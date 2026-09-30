import { describe, it, expect } from 'bun:test';
import { sanitizeSurrogates } from '../src/util/sanitize.ts';

describe('util/sanitize — sanitizeSurrogates', () => {
  it('returns string unchanged when no surrogates', () => {
    expect(sanitizeSurrogates('hello world')).toBe('hello world');
  });

  it('removes lone high surrogate', () => {
    const input = 'a\uD800b';
    expect(sanitizeSurrogates(input)).toBe('ab');
  });

  it('removes lone low surrogate', () => {
    const input = 'a\uDC00b';
    expect(sanitizeSurrogates(input)).toBe('ab');
  });

  it('preserves valid surrogate pairs', () => {
    // U+1F600 GRINNING FACE = \uD83D\uDE00
    const emoji = '\uD83D\uDE00';
    expect(sanitizeSurrogates(emoji)).toBe(emoji);
  });

  it('removes unpaired surrogates but keeps paired ones', () => {
    const input = '\uD83D\uDE00\uD800text';
    expect(sanitizeSurrogates(input)).toBe('\uD83D\uDE00text');
  });

  it('handles null → empty string', () => {
    expect(sanitizeSurrogates(null)).toBe('');
  });

  it('handles undefined → empty string', () => {
    expect(sanitizeSurrogates(undefined)).toBe('');
  });

  it('coerces numbers to string', () => {
    expect(sanitizeSurrogates(42)).toBe('42');
  });

  it('coerces objects via JSON.stringify', () => {
    expect(sanitizeSurrogates({ a: 1 })).toBe('{"a":1}');
  });
});
