import { describe, expect, it } from 'bun:test';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  createSession,
  listSessions,
  loadSession,
  saveSession,
} from '../src/services/session/store.js';
import { parseSessionDocument } from '../src/services/session/validate.js';

describe('Session Persistence & Recovery', () => {
  it('parseSessionDocument handles non-standard effort strings gracefully without failing schema validation', () => {
    const rawDoc = JSON.stringify({
      schemaVersion: 1,
      id: 'test-effort-compat',
      name: 'Test Non-Standard Effort',
      date: '2026-10-02',
      createdAt: '2026-10-02T10:00:00.000Z',
      updatedAt: '2026-10-02T10:00:00.000Z',
      model: {
        provider: 'openrouter',
        modelId: 'openrouter/free',
        effort: 'provider-default',
      },
      totalUsage: {
        input: 100,
        output: 50,
        total: 150,
      },
      turns: [],
    });

    const result = parseSessionDocument(rawDoc);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.doc.id).toBe('test-effort-compat');
      expect(result.doc.model.provider).toBe('openrouter');
      expect(result.doc.model.effort).toBeUndefined();
    }
  });

  it('parseSessionDocument handles null token usage fields in legacy/historical sessions', () => {
    const rawDoc = JSON.stringify({
      schemaVersion: 1,
      id: 'test-null-tokens',
      name: 'Test Null Tokens',
      date: '2026-10-02',
      createdAt: '2026-10-02T10:00:00.000Z',
      updatedAt: '2026-10-02T10:00:00.000Z',
      model: {
        provider: 'google',
        modelId: 'gemini-2.5-flash',
        effort: 'medium',
      },
      totalUsage: {
        input: null,
        output: null,
        total: null,
        inputTokens: null,
        outputTokens: null,
        totalTokens: null,
        reasoningTokens: null,
      },
      turns: [
        {
          id: 'turn-1',
          timestamp: '2026-10-02T10:00:05.000Z',
          status: 'complete',
          usage: {
            input: null,
            output: null,
            total: null,
            inputTokens: null,
            outputTokens: null,
            totalTokens: null,
          },
          messages: [{ role: 'user', content: 'hello' }],
        },
      ],
    });

    const result = parseSessionDocument(rawDoc);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.doc.id).toBe('test-null-tokens');
      expect(result.doc.totalUsage.input).toBe(0);
      expect(result.doc.totalUsage.output).toBe(0);
      expect(result.doc.totalUsage.total).toBe(0);
      expect(result.doc.turns[0].usage.total).toBe(0);
    }
  });

  it('saveSession and listSessions end-to-end roundtrip without quarantining valid session', () => {
    const testDir = join(import.meta.dir, 'tmp-sessions-test');
    mkdirSync(testDir, { recursive: true });
    process.env.STEWARD_SESSIONS_DIR = testDir;

    try {
      const session = createSession({
        provider: 'openai',
        modelId: 'gpt-4o',
        effort: 'high',
      });
      session.name = 'Persistence Verification Session';

      const savedPath = saveSession(session);
      expect(savedPath).toBeTruthy();

      const loaded = loadSession(session.id);
      expect(loaded).not.toBeNull();
      expect(loaded?.id).toBe(session.id);
      expect(loaded?.name).toBe('Persistence Verification Session');

      const summaries = listSessions();
      expect(summaries.length).toBeGreaterThanOrEqual(1);
      const found = summaries.find((s) => s.id === session.id);
      expect(found).toBeDefined();
      expect(found?.name).toBe('Persistence Verification Session');
    } finally {
      delete process.env.STEWARD_SESSIONS_DIR;
      try {
        rmSync(testDir, { recursive: true, force: true });
      } catch {}
    }
  });
});
