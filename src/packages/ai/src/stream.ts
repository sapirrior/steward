/**
 * @steward/ai - SSE & Stream decoding
 */

export interface SSEMessage {
  event?: string;
  data: string;
  id?: string;
}

/**
 * Decodes a Web ReadableStream<Uint8Array> into an async iterable of SSEMessage objects.
 */
export async function* decodeSSE(
  stream: ReadableStream<Uint8Array>,
  abortSignal?: AbortSignal,
): AsyncGenerator<SSEMessage, void, unknown> {
  const reader = stream.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  try {
    while (true) {
      if (abortSignal?.aborted) {
        throw abortSignal.reason || new Error('Stream aborted');
      }

      const { done, value } = await reader.read();
      if (done) {
        buffer += decoder.decode();
        break;
      }

      buffer += decoder.decode(value, { stream: true });

      // Process complete double-newline separated SSE events
      let eventEndIndex: number;
      while ((eventEndIndex = findEventEnd(buffer)) !== -1) {
        const rawEvent = buffer.slice(0, eventEndIndex);
        buffer = buffer.slice(
          eventEndIndex +
            (buffer[eventEndIndex] === '\r' && buffer[eventEndIndex + 1] === '\n' ? 2 : 1),
        );
        if (buffer.startsWith('\n')) {
          buffer = buffer.slice(1);
        }

        const parsed = parseSSEEvent(rawEvent);
        if (parsed) {
          yield parsed;
        }
      }
    }

    // Flush any remaining event in buffer
    if (buffer.trim()) {
      const parsed = parseSSEEvent(buffer);
      if (parsed) {
        yield parsed;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

function findEventEnd(buffer: string): number {
  const idx1 = buffer.indexOf('\n\n');
  const idx2 = buffer.indexOf('\r\n\r\n');
  const idx3 = buffer.indexOf('\r\r');

  const indices = [idx1, idx2, idx3].filter((i) => i !== -1);
  if (indices.length === 0) return -1;
  return Math.min(...indices);
}

function parseSSEEvent(raw: string): SSEMessage | null {
  const lines = raw.split(/\r\n|\r|\n/);
  let event: string | undefined;
  let id: string | undefined;
  const dataLines: string[] = [];

  for (const line of lines) {
    if (!line || line.startsWith(':')) {
      // Comment or empty line
      continue;
    }

    const colonIdx = line.indexOf(':');
    let field = line;
    let value = '';

    if (colonIdx !== -1) {
      field = line.slice(0, colonIdx);
      value = line.slice(colonIdx + 1);
      if (value.startsWith(' ')) {
        value = value.slice(1);
      }
    }

    if (field === 'event') {
      event = value;
    } else if (field === 'data') {
      dataLines.push(value);
    } else if (field === 'id') {
      id = value;
    }
  }

  if (dataLines.length === 0 && !event) {
    return null;
  }

  return {
    event,
    id,
    data: dataLines.join('\n'),
  };
}
