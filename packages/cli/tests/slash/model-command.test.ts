import { describe, it, expect, beforeEach } from 'bun:test';
import { modelCommand } from '../../src/slash/model/index.js';
import type { CommandContext } from '../../src/slash/types.js';

describe('Slash Command: /model with @steward/models integration', () => {
  let dummySession: any;
  let currentSelection: any;

  beforeEach(() => {
    currentSelection = {
      provider: 'google',
      modelId: 'gemini-2.5-flash',
      effort: 'medium',
    };

    dummySession = {
      getModel: () => currentSelection,
      setModel: (sel: any) => {
        currentSelection = { ...sel };
        return currentSelection;
      },
      aiClient: {
        providers: () => [{ id: 'google' }, { id: 'anthropic' }, { id: 'openai' }],
        models: () => [
          { provider: 'google', id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
          { provider: 'anthropic', id: 'claude-3-7-sonnet', name: 'Claude 3.7 Sonnet' },
        ],
        availableModels: async () => [
          { provider: 'google', id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
        ],
        refreshCatalog: async () => {},
      },
    };
  });

  it('should return showModelPicker when /model is called with no args', async () => {
    const context: CommandContext = {
      session: dummySession,
      cwd: process.cwd(),
      getScreenLines: () => [],
    };

    const result = await modelCommand.execute([], context);
    expect(result.handled).toBe(true);
    expect(result.data?.showModelPicker).toBe(true);
    expect(Array.isArray(result.data?.models)).toBe(true);
  });

  it('should switch model when /model is called with model id argument', async () => {
    const context: CommandContext = {
      session: dummySession,
      cwd: process.cwd(),
      getScreenLines: () => [],
    };

    const result = await modelCommand.execute(['claude-3-7-sonnet'], context);
    expect(result.handled).toBe(true);
    expect(result.message).toContain('Active model switched to');
    expect(currentSelection.modelId).toBe('claude-3-7-sonnet');
  });

  it('should switch model when /model is called with provider and model id argument', async () => {
    const context: CommandContext = {
      session: dummySession,
      cwd: process.cwd(),
      getScreenLines: () => [],
    };

    const result = await modelCommand.execute(['google', 'gemini-2.5-flash'], context);
    expect(result.handled).toBe(true);
    expect(result.message).toContain('Active model switched to google/gemini-2.5-flash');
    expect(currentSelection.provider).toBe('google');
    expect(currentSelection.modelId).toBe('gemini-2.5-flash');
  });
});
