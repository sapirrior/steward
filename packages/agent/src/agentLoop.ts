/**
 * @steward/agent - Generic Multi-Step Agent Execution Loop
 *
 * Implements a pure, deterministic multi-step agent turn loop with zero application
 * logic or framework dependencies.
 *
 * Production Guarantees (inspired by reference query engine patterns):
 * 1. Sequential tool execution in model order.
 * 2. Incomplete tool-call filtering on abort or mid-stream error (preventing orphaned calls).
 * 3. 1:1 tool-call to tool-result pairing invariant (all unexecuted calls receive synthetic error results).
 * 4. Resilient event dispatch (listener exceptions are caught and never crash the turn).
 * 5. Accurate step-limit vs natural stop reason classification.
 * 6. Precise multi-step token usage accumulation.
 */

import type {
  AgentRunResult,
  AgentRunStopReason,
  AssistantContent,
  AssistantMessage,
  Message,
  ReasoningEffort,
  StreamError,
  StreamFn,
  StreamRequest,
  TokenUsage,
  ToolCallContent,
  ToolResult,
  ToolResultContent,
  ToolSpec,
} from './types.js';
import type { AgentEventListener } from './events.js';

export interface RunAgentLoopOptions {
  messages: Message[];
  stream: StreamFn;
  tools?: readonly ToolSpec[];
  executeTool: (call: ToolCallContent, signal: AbortSignal) => Promise<ToolResult>;
  maxSteps?: number;
  effort?: ReasoningEffort;
  temperature?: number;
  signal?: AbortSignal;
  onEvent?: AgentEventListener;
}

export const DEFAULT_SAFETY_STEP_CEILING = 50;

/**
 * Pure helper to accumulate token usage metrics safely across multiple steps.
 */
export function accumulateTokenUsage(current: TokenUsage, delta?: TokenUsage): TokenUsage {
  if (!delta) return { ...current };
  const input = (current.input ?? 0) + (delta.input ?? 0);
  const output = (current.output ?? 0) + (delta.output ?? 0);
  const total = (current.total ?? 0) + (delta.total ?? input + output);
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
  };
}

/**
 * Filters out uncompleted or orphaned tool-call content blocks from an assistant message.
 */
export function sanitizeAssistantMessage(
  message: AssistantMessage,
  completedCallIds: Set<string>,
): AssistantMessage {
  const filteredContent = message.content.filter((block) => {
    if (block.type !== 'tool-call') return true;
    return completedCallIds.has(block.id);
  });
  return {
    ...message,
    content: filteredContent,
  };
}

/**
 * Executes a deterministic multi-step agent turn loop.
 */
export async function runAgentLoop(options: RunAgentLoopOptions): Promise<AgentRunResult> {
  const maxSteps = options.maxSteps ?? DEFAULT_SAFETY_STEP_CEILING;
  const startedAt = new Date().toISOString();
  const startMonotonic = performance.now();

  const activeMessages: Message[] = [...options.messages];
  const newMessages: Message[] = [];
  const allToolResults: ToolResult[] = [];

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
  let finalFinishReason = 'stop';
  let stopReason: AgentRunStopReason = 'natural';
  let loopError: StreamError | undefined;

  // Resilient event dispatch wrapper
  const emit = (event: Parameters<AgentEventListener>[0]) => {
    if (!options.onEvent) return;
    try {
      options.onEvent(event);
    } catch {
      // Catch listener exceptions so UI crashes never abort the agent loop
    }
  };

  emit({ type: 'agent-start' });

  let step = 0;

  try {
    while (step < maxSteps) {
      if (options.signal?.aborted) {
        stopReason = 'aborted';
        break;
      }

      step++;
      emit({ type: 'turn-start', step });

      const request: StreamRequest = {
        messages: activeMessages,
        tools: options.tools,
        effort: options.effort,
        temperature: options.temperature,
        abortSignal: options.signal,
      };

      const stream = options.stream(request);
      const stepToolCalls: ToolCallContent[] = [];
      const completedCallIds = new Set<string>();

      // Track incremental assistant message during this step
      let currentAssistantMessage: AssistantMessage = {
        role: 'assistant',
        content: [],
      };

      emit({ type: 'message-start', message: currentAssistantMessage });

      for await (const event of stream) {
        if (options.signal?.aborted) {
          stopReason = 'aborted';
          break;
        }

        switch (event.type) {
          case 'text-delta': {
            accumulatedText += event.delta;
            emit({
              type: 'message-update',
              message: currentAssistantMessage,
              streamEvent: event,
            });
            break;
          }

          case 'reasoning-delta': {
            accumulatedReasoning += event.delta;
            emit({
              type: 'message-update',
              message: currentAssistantMessage,
              streamEvent: event,
            });
            break;
          }

          case 'tool-call-start':
          case 'tool-call-delta': {
            emit({
              type: 'message-update',
              message: currentAssistantMessage,
              streamEvent: event,
            });
            break;
          }

          case 'tool-call-end': {
            stepToolCalls.push(event.toolCall);
            completedCallIds.add(event.toolCall.id);
            emit({
              type: 'message-update',
              message: currentAssistantMessage,
              streamEvent: event,
            });
            break;
          }

          case 'retry': {
            emit({
              type: 'retry',
              attempt: event.attempt,
              maxAttempts: event.maxAttempts,
              delayMs: event.delayMs,
              error: event.error,
            });
            break;
          }

          case 'error': {
            // Error stream event handled upon stream.result()
            break;
          }
        }
      }

      const streamResult = await stream.result();
      finalFinishReason = streamResult.finishReason;
      accumulatedUsage = accumulateTokenUsage(accumulatedUsage, streamResult.usage);

      // Handle stream-level error
      if (streamResult.error) {
        loopError = streamResult.error;
        const isAbort = streamResult.error.code === 'aborted' || Boolean(options.signal?.aborted);
        stopReason = isAbort ? 'aborted' : 'error';

        // Sanitize partial assistant message to remove incomplete tool-call blocks
        const sanitized = sanitizeAssistantMessage(streamResult.message, completedCallIds);
        if (sanitized.content.length > 0) {
          activeMessages.push(sanitized);
          newMessages.push(sanitized);
          emit({ type: 'message-end', message: sanitized });
        }
        break;
      }

      // Sanitize assistant message to ensure only completed tool calls are preserved
      const assistantMessage = sanitizeAssistantMessage(streamResult.message, completedCallIds);

      activeMessages.push(assistantMessage);
      newMessages.push(assistantMessage);
      emit({ type: 'message-end', message: assistantMessage });

      // If no tool calls requested, the turn concludes naturally
      if (stepToolCalls.length === 0) {
        stopReason = 'natural';
        emit({
          type: 'turn-end',
          message: assistantMessage,
          toolResults: [],
          usage: streamResult.usage,
        });
        break;
      }

      // Check if we hit the step limit while the model still requested tool calls
      if (step >= maxSteps) {
        stopReason = 'step-limit';
        emit({
          type: 'turn-end',
          message: assistantMessage,
          toolResults: [],
          usage: streamResult.usage,
        });
        break;
      }

      // Execute tool calls sequentially in model order
      const stepToolResults: ToolResult[] = [];
      const toolResultContents: ToolResultContent[] = [];

      for (let i = 0; i < stepToolCalls.length; i++) {
        const call = stepToolCalls[i]!;

        // If turn was aborted before/during tool execution, synthesize error results
        if (options.signal?.aborted) {
          stopReason = 'aborted';
          const abortedResult: ToolResult = {
            id: call.id,
            name: call.name,
            args: call.arguments,
            result: 'Aborted by user',
            isError: true,
            durationMs: 0,
            startedAt: new Date().toISOString(),
            finishedAt: new Date().toISOString(),
          };

          stepToolResults.push(abortedResult);
          allToolResults.push(abortedResult);
          toolResultContents.push({
            type: 'tool-result',
            toolCallId: call.id,
            toolName: call.name,
            output: 'Aborted by user',
            isError: true,
          });

          emit({
            type: 'tool-execution-end',
            toolCall: call,
            result: abortedResult,
          });
          continue;
        }

        emit({ type: 'tool-execution-start', toolCall: call });

        let result: ToolResult;
        try {
          result = await options.executeTool(call, options.signal ?? new AbortController().signal);
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          result = {
            id: call.id,
            name: call.name,
            args: call.arguments,
            result: errMsg,
            isError: true,
            durationMs: 0,
            startedAt: new Date().toISOString(),
            finishedAt: new Date().toISOString(),
          };
        }

        stepToolResults.push(result);
        allToolResults.push(result);
        toolResultContents.push({
          type: 'tool-result',
          toolCallId: call.id,
          toolName: call.name,
          output: result.result as any,
          isError: result.isError,
        });

        emit({
          type: 'tool-execution-end',
          toolCall: call,
          result,
        });
      }

      // Append tool message to conversation history with 1:1 pairing
      const toolMessage: Message = {
        role: 'tool',
        content: toolResultContents,
      };

      activeMessages.push(toolMessage);
      newMessages.push(toolMessage);

      emit({
        type: 'turn-end',
        message: assistantMessage,
        toolResults: stepToolResults,
        usage: streamResult.usage,
      });

      if (options.signal?.aborted) {
        stopReason = 'aborted';
        break;
      }
    }
  } catch (err) {
    const errObj = err instanceof Error ? err : new Error(String(err));
    const wasAborted = Boolean(options.signal?.aborted);
    stopReason = wasAborted ? 'aborted' : 'error';
    loopError = {
      name: errObj.name,
      message: errObj.message,
      code: wasAborted ? 'aborted' : 'unknown',
    };
  }

  const finishedAt = new Date().toISOString();
  const durationMs = Math.max(0, Math.round(performance.now() - startMonotonic));

  const result: AgentRunResult = {
    newMessages,
    stopReason,
    usage: accumulatedUsage,
    finishReason: finalFinishReason,
    error: loopError,
    durationMs,
    startedAt,
    finishedAt,
    text: accumulatedText,
    reasoning: accumulatedReasoning || undefined,
    toolResults: allToolResults,
  };

  emit({ type: 'agent-end', result });

  return result;
}
