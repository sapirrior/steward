import type { ModelMessage, AssistantContentPart, ToolContentPart } from '@steward/threads';

/**
 * Normalizes raw or deserialized messages (from AI SDK or disk) into canonical ModelMessage[].
 * Handles schema differences such as tool-call `input` vs `args`, ensuring tool arguments
 * and results are never undefined or lost.
 */
export function normalizeModelMessages(rawMessages: unknown[]): ModelMessage[] {
  if (!Array.isArray(rawMessages)) return [];

  const normalized: ModelMessage[] = [];

  for (const raw of rawMessages) {
    if (!raw || typeof raw !== 'object' || !('role' in raw)) continue;

    const msg = raw as Record<string, unknown>;
    const role = msg.role;

    if (role === 'system' && typeof msg.content === 'string') {
      normalized.push({
        role: 'system',
        content: msg.content,
      });
    } else if (role === 'user') {
      if (typeof msg.content === 'string') {
        normalized.push({
          role: 'user',
          content: msg.content,
        });
      } else if (Array.isArray(msg.content)) {
        normalized.push({
          role: 'user',
          content: msg.content as any,
        });
      }
    } else if (role === 'assistant') {
      if (typeof msg.content === 'string') {
        normalized.push({
          role: 'assistant',
          content: msg.content,
        });
      } else if (Array.isArray(msg.content)) {
        const parts: AssistantContentPart[] = [];
        for (const rawPart of msg.content) {
          if (!rawPart || typeof rawPart !== 'object') continue;
          const part = rawPart as Record<string, unknown>;

          if (part.type === 'text' && typeof part.text === 'string') {
            parts.push({ type: 'text', text: part.text });
          } else if (part.type === 'reasoning' && typeof part.text === 'string') {
            parts.push({
              type: 'reasoning',
              text: part.text,
              signature: typeof part.signature === 'string' ? part.signature : undefined,
            });
          } else if (part.type === 'tool-call') {
            const toolCallId = String(part.toolCallId || '');
            const toolName = String(part.toolName || '');
            // Support both AI SDK v7 `input` and canonical/legacy `args`
            const args =
              part.args !== undefined
                ? part.args
                : part.input !== undefined
                  ? part.input
                  : {};

            parts.push({
              type: 'tool-call',
              toolCallId,
              toolName,
              args,
            });
          }
        }
        normalized.push({
          role: 'assistant',
          content: parts,
        });
      }
    } else if (role === 'tool' && Array.isArray(msg.content)) {
      const parts: ToolContentPart[] = [];
      for (const rawPart of msg.content) {
        if (!rawPart || typeof rawPart !== 'object') continue;
        const part = rawPart as Record<string, unknown>;

        if (part.type === 'tool-result' || part.toolCallId) {
          parts.push({
            type: 'tool-result',
            toolCallId: String(part.toolCallId || ''),
            toolName: String(part.toolName || ''),
            result:
              part.result !== undefined
                ? part.result
                : part.output !== undefined
                  ? part.output
                  : '',
            isError: Boolean(part.isError),
          });
        }
      }
      normalized.push({
        role: 'tool',
        content: parts,
      });
    }
  }

  return normalized;
}
