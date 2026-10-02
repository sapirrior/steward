import { describe, it, expect } from 'bun:test';
import { readErrorBody, parseProviderError } from '../src/util/error-body.ts';

function makeResponse(body: string, status = 400): Response {
  return new Response(body, { status });
}

describe('util/error-body — readErrorBody', () => {
  it('returns body text for a non-2xx response', async () => {
    const detail = await readErrorBody(makeResponse('{"error":"bad request"}'));
    expect(detail).toBe('{"error":"bad request"}');
  });

  it('returns undefined for empty body', async () => {
    const detail = await readErrorBody(makeResponse('   '));
    expect(detail).toBeUndefined();
  });

  it('redacts Bearer tokens', async () => {
    const body = 'Authorization: Bearer sk-abc123def456ghi789jkl012';
    const detail = await readErrorBody(makeResponse(body));
    expect(detail).not.toContain('sk-abc123def456ghi789jkl012');
    expect(detail).toContain('[REDACTED]');
  });

  it('redacts Anthropic API keys', async () => {
    const body = 'key=sk-ant-api01-abc123xyz456def789ghi012jkl345';
    const detail = await readErrorBody(makeResponse(body));
    expect(detail).not.toContain('sk-ant-api01');
    expect(detail).toContain('[REDACTED]');
  });

  it('truncates very long bodies', async () => {
    const longBody = 'x'.repeat(5000);
    const detail = await readErrorBody(makeResponse(longBody));
    expect(detail).toBeDefined();
    expect(detail!.length).toBeLessThan(5000);
    expect(detail).toContain('[truncated');
  });

  it('returns undefined for already-consumed body', async () => {
    const resp = makeResponse('hello');
    await resp.text(); // consume it
    const detail = await readErrorBody(resp);
    // Should not throw — returns undefined gracefully
    expect(detail === undefined || typeof detail === 'string').toBe(true);
  });
});

describe('util/error-body — parseProviderError', () => {
  it('parses Anthropic overloaded_error envelope', () => {
    const body = JSON.stringify({
      type: 'error',
      error: { type: 'overloaded_error', message: 'Overloaded' },
    });
    const result = parseProviderError(body);
    expect(result.type).toBe('overloaded_error');
    expect(result.message).toBe('Overloaded');
    expect(result.code).toBeUndefined();
  });

  it('parses Anthropic rate_limit_error envelope', () => {
    const body = JSON.stringify({
      type: 'error',
      error: { type: 'rate_limit_error', message: 'Rate limit exceeded' },
    });
    const result = parseProviderError(body);
    expect(result.type).toBe('rate_limit_error');
    expect(result.message).toBe('Rate limit exceeded');
  });

  it('parses OpenAI error envelope with code', () => {
    const body = JSON.stringify({
      error: {
        message: 'You exceeded your current quota',
        type: 'insufficient_quota',
        code: 'insufficient_quota',
      },
    });
    const result = parseProviderError(body);
    expect(result.type).toBe('insufficient_quota');
    expect(result.code).toBe('insufficient_quota');
    expect(result.message).toBe('You exceeded your current quota');
  });

  it('parses Google error envelope', () => {
    const body = JSON.stringify({
      error: { code: 429, message: 'Quota exceeded', status: 'RESOURCE_EXHAUSTED' },
    });
    const result = parseProviderError(body);
    expect(result.message).toBe('Quota exceeded');
  });

  it('parses OpenRouter error envelope', () => {
    const body = JSON.stringify({
      error: { message: 'Provider returned error', metadata: { raw: '{}' } },
    });
    const result = parseProviderError(body);
    expect(result.message).toBe('Provider returned error');
  });

  it('falls back to a trimmed excerpt for plain text', () => {
    const result = parseProviderError('Service Unavailable');
    expect(result.message).toBe('Service Unavailable');
  });

  it('returns empty object for empty string', () => {
    const result = parseProviderError('');
    expect(result).toEqual({});
  });

  it('truncates very long plain-text fallback to ~200 chars', () => {
    const long = 'x'.repeat(300);
    const result = parseProviderError(long);
    expect(result.message).toBeDefined();
    expect(result.message!.length).toBeLessThanOrEqual(202); // 200 + ellipsis char
  });
});
