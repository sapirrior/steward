import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'bun:test';

const testDir = join(tmpdir(), 'steward-test-' + Date.now());
mkdirSync(testDir, { recursive: true });
process.env.STEWARD_SETTINGS_DIR = join(testDir, 'settings');
process.env.STEWARD_SESSIONS_DIR = join(testDir, 'sessions');
process.env.STEWARD_LOGS_DIR = join(testDir, 'logs');

import {
  ALL_PROVIDER_NAMES,
  getAvailableProviders,
  hasProviderConfig,
  type EnvConfig,
} from '../src/packages/services/src/config/index.js';
import { PROVIDER_REGISTRY, PROVIDER_SELECTION_PRIORITY, resolveModelSelection } from '@steward/ai';
import { fetchDeepSeekModels, fetchOpenRouterModels } from '@steward/ai';

describe('Provider Configuration & Discovery', () => {
  it('should include all 11 canonical providers in ALL_PROVIDER_NAMES and priority list', () => {
    expect(ALL_PROVIDER_NAMES).toEqual([
      'gemini',
      'anthropic',
      'openai',
      'deepseek',
      'openrouter',
      'github-copilot',
      'groq',
      'xai',
      'mistral',
      'ollama',
      'custom',
    ]);
    expect(PROVIDER_SELECTION_PRIORITY).toEqual([
      'gemini',
      'anthropic',
      'openai',
      'deepseek',
      'groq',
      'xai',
      'mistral',
      'github-copilot',
      'ollama',
      'openrouter',
      'custom',
    ]);
  });

  it('should accurately detect configured providers via hasProviderConfig and getAvailableProviders', () => {
    const emptyConfig: EnvConfig = { custom: {} };
    expect(getAvailableProviders(emptyConfig)).toEqual([]);

    const openrouterConfig: EnvConfig = { openrouterApiKey: 'or-test-key', custom: {} };
    expect(hasProviderConfig('openrouter', openrouterConfig)).toBe(true);
    expect(hasProviderConfig('deepseek', openrouterConfig)).toBe(false);
    expect(getAvailableProviders(openrouterConfig)).toEqual(['openrouter']);
  });

  it('should update sessionData.model when setModel is called on AgentSession', async () => {
    process.env['OPENAI_API_KEY'] = 'sk-mock-key';
    process.env['GEMINI_API_KEY'] = 'mock-gemini-key';

    const { AgentSession } = await import('../src/packages/agents/src/engine/agent-session.js');
    const session = new AgentSession({ provider: 'openai', modelId: 'gpt-4o-mini' });

    expect(session.getModel().provider).toBe('openai');
    expect(session.session.model.provider).toBe('openai');
    expect(session.session.model.modelId).toBe('gpt-4o-mini');

    // Switch model to gemini
    session.setModel({ provider: 'gemini', modelId: 'gemini-2.5-flash', effort: 'medium' });

    expect(session.getModel().provider).toBe('gemini');
    expect(session.getModel().modelId).toBe('gemini-2.5-flash');
    expect(session.session.model.provider).toBe('gemini');
    expect(session.session.model.modelId).toBe('gemini-2.5-flash');
  });

  it('should update reasoning effort on AgentSession and sessionData.model', async () => {
    process.env['OPENAI_API_KEY'] = 'sk-mock-key';

    const { AgentSession } = await import('../src/packages/agents/src/engine/agent-session.js');
    const session = new AgentSession({ provider: 'openai', modelId: 'gpt-4o-mini' });

    expect(session.getEffort()).toBe('medium');
    expect(session.session.model.effort).toBe('medium');

    session.setEffort('high');
    expect(session.getEffort()).toBe('high');
    expect(session.session.model.effort).toBe('high');

    session.setEffort('none', false);
    expect(session.getEffort()).toBe('none');
    expect(session.session.model.effort).toBe('none');
  });

  it('should trigger EffortPicker dock when /effort is called with no arguments', async () => {
    const { effortCommand } = await import('../src/app/commands/effort/index.js');
    const { AgentSession } = await import('../src/packages/agents/src/engine/agent-session.js');
    const session = new AgentSession({ provider: 'openai', modelId: 'gpt-4o-mini' });

    const result = await effortCommand.execute([], { session, cwd: process.cwd() });
    expect(result.handled).toBe(true);
    expect(result.data?.showEffortPicker).toBe(true);

    const directResult = await effortCommand.execute(['high'], { session, cwd: process.cwd() });
    expect(directResult.handled).toBe(true);
    expect(session.getEffort()).toBe('high');
  });

  it('should parse legacy session schemas without effort gracefully', async () => {
    const { parseSessionDocument } =
      await import('../src/packages/services/src/session/validate.js');

    const legacyRaw = JSON.stringify({
      schemaVersion: 1,
      id: 'legacy-session-1',
      name: 'Legacy Session',
      date: '2026-09-15',
      createdAt: '2026-09-15T00:00:00.000Z',
      updatedAt: '2026-09-15T00:00:00.000Z',
      model: {
        provider: 'anthropic',
        modelId: 'claude-3-7-sonnet-20250219',
      },
      totalUsage: {
        inputTokens: 10,
        outputTokens: 5,
        totalTokens: 15,
      },
      turns: [],
    });

    const parsed = parseSessionDocument(legacyRaw);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.doc.model.provider).toBe('anthropic');
      expect(parsed.doc.model.modelId).toBe('claude-3-7-sonnet-20250219');
    }
  });
});
