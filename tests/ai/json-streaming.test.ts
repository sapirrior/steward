import { describe, expect, it } from 'bun:test';
import {
  parseJson,
  parseStreamingJson,
  sanitizeSurrogates,
} from '../../src/packages/ai/src/json.js';

describe('JSON and Streaming JSON Parser', () => {
  it('parses valid complete JSON', () => {
    const res = parseJson('{"name": "test", "val": 123}');
    expect(res).toEqual({ name: 'test', val: 123 });
  });

  it('safely parses streaming JSON fragments', () => {
    expect(parseStreamingJson('{"a":')).toEqual({ a: null });
    expect(parseStreamingJson('{"a": 1')).toEqual({ a: 1 });
    expect(parseStreamingJson('{"a": {"b":')).toEqual({ a: { b: null } });
    expect(parseStreamingJson('{"a": [')).toEqual({ a: [] });
    expect(parseStreamingJson('{"name": "hello world')).toEqual({ name: 'hello world' });
  });

  it('handles empty or malformed strings gracefully', () => {
    expect(parseStreamingJson('')).toEqual({});
    expect(parseStreamingJson('   ')).toEqual({});
  });

  it('safely sanitizes Unicode surrogates and handles non-string inputs', () => {
    expect(sanitizeSurrogates('valid text')).toBe('valid text');
    expect(sanitizeSurrogates('lone surrogate \uD800 test')).toBe('lone surrogate  test');
    expect(sanitizeSurrogates(null)).toBe('');
    expect(sanitizeSurrogates(undefined)).toBe('');
    expect(sanitizeSurrogates(123)).toBe('123');
    expect(sanitizeSurrogates({ error: 'failed' })).toBe('{"error":"failed"}');
    expect(sanitizeSurrogates(['a', 'b'])).toBe('["a","b"]');
  });
});
