/**
 * @steward/ai — Transformer: Messages Normalization
 *
 * Converts Steward Message[] history to AI SDK ModelMessage[] + instructions.
 *
 * Signature/encrypted-content replay is handled ENTIRELY by each AI SDK provider adapter
 * via the providerOptions passthrough. We only need to round-trip providerMetadata
 * back as providerOptions on reasoning parts — the SDK does the rest.
 *
 * No provider-specific branching needed here.
 */

import type { ModelMessage } from 'ai';
import type { AssistantMessage, Message, ToolMessage, UserMessage } from '../types.js';

export interface NormalizedMessagesResult {
  instructions?: string;
  messages: ModelMessage[];
}

export function normalizeMessages(
  inputMessages: readonly Message[],
  _config?: unknown,
  _currentModelId?: string,
): NormalizedMessagesResult {
  let instructions: string | undefined;
  const messages: ModelMessage[] = [];

  for (const msg of inputMessages) {
    if (msg.role === 'system') {
      const text = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
      instructions = instructions ? `${instructions}\n\n${text}` : text;
      continue;
    }
    if (msg.role === 'user') messages.push(toUserMessage(msg));
    else if (msg.role === 'assistant') messages.push(toAssistantMessage(msg));
    else if (msg.role === 'tool') messages.push(toToolMessage(msg));
  }

  return { instructions, messages };
}

function toUserMessage(msg: UserMessage): ModelMessage {
  if (typeof msg.content === 'string') return { role: 'user', content: msg.content };

  return {
    role: 'user',
    content: msg.content.map((b) => ({ type: 'text' as const, text: b.text })),
  };
}

function toAssistantMessage(msg: AssistantMessage): ModelMessage {
  const parts: any[] = [];

  for (const block of msg.content) {
    if (block.type === 'text') {
      parts.push({ type: 'text', text: block.text });
    } else if (block.type === 'thinking') {
      /**
       * Reasoning replay: pass whatever providerMetadata we stored back as
       * providerOptions. Each SDK adapter (Anthropic, OpenAI, xAI, …) reads its
       * own namespace key and reconstructs the correct wire payload automatically.
       *
       * Anthropic reads:  providerOptions.anthropic.signature
       * OpenAI reads:     providerOptions.openai.reasoningEncryptedContent
       *
       * thinkingSignature stored in Steward ThinkingContent maps to the
       * anthropic namespace — set it there.
       */
      const providerOptions: Record<string, unknown> = {};
      if (block.thinkingSignature) {
        providerOptions['anthropic'] = { signature: block.thinkingSignature };
      }
      parts.push({
        type: 'reasoning',
        text: block.thinking ?? '',
        providerOptions: Object.keys(providerOptions).length ? providerOptions : undefined,
      });
    } else if (block.type === 'tool-call') {
      parts.push({
        type: 'tool-call',
        toolCallId: block.id,
        toolName: block.name,
        input: block.arguments,
      });
    }
  }

  return { role: 'assistant', content: parts };
}

function toToolMessage(msg: ToolMessage): ModelMessage {
  return {
    role: 'tool',
    content: msg.content.map((c) => ({
      type: 'tool-result' as const,
      toolCallId: c.toolCallId,
      toolName: c.toolName ?? 'unknown',
      output: {
        type: 'text' as const,
        value: typeof c.output === 'string' ? c.output : JSON.stringify(c.output),
      },
    })),
  };
}
