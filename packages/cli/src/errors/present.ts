/**
 * @steward/cli - Error Presenter
 *
 * Single source of truth for presentation of errors in Steward CLI.
 * Strictly branches on structured error fields (code, status, providerType, provider)
 * without fragile substring heuristics.
 */

export interface PresentedError {
  headline: string;
  hint?: string;
  tone: 'error' | 'info' | 'warning';
}

interface ErrorFields {
  name?: string;
  code?: string;
  status?: number;
  provider?: string;
  providerType?: string;
  retryAfterMs?: number;
  message?: string;
}

function extractFields(err: unknown): ErrorFields {
  if (typeof err !== 'object' || err === null) {
    return { message: String(err) };
  }

  const e = err as Record<string, unknown>;
  return {
    name: typeof e.name === 'string' ? e.name : undefined,
    code: typeof e.code === 'string' ? e.code : undefined,
    status: typeof e.status === 'number' ? e.status : undefined,
    provider: typeof e.provider === 'string' ? e.provider : undefined,
    providerType: typeof e.providerType === 'string' ? e.providerType : undefined,
    retryAfterMs: typeof e.retryAfterMs === 'number' ? e.retryAfterMs : undefined,
    message: typeof e.message === 'string' ? e.message : undefined,
  };
}

/**
 * Transforms any model or runtime error into a clean, single-line headline and actionable hint.
 */
export function presentError(err: unknown): PresentedError {
  if (!err) {
    return {
      headline: 'Unknown error occurred',
      tone: 'error',
    };
  }

  const { name, code, status, provider, providerType, retryAfterMs, message } = extractFields(err);

  // 1. Aborted turns (informational, not an error)
  if (code === 'aborted' || name === 'AbortError') {
    return {
      headline: 'Interrupted',
      tone: 'info',
    };
  }

  // 2. Authentication failures
  if (code === 'auth' || status === 401 || status === 403) {
    const p = provider ?? 'model provider';
    if (status === 401 || status === 403) {
      return {
        headline: `${p} rejected your credentials (HTTP ${status})`,
        hint: `Run /login ${provider ?? ''}`.trim() + ' or check your API key / billing status',
        tone: 'error',
      };
    }
    return {
      headline: `No credentials configured for ${p}`,
      hint: `Run /login ${provider ?? ''}`.trim() + ' or switch models via /model',
      tone: 'error',
    };
  }

  // 3. Rate limiting & Quota exhaustion
  if (code === 'rate-limit' || status === 429) {
    const isQuota = providerType === 'insufficient_quota' || message?.includes('quota');
    if (isQuota) {
      return {
        headline: `Quota or credit exhausted for ${provider ?? 'provider'}`,
        hint: 'Check your provider account balance or switch models with /model',
        tone: 'error',
      };
    }

    const retrySec = retryAfterMs ? Math.ceil(retryAfterMs / 1000) : undefined;
    const retryStr = retrySec ? ` (retry after ${retrySec}s)` : '';
    return {
      headline: `Rate limited by ${provider ?? 'provider'}${retryStr}`,
      hint: 'Waiting before retry or switch models via /model',
      tone: 'error',
    };
  }

  // 4. Overload & Server errors
  if (
    status === 529 ||
    status === 503 ||
    providerType === 'overloaded_error' ||
    providerType === 'api_error'
  ) {
    return {
      headline: `${provider ?? 'Provider'} is currently overloaded`,
      hint: 'Retrying shortly may succeed, or switch models via /model',
      tone: 'warning',
    };
  }

  // 5. Context overflow
  if (code === 'context-overflow' || status === 413) {
    return {
      headline: "Conversation exceeds the model's context window",
      hint: 'Run /clear to start a fresh turn context',
      tone: 'warning',
    };
  }

  // 6. Invalid request
  if (code === 'invalid-request' || status === 400 || status === 404 || status === 422) {
    return {
      headline: message || `Invalid request (HTTP ${status ?? 400})`,
      tone: 'error',
    };
  }

  // 7. Network / connection errors
  if (code === 'network') {
    return {
      headline: `Cannot reach ${provider ?? 'model API'} server`,
      hint: 'Check your internet connection, proxy, or provider endpoint URL',
      tone: 'error',
    };
  }

  // 8. Fallback for generic errors
  const rawMsg = message || String(err) || 'Unexpected error';
  const cleanMsg = rawMsg.length > 120 ? `${rawMsg.slice(0, 117)}…` : rawMsg;

  return {
    headline: cleanMsg,
    hint: 'If the issue persists, run /clear or check ~/.steward/logs',
    tone: 'error',
  };
}
