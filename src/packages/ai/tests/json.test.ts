import { describe, it, expect } from 'bun:test';
import { parseJson, parseStreamingJson } from '../src/util/json.ts';
import { AIError } from '../src/errors.ts';

describe('util/json — parseJson', () => {
  it('parses valid JSON', () => {
    expect(parseJson('{"a":1}')).toEqual({ a: 1 });
  });

  it('throws AIError on invalid JSON', () => {
    expect(() => parseJson('not json')).toThrow(AIError);
    try {
      parseJson('bad');
    } catch (e) {
      expect(e).toBeInstanceOf(AIError);
      expect((e as AIError).code).toBe('parse');
    }
  });
});

describe('util/json — parseStreamingJson', () => {
  it('returns complete object', () => {
    expect(parseStreamingJson('{"x":42}')).toEqual({ x: 42 });
  });

  it('returns {} for empty string', () => {
    expect(parseStreamingJson('')).toEqual({});
  });

  it('repairs open object with missing closing brace', () => {
    const result = parseStreamingJson('{"name":"Alice"');
    expect(result).toMatchObject({ name: 'Alice' });
  });

  it('repairs open string', () => {
    const result = parseStreamingJson('{"name":"Ali');
    // Should not throw; returns partial
    expect(typeof result).toBe('object');
  });

  it('handles trailing colon', () => {
    const result = parseStreamingJson('{"name":');
    expect(typeof result).toBe('object');
  });

  it('handles trailing comma', () => {
    const result = parseStreamingJson('{"a":1,');
    expect((result as { a: number }).a).toBe(1);
  });

  it('handles nested objects', () => {
    const result = parseStreamingJson('{"a":{"b":1}');
    expect((result as { a: { b: number } }).a.b).toBe(1);
  });

  it('returns {} for non-object input', () => {
    expect(parseStreamingJson('[1,2')).toEqual({});
  });
});
