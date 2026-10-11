import type { ModelMessage, UserModelMessage } from 'ai';

/**
 * Normalizes any raw tool result (string, object, legacy result)
 * into AI SDK Core v7 ToolResultOutput ({ type: 'text' | 'json', value }).
 */
export function normalizeToolResultOutput(raw: unknown): Record<string, any> {
  if (
    raw &&
    typeof raw === 'object' &&
    'type' in raw &&
    ('value' in raw || 'reason' in raw)
  ) {
    return { ...(raw as Record<string, any>) };
  }

  if (typeof raw === 'string') {
    return { type: 'text', value: raw };
  }

  return { type: 'json', value: raw !== undefined ? raw : null };
}

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
 * Guarantees that callers' history arrays and nested objects are never mutated,
 * while ensuring compatibility with AI SDK Core v7 ModelMessage schema
 * (supporting legacy tool-call `args` and tool-result `result`).
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
                const rawArgs =
                  (part as any).input !== undefined
                    ? (part as any).input
                    : (part as any).args !== undefined
                      ? (part as any).args
                      : {};

                const clonedInput =
                  rawArgs && typeof rawArgs === 'object'
                    ? JSON.parse(JSON.stringify(rawArgs))
                    : rawArgs;

                return {
                  ...part,
                  // AI SDK Core v7 streamText messages requires `input`
                  input: clonedInput,
                  args: clonedInput,
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
          ? msg.content.map((part) => {
              const rawOutput =
                (part as any).output !== undefined
                  ? (part as any).output
                  : (part as any).result;

              return {
                ...part,
                // AI SDK Core v7 requires `output: ToolResultOutput`
                output: normalizeToolResultOutput(rawOutput),
              };
            })
          : msg.content,
      };
    }

    // System or custom role messages
    return { ...msg };
  });
}
