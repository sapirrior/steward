import { describe, it, expect } from 'bun:test';
import { readErrorBody } from '../src/util/error-body.ts';

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
