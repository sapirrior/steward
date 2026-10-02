import { describe, it, expect } from 'bun:test';
import { presentError } from '../src/errors/present.js';

describe('cli/errors/present — presentError', () => {
  it('formats aborted turns as info tone', () => {
    const err = { code: 'aborted', message: 'Inference request aborted.' };
    const res = presentError(err);
    expect(res.headline).toBe('Interrupted');
    expect(res.tone).toBe('info');
    expect(res.hint).toBeUndefined();
  });

  it('formats auth failure without credentials with login hint', () => {
    const err = { code: 'auth', provider: 'anthropic', message: 'No API key configured' };
    const res = presentError(err);
    expect(res.headline).toBe('No credentials configured for anthropic');
    expect(res.hint).toContain('/login anthropic');
    expect(res.tone).toBe('error');
  });

  it('formats auth failure with rejected credentials (HTTP 401)', () => {
    const err = { code: 'auth', status: 401, provider: 'openai', message: 'Invalid API key' };
    const res = presentError(err);
    expect(res.headline).toBe('openai rejected your credentials (HTTP 401)');
    expect(res.hint).toContain('/login openai');
    expect(res.tone).toBe('error');
  });

  it('formats rate limit with retry-after information', () => {
    const err = { code: 'rate-limit', status: 429, provider: 'google', retryAfterMs: 5000 };
    const res = presentError(err);
    expect(res.headline).toBe('Rate limited by google (retry after 5s)');
    expect(res.hint).toContain('/model');
    expect(res.tone).toBe('error');
  });

  it('formats quota exhaustion distinctly from rate limiting', () => {
    const err = {
      code: 'rate-limit',
      status: 429,
      provider: 'openai',
      providerType: 'insufficient_quota',
      message: 'You exceeded your current quota',
    };
    const res = presentError(err);
    expect(res.headline).toBe('Quota or credit exhausted for openai');
    expect(res.hint).toContain('account balance');
    expect(res.tone).toBe('error');
  });

  it('formats overloaded provider error (529 / 503) as warning tone', () => {
    const err = {
      code: 'provider',
      status: 529,
      provider: 'anthropic',
      providerType: 'overloaded_error',
    };
    const res = presentError(err);
    expect(res.headline).toBe('anthropic is currently overloaded');
    expect(res.hint).toContain('Retrying shortly');
    expect(res.tone).toBe('warning');
  });

  it('formats context overflow with /clear hint', () => {
    const err = { code: 'context-overflow', message: 'Context window exceeded' };
    const res = presentError(err);
    expect(res.headline).toBe("Conversation exceeds the model's context window");
    expect(res.hint).toContain('/clear');
    expect(res.tone).toBe('warning');
  });

  it('formats network connection error', () => {
    const err = { code: 'network', provider: 'ollama', message: 'fetch failed' };
    const res = presentError(err);
    expect(res.headline).toBe('Cannot reach ollama server');
    expect(res.hint).toContain('connection');
    expect(res.tone).toBe('error');
  });

  it('formats invalid request with clean error message', () => {
    const err = { code: 'invalid-request', status: 400, message: 'Invalid model parameter' };
    const res = presentError(err);
    expect(res.headline).toBe('Invalid model parameter');
    expect(res.tone).toBe('error');
  });
});
