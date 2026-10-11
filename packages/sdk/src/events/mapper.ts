import type { LanguageModelUsage, TextStreamPart, ToolSet } from 'ai';
import type { SDKEvent, SDKUsage } from './events.js';

export function normalizeUsage(usage?: LanguageModelUsage): SDKUsage {
  if (!usage) {
    return {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
    };
  }

  return {
    inputTokens: usage.inputTokens ?? 0,
    outputTokens: usage.outputTokens ?? 0,
    totalTokens: usage.totalTokens ?? 0,
    reasoningTokens: (usage as any).outputTokenDetails?.reasoningTokens,
    cacheReadTokens: (usage as any).inputTokenDetails?.cacheReadTokens,
    cacheWriteTokens: (usage as any).inputTokenDetails?.cacheWriteTokens,
  };
}

/**
 * Maps an AI SDK TextStreamPart into zero, one, or more SDKEvents.
 * Note: Terminal events ('finish', 'aborted', 'error') are emitted
 * with full authoritative response metadata by the SDK engine.
 */
export function mapStreamPartToEvent<TOOLS extends ToolSet>(
  part: TextStreamPart<TOOLS>,
  stepIndex: number
): SDKEvent | null {
  switch (part.type) {
    case 'text-delta':
      return {
        type: 'text-delta',
        text: (part as any).text ?? (part as any).delta ?? '',
        id: (part as any).id,
      };

    case 'reasoning-delta':
      return {
        type: 'reasoning-delta',
        text: (part as any).text ?? (part as any).delta ?? '',
        id: (part as any).id,
      };

    case 'tool-input-start':
      return {
        type: 'tool-input-start',
        toolCallId: (part as any).id ?? (part as any).toolCallId ?? '',
        toolName: (part as any).toolName,
      };

    case 'tool-input-delta':
      return {
        type: 'tool-input-delta',
        toolCallId: (part as any).id ?? (part as any).toolCallId ?? '',
        delta: (part as any).delta ?? '',
      };

    case 'tool-call':
      return {
        type: 'tool-call',
        toolCallId: (part as any).toolCallId,
        toolName: (part as any).toolName,
        input: (part as any).input ?? (part as any).args,
      };

    case 'tool-result':
      return {
        type: 'tool-result',
        toolCallId: (part as any).toolCallId,
        toolName: (part as any).toolName,
        output: (part as any).output ?? (part as any).result,
        isError: (part as any).isError ?? false,
      };

    case 'start-step':
      return {
        type: 'step-start',
        stepIndex,
        timestamp: Date.now(),
      };

    case 'finish-step':
      return {
        type: 'step-finish',
        stepIndex,
        finishReason: (part as any).finishReason,
        usage: (part as any).usage ? normalizeUsage((part as any).usage) : undefined,
      };

    default:
      // Other parts (files, sources, etc.) can be passed or ignored as intermediate telemetry
      return null;
  }
}
