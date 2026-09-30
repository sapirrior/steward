/**
 * @steward/ai - HTTP error body extraction
 *
 * Reads the body of a non-2xx fetch Response once, truncates it,
 * and redacts secrets (bearer tokens, API keys) before surfacing
 * as AIError.detail. AIError.message stays short and body-free.
 */

const MAX_ERROR_BODY_CHARS = 4_000;

/** Patterns that look like secrets — redacted before storing in detail */
const SECRET_PATTERNS = [
  /Bearer\s+[A-Za-z0-9\-._~+/]+=*/g,
  /sk-[A-Za-z0-9]{20,}/g,
  /sk-ant-[A-Za-z0-9\-]{20,}/g,
  /AIza[A-Za-z0-9\-_]{35}/g,
];

function redactSecrets(text: string): string {
  let result = text;
  for (const pattern of SECRET_PATTERNS) {
    result = result.replace(pattern, '[REDACTED]');
  }
  return result;
}

function truncate(text: string): string {
  if (text.length <= MAX_ERROR_BODY_CHARS) return text;
  return `${text.slice(0, MAX_ERROR_BODY_CHARS)}… [truncated ${text.length - MAX_ERROR_BODY_CHARS} chars]`;
}

/**
 * Reads a non-2xx fetch Response body and returns a redacted, truncated
 * string suitable for AIError.detail. Returns undefined when the body
 * is empty or unreadable (body already consumed, etc.).
 */
export async function readErrorBody(response: Response): Promise<string | undefined> {
  try {
    const text = await response.text();
    const trimmed = text.trim();
    if (!trimmed) return undefined;
    return truncate(redactSecrets(trimmed));
  } catch {
    return undefined;
  }
}

export function safeJsonStringify(value: unknown): string {
  try {
    const s = JSON.stringify(value);
    return s === undefined ? String(value) : s;
  } catch {
    return String(value);
  }
}
