import { describe, it, expect } from 'bun:test';
import { classifyHttpError, AIError } from '../src/errors.ts';

describe('errors — classifyHttpError', () => {
  it('classifies 401/403 as auth error', () => {
    const err = classifyHttpError(401, 'Unauthorized', 'anthropic');
    expect(err).toBeInstanceOf(AIError);
    expect(err.code).toBe('auth');
    expect(err.provider).toBe('anthropic');
    expect(err.retryable).toBe(false);
  });

  it('classifies 429 as rate-limit error (retryable)', () => {
    const err = classifyHttpError(429, 'Too many requests', 'openai');
    expect(err.code).toBe('rate-limit');
    expect(err.retryable).toBe(true);
  });

  it('classifies 413 or prompt overflow as context-overflow', () => {
    const err413 = classifyHttpError(413, 'Payload too large', 'openai');
    expect(err413.code).toBe('context-overflow');

    const errPattern = classifyHttpError(
      400,
      'prompt is too long for model context window',
      'anthropic',
    );
    expect(errPattern.code).toBe('context-overflow');
  });

  it('classifies 400/404/422 as invalid-request', () => {
    const err = classifyHttpError(400, 'Invalid parameters', 'google');
    expect(err.code).toBe('invalid-request');
    expect(err.retryable).toBe(false);
  });

  it('classifies 500/502/503/504 as provider error (retryable)', () => {
    const err = classifyHttpError(503, 'Service unavailable', 'openai');
    expect(err.code).toBe('provider');
    expect(err.retryable).toBe(true);
  });
});
