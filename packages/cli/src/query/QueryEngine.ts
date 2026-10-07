import { runAgentLoop } from '@steward/agent';
import type { AI, Message, ModelSelection, PortError, ToolSpec } from '@steward/ai';
import type { ToolContext } from '../tools/types.js';
import { executeToolCall } from './toolRunner.js';
import type { AgentEventListener, AgentTurnEvent, TurnSummary } from './types.js';

export interface RunQueryTurnOptions {
  ai: AI;
  model: ModelSelection;
  messages: Message[];
  instructions?: string;
  tools?: readonly ToolSpec[];
  toolContext: ToolContext;
  maxSteps?: number;
  temperature?: number;
  abortSignal?: AbortSignal;
  onEvent?: AgentEventListener;
}

export async function runQueryTurn(options: RunQueryTurnOptions): Promise<TurnSummary> {
  const activeMessages: Message[] = [...options.messages];
  if (options.instructions) {
    activeMessages.unshift({ role: 'system', content: options.instructions });
  }

  let stepCounter = 0;

  const loopResult = await runAgentLoop({
    messages: activeMessages,
    stream: (req) =>
      options.ai.stream({
        model: options.model,
        messages: req.messages as any,
        tools: req.tools as any,
        temperature: options.temperature,
        effort: options.model.effort,
        abortSignal: options.abortSignal,
      }),
    tools: options.tools as any,
    executeTool: async (call) => {
      return await executeToolCall(call, options.toolContext);
    },
    maxSteps: options.maxSteps,
    effort: options.model.effort,
    temperature: options.temperature,
    signal: options.abortSignal,
    onEvent: (event) => {
      if (!options.onEvent) return;
      switch (event.type) {
        case 'turn-start':
          stepCounter = event.step;
          break;
        case 'message-update':
          if (event.streamEvent.type === 'text-delta') {
            options.onEvent({
              type: 'text-delta',
              text: event.streamEvent.delta,
            });
          } else if (event.streamEvent.type === 'reasoning-delta') {
            options.onEvent({
              type: 'reasoning-delta',
              reasoning: event.streamEvent.delta,
            });
          } else if (event.streamEvent.type === 'tool-call-end') {
            options.onEvent({
              type: 'tool-call',
              toolCall: {
                id: event.streamEvent.toolCall.id,
                name: event.streamEvent.toolCall.name,
                args: event.streamEvent.toolCall.arguments,
              },
            });
          }
          break;
        case 'retry':
          options.onEvent({
            type: 'retry',
            attempt: event.attempt,
            maxAttempts: event.maxAttempts,
            delayMs: event.delayMs,
            error: event.error as any,
          });
          break;
        case 'tool-execution-end':
          options.onEvent({
            type: 'tool-result',
            toolResult: {
              id: event.result.id,
              name: event.result.name,
              args: event.result.args,
              result: event.result.result,
              isError: event.result.isError,
              durationMs: event.result.durationMs,
              startedAt: event.result.startedAt,
              finishedAt: event.result.finishedAt,
            },
          });
          break;
        case 'turn-end':
          options.onEvent({
            type: 'step-end',
            stepIndex: stepCounter,
            usage: event.usage,
          });
          break;
      }
    },
  });

  const error: PortError | undefined = loopResult.error
    ? {
        name: loopResult.error.name,
        message: loopResult.error.message,
        code: (loopResult.error.code as any) ?? 'unknown',
      }
    : undefined;

  const summary: TurnSummary = {
    text: loopResult.text,
    reasoning: loopResult.reasoning,
    toolCalls: loopResult.toolResults.map((r) => ({
      id: r.id,
      name: r.name,
      args: r.args,
      result: r.result,
      isError: r.isError,
      durationMs: r.durationMs,
      startedAt: r.startedAt,
      finishedAt: r.finishedAt,
    })),
    usage: loopResult.usage,
    finishReason: loopResult.finishReason,
    stopReason: loopResult.stopReason,
    error,
    rawMessages: loopResult.newMessages as Message[],
    durationMs: loopResult.durationMs,
    startedAt: loopResult.startedAt,
    finishedAt: loopResult.finishedAt,
  };

  options.onEvent?.({
    type: 'turn-complete',
    summary,
  });

  return summary;
}
