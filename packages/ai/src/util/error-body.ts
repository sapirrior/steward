/**
 * @steward/ai - HTTP error body extraction
 *
 * Reads the body of a non-2xx fetch Response once, truncates it,
 * and redacts secrets (bearer tokens, API keys) before surfacing
 * as AIError.detail. AIError.message stays short and body-free.
 */

const MAX_ERROR_BODY_CHARS = 4_000;
const MAX_MESSAGE_EXCERPT = 200;

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

export interface ParsedProviderError {
  /** Provider-specific error type string, e.g. "overloaded_error", "rate_limit_error" */
  type?: string;
  /** Provider error code string, e.g. "insufficient_quota" */
  code?: string;
  /** Human-readable message extracted from the provider envelope */
  message?: string;
}

/**
 * Parses a raw provider error body string into a structured object.
 * Handles Anthropic, OpenAI/OpenAI-compatible (incl. Google, OpenRouter) envelopes.
 * Falls back to a trimmed single-line excerpt (max ~200 chars) when no JSON envelope matches.
 * Never throws.
 */
export function parseProviderError(bodyText: string): ParsedProviderError {
  const trimmed = bodyText.trim();
  if (!trimmed) return {};

  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;

    // Anthropic: { "type": "error", "error": { "type": "overloaded_error", "message": "..." } }
    if (parsed.type === 'error' && parsed.error && typeof parsed.error === 'object') {
      const inner = parsed.error as Record<string, unknown>;
      return {
        type: typeof inner.type === 'string' ? inner.type : undefined,
        message: typeof inner.message === 'string' ? inner.message : undefined,
      };
    }

    // OpenAI / OpenAI-compatible: { "error": { "message": "...", "type": "...", "code": "..." } }
    // Also covers Google: { "error": { "code": 429, "message": "...", "status": "..." } }
    // Also covers OpenRouter: { "error": { "message": "...", "metadata": { "raw": "..." } } }
    if (parsed.error && typeof parsed.error === 'object') {
      const inner = parsed.error as Record<string, unknown>;
      return {
        type: typeof inner.type === 'string' ? inner.type : undefined,
        code: typeof inner.code === 'string' ? inner.code : undefined,
        message: typeof inner.message === 'string' ? inner.message : undefined,
      };
    }

    // Top-level message field (some providers)
    if (typeof parsed.message === 'string') {
      return { message: parsed.message };
    }
  } catch {
    // Not JSON — fall through to excerpt
  }

  // Fallback: single-line trimmed excerpt, never raw multi-line JSON
  const oneLine = trimmed.replace(/\s+/g, ' ');
  return {
    message:
      oneLine.length <= MAX_MESSAGE_EXCERPT ? oneLine : `${oneLine.slice(0, MAX_MESSAGE_EXCERPT)}…`,
  };
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
