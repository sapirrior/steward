import type { ModelMessage } from '@steward/threads';
import type { CompletedTurn, ActiveToolCallState } from '../types.js';

/**
 * Reconstructs TUI CompletedTurn array from persisted AI SDK ModelMessages in a thread document.
 */
export function reconstructTurnsFromMessages(messages: ModelMessage[]): CompletedTurn[] {
  const turns: CompletedTurn[] = [];
  let currentPrompt = '';
  let currentTimestamp = 'Past';
  let currentText = '';
  let currentReasoning = '';
  let currentToolCalls: ActiveToolCallState[] = [];

  for (const msg of messages) {
    if (msg.role === 'user') {
      if (currentPrompt) {
        turns.push({
          id: `restored-turn-${turns.length}`,
          userPrompt: currentPrompt,
          userTimestamp: currentTimestamp,
          text: currentText,
          reasoning: currentReasoning || undefined,
          toolCalls: currentToolCalls,
          status: 'finished',
        });
        currentText = '';
        currentReasoning = '';
        currentToolCalls = [];
      }

      currentPrompt =
        typeof msg.content === 'string'
          ? msg.content
          : msg.content.map((c) => (c.type === 'text' ? c.text : '')).join('\n');
      currentTimestamp = 'Past';
    } else if (msg.role === 'assistant') {
      if (typeof msg.content === 'string') {
        currentText += msg.content;
      } else if (Array.isArray(msg.content)) {
        for (const part of msg.content) {
          if (part.type === 'text') currentText += part.text;
          if (part.type === 'reasoning') currentReasoning += part.text;
          if (part.type === 'tool-call') {
            currentToolCalls.push({
              toolCallId: part.toolCallId,
              toolName: part.toolName,
              tagline: `Running ${part.toolName}`,
              args: (part.args as Record<string, unknown>) || {},
              status: 'success',
            });
          }
        }
      }
    } else if (msg.role === 'tool') {
      for (const part of msg.content) {
        const found = currentToolCalls.find((tc) => tc.toolCallId === part.toolCallId);
        if (found) {
          found.status = part.isError ? 'error' : 'success';
          found.result = part.result;
          found.isError = part.isError;
        }
      }
    }
  }

  if (currentPrompt) {
    turns.push({
      id: `restored-turn-${turns.length}`,
      userPrompt: currentPrompt,
      userTimestamp: currentTimestamp,
      text: currentText,
      reasoning: currentReasoning || undefined,
      toolCalls: currentToolCalls,
      status: 'finished',
    });
  }

  return turns;
}
