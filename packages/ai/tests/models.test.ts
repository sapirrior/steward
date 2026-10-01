import { describe, it, expect } from 'bun:test';
import {
  clampThinkingEffort,
  getSupportedEfforts,
  calculateAnthropicBudgetTokens,
} from '../src/models/thinking.ts';
import {
  parseModelsDevModel,
  inferProtocolForModel,
  supportsReasoning,
  filterModels,
  MODELS,
} from '../src/models/catalog.ts';
import { resolveModelSelection, inferProviderFromModelId } from '../src/models/selection.ts';
import type { Model } from '../src/types.ts';

describe('models/thinking — clampThinkingEffort & getSupportedEfforts', () => {
  const nonReasoningModel: Model = {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    protocol: 'openai-responses',
    baseUrl: 'https://api.openai.com/v1',
    reasoning: false,
    input: ['text', 'image'],
    contextWindow: 128000,
    maxOutputTokens: 4096,
    temperature: true,
  };

  const fullReasoningModel: Model = {
    id: 'gpt-5.4',
    name: 'GPT-5.4',
    provider: 'openai',
    protocol: 'openai-responses',
    baseUrl: 'https://api.openai.com/v1',
    reasoning: true,
    thinkingLevelMap: {
      none: 'none',
      low: 'low',
      medium: 'medium',
      high: 'high',
      xhigh: 'xhigh',
    },
    input: ['text', 'image'],
    contextWindow: 200000,
    maxOutputTokens: 16384,
    temperature: true,
  };

  const restrictedModel: Model = {
    id: 'custom-r1',
    name: 'Custom R1',
    provider: 'openrouter',
    protocol: 'anthropic-messages',
    baseUrl: 'https://openrouter.ai/api/v1',
    reasoning: true,
    thinkingLevelMap: {
      none: null, // cannot turn off
      low: null,
      medium: 'medium',
      high: 'high',
      xhigh: null,
    },
    input: ['text'],
    contextWindow: 64000,
    maxOutputTokens: 8192,
    temperature: true,
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
    expect(clampThinkingEffort(restrictedModel, 'none')).toBe('medium');
    expect(clampThinkingEffort(restrictedModel, 'xhigh')).toBe('high');
  });

  it('calculateAnthropicBudgetTokens respects effort and max tokens ceiling', () => {
    expect(calculateAnthropicBudgetTokens('none', 8192)).toBeUndefined();
    expect(calculateAnthropicBudgetTokens('low', 8192)).toBe(2048);
    expect(calculateAnthropicBudgetTokens('medium', 8192)).toBe(4096);
    expect(calculateAnthropicBudgetTokens('high', 8192)).toBe(7168);
  });
});

describe('models/catalog — parseModelsDevModel & inferProtocolForModel', () => {
  it('filters out deprecated models', () => {
    const item = parseModelsDevModel('openai', {
      id: 'old-model',
      name: 'Old Model',
      status: 'deprecated',
      tool_call: true,
      modalities: { input: ['text'] },
      limit: { context: 1000, output: 1000 },
    });
    expect(item).toBeUndefined();
  });

  it('filters out models without tool support', () => {
    const item = parseModelsDevModel('openai', {
      id: 'chat-only',
      name: 'Chat Only',
      tool_call: false,
      modalities: { input: ['text'] },
      limit: { context: 1000, output: 1000 },
    });
    expect(item).toBeUndefined();
  });

  it('filters out non-text models', () => {
    const item = parseModelsDevModel('openai', {
      id: 'image-model',
      name: 'Image Only',
      tool_call: true,
      modalities: { input: ['image'] },
      limit: { context: 1000, output: 1000 },
    });
    expect(item).toBeUndefined();
  });

  it('parses valid active model with pricing and context', () => {
    const item = parseModelsDevModel('anthropic', {
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
    expect(supportsReasoning(item!)).toBe(true);
  });

  it('infers correct protocol for known models', () => {
    expect(inferProtocolForModel('anthropic', 'claude-sonnet-4-5')).toBe('anthropic-messages');
    expect(inferProtocolForModel('openai', 'gpt-5.4')).toBe('openai-responses');
    expect(inferProtocolForModel('openrouter', 'anthropic/claude-sonnet-4.5')).toBe('openai-completions');
    expect(inferProtocolForModel('openrouter', 'meta-llama-3')).toBe('openai-completions');
  });

  it('static MODELS catalog is populated offline with valid context windows', () => {
    expect(MODELS.length).toBeGreaterThan(0);
    for (const m of MODELS) {
      expect(m.contextWindow).toBeGreaterThan(0);
      expect(m.maxOutputTokens).toBeGreaterThan(0);
      expect(m.input).toContain('text');
      expect(m.baseUrl).toBeTruthy();
    }
  });

  it('filterModels applies structured filters correctly', () => {
    const anthropicModels = filterModels(MODELS, { provider: 'anthropic' });
    expect(anthropicModels.length).toBeGreaterThan(0);
    expect(anthropicModels.every((m) => m.provider === 'anthropic')).toBe(true);

    const reasoningModels = filterModels(MODELS, { reasoning: true });
    expect(reasoningModels.every((m) => m.reasoning === true)).toBe(true);
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
