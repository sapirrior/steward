import { describe, expect, it } from 'bun:test';
import { normalizeSDKError, redactSensitiveData, StewardSDKError } from './errors.js';

describe('redactSensitiveData', () => {
  it('redacts openai/anthropic style sk- keys', () => {
    const text = 'Failed with token sk-abcdef1234567890xyz and secret';
    expect(redactSensitiveData(text)).toBe('Failed with token sk-***[REDACTED]*** and secret');
  });

  it('redacts Bearer tokens', () => {
    const text = 'Authorization: Bearer secret_token_xyz_12345';
    expect(redactSensitiveData(text)).toBe('Authorization: Bearer ***[REDACTED]***');
  });
});

describe('normalizeSDKError', () => {
  it('identifies abort signal errors', () => {
    const abortErr = new Error('The operation was aborted');
    abortErr.name = 'AbortError';
    const normalized = normalizeSDKError(abortErr);
    expect(normalized.kind).toBe('abort');
    expect(normalized.retryable).toBe(false);
  });

  it('identifies authentication errors (401)', () => {
    const authErr = { status: 401, message: 'Invalid API Key' };
    const normalized = normalizeSDKError(authErr);
    expect(normalized.kind).toBe('auth');
    expect(normalized.retryable).toBe(false);
  });

  it('identifies rate-limit errors (429) with retry-after header', () => {
    const rateErr = {
      status: 429,
      message: 'Rate limit exceeded',
      responseHeaders: {
        get: (h: string) => (h === 'retry-after' ? '5' : null),
      },
    };
    const normalized = normalizeSDKError(rateErr);
    expect(normalized.kind).toBe('rate-limit');
    expect(normalized.retryable).toBe(true);
    expect(normalized.retryAfterMs).toBe(5000);
  });

  it('identifies network failures as retryable network errors', () => {
    const netErr = { code: 'ECONNRESET', message: 'Connection reset by peer' };
    const normalized = normalizeSDKError(netErr);
    expect(normalized.kind).toBe('network');
    expect(normalized.retryable).toBe(true);
  });

  it('identifies context-length errors', () => {
    const ctxErr = { status: 413, message: 'Prompt exceeded maximum context length' };
    const normalized = normalizeSDKError(ctxErr);
    expect(normalized.kind).toBe('context-length');
    expect(normalized.retryable).toBe(false);
  });

  it('falls back to provider error category for 5xx server issues (retryable)', () => {
    const serverErr = { status: 503, message: 'Service Unavailable' };
    const normalized = normalizeSDKError(serverErr);
    expect(normalized.kind).toBe('provider');
    expect(normalized.retryable).toBe(true);
  });

  it('falls back to provider-default for unknown exceptions (non-retryable)', () => {
    const unknownErr = new Error('Something completely unexpected occurred');
    const normalized = normalizeSDKError(unknownErr, {
      provider: 'test-prov',
      modelId: 'test-mod',
    });
    expect(normalized.kind).toBe('provider');
    expect(normalized.retryable).toBe(false);
    expect(normalized.provider).toBe('test-prov');
    expect(normalized.modelId).toBe('test-mod');
  });

  it('preserves already normalized StewardSDKError directly', () => {
    const existing = new StewardSDKError({
      kind: 'auth',
      message: 'Already normalized',
      retryable: false,
    });
    expect(normalizeSDKError(existing)).toBe(existing);
  });
});
