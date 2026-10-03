/**
 * @steward/ai — Transformer: Messages Normalization
 *
 * Converts Steward Message[] history to AI SDK ModelMessage[] format and instructions (system prompt).
 * Handles:
 * - Extracting system instructions
 * - Replaying thinking/signatures or collapsing thinking to text for foreign models
 * - Formatting user/assistant/tool messages
 */

import type { ModelMessage } from 'ai';
import type {
  AssistantMessage,
  Message,
  ToolMessage,
  UserMessage,
} from '../types.js';
import type { NamespaceConfig } from './config.js';

export interface NormalizedMessagesResult {
  instructions?: string;
  messages: ModelMessage[];
}

export function normalizeMessages(
  inputMessages: readonly Message[],
  config: NamespaceConfig,
  currentModelId?: string,
): NormalizedMessagesResult {
  let instructions: string | undefined = undefined;
  const messages: ModelMessage[] = [];

  for (const msg of inputMessages) {
    if (msg.role === 'system') {
      const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
      instructions = instructions ? `${instructions}\n\n${content}` : content;
      continue;
    }

    if (msg.role === 'user') {
      messages.push(normalizeUserMessage(msg));
    } else if (msg.role === 'assistant') {
      messages.push(normalizeAssistantMessage(msg, config, currentModelId));
    } else if (msg.role === 'tool') {
      messages.push(normalizeToolMessage(msg));
    }
  }

  return { instructions, messages };
}

function normalizeUserMessage(msg: UserMessage): ModelMessage {
  if (typeof msg.content === 'string') {
    return {
      role: 'user',
      content: msg.content,
    };
  }

  const parts: any[] = [];
  for (const block of msg.content) {
    if (block.type === 'text') {
      parts.push({ type: 'text', text: block.text });
    }
  }

  return {
    role: 'user',
    content: parts,
  };
}

function normalizeAssistantMessage(
  msg: AssistantMessage,
  config: NamespaceConfig,
  currentModelId?: string,
): ModelMessage {
  const isSameModel = !msg.meta?.modelId || !currentModelId || msg.meta.modelId === currentModelId;
  const parts: any[] = [];

  for (const block of msg.content) {
    if (block.type === 'text') {
      parts.push({ type: 'text', text: block.text });
    } else if (block.type === 'thinking') {
      if (!isSameModel && config.replay.foreignToText) {
        if (block.thinking) {
          parts.push({ type: 'text', text: block.thinking });
        }
      } else {
        if (block.thinking || block.redacted) {
          const reasoningPart: any = {
            type: 'reasoning',
            text: block.thinking || '',
          };
          if (block.thinkingSignature && config.metadataToLegacy.thinkingSignature) {
            reasoningPart.providerMetadata = {
              [config.metadataToLegacy.thinkingSignature]: block.thinkingSignature,
            };
          }
          parts.push(reasoningPart);
        }
      }
    } else if (block.type === 'tool-call') {
      parts.push({
        type: 'tool-call',
        toolCallId: config.toolCallId.normalize(block.id),
        toolName: block.name,
        input: block.arguments,
      });
    }
  }

  return {
    role: 'assistant',
    content: parts,
  };
}

function normalizeToolMessage(msg: ToolMessage): ModelMessage {
  return {
    role: 'tool',
    content: msg.content.map((c) => ({
      type: 'tool-result',
      toolCallId: c.toolCallId,
      toolName: c.toolName ?? 'unknown',
      output: {
        type: 'text',
        value: typeof c.output === 'string' ? c.output : JSON.stringify(c.output),
      },
    })),
  };
}
