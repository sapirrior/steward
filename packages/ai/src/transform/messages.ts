/**
 * @steward/ai - Cross-Model Message Normalization & Transformation Layer
 *
 * Rules:
 * 1. isSameModel: checks provider, protocol, and modelId against assistant.meta.
 *    No meta => treated as foreign (safe default for loaded legacy sessions).
 * 2. Thinking blocks:
 *    - Redacted: keep only if same model, else drop.
 *    - Same model with signature: keep.
 *    - Foreign non-empty thinking: convert to plain text block.
 *    - Foreign thoughtSignature on tool calls: strip.
 * 3. Tool call ID normalization:
 *    - Normalizes foreign IDs (Anthropic ^[a-zA-Z0-9_-]{1,64}$, Responses long IDs)
 *    - Maps normalized IDs across tool messages.
 * 4. Incomplete/Aborted turns:
 *    - Skips assistant messages with finishReason: 'error' | 'aborted' on replay.
 * 5. Orphan tool calls:
 *    - If an assistant tool call is unanswered before the next user/assistant turn or end of transcript,
 *      synthesize a tool-result: { output: 'No result provided', isError: true }.
 * 6. System message preservation:
 *    - Held back if between a tool call and its result, avoiding broken pairs.
 * 7. Text-only guard:
 *    - Flatten/guarantee valid string or TextContent in messages.
 */

import type {
  AssistantContent,
  AssistantMessage,
  Message,
  Model,
  TextContent,
  ThinkingContent,
  ToolCallContent,
  ToolMessage,
  ToolResultContent,
  UserMessage,
} from '../types.js';

/**
 * Normalizes tool call ID for protocol compatibility.
 * Anthropic requires ^[a-zA-Z0-9_-]{1,64}$.
 */
export function defaultNormalizeToolCallId(rawId: string): string {
  // Replace disallowed characters with '_'
  const cleaned = rawId.replace(/[^a-zA-Z0-9_-]/g, '_');
  if (cleaned.length <= 64) return cleaned || 'call_0';

  // Deterministically shorten by taking prefix + hash
  let hash = 0;
  for (let i = 0; i < rawId.length; i++) {
    hash = (hash << 5) - hash + rawId.charCodeAt(i);
    hash |= 0;
  }
  const suffix = `_${Math.abs(hash).toString(36)}`;
  return `${cleaned.slice(0, 64 - suffix.length)}${suffix}`;
}

export function transformMessages(
  messages: readonly Message[],
  targetModel: Model,
  normalizeToolId: (id: string) => string = defaultNormalizeToolCallId,
): Message[] {
  const toolCallIdMap = new Map<string, string>();

  // Pass 1: Content normalization and ID mapping
  const transformedPass1: Message[] = messages.map((msg) => {
    if (msg.role === 'system') {
      return msg;
    }

    if (msg.role === 'user') {
      return msg;
    }

    if (msg.role === 'tool') {
      const toolMsg = msg as ToolMessage;
      const updatedContent: ToolResultContent[] = toolMsg.content.map((res) => {
        const mappedId = toolCallIdMap.get(res.toolCallId);
        if (mappedId && mappedId !== res.toolCallId) {
          return { ...res, toolCallId: mappedId };
        }
        return res;
      });
      return { ...toolMsg, content: updatedContent };
    }

    if (msg.role === 'assistant') {
      const assistantMsg = msg as AssistantMessage;
      const meta = assistantMsg.meta;
      const isSameModel =
        meta !== undefined &&
        meta.provider === targetModel.provider &&
        meta.protocol === targetModel.protocol &&
        meta.modelId === targetModel.id;

      const newContent: AssistantContent[] = [];

      for (const block of assistantMsg.content) {
        if (block.type === 'thinking') {
          const thinkingBlock = block as ThinkingContent;
          if (thinkingBlock.redacted) {
            if (isSameModel) newContent.push(thinkingBlock);
            continue;
          }
          if (isSameModel && thinkingBlock.thinkingSignature) {
            newContent.push(thinkingBlock);
            continue;
          }
          if (!thinkingBlock.thinking || thinkingBlock.thinking.trim() === '') {
            continue;
          }
          if (isSameModel) {
            newContent.push(thinkingBlock);
          } else {
            // Foreign thinking block -> convert to plain text
            newContent.push({
              type: 'text',
              text: thinkingBlock.thinking,
            } satisfies TextContent);
          }
          continue;
        }

        if (block.type === 'text') {
          newContent.push(block);
          continue;
        }

        if (block.type === 'tool-call') {
          const tc = block as ToolCallContent;
          let normalizedTc = tc;

          if (!isSameModel && tc.thoughtSignature) {
            normalizedTc = { ...tc, thoughtSignature: undefined };
          }

          if (!isSameModel) {
            const normalizedId = normalizeToolId(tc.id);
            if (normalizedId !== tc.id) {
              toolCallIdMap.set(tc.id, normalizedId);
              normalizedTc = { ...normalizedTc, id: normalizedId };
            }
          }

          newContent.push(normalizedTc);
          continue;
        }

        newContent.push(block);
      }

      return {
        ...assistantMsg,
        content: newContent,
      };
    }

    return msg;
  });

  // Pass 2: Orphan tool-call synthesis & held system messages
  const result: Message[] = [];
  let pendingToolCalls: ToolCallContent[] = [];
  const answeredToolCallIds = new Set<string>();
  const heldSystemMessages: Message[] = [];

  const closePendingToolCalls = () => {
    if (pendingToolCalls.length > 0) {
      const syntheticResults: ToolResultContent[] = [];
      for (const tc of pendingToolCalls) {
        if (!answeredToolCallIds.has(tc.id)) {
          syntheticResults.push({
            type: 'tool-result',
            toolCallId: tc.id,
            toolName: tc.name,
            output: 'No result provided',
            isError: true,
          });
        }
      }
      if (syntheticResults.length > 0) {
        result.push({
          role: 'tool',
          content: syntheticResults,
        } satisfies ToolMessage);
      }
      pendingToolCalls = [];
      answeredToolCallIds.clear();
    }
    result.push(...heldSystemMessages);
    heldSystemMessages.length = 0;
  };

  for (const msg of transformedPass1) {
    if (msg.role === 'assistant') {
      closePendingToolCalls();

      const assistantMsg = msg as AssistantMessage;
      // Skip incomplete turns on replay
      if (
        assistantMsg.meta?.finishReason === 'error' ||
        assistantMsg.meta?.finishReason === 'aborted'
      ) {
        continue;
      }

      const toolCalls = assistantMsg.content.filter(
        (b): b is ToolCallContent => b.type === 'tool-call',
      );
      if (toolCalls.length > 0) {
        pendingToolCalls = [...toolCalls];
        answeredToolCallIds.clear();
      }

      result.push(msg);
    } else if (msg.role === 'tool') {
      const toolMsg = msg as ToolMessage;
      for (const res of toolMsg.content) {
        answeredToolCallIds.add(res.toolCallId);
      }
      result.push(msg);
    } else if (msg.role === 'system') {
      if (pendingToolCalls.length > 0) {
        heldSystemMessages.push(msg);
      } else {
        result.push(msg);
      }
    } else if (msg.role === 'user') {
      closePendingToolCalls();
      result.push(msg);
    } else {
      result.push(msg);
    }
  }

  // Close any trailing unanswered tool calls at the end of transcript
  closePendingToolCalls();

  return result;
}
