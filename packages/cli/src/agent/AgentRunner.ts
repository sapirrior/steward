import { streamText, isStepCount, type LanguageModel } from 'ai';
import type { ModelMessage, ThreadUsage } from '@steward/threads';
import { ProviderRegistry } from './providers/ProviderRegistry.js';
import { adaptTools } from './tools/toolAdapter.js';
import { executeWithRetry } from './retry/RetryEngine.js';
import { normalizeAgentError } from './errors/errorNormalizer.js';
import { AgentError } from './errors/AgentError.js';
import type {
  AgentEvent,
  AgentFinishReason,
  AgentRunOptions,
  AgentRunResult,
  AgentStepStartEvent,
  AgentStepEndEvent,
  AgentTextDeltaEvent,
  AgentReasoningDeltaEvent,
  AgentFinishEvent,
  AgentErrorEvent,
} from './types.js';

export class AgentRunner {
  private readonly registry: ProviderRegistry;

  constructor(registry?: ProviderRegistry) {
    this.registry = registry ?? new ProviderRegistry();
  }

  /**
   * Access the underlying provider registry to register new providers or inspect existing ones.
   */
  getProviderRegistry(): ProviderRegistry {
    return this.registry;
  }

  /**
   * Executes an agent turn, streaming structured events via AsyncGenerator and optional callback.
   */
  async *runStream(
    options: AgentRunOptions,
    onEvent?: (event: AgentEvent) => void,
  ): AsyncGenerator<AgentEvent, AgentRunResult, void> {
    const emit = (event: AgentEvent) => {
      onEvent?.(event);
      return event;
    };

    let resolvedModel: LanguageModel;
    let effectiveModelRef = options.modelRef;

    try {
      const resolved = await this.registry.resolve(options.modelRef, {
        signal: options.signal,
      });
      resolvedModel = resolved.model;
      effectiveModelRef = resolved.ref;
    } catch (err: unknown) {
      if (options.fallbackModelRef) {
        try {
          const fallbackResolved = await this.registry.resolve(options.fallbackModelRef, {
            signal: options.signal,
          });
          resolvedModel = fallbackResolved.model;
          effectiveModelRef = fallbackResolved.ref;
        } catch (fallbackErr: unknown) {
          const normErr = normalizeAgentError(err, {
            modelRef: options.modelRef,
            signal: options.signal,
          });
          const errEvent: AgentErrorEvent = { type: 'error', error: normErr };
          yield emit(errEvent);
          return {
            responseMessages: [],
            usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
            finishReason: 'error',
            error: normErr,
          };
        }
      } else {
        const normErr = normalizeAgentError(err, {
          modelRef: options.modelRef,
          signal: options.signal,
        });
        const errEvent: AgentErrorEvent = { type: 'error', error: normErr };
        yield emit(errEvent);
        return {
          responseMessages: [],
          usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
          finishReason: 'error',
          error: normErr,
        };
      }
    }

    // Build instructions combining static system prompt and dynamic runtime context
    const instructionsParts: string[] = [];
    if (options.systemPrompt) {
      instructionsParts.push(options.systemPrompt.trim());
    }
    if (options.runtimeContext) {
      instructionsParts.push(
        `\n<runtime_context>\n${options.runtimeContext.trim()}\n</runtime_context>`,
      );
    }
    const instructions = instructionsParts.join('\n\n') || undefined;

    // Adapt tools with event emission
    const tools = options.tools
      ? adaptTools(options.tools, {
          onToolStart: (e) => {
            onEvent?.(e);
          },
          onToolResult: (e) => {
            onEvent?.(e);
          },
        })
      : undefined;

    const maxSteps = options.maxSteps ?? 50;

    // Normalizing reasoning option for AI SDK v7
    const reasoningSetting =
      options.reasoning === 'none'
        ? 'none'
        : typeof options.reasoning === 'string'
          ? (options.reasoning as any)
          : undefined;

    try {
      const runnerFn = async (_attempt: number) => {
        return streamText({
          model: resolvedModel,
          instructions,
          messages: options.messages as any,
          tools,
          stopWhen: isStepCount(maxSteps),
          reasoning: reasoningSetting,
          abortSignal: options.signal,
        });
      };

      const resultStream = await executeWithRetry({
        fn: runnerFn,
        policy: options.retry,
        modelRef: effectiveModelRef,
        signal: options.signal,
        onRetry: (retryEvent) => {
          onEvent?.(retryEvent);
        },
      });

      let currentStepIndex = 1;
      let finalFinishReason: AgentFinishReason = 'stop';

      // Stream each part from the active streamText result
      for await (const part of resultStream.stream) {
        if (options.signal?.aborted) {
          throw new AgentError({
            code: 'ABORTED',
            message: 'Operation canceled by user.',
            retryable: false,
          });
        }

        switch (part.type) {
          case 'start-step': {
            const startEvent: AgentStepStartEvent = {
              type: 'step-start',
              stepIndex: currentStepIndex,
              timestamp: Date.now(),
            };
            yield emit(startEvent);
            break;
          }

          case 'reasoning-delta': {
            const reasoningEvent: AgentReasoningDeltaEvent = {
              type: 'reasoning-delta',
              text: (part as { text?: string }).text || '',
            };
            yield emit(reasoningEvent);
            break;
          }

          case 'text-delta': {
            const textEvent: AgentTextDeltaEvent = {
              type: 'text-delta',
              text: (part as { text?: string }).text || '',
            };
            yield emit(textEvent);
            break;
          }

          case 'finish-step': {
            const stepUsage = (part as any).usage
              ? {
                  inputTokens: (part as any).usage.inputTokens ?? 0,
                  outputTokens: (part as any).usage.outputTokens ?? 0,
                  totalTokens: (part as any).usage.totalTokens ?? 0,
                  reasoningTokens: (part as any).usage.outputTokenDetails?.reasoningTokens,
                  cacheReadTokens: (part as any).usage.inputTokenDetails?.cacheReadTokens,
                  cacheWriteTokens: (part as any).usage.inputTokenDetails?.cacheWriteTokens,
                }
              : undefined;

            const endEvent: AgentStepEndEvent = {
              type: 'step-end',
              stepIndex: currentStepIndex,
              usage: stepUsage,
            };
            yield emit(endEvent);
            currentStepIndex++;
            break;
          }

          case 'finish': {
            const reason = (part as { finishReason?: string }).finishReason;
            if (reason === 'tool-calls') {
              finalFinishReason = 'tool-calls';
            } else if (currentStepIndex > maxSteps) {
              finalFinishReason = 'max-steps';
            } else {
              finalFinishReason = 'stop';
            }
            break;
          }

          case 'error': {
            const norm = normalizeAgentError((part as { error?: unknown }).error, {
              modelRef: effectiveModelRef,
              signal: options.signal,
            });
            const errEv: AgentErrorEvent = { type: 'error', error: norm };
            yield emit(errEv);
            break;
          }
        }
      }

      const [responseMessages, rawUsage] = await Promise.all([
        resultStream.responseMessages,
        resultStream.usage,
      ]);

      const usage: ThreadUsage = {
        inputTokens: rawUsage.inputTokens ?? 0,
        outputTokens: rawUsage.outputTokens ?? 0,
        totalTokens: rawUsage.totalTokens ?? 0,
        reasoningTokens: rawUsage.outputTokenDetails?.reasoningTokens,
        cacheReadTokens: rawUsage.inputTokenDetails?.cacheReadTokens,
        cacheWriteTokens: rawUsage.inputTokenDetails?.cacheWriteTokens,
      };

      const finishEvent: AgentFinishEvent = {
        type: 'finish',
        responseMessages: responseMessages as ModelMessage[],
        usage,
        finishReason: finalFinishReason,
      };

      yield emit(finishEvent);

      return {
        responseMessages: responseMessages as ModelMessage[],
        usage,
        finishReason: finalFinishReason,
      };
    } catch (err: unknown) {
      const normErr = normalizeAgentError(err, {
        modelRef: effectiveModelRef,
        signal: options.signal,
      });

      const errEvent: AgentErrorEvent = { type: 'error', error: normErr };
      yield emit(errEvent);

      return {
        responseMessages: [],
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        finishReason: normErr.code === 'ABORTED' ? 'aborted' : 'error',
        error: normErr,
      };
    }
  }
}
