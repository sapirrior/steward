import { describe, it, expect } from 'bun:test';
import { isContextOverflow } from '../src/util/overflow.ts';
import { AIError } from '../src/errors.ts';
import type { InferenceResult } from '../src/types.ts';

function errorResult(errorMsg: string, detail?: string): InferenceResult {
  return {
    message: { role: 'assistant', content: [] },
    usage: {},
    finishReason: 'error',
    error: new AIError(errorMsg, { code: 'provider', detail }),
  };
}

function stopResult(input: number, output: number): InferenceResult {
  return {
    message: {
      role: 'assistant',
      content: [],
      meta: {
        provider: 'openai',
        protocol: 'openai-completions',
        modelId: 'm',
        usage: { input, output },
      },
    },
    usage: { input, output },
    finishReason: 'stop',
  };
}

function lengthResult(input: number, output: number): InferenceResult {
  return {
    message: {
      role: 'assistant',
      content: [],
      meta: {
        provider: 'openai',
        protocol: 'openai-completions',
        modelId: 'm',
        usage: { input, output },
      },
    },
    usage: { input, output },
    finishReason: 'length',
  };
}

describe('util/overflow — isContextOverflow', () => {
  it('Anthropic: detects "prompt is too long"', () => {
    expect(
      isContextOverflow(errorResult('prompt is too long: 213462 tokens > 200000 maximum')),
    ).toBe(true);
  });

  it('Anthropic: detects request_too_large', () => {
    expect(isContextOverflow(errorResult('request_too_large error'))).toBe(true);
  });

  it('OpenAI: detects exceeds the context window', () => {
    expect(
      isContextOverflow(errorResult('Your input exceeds the context window of this model')),
    ).toBe(true);
  });

  it('OpenAI-compatible: detects maximum context length pattern', () => {
    expect(
      isContextOverflow(
        errorResult(
          "Requested token count exceeds the model's maximum context length of 131072 tokens",
        ),
      ),
    ).toBe(true);
  });

  it('Google: detects input token count exceeds', () => {
    expect(
      isContextOverflow(
        errorResult(
          'The input token count (1196265) exceeds the maximum number of tokens allowed (1048575)',
        ),
      ),
    ).toBe(true);
  });

  it('GitHub Copilot: detects prompt token count exceeds limit', () => {
    expect(
      isContextOverflow(errorResult('prompt token count of 50000 exceeds the limit of 32768')),
    ).toBe(true);
  });

  it('OpenRouter: detects maximum context length', () => {
    expect(
      isContextOverflow(errorResult("This endpoint's maximum context length is 8192 tokens")),
    ).toBe(true);
  });

  it('llama.cpp: detects exceeds available context size', () => {
    expect(
      isContextOverflow(
        errorResult('the request exceeds the available context size, try increasing it'),
      ),
    ).toBe(true);
  });

  it('does NOT flag rate-limit errors', () => {
    expect(isContextOverflow(errorResult('rate limit exceeded, too many tokens per minute'))).toBe(
      false,
    );
  });

  it('does NOT flag too many requests', () => {
    expect(isContextOverflow(errorResult('too many requests, slow down'))).toBe(false);
  });

  it('does NOT flag normal stop', () => {
    expect(isContextOverflow(stopResult(100, 50))).toBe(false);
  });

  it('detects silent overflow when input > contextWindow', () => {
    expect(isContextOverflow(stopResult(200_000, 100), 128_000)).toBe(true);
  });

  it('does NOT flag silent overflow when input within window', () => {
    expect(isContextOverflow(stopResult(50_000, 100), 128_000)).toBe(false);
  });

  it('detects length-stop with zero output filling context (MiMo-style)', () => {
    expect(isContextOverflow(lengthResult(127_900, 0), 128_000)).toBe(true);
  });

  it('does NOT flag length-stop with normal output', () => {
    expect(isContextOverflow(lengthResult(100, 50), 128_000)).toBe(false);
  });
});
