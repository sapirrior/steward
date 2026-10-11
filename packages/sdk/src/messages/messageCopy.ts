import type { ModelMessage, UserModelMessage } from 'ai';

/**
 * Creates an owned, deep clone of user message content (string or parts array).
 * Preserves URLs, Buffers, Uint8Array and ArrayBuffer binary payloads without mutation.
 */
export function cloneUserContent(
  content: UserModelMessage['content']
): UserModelMessage['content'] {
  if (typeof content === 'string') {
    return content;
  }

  if (!Array.isArray(content)) {
    return content;
  }

  return content.map((part) => {
    if (typeof part === 'string') {
      return part;
    }

    if (!part || typeof part !== 'object') {
      return part;
    }

    switch (part.type) {
      case 'text':
        return { ...part };

      case 'image': {
        let image = part.image;
        if (image instanceof URL) {
          image = new URL(image.href);
        } else if (image instanceof Uint8Array) {
          image = new Uint8Array(image);
        } else if (image instanceof ArrayBuffer) {
          image = image.slice(0);
        }
        return {
          ...part,
          image,
        };
      }

      case 'file': {
        let data = part.data;
        if (data instanceof URL) {
          data = new URL(data.href);
        } else if (data instanceof Uint8Array) {
          data = new Uint8Array(data);
        } else if (data instanceof ArrayBuffer) {
          data = data.slice(0);
        } else if (data && typeof data === 'object' && 'type' in data) {
          // FileData tagged object
          if (data.type === 'url') {
            data = { type: 'url', url: new URL(data.url.href) };
          } else if (data.type === 'data') {
            const raw = data.data;
            if (raw instanceof Uint8Array) {
              data = { type: 'data', data: new Uint8Array(raw) };
            } else if (raw instanceof ArrayBuffer) {
              data = { type: 'data', data: raw.slice(0) };
            }
          }
        }
        return {
          ...part,
          data,
        };
      }

      default:
        return { ...part };
    }
  });
}

/**
 * Creates an owned, deep copy of prior ModelMessage[] history.
 * Guarantees that callers' history arrays and nested objects are never mutated.
 */
export function cloneModelMessages(
  messages: readonly ModelMessage[]
): ModelMessage[] {
  return messages.map((msg) => {
    if (msg.role === 'user') {
      return {
        ...msg,
        content: cloneUserContent(msg.content),
      };
    }

    if (msg.role === 'assistant') {
      if (typeof msg.content === 'string') {
        return { ...msg };
      }
      if (Array.isArray(msg.content)) {
        return {
          ...msg,
          content: msg.content.map((part) => {
            if (part && typeof part === 'object') {
              if (part.type === 'tool-call') {
                return {
                  ...part,
                  // ToolCallPart uses `args: unknown` in AI SDK ModelMessage
                  args:
                    part.args && typeof part.args === 'object'
                      ? JSON.parse(JSON.stringify(part.args))
                      : part.args,
                };
              }
              return { ...part };
            }
            return part;
          }),
        };
      }
      return { ...msg };
    }

    if (msg.role === 'tool') {
      return {
        ...msg,
        content: Array.isArray(msg.content)
          ? msg.content.map((part) => ({
              ...part,
              output:
                part.output && typeof part.output === 'object'
                  ? JSON.parse(JSON.stringify(part.output))
                  : part.output,
            }))
          : msg.content,
      };
    }

    // System or custom role messages
    return { ...msg };
  });
}
