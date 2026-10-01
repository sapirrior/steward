/**
 * @steward/agent - Pure Tool / Agent Loop Runner
 */

import type {
  AI,
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

export interface RunAgentTurnOptions {
  ai: AI;
  model: ModelSelection;
  messages: Message[];
  instructions?: string;
  tools?: readonly ToolSpec[];
  toolExecutor?: (call: ToolCallContent) => Promise<ToolResultInfo>;
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
 * Pure helper to accumulate token usage metrics safely.
 */
export function accumulateTokenUsage(current: TokenUsage, delta?: TokenUsage): TokenUsage {
  if (!delta) return { ...current };
  const input = (current.input ?? 0) + (delta.input ?? 0);
  const output = (current.output ?? 0) + (delta.output ?? 0);
  const total = (current.total ?? 0) + (delta.total ?? (input + output));
  return {
    input,
    output,
    total,
    reasoning:
      delta.reasoning !== undefined
        ? (current.reasoning ?? 0) + delta.reasoning
        : current.reasoning,
    cacheRead:
      delta.cacheRead !== undefined
        ? (current.cacheRead ?? 0) + delta.cacheRead
        : current.cacheRead,
    cacheWrite:
      delta.cacheWrite !== undefined
        ? (current.cacheWrite ?? 0) + delta.cacheWrite
        : current.cacheWrite,
    cost: delta.cost,
  };
}

/**
 * Runs a deterministic multi-step agent turn using @steward/ai without external AI SDK dependencies.
 */
export async function runAgentTurn(options: RunAgentTurnOptions): Promise<TurnSummary> {
  const maxSteps = options.maxSteps ?? SAFETY_STEP_CEILING;
  const toolResults: ToolResultInfo[] = [];
  const turnStartedAt = new Date().toISOString();
  const turnStartMonotonic = performance.now();

  const baseInstructions = options.instructions ?? '';
  const activeMessages: Message[] = [...options.messages];
  if (baseInstructions) {
    activeMessages.unshift({ role: 'system', content: baseInstructions });
  }

  let accumulatedUsage: TokenUsage = {
    input: 0,
    output: 0,
    total: 0,
    reasoning: 0,
    cacheRead: 0,
    cacheWrite: 0,
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
            break;
          }
        }
      }

      const stepResult = await stream.result();
      finalFinishReason = stepResult.finishReason;
      accumulatedUsage = accumulateTokenUsage(accumulatedUsage, stepResult.usage);

      // If step ended with error, record partial message if present and throw / break cleanly
      if (stepResult.finishReason === 'error' && stepResult.error) {
        if (stepResult.message.content.length > 0) {
          activeMessages.push(stepResult.message);
          newTurnMessages.push(stepResult.message);
        }
        throw stepResult.error;
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

      // If no tool calls, turn finishes naturally
      if (stepToolCalls.length === 0) {
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
        }
      }

      // Append tool result message to conversation history
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
