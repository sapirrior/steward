import { describe, expect, it } from 'bun:test';
import { parseModelIdentifier } from './modelId.js';
import { StewardSDKError } from './errors.js';

describe('parseModelIdentifier', () => {
  it('parses standard single-slash provider and modelId', () => {
    const result = parseModelIdentifier('anthropic/claude-sonnet-4-5');
    expect(result).toEqual({
      provider: 'anthropic',
      modelId: 'claude-sonnet-4-5',
    });
  });

  it('splits strictly on the first slash for multi-slash models (e.g. openrouter/openrouter/free)', () => {
    const result = parseModelIdentifier('openrouter/openrouter/free');
    expect(result).toEqual({
      provider: 'openrouter',
      modelId: 'openrouter/free',
    });
  });

  it('handles deeply nested slashes correctly after the first slash', () => {
    const result = parseModelIdentifier('openrouter/google/gemini-2.5-flash:preview/sub');
    expect(result).toEqual({
      provider: 'openrouter',
      modelId: 'google/gemini-2.5-flash:preview/sub',
    });
  });

  it('normalizes provider to lowercase but preserves modelId casing', () => {
    const result = parseModelIdentifier('OpenAI/GPT-4o-Mini');
    expect(result).toEqual({
      provider: 'openai',
      modelId: 'GPT-4o-Mini',
    });
  });

  it('trims leading and trailing whitespace', () => {
    const result = parseModelIdentifier('   google / gemini-2.5-pro   ');
    expect(result).toEqual({
      provider: 'google',
      modelId: 'gemini-2.5-pro',
    });
  });

  it('throws invalid-input error if input lacks a slash', () => {
    expect(() => parseModelIdentifier('claude-sonnet-4-5')).toThrow(StewardSDKError);
    try {
      parseModelIdentifier('claude-sonnet-4-5');
    } catch (e) {
      const err = e as StewardSDKError;
      expect(err.kind).toBe('invalid-input');
      expect(err.retryable).toBe(false);
    }
  });

  it('throws invalid-input error if provider is empty', () => {
    expect(() => parseModelIdentifier('/gpt-4o')).toThrow(StewardSDKError);
    try {
      parseModelIdentifier('   / gpt-4o');
    } catch (e) {
      const err = e as StewardSDKError;
      expect(err.kind).toBe('invalid-input');
      expect(err.retryable).toBe(false);
    }
  });

  it('throws invalid-input error if modelId is empty', () => {
    expect(() => parseModelIdentifier('openai/')).toThrow(StewardSDKError);
    try {
      parseModelIdentifier('openai /   ');
    } catch (e) {
      const err = e as StewardSDKError;
      expect(err.kind).toBe('invalid-input');
      expect(err.retryable).toBe(false);
    }
  });

  it('throws invalid-input error if input is not a string', () => {
    // @ts-expect-error test non-string input
    expect(() => parseModelIdentifier(null)).toThrow(StewardSDKError);
  });
});
