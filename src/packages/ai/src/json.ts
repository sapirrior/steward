/**
 * @steward/ai - Partial & Streaming JSON parser
 */

import type { JsonObject, JsonValue } from './types.js';
import { AIError } from './errors.js';

export function parseJson<T = JsonValue>(text: string): T {
  try {
    return JSON.parse(text) as T;
  } catch (err) {
    throw new AIError(`Failed to parse JSON: ${err instanceof Error ? err.message : String(err)}`, {
      code: 'parse',
      cause: err,
    });
  }
}

/**
 * Parses incomplete / streaming JSON text into an object,
 * safely returning partial state or {} when still syntactically incomplete.
 */
export function parseStreamingJson<T = JsonObject>(partial: string): T {
  const trimmed = partial.trim();
  if (!trimmed) {
    return {} as T;
  }

  // Quick path: complete JSON
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    // Attempt relaxed parsing for streaming fragments
  }

  // Balanced repair attempt for common JSON streams
  let candidate = trimmed;

  // If candidate starts with '{' but not ended
  if (candidate.startsWith('{')) {
    // Count open quotes and brackets/braces to close them
    let inString = false;
    let escaped = false;
    const stack: ('{' | '[')[] = [];

    for (let i = 0; i < candidate.length; i++) {
      const char = candidate[i];
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === '\\') {
        escaped = true;
        continue;
      }
      if (char === '"') {
        inString = !inString;
        continue;
      }
      if (inString) {
        continue;
      }

      if (char === '{' || char === '[') {
        stack.push(char);
      } else if (char === '}') {
        if (stack[stack.length - 1] === '{') {
          stack.pop();
        }
      } else if (char === ']') {
        if (stack[stack.length - 1] === '[') {
          stack.pop();
        }
      }
    }

    // If string was left open, close it
    if (inString) {
      candidate += '"';
    }

    // If there's a trailing colon or comma, strip or append dummy value
    const trimmedEnd = candidate.trimEnd();
    if (trimmedEnd.endsWith(':')) {
      candidate = trimmedEnd + ' null';
    } else if (trimmedEnd.endsWith(',')) {
      candidate = trimmedEnd.slice(0, -1);
    }

    // Close remaining open brackets/braces in reverse order
    for (let i = stack.length - 1; i >= 0; i--) {
      const opener = stack[i];
      if (opener === '{') {
        candidate += '}';
      } else if (opener === '[') {
        candidate += ']';
      }
    }

    try {
      return JSON.parse(candidate) as T;
    } catch {
      return {} as T;
    }
  }

  return {} as T;
}
