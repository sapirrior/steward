import { describe, expect, it } from 'bun:test';
import { parseJson, parseStreamingJson } from '../../src/packages/ai/src/json.js';

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
});
