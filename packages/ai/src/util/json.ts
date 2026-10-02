/**
 * @steward/ai - JSON parsing utilities
 *
 * parseJson: strict parse, throws AIError on failure.
 * parseStreamingJson: tolerant partial-JSON parse for streaming tool-call arguments.
 */

import type { JsonObject, JsonValue } from '../types.js';
import { AIError } from '../errors.js';

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
 * Handles: open strings, trailing colons/commas, unmatched braces/brackets.
 */
export function parseStreamingJson<T = JsonObject>(partial: string): T {
  const trimmed = partial.trim();
  if (!trimmed) return {} as T;

  // Quick path: already complete JSON
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    // fall through to repair
  }

  if (!trimmed.startsWith('{')) return {} as T;

  let candidate = trimmed;
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
    if (inString) continue;
    if (char === '{' || char === '[') stack.push(char);
    else if (char === '}' && stack[stack.length - 1] === '{') stack.pop();
    else if (char === ']' && stack[stack.length - 1] === '[') stack.pop();
  }

  if (inString) candidate += '"';

  const trimmedEnd = candidate.trimEnd();
  if (trimmedEnd.endsWith(':')) candidate = trimmedEnd + ' null';
  else if (trimmedEnd.endsWith(',')) candidate = trimmedEnd.slice(0, -1);

  for (let i = stack.length - 1; i >= 0; i--) {
    candidate += stack[i] === '{' ? '}' : ']';
  }

  try {
    return JSON.parse(candidate) as T;
  } catch {
    return {} as T;
  }
}
