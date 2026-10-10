import { describe, it, expect } from 'bun:test';
import { APICallError, LoadAPIKeyError, RetryError } from 'ai';
import { normalizeAgentError, AgentError } from './index.js';

describe('AgentError and errorNormalizer', () => {
  it('returns an existing AgentError unchanged', () => {
    const original = new AgentError({
      code: 'AUTH_MISSING',
      message: 'Already normalized',
      retryable: false,
    });
    const result = normalizeAgentError(original);
    expect(result).toBe(original);
    expect(result.code).toBe('AUTH_MISSING');
  });

  it('normalizes abort signal and AbortError to ABORTED code', () => {
    const controller = new AbortController();
    controller.abort();

    const result = normalizeAgentError(new Error('AbortError'), {
      signal: controller.signal,
      modelRef: 'anthropic/claude-3-7-sonnet-20250219',
    });

    expect(result.code).toBe('ABORTED');
    expect(result.retryable).toBe(false);
    expect(result.provider).toBe('anthropic');
    expect(result.modelId).toBe('claude-3-7-sonnet-20250219');
  });

  it('normalizes LoadAPIKeyError to AUTH_MISSING with helpful guidance', () => {
    const raw = new LoadAPIKeyError({ message: 'Missing API key' });
    const result = normalizeAgentError(raw, {
      modelRef: { provider: 'openrouter', modelId: 'anthropic/claude-3.5-sonnet' },
    });

    expect(result.code).toBe('AUTH_MISSING');
    expect(result.message).toContain('steward login openrouter');
    expect(result.retryable).toBe(false);
  });

  it('normalizes 401/403 APICallError to AUTH_INVALID', () => {
    const raw = new APICallError({
      message: 'Unauthorized',
      url: 'https://api.anthropic.com/v1/messages',
      requestBodyValues: {},
      statusCode: 401,
      isRetryable: false,
    });

    const result = normalizeAgentError(raw, { modelRef: 'anthropic/claude-3-7-sonnet' });
    expect(result.code).toBe('AUTH_INVALID');
    expect(result.status).toBe(401);
    expect(result.retryable).toBe(false);
  });

  it('normalizes 429 APICallError with retry-after header to RATE_LIMITED', () => {
    const raw = new APICallError({
      message: 'Rate limit reached',
      url: 'https://api.openai.com/v1/chat/completions',
      requestBodyValues: {},
      statusCode: 429,
      responseHeaders: { 'retry-after': '3' },
      isRetryable: true,
    });

    const result = normalizeAgentError(raw, { modelRef: 'openai/gpt-4o' });
    expect(result.code).toBe('RATE_LIMITED');
    expect(result.status).toBe(429);
    expect(result.retryable).toBe(true);
    expect(result.retryAfterMs).toBe(3000);
  });

  it('normalizes 503/529 server errors to SERVER_OVERLOADED with retryable true', () => {
    const raw = new APICallError({
      message: 'Overloaded',
      url: 'https://api.anthropic.com/v1/messages',
      requestBodyValues: {},
      statusCode: 529,
      isRetryable: true,
    });

    const result = normalizeAgentError(raw, { modelRef: 'anthropic/claude-3-7-sonnet' });
    expect(result.code).toBe('SERVER_OVERLOADED');
    expect(result.status).toBe(529);
    expect(result.retryable).toBe(true);
  });

  it('unwraps RetryError to extract underlying failure', () => {
    const inner = new APICallError({
      message: 'Rate limited',
      url: 'https://api.openai.com/v1',
      requestBodyValues: {},
      statusCode: 429,
      isRetryable: true,
    });

    const rawRetry = new RetryError({
      message: 'Retry failed',
      reason: 'maxRetriesExceeded',
      errors: [inner],
    });

    const result = normalizeAgentError(rawRetry);
    expect(result.code).toBe('RATE_LIMITED');
    expect(result.status).toBe(429);
  });

  it('normalizes socket/network errors to NETWORK_ERROR with retryable true', () => {
    const networkErr = new Error('fetch failed: connect ECONNRESET 1.2.3.4:443');
    const result = normalizeAgentError(networkErr);

    expect(result.code).toBe('NETWORK_ERROR');
    expect(result.retryable).toBe(true);
  });
});
