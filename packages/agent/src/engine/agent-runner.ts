/**
 * @steward/agents - Pure Tool / Agent Loop Runner
 */

import type {
  AIEngine,
  AssistantMessage,
  InferenceRequest,
  Message,
  ModelSelection,
  ReasoningEffort,
  TokenUsage,
  ToolCallContent,
  ToolSpec,
} from '@steward/ai';
import { SAFETY_STEP_CEILING } from './constants.js';
import type { AgentEventListener } from './events.js';
import type { ToolResultInfo, TurnStopReason, TurnSummary } from './types.js';

export interface AgentTurnCallbacks {
  beforeToolUse?: (params: {
    toolCallId: string;
    toolName: string;
    toolInput: Record<string, unknown>;
  }) => Promise<{ blocked: boolean; reason?: string }>;

  afterToolUse?: (params: {
    toolCallId: string;
    toolName: string;
    toolInput: Record<string, unknown>;
    toolOutput: unknown;
    isError: boolean;
    durationMs: number;
  }) => Promise<{ context?: string[] }>;

  toolUseFailure?: (params: {
    toolCallId: string;
    toolName: string;
    toolInput: Record<string, unknown>;
    error: string;
    durationMs: number;
  }) => Promise<{ context?: string[] }>;

  agentStop?: (params: {
    stopReason: string;
    finishReason: string;
    assistantText: string;
    stopHookActive: boolean;
  }) => Promise<{ blocked: boolean; reason?: string }>;
}

export interface RunAgentTurnOptions {
  ai: AIEngine;
  model: ModelSelection;
  messages: Message[];
  instructions?: string;
  tools?: readonly ToolSpec[];
  toolExecutor?: (call: ToolCallContent) => Promise<ToolResultInfo>;
  callbacks?: AgentTurnCallbacks;
  maxSteps?: number;
  temperature?: number;
  reasoningEffort?: ReasoningEffort;
  abortSignal?: AbortSignal;
  onEvent?: AgentEventListener;
}

export { SAFETY_STEP_CEILING };

function classifyStopReason(hitStepCeiling: boolean, wasAborted: boolean): TurnStopReason {
  if (wasAborted) return 'aborted';
  if (hitStepCeiling) return 'step-limit';
  return 'natural';
}

/**
 * Runs a multi-step agent turn using @steward/ai without external AI SDK dependencies.
 */
export async function runAgentTurn(options: RunAgentTurnOptions): Promise<TurnSummary> {
  const maxSteps = options.maxSteps ?? SAFETY_STEP_CEILING;
  const toolResults: ToolResultInfo[] = [];
  const turnStartedAt = new Date().toISOString();
  const turnStartMonotonic = performance.now();

  let baseInstructions = options.instructions ?? '';
  let pendingStepContext: string[] = [];
  let stopHookContinuations = 0;

  const activeMessages: Message[] = [...options.messages];
  if (baseInstructions) {
    activeMessages.unshift({ role: 'system', content: baseInstructions });
  }

  const accumulatedUsage: TokenUsage = {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    reasoningTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
  };

  let accumulatedText = '';
  let accumulatedReasoning = '';
  let stepIndex = 0;
  let finalFinishReason = 'stop';
  const newTurnMessages: Message[] = [];

  try {
    while (stepIndex < maxSteps) {
      if (options.abortSignal?.aborted) {
        break;
      }

      // Inject ephemeral hook context into the system instructions if present
      if (pendingStepContext.length > 0) {
        const extraSection = '\n\n[Hook Context]\n' + pendingStepContext.join('\n');
        pendingStepContext = [];

        const systemMsgIdx = activeMessages.findIndex((m) => m.role === 'system');
        if (systemMsgIdx >= 0) {
          const currentSys = activeMessages[systemMsgIdx]!;
          const currentContent =
            typeof currentSys.content === 'string'
              ? currentSys.content
              : Array.isArray(currentSys.content)
                ? currentSys.content
                    .filter((c: any) => c.type === 'text')
                    .map((c: any) => c.text)
                    .join('\n')
                : '';
          activeMessages[systemMsgIdx] = {
            role: 'system',
            content: currentContent + extraSection,
          };
        } else {
          activeMessages.unshift({
            role: 'system',
            content: extraSection.trim(),
          });
        }
      }

      const inferenceRequest: InferenceRequest = {
        model: {
          ...options.model,
          effort: options.reasoningEffort ?? options.model.effort ?? 'medium',
        },
        messages: activeMessages,
        tools: options.tools,
        temperature: options.temperature,
        abortSignal: options.abortSignal,
      };

      const stream = options.ai.stream(inferenceRequest);
      const stepToolCalls: ToolCallContent[] = [];

      for await (const event of stream) {
        if (options.abortSignal?.aborted) {
          break;
        }

        switch (event.type) {
          case 'text-delta': {
            accumulatedText += event.delta;
            options.onEvent?.({
              type: 'text-delta',
              text: event.delta,
            });
            break;
          }

          case 'reasoning-delta': {
            accumulatedReasoning += event.delta;
            options.onEvent?.({
              type: 'reasoning-delta',
              reasoning: event.delta,
            });
            break;
          }

          case 'tool-call-start': {
            break;
          }

          case 'tool-call-delta': {
            break;
          }

          case 'tool-call-end': {
            stepToolCalls.push(event.toolCall);
            options.onEvent?.({
              type: 'tool-call',
              toolCall: {
                id: event.toolCall.id,
                name: event.toolCall.name,
                args: event.toolCall.arguments,
              },
            });
            break;
          }

          case 'error': {
            options.onEvent?.({
              type: 'error',
              error: event.error,
              isFatal: false,
            });
            throw event.error;
          }
        }
      }

      const stepResult = await stream.result();
      finalFinishReason = stepResult.finishReason;

      // Accumulate usage
      accumulatedUsage.inputTokens += stepResult.usage.inputTokens;
      accumulatedUsage.outputTokens += stepResult.usage.outputTokens;
      accumulatedUsage.totalTokens += stepResult.usage.totalTokens;
      if (stepResult.usage.reasoningTokens) {
        accumulatedUsage.reasoningTokens =
          (accumulatedUsage.reasoningTokens ?? 0) + stepResult.usage.reasoningTokens;
      }
      if (stepResult.usage.cacheReadTokens) {
        accumulatedUsage.cacheReadTokens =
          (accumulatedUsage.cacheReadTokens ?? 0) + stepResult.usage.cacheReadTokens;
      }
      if (stepResult.usage.cacheWriteTokens) {
        accumulatedUsage.cacheWriteTokens =
          (accumulatedUsage.cacheWriteTokens ?? 0) + stepResult.usage.cacheWriteTokens;
      }

      // Append assistant message to history
      activeMessages.push(stepResult.message);
      newTurnMessages.push(stepResult.message);

      stepIndex++;
      options.onEvent?.({
        type: 'step-end',
        stepIndex,
        usage: stepResult.usage,
      });

      // If no tool calls, check AgentStop hook before natural finish
      if (stepToolCalls.length === 0) {
        if (
          options.callbacks?.agentStop &&
          !options.abortSignal?.aborted &&
          stopHookContinuations === 0
        ) {
          const stopOutcome = await options.callbacks.agentStop({
            stopReason: 'natural',
            finishReason: finalFinishReason,
            assistantText: accumulatedText,
            stopHookActive: false,
          });

          if (stopOutcome.blocked && stopHookContinuations === 0 && stepIndex < maxSteps) {
            stopHookContinuations++;
            const retryGuidance =
              stopOutcome.reason || 'AgentStop requested continuation. Please continue your turn.';
            pendingStepContext.push(`[AgentStop Continuation]\n${retryGuidance}`);
            continue;
          }
        }
        break;
      }

      // Execute tool calls sequentially in model order
      const toolResultsForStep: Array<{
        type: 'tool-result';
        toolCallId: string;
        toolName: string;
        output: any;
        isError?: boolean;
      }> = [];

      for (const call of stepToolCalls) {
        if (options.abortSignal?.aborted) {
          break;
        }

        // 1. BeforeToolUse hook check
        let isBlocked = false;
        let blockReason: string | undefined;

        if (options.callbacks?.beforeToolUse) {
          const beforeRes = await options.callbacks.beforeToolUse({
            toolCallId: call.id,
            toolName: call.name,
            toolInput: (call.arguments ?? {}) as Record<string, unknown>,
          });
          if (beforeRes.blocked) {
            isBlocked = true;
            blockReason = beforeRes.reason || `Tool execution blocked by hook.`;
          }
        }

        if (isBlocked) {
          // Tool was blocked before execution: emit error-shaped tool result without running ToolUseFailure
          const blockedResultInfo: ToolResultInfo = {
            id: call.id,
            name: call.name,
            args: call.arguments,
            result: `Tool "${call.name}" blocked: ${blockReason}`,
            isError: true,
            durationMs: 0,
            startedAt: new Date().toISOString(),
            finishedAt: new Date().toISOString(),
          };

          toolResults.push(blockedResultInfo);
          options.onEvent?.({
            type: 'tool-result',
            toolResult: blockedResultInfo,
          });

          toolResultsForStep.push({
            type: 'tool-result',
            toolCallId: call.id,
            toolName: call.name,
            output: blockedResultInfo.result,
            isError: true,
          });
          continue;
        }

        // 2. Execute tool
        if (options.toolExecutor) {
          const resultInfo = await options.toolExecutor(call);
          toolResults.push(resultInfo);
          options.onEvent?.({
            type: 'tool-result',
            toolResult: resultInfo,
          });

          toolResultsForStep.push({
            type: 'tool-result',
            toolCallId: call.id,
            toolName: call.name,
            output: resultInfo.result,
            isError: resultInfo.isError,
          });

          // 3. AfterToolUse or ToolUseFailure hooks
          if (resultInfo.isError) {
            if (options.callbacks?.toolUseFailure) {
              const errorText =
                typeof resultInfo.result === 'object' && resultInfo.result !== null
                  ? JSON.stringify(resultInfo.result)
                  : String(resultInfo.result);

              const failureRes = await options.callbacks.toolUseFailure({
                toolCallId: call.id,
                toolName: call.name,
                toolInput: (call.arguments ?? {}) as Record<string, unknown>,
                error: errorText,
                durationMs: resultInfo.durationMs ?? 0,
              });

              if (failureRes?.context && failureRes.context.length > 0) {
                pendingStepContext.push(...failureRes.context);
              }
            }
          } else {
            if (options.callbacks?.afterToolUse) {
              const afterRes = await options.callbacks.afterToolUse({
                toolCallId: call.id,
                toolName: call.name,
                toolInput: (call.arguments ?? {}) as Record<string, unknown>,
                toolOutput: resultInfo.result,
                isError: false,
                durationMs: resultInfo.durationMs ?? 0,
              });

              if (afterRes?.context && afterRes.context.length > 0) {
                pendingStepContext.push(...afterRes.context);
              }
            }
          }
        }
      }

      // Append tool result message
      if (toolResultsForStep.length > 0) {
        const toolMsg: Message = {
          role: 'tool',
          content: toolResultsForStep,
        };
        activeMessages.push(toolMsg);
        newTurnMessages.push(toolMsg);
      }
    }

    const hitStepCeiling = stepIndex >= maxSteps;
    const wasAborted = Boolean(options.abortSignal?.aborted);
    const stopReason = classifyStopReason(hitStepCeiling, wasAborted);

    const turnFinishedAt = new Date().toISOString();
    const turnDurationMs = Math.max(0, Math.round(performance.now() - turnStartMonotonic));

    const summary: TurnSummary = {
      text: accumulatedText,
      reasoning: accumulatedReasoning || undefined,
      toolCalls: toolResults,
      usage: accumulatedUsage,
      finishReason: finalFinishReason,
      stopReason,
      rawMessages: newTurnMessages,
      durationMs: turnDurationMs,
      startedAt: turnStartedAt,
      finishedAt: turnFinishedAt,
    };

    options.onEvent?.({
      type: 'turn-complete',
      summary,
    });

    return summary;
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    options.onEvent?.({
      type: 'error',
      error,
      isFatal: true,
    });
    throw error;
  }
}
