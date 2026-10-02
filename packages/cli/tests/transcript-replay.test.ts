import { describe, it, expect } from 'bun:test';
import { TerminalEngine } from 'stitchable';
import { renderTranscript } from '../src/ui/utils/transcript.js';
import Header from '../src/ui/components/Header.js';
import type { SessionData } from '@steward/agent';

describe('cli/ui/utils/transcript — Session Transcript Replay', () => {
  it('renders error badge when replaying an errored session turn', () => {
    const engine = new TerminalEngine();
    const header = new Header({
      version: '1.0.0',
      model: { provider: 'anthropic', modelId: 'claude-3-7-sonnet' },
      cwd: '/test/workspace',
    });

    const sessionData: SessionData = {
      schemaVersion: 1,
      id: 'session-err-1',
      name: 'Errored Turn Session',
      date: '2026-10-02',
      createdAt: '2026-10-02T10:00:00.000Z',
      updatedAt: '2026-10-02T10:01:00.000Z',
      model: { provider: 'anthropic', modelId: 'claude-3-7-sonnet' },
      totalUsage: { input: 10, output: 5, total: 15 },
      turns: [
        {
          id: 'turn-err-1',
          status: 'errored',
          usage: { input: 10, output: 5, total: 15 },
          messages: [{ role: 'user', content: 'Do something that fails' }],
        },
      ],
    };

    renderTranscript(engine, sessionData, header);
    const historyText = engine.history.getAllLines().join('\n');
    expect(historyText).toContain('Do something that fails');
    // Error badge indicator should be committed for errored turn
    expect(historyText).toContain('Turn failed with error');
  });

  it('renders interrupted badge when replaying an aborted session turn', () => {
    const engine = new TerminalEngine();
    const header = new Header({
      version: '1.0.0',
      model: { provider: 'openai', modelId: 'gpt-4o' },
      cwd: '/test/workspace',
    });

    const sessionData: SessionData = {
      schemaVersion: 1,
      id: 'session-abort-1',
      name: 'Aborted Turn Session',
      date: '2026-10-02',
      createdAt: '2026-10-02T10:00:00.000Z',
      updatedAt: '2026-10-02T10:01:00.000Z',
      model: { provider: 'openai', modelId: 'gpt-4o' },
      totalUsage: { input: 0, output: 0, total: 0 },
      turns: [
        {
          id: 'turn-abort-1',
          status: 'interrupted',
          usage: { input: 0, output: 0, total: 0 },
          messages: [{ role: 'user', content: 'Run long command' }],
        },
      ],
    };

    renderTranscript(engine, sessionData, header);
    const historyText = engine.history.getAllLines().join('\n');
    expect(historyText).toContain('Run long command');
    expect(historyText).toContain('Interrupted');
  });
});
