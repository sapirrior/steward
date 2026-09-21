import type { SessionData, UIHistoryItem } from './types.js';
import type { SessionPresentationProjection } from './logs/types.js';

/**
 * Extracts full output or summary from tool execution outputs for terminal rendering.
 */
export function formatToolOutputSummary(res: unknown, isError = false): string | undefined {
  if (isError || res === undefined || res === null) {
    return undefined;
  }

  if (typeof res === 'object') {
    const obj = res as Record<string, any>;

    if (typeof obj.message === 'string' && obj.message.trim()) {
      return obj.message.trim();
    }
    if (obj.totalLines !== undefined && obj.startLine !== undefined && obj.endLine !== undefined) {
      return `Read ${obj.endLine - obj.startLine + 1} of ${obj.totalLines} lines`;
    }
    if (obj.totalEntries !== undefined) {
      return `Listed ${obj.totalEntries} entries`;
    }
    if (obj.totalMatches !== undefined && Array.isArray(obj.files)) {
      return `Found ${obj.totalMatches} files`;
    }
    if (obj.totalMatches !== undefined && Array.isArray(obj.matches)) {
      return `Found ${obj.totalMatches} matches`;
    }
    if (obj.resultCount !== undefined) {
      return `Found ${obj.resultCount} results`;
    }
    if (obj.url && obj.status) {
      return `Fetched ${obj.contentType ?? 'content'} (${obj.status} OK, ${obj.content?.length ?? 0} chars)`;
    }
    if (Array.isArray(obj.todos)) {
      const total = obj.todos.length;
      const completed = obj.todos.filter((t: any) => t.status === 'completed').length;
      const inProgress = obj.todos.filter((t: any) => t.status === 'in_progress').length;
      const header = `Todos (${completed}/${total} completed${inProgress > 0 ? `, ${inProgress} in progress` : ''})`;
      const items = obj.todos
        .slice(0, 10)
        .map((t: any, i: number) => {
          const mark =
            t.status === 'completed'
              ? '[x]'
              : t.status === 'in_progress'
                ? '[▲]'
                : t.status === 'cancelled'
                  ? '[✖]'
                  : t.status === 'blocked'
                    ? '[⚠]'
                    : '[ ]';
          return `${i + 1}. ${mark} ${t.description}`;
        })
        .join('\n');
      return `${header}\n${items}`;
    }
    if (obj.linesWritten !== undefined && obj.path) {
      return `Wrote ${obj.linesWritten} lines to ${obj.path}`;
    }
    if (obj.replacements !== undefined && obj.path) {
      return `Updated ${obj.path}`;
    }
    if (obj.output !== undefined && typeof obj.output === 'string') {
      const trimmed = obj.output.trim();
      return trimmed || undefined;
    }
    if (obj.stdout !== undefined || obj.stderr !== undefined) {
      const combined = [obj.stdout, obj.stderr].filter(Boolean).join('\n').trim();
      return combined || undefined;
    }
    if (obj.content !== undefined) {
      if (typeof obj.content === 'string') {
        const trimmed = obj.content.trim();
        return trimmed || undefined;
      }
    }
    return undefined;
  }

  if (typeof res === 'string') {
    const trimmed = res.trim();
    if (!trimmed) return undefined;

    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed);
        const extracted = formatToolOutputSummary(parsed, isError);
        if (extracted) return extracted;
      } catch {}
    }
    return trimmed;
  }

  return undefined;
}

/**
 * Converts stored SessionData turns into UIHistoryItem list for restored sessions.
 * Derived from canonical ModelMessage[] history, optionally augmented with presentation journal metadata.
 */
export function rehydrateSessionHistory(
  sessionData: SessionData,
  projection?: SessionPresentationProjection | null,
): UIHistoryItem[] {
  const restoredItems: UIHistoryItem[] = [];

  for (const turn of sessionData.turns) {
    if (!turn.messages || turn.messages.length === 0) continue;

    const turnPresentation = projection?.turns.get(turn.id);
    const toolCallsMap = new Map<
      string,
      {
        id: string;
        name: string;
        args: Record<string, unknown>;
        result?: unknown;
        isError: boolean;
      }
    >();

    for (const msg of turn.messages) {
      if (msg.role === 'user') {
        const userText =
          typeof msg.content === 'string'
            ? msg.content
            : Array.isArray(msg.content)
              ? msg.content
                  .filter((p: any) => p.type === 'text')
                  .map((p: any) => p.text)
                  .join('\n')
              : '';
        if (userText.trim()) {
          restoredItems.push({
            id: `u-${turn.id}-${restoredItems.length}`,
            turnId: turn.id,
            type: 'user',
            content: userText.trim(),
          });
        }
      } else if (msg.role === 'assistant') {
        if (typeof msg.content === 'string') {
          if (msg.content.trim()) {
            restoredItems.push({
              id: `a-${turn.id}-${restoredItems.length}`,
              turnId: turn.id,
              type: 'assistant',
              content: msg.content.trim(),
            });
          }
        } else if (Array.isArray(msg.content)) {
          let textAccum = '';

          for (const part of msg.content) {
            if (part.type === 'text') {
              textAccum += (textAccum ? '\n' : '') + part.text;
            } else if (part.type === 'tool-call') {
              let parsedInput = (part.input as Record<string, unknown>) ?? {};
              if (typeof part.input === 'string') {
                const trimmed = part.input.trim();
                if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
                  try {
                    parsedInput = JSON.parse(trimmed);
                  } catch {}
                }
              }
              toolCallsMap.set(part.toolCallId, {
                id: part.toolCallId,
                name: part.toolName,
                args: parsedInput,
                isError: false,
              });
            }
          }

          if (textAccum.trim()) {
            restoredItems.push({
              id: `a-${turn.id}-${restoredItems.length}`,
              turnId: turn.id,
              type: 'assistant',
              content: textAccum.trim(),
            });
          }
        }
      } else if (msg.role === 'tool') {
        if (Array.isArray(msg.content)) {
          for (const part of msg.content) {
            if (part.type === 'tool-result') {
              const existing = toolCallsMap.get(part.toolCallId);
              const isError = Boolean(part.isError);
              const toolName = existing?.name ?? part.toolName ?? 'tool';
              const argsSummary = existing?.args ? JSON.stringify(existing.args) : '';
              let outputVal = part.output;
              if (typeof outputVal === 'string') {
                const trimmed = outputVal.trim();
                if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
                  try {
                    outputVal = JSON.parse(trimmed);
                  } catch {}
                }
              }
              const canonicalOutputSummary = formatToolOutputSummary(outputVal, isError);

              const toolLog = turnPresentation?.tools.get(part.toolCallId);

              const status = toolLog
                ? toolLog.status === 'failed'
                  ? 'failed'
                  : 'completed'
                : isError
                  ? 'failed'
                  : 'completed';

              const error = toolLog?.errorMessage
                ? toolLog.errorMessage
                : isError
                  ? typeof outputVal === 'object' && outputVal !== null
                    ? ((outputVal as any).message ?? JSON.stringify(outputVal))
                    : String(outputVal)
                  : undefined;

              const toolOutput = toolLog?.outputSummary ?? canonicalOutputSummary;

              restoredItems.push({
                id: `tool-${part.toolCallId}`,
                turnId: turn.id,
                type: 'tool',
                content: '',
                toolData: {
                  toolName,
                  displayName: toolLog?.displayName,
                  icon: toolLog?.icon,
                  argsSummary,
                  args: existing?.args,
                  result: outputVal,
                  status,
                  durationMs: toolLog?.durationMs,
                  error,
                  toolOutput,
                },
              });
            }
          }
        }
      }
    }
  }

  return restoredItems;
}

/**
 * Pure helper to merge session presentation projection into canonical history items.
 */
export function mergeSessionPresentation(
  sessionData: SessionData,
  canonicalItems: UIHistoryItem[],
  projection: SessionPresentationProjection | null,
): UIHistoryItem[] {
  if (!projection) return canonicalItems;
  return rehydrateSessionHistory(sessionData, projection);
}
