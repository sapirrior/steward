import type { ModelMessage } from '@steward/threads';
import { normalizeModelMessages } from './messageNormalizer.js';

export interface ComposePromptOptions {
  systemPrompt?: string;
  runtimeContext?: string;
  historyMessages: ModelMessage[];
  newUserPrompt: string;
}

export interface ComposedPromptResult {
  systemPrompt?: string;
  runtimeContext?: string;
  messages: ModelMessage[];
}

/**
 * Pure prompt composer that preserves the full, canonical ModelMessage sequence
 * (including tool-call and tool-result parts) and appends the new user message.
 * Prevents history flattening into lossy CompletedTurn text representations.
 */
export function composePrompt(options: ComposePromptOptions): ComposedPromptResult {
  const trimmedPrompt = options.newUserPrompt.trim();
  if (!trimmedPrompt) {
    throw new Error('Cannot compose prompt with empty user input');
  }

  // Normalize existing history messages safely
  const canonicalHistory = normalizeModelMessages(options.historyMessages);

  // Append new user turn
  const fullMessages: ModelMessage[] = [
    ...canonicalHistory,
    {
      role: 'user',
      content: trimmedPrompt,
    },
  ];

  return {
    systemPrompt: options.systemPrompt?.trim() || undefined,
    runtimeContext: options.runtimeContext?.trim() || undefined,
    messages: fullMessages,
  };
}
