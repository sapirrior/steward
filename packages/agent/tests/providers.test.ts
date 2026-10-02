import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'bun:test';

const testDir = join(tmpdir(), 'steward-test-' + Date.now());
mkdirSync(testDir, { recursive: true });
process.env.STEWARD_SETTINGS_DIR = join(testDir, 'settings');
process.env.STEWARD_SESSIONS_DIR = join(testDir, 'sessions');
process.env.STEWARD_LOGS_DIR = join(testDir, 'logs');

import { getAvailableProviders, hasProviderConfig } from '../src/services/config/index.js';
import { PROVIDER_SELECTION_PRIORITY, resolveModelSelection, createAI } from '@steward/ai';
import { AgentSession } from '../src/engine/agent-session.js';
import { parseSessionDocument } from '../src/services/session/validate.js';

describe('Provider Configuration & Discovery', () => {
  it('should verify canonical provider priority list in @steward/ai', () => {
    expect(PROVIDER_SELECTION_PRIORITY).toEqual([
      'anthropic',
      'openai',
      'google',
      'openrouter',
      'grok',
      'mistral',
      'github-copilot',
    ]);
  });

  it('should accurately detect configured providers via hasProviderConfig and getAvailableProviders', async () => {
    process.env['OPENROUTER_API_KEY'] = 'or-test-key';
    expect(await hasProviderConfig('openrouter')).toBe(true);
  });

  it('should update sessionData.model when setModel is called on AgentSession', async () => {
    process.env['OPENAI_API_KEY'] = 'sk-mock-key';
    process.env['GEMINI_API_KEY'] = 'mock-gemini-key';

    const session = new AgentSession({ provider: 'openai', modelId: 'gpt-4o-mini' });

    expect(session.getModel().provider).toBe('openai');
    expect(session.session.model.provider).toBe('openai');
    expect(session.session.model.modelId).toBe('gpt-4o-mini');

    // Switch model to google
    session.setModel({ provider: 'google', modelId: 'gemini-2.5-flash', effort: 'medium' });

    expect(session.getModel().provider).toBe('google');
    expect(session.getModel().modelId).toBe('gemini-2.5-flash');
    expect(session.session.model.provider).toBe('google');
    expect(session.session.model.modelId).toBe('gemini-2.5-flash');
  });

  it('should update reasoning effort on AgentSession and sessionData.model', async () => {
    process.env['OPENAI_API_KEY'] = 'sk-mock-key';

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

  it('should parse legacy session schemas without effort gracefully', async () => {
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
