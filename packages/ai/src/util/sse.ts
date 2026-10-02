/**
 * @steward/ai - SSE (Server-Sent Events) decoder
 *
 * Handles CRLF, LF, and CR line endings; comment lines (`:…`);
 * multi-line `data:` fields; and trailing flush after stream close.
 */

export interface SSEMessage {
  event?: string;
  data: string;
  id?: string;
}

/**
 * Decodes a Web ReadableStream<Uint8Array> into an async iterable of SSEMessage objects.
 * Releases the reader lock in all exit paths (abort, error, normal end).
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
        throw abortSignal.reason ?? new Error('Stream aborted');
      }

      const { done, value } = await reader.read();
      if (done) {
        buffer += decoder.decode();
        break;
      }

      buffer += decoder.decode(value, { stream: true });

      let eventEndIndex: number;
      while ((eventEndIndex = findEventEnd(buffer)) !== -1) {
        const rawEvent = buffer.slice(0, eventEndIndex);
        // Advance past the double-newline terminator (handles \n\n, \r\n\r\n, \r\r)
        const termLen =
          buffer[eventEndIndex] === '\r' && buffer[eventEndIndex + 1] === '\n' ? 4 : 2;
        buffer = buffer.slice(eventEndIndex + termLen);

        const parsed = parseSSEEvent(rawEvent);
        if (parsed) yield parsed;
      }
    }

    // Flush any remaining partial event at stream end
    if (buffer.trim()) {
      const parsed = parseSSEEvent(buffer);
      if (parsed) yield parsed;
    }
  } finally {
    reader.releaseLock();
  }
}

function findEventEnd(buffer: string): number {
  const idx1 = buffer.indexOf('\n\n');
  const idx2 = buffer.indexOf('\r\n\r\n');
  const idx3 = buffer.indexOf('\r\r');
  const candidates = [idx1, idx2, idx3].filter((i) => i !== -1);
  return candidates.length === 0 ? -1 : Math.min(...candidates);
}

function parseSSEEvent(raw: string): SSEMessage | null {
  const lines = raw.split(/\r\n|\r|\n/);
  let event: string | undefined;
  let id: string | undefined;
  const dataLines: string[] = [];

  for (const line of lines) {
    if (!line || line.startsWith(':')) continue; // empty or comment

    const colonIdx = line.indexOf(':');
    let field = line;
    let value = '';

    if (colonIdx !== -1) {
      field = line.slice(0, colonIdx);
      value = line.slice(colonIdx + 1);
      if (value.startsWith(' ')) value = value.slice(1);
    }

    if (field === 'event') event = value;
    else if (field === 'data') dataLines.push(value);
    else if (field === 'id') id = value;
  }

  if (dataLines.length === 0 && !event) return null;
  return { event, id, data: dataLines.join('\n') };
}
