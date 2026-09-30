import { describe, it, expect } from 'bun:test';
import {
  clampThinkingEffort,
  getSupportedEfforts,
  calculateAnthropicBudgetTokens,
} from '../src/models/thinking.ts';
import { parseModelsDevItem, inferProtocolForModel } from '../src/models/catalog.ts';
import { resolveModelSelection, inferProviderFromModelId } from '../src/models/selection.ts';
import type { Model } from '../src/types.ts';

describe('models/thinking — clampThinkingEffort & getSupportedEfforts', () => {
  const nonReasoningModel: Model = {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    protocol: 'openai-responses',
    baseUrl: '',
    reasoning: false,
    maxOutputTokens: 4096,
  };

  const fullReasoningModel: Model = {
    id: 'gpt-5.4',
    name: 'GPT-5.4',
    provider: 'openai',
    protocol: 'openai-responses',
    baseUrl: '',
    reasoning: true,
    thinkingLevelMap: {
      none: 'none',
      low: 'low',
      medium: 'medium',
      high: 'high',
      xhigh: 'xhigh',
    },
    maxOutputTokens: 16384,
  };

  const restrictedModel: Model = {
    id: 'custom-r1',
    name: 'Custom R1',
    provider: 'openrouter',
    protocol: 'openai-completions',
    baseUrl: '',
    reasoning: true,
    thinkingLevelMap: {
      none: null, // cannot turn off
      low: null,
      medium: 'medium',
      high: 'high',
      xhigh: null,
    },
    maxOutputTokens: 8192,
  };

  it('non-reasoning model always returns none', () => {
    expect(getSupportedEfforts(nonReasoningModel)).toEqual(['none']);
    expect(clampThinkingEffort(nonReasoningModel, 'high')).toBe('none');
    expect(clampThinkingEffort(nonReasoningModel, 'low')).toBe('none');
  });

  it('full reasoning model preserves requested effort', () => {
    expect(clampThinkingEffort(fullReasoningModel, 'xhigh')).toBe('xhigh');
    expect(clampThinkingEffort(fullReasoningModel, 'high')).toBe('high');
    expect(clampThinkingEffort(fullReasoningModel, 'none')).toBe('none');
  });

  it('restricted model clamps unavailable effort to closest supported tier', () => {
    expect(getSupportedEfforts(restrictedModel)).toEqual(['medium', 'high']);
    // 'none' requested -> clamped to closest supported ('medium')
    expect(clampThinkingEffort(restrictedModel, 'none')).toBe('medium');
    // 'xhigh' requested -> clamped to closest supported ('high')
    expect(clampThinkingEffort(restrictedModel, 'xhigh')).toBe('high');
  });

  it('calculateAnthropicBudgetTokens respects effort and max tokens ceiling', () => {
    expect(calculateAnthropicBudgetTokens('none', 8192)).toBeUndefined();
    expect(calculateAnthropicBudgetTokens('low', 8192)).toBe(2048);
    expect(calculateAnthropicBudgetTokens('medium', 8192)).toBe(4096);
    // high is 16384, but maxOutput 8192 - 1024 = 7168 cap
    expect(calculateAnthropicBudgetTokens('high', 8192)).toBe(7168);
  });
});

describe('models/catalog — parseModelsDevItem & inferProtocolForModel', () => {
  it('filters out deprecated models', () => {
    const item = parseModelsDevItem('openai', {
      id: 'old-model',
      name: 'Old Model',
      status: 'deprecated',
      tool_call: true,
      modalities: { input: ['text'] },
    });
    expect(item).toBeUndefined();
  });

  it('filters out models without tool support', () => {
    const item = parseModelsDevItem('openai', {
      id: 'chat-only',
      name: 'Chat Only',
      tool_call: false,
      modalities: { input: ['text'] },
    });
    expect(item).toBeUndefined();
  });

  it('filters out non-text models (e.g. image/audio only)', () => {
    const item = parseModelsDevItem('openai', {
      id: 'image-model',
      name: 'Image Only',
      tool_call: true,
      modalities: { input: ['image'] },
    });
    expect(item).toBeUndefined();
  });

  it('parses valid active model with pricing and context', () => {
    const item = parseModelsDevItem('anthropic', {
      id: 'claude-sonnet-4-5',
      name: 'Claude Sonnet 4.5',
      tool_call: true,
      reasoning: true,
      reasoning_options: [{ type: 'budget_tokens' }],
      limit: { context: 200000, output: 64000 },
      cost: { input: 3, output: 15, cache_read: 0.3, cache_write: 3.75 },
      modalities: { input: ['text', 'image'] },
    });
    expect(item).toBeDefined();
    expect(item?.id).toBe('claude-sonnet-4-5');
    expect(item?.protocol).toBe('anthropic-messages');
    expect(item?.contextWindow).toBe(200000);
    expect(item?.cost?.input).toBe(3);
  });

  it('infers correct protocol for Copilot models', () => {
    expect(inferProtocolForModel('github-copilot', 'claude-sonnet-4-5')).toBe('anthropic-messages');
    expect(inferProtocolForModel('github-copilot', 'gpt-5.4')).toBe('openai-responses');
    expect(inferProtocolForModel('github-copilot', 'meta-llama-3')).toBe('openai-completions');
  });
});

describe('models/selection — resolveModelSelection', () => {
  it('infers provider from modelId', () => {
    expect(inferProviderFromModelId('claude-sonnet-4-5')).toBe('anthropic');
    expect(inferProviderFromModelId('gpt-5.4')).toBe('openai');
    expect(inferProviderFromModelId('gemini-3.5-flash')).toBe('google');
    expect(inferProviderFromModelId('anthropic/claude-sonnet-4.5')).toBe('openrouter');
  });

  it('resolves explicit provider and modelId', async () => {
    const sel = await resolveModelSelection(
      { provider: 'anthropic', modelId: 'claude-sonnet-4-5', effort: 'high' },
      { isConfigured: () => true },
    );
    expect(sel.provider).toBe('anthropic');
    expect(sel.modelId).toBe('claude-sonnet-4-5');
    expect(sel.effort).toBe('high');
  });

  it('resolves provider default when modelId is omitted', async () => {
    const sel = await resolveModelSelection(
      { provider: 'openai' },
      { isConfigured: () => true },
    );
    expect(sel.provider).toBe('openai');
    expect(sel.modelId).toBe('gpt-5.4');
  });
});
