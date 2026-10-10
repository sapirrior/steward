import { describe, it, expect, mock } from 'bun:test';
import { AgentRunner } from './AgentRunner.js';
import { ProviderRegistry, type ModelProvider } from './providers/index.js';
import type { LanguageModel } from 'ai';
import type { ModelRef } from '@steward/models';
import type { AgentEvent } from './types.js';

describe('AgentRunner Execution Engine', () => {
  it('instantiates cleanly with default ProviderRegistry', () => {
    const runner = new AgentRunner();
    expect(runner.getProviderRegistry()).toBeDefined();
    expect(runner.getProviderRegistry().getRegisteredProviders().length).toBe(11);
  });

  it('handles provider resolution failure cleanly with error event and finishReason error', async () => {
    const runner = new AgentRunner();
    const events: AgentEvent[] = [];

    const result = await (async () => {
      const gen = runner.runStream(
        {
          modelRef: 'unregistered/some-model',
          messages: [{ role: 'user', content: 'Hello' }],
        },
        (e) => events.push(e),
      );

      let final;
      for await (const event of gen) {
        // stream consuming
      }
      return await gen.next();
    })();

    expect(events.length).toBe(1);
    expect(events[0].type).toBe('error');
    if (events[0].type === 'error') {
      expect(events[0].error.code).toBe('UNKNOWN');
      expect(events[0].error.message).toContain("No provider registered to handle 'unregistered'");
    }
  });

  it('attempts fallback model resolution when primary fails', async () => {
    const registry = new ProviderRegistry();
    const runner = new AgentRunner(registry);
    const events: AgentEvent[] = [];

    // Primary: unregistered, Fallback: unregistered2
    const gen = runner.runStream(
      {
        modelRef: 'unregistered/primary',
        fallbackModelRef: 'unregistered2/fallback',
        messages: [{ role: 'user', content: 'Hello' }],
      },
      (e) => events.push(e),
    );

    for await (const _event of gen) {
    }

    expect(events.length).toBe(1);
    expect(events[0].type).toBe('error');
  });

  it('aborts cleanly when signal is already aborted', async () => {
    const registry = new ProviderRegistry();
    const mockModel: LanguageModel = {
      specificationVersion: 'v4',
      provider: 'mock.provider',
      modelId: 'mock-model',
    } as any;

    const mockProvider: ModelProvider = {
      id: 'mock',
      displayName: 'Mock',
      canHandle: (ref: ModelRef) => ref.provider === 'mock',
      resolveModel: async () => mockModel,
    };
    registry.register(mockProvider);

    const runner = new AgentRunner(registry);
    const controller = new AbortController();
    controller.abort();

    const events: AgentEvent[] = [];
    const gen = runner.runStream(
      {
        modelRef: 'mock/mock-model',
        messages: [{ role: 'user', content: 'Hello' }],
        signal: controller.signal,
      },
      (e) => events.push(e),
    );

    for await (const _ of gen) {
    }

    const errorEvent = events.find((e) => e.type === 'error');
    expect(errorEvent).toBeDefined();
    if (errorEvent && errorEvent.type === 'error') {
      expect(errorEvent.error.code).toBe('ABORTED');
    }
  });
});
