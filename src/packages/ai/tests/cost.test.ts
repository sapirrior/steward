import { describe, it, expect } from 'bun:test';
import { calculateCost } from '../src/util/cost.ts';
import type { Model, TokenUsage } from '../src/types.ts';

const baseModel: Model = {
  id: 'test-model',
  name: 'Test Model',
  provider: 'openai',
  protocol: 'openai-completions',
  baseUrl: 'https://api.openai.com',
  reasoning: false,
  maxOutputTokens: 4096,
  cost: {
    input: 3.0,   // $3.00 / M tokens
    output: 15.0, // $15.00 / M tokens
    cacheRead: 0.3,
    cacheWrite: 3.75,
  },
};

describe('util/cost — calculateCost', () => {
  it('returns undefined when model has no cost', () => {
    const m = { ...baseModel, cost: undefined };
    expect(calculateCost(m, { input: 100, output: 50 })).toBeUndefined();
  });

  it('calculates input + output cost', () => {
    const result = calculateCost(baseModel, { input: 1_000_000, output: 1_000_000 });
    expect(result).toBeDefined();
    expect(result!.input).toBeCloseTo(3.0);
    expect(result!.output).toBeCloseTo(15.0);
    expect(result!.total).toBeCloseTo(18.0);
  });

  it('includes cache read and write cost', () => {
    const usage: TokenUsage = { input: 0, output: 0, cacheRead: 1_000_000, cacheWrite: 1_000_000 };
    const result = calculateCost(baseModel, usage);
    expect(result!.cacheRead).toBeCloseTo(0.3);
    expect(result!.cacheWrite).toBeCloseTo(3.75);
  });

  it('handles missing usage fields (treats as 0)', () => {
    const result = calculateCost(baseModel, {});
    expect(result!.total).toBeCloseTo(0);
  });

  it('total equals sum of all parts', () => {
    const usage: TokenUsage = { input: 500_000, output: 200_000, cacheRead: 100_000, cacheWrite: 50_000 };
    const result = calculateCost(baseModel, usage);
    const expected = result!.input + result!.output + result!.cacheRead + result!.cacheWrite;
    expect(result!.total).toBeCloseTo(expected);
  });
});
