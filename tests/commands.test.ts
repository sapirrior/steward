import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { initCommand } from '../src/app/commands/init/index.js';
import { copyCommand } from '../src/app/commands/copy/index.js';
import { exportCommand } from '../src/app/commands/export/index.js';
import { usageCommand } from '../src/app/commands/usage/index.js';
import { compileHooksConfig } from '../src/packages/plugins/src/hooks/config.js';

describe('Slash Commands: /init, /copy, /usage, /export', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'steward-init-test-'));
  });

  afterEach(() => {
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  describe('/init command', () => {
    it('should scaffold AGENTS.md, .steward/hooks.json, and .agents/skills/ in empty directory', async () => {
      const result = await initCommand.execute([], {
        cwd: tempDir,
        session: {} as any,
      });

      expect(result.handled).toBe(true);
      expect(result.message).toContain('Project initialized successfully!');
      expect(result.message).toContain('AGENTS.md');
      expect(result.message).toContain('.steward/hooks.json');
      expect(result.message).toContain('.agents/skills/');

      // Verify files on disk
      expect(existsSync(join(tempDir, 'AGENTS.md'))).toBe(true);
      expect(existsSync(join(tempDir, '.steward', 'hooks.json'))).toBe(true);
      expect(existsSync(join(tempDir, '.agents', 'skills'))).toBe(true);

      // Verify generated hooks.json passes strict schema validation
      const hooksRaw = JSON.parse(readFileSync(join(tempDir, '.steward', 'hooks.json'), 'utf-8'));
      const { hooks, error } = compileHooksConfig(hooksRaw, 'project');
      expect(error).toBeUndefined();
      expect(hooks.length).toBeGreaterThan(0);
      expect(hooks.every((h) => h.enabled === false)).toBe(true);
    });

    it('should detect Node package.json scripts when generating AGENTS.md', async () => {
      writeFileSync(
        join(tempDir, 'package.json'),
        JSON.stringify({ name: 'my-test-app', scripts: { test: 'vitest', build: 'tsc' } }),
      );

      await initCommand.execute([], {
        cwd: tempDir,
        session: {} as any,
      });

      const agentsMd = readFileSync(join(tempDir, 'AGENTS.md'), 'utf-8');
      expect(agentsMd).toContain('Node.js / TypeScript');
      expect(agentsMd).toContain('npm run test');
      expect(agentsMd).toContain('npm run build');
    });

    it('should not overwrite existing AGENTS.md or hooks.json on subsequent runs', async () => {
      writeFileSync(join(tempDir, 'AGENTS.md'), '# Existing Custom Guidelines');

      const result = await initCommand.execute([], {
        cwd: tempDir,
        session: {} as any,
      });

      expect(result.handled).toBe(true);
      expect(result.message).toContain('Preserved: AGENTS.md (already exists)');

      const agentsMd = readFileSync(join(tempDir, 'AGENTS.md'), 'utf-8');
      expect(agentsMd).toBe('# Existing Custom Guidelines');
    });
  });

  describe('/copy command', () => {
    it('should reject if session is busy', async () => {
      const result = await copyCommand.execute([], {
        cwd: tempDir,
        session: { isBusy: true, getHistory: () => [] } as any,
      });

      expect(result.handled).toBe(true);
      expect(result.message).toContain('Cannot copy while the agent is generating a response.');
    });

    it('should report when no assistant messages exist', async () => {
      const result = await copyCommand.execute([], {
        cwd: tempDir,
        session: {
          isBusy: false,
          getHistory: () => [{ role: 'user', content: 'hello' }],
        } as any,
      });

      expect(result.handled).toBe(true);
      expect(result.message).toContain('No previous AI response found to copy.');
    });

    it('should extract text and copy when assistant message is present', async () => {
      const mockHistory = [
        { role: 'user', content: 'Hi' },
        {
          role: 'assistant',
          content: [
            { type: 'thinking', thinking: 'Thinking step' },
            { type: 'text', text: 'Hello, I am Steward!' },
          ],
        },
      ];

      const result = await copyCommand.execute([], {
        cwd: tempDir,
        session: {
          isBusy: false,
          getHistory: () => mockHistory,
        } as any,
      });

      expect(result.handled).toBe(true);
      expect(result.message).toContain('Copied last AI response to clipboard.');
    });
  });

  describe('/usage command', () => {
    it('should format zero usage cleanly on fresh session', async () => {
      const result = await usageCommand.execute([], {
        cwd: tempDir,
        session: {
          session: { turns: [], createdAt: new Date().toISOString() },
          getModel: () => ({ provider: 'gemini', modelId: 'gemini-2.5-flash', effort: 'medium' }),
          getUsage: () => ({ inputTokens: 0, outputTokens: 0, totalTokens: 0 }),
        } as any,
      });

      expect(result.handled).toBe(true);
      expect(result.message).toContain('Session Usage & Analytics:');
      expect(result.message).toContain('• Active Model: gemini-2.5-flash (gemini)');
      expect(result.message).toContain('• Activity: 0 turns (0 tool executions)');
      expect(result.message).toContain('• Context Window:');
      expect(result.message).toContain('• Input Tokens: 0');
      expect(result.message).toContain('• Output Tokens: 0');
      expect(result.message).toContain('• Total Tokens: 0');
      expect(result.message).toContain('• Session Spend: $0.00 USD');
    });

    it('should format token breakdown with reasoning, cache metrics, and cost estimate', async () => {
      const result = await usageCommand.execute([], {
        cwd: tempDir,
        session: {
          session: {
            turns: [
              { messages: [{ role: 'tool' }] },
              { messages: [{ role: 'assistant', content: [{ type: 'tool-call' }] }] },
              { messages: [] },
            ],
            createdAt: new Date(Date.now() - 120_000).toISOString(),
          },
          getModel: () => ({ provider: 'anthropic', modelId: 'claude-3-7-sonnet', effort: 'high' }),
          getUsage: () => ({
            inputTokens: 15420,
            outputTokens: 2310,
            totalTokens: 17730,
            reasoningTokens: 1200,
            cacheReadTokens: 10500,
            cacheWriteTokens: 1200,
          }),
        } as any,
      });

      expect(result.handled).toBe(true);
      expect(result.message).toContain(
        '• Active Model: claude-3-7-sonnet (anthropic, effort: high)',
      );
      expect(result.message).toContain('• Activity: 3 turns (2 tool executions)');
      expect(result.message).toContain('• Context Window:');
      expect(result.message).toContain('• Input Tokens: 15,420');
      expect(result.message).toContain('• Output Tokens: 2,310');
      expect(result.message).toContain('• Reasoning Tokens: 1,200');
      expect(result.message).toContain('• Cache Read Tokens: 10,500');
      expect(result.message).toContain('• Cache Write Tokens: 1,200');
      expect(result.message).toContain('• Total Tokens: 17,730');
      expect(result.message).toContain('• Session Spend: ~');
    });
  });

  describe('/export command', () => {
    it('should reject if session is busy', async () => {
      const result = await exportCommand.execute([], {
        cwd: tempDir,
        session: { isBusy: true, session: { turns: [] } } as any,
      });

      expect(result.handled).toBe(true);
      expect(result.message).toContain('Cannot export while the agent is generating a response.');
    });

    it('should export banner transcript when no conversation messages exist', async () => {
      const result = await exportCommand.execute([], {
        cwd: tempDir,
        session: {
          isBusy: false,
          session: { turns: [], model: { modelId: 'gpt-4o', provider: 'openai' } },
        } as any,
      });

      expect(result.handled).toBe(true);
      expect(result.message).toContain('Copied conversation transcript to clipboard.');
    });

    it('should copy 1:1 UI screen lines when live buffer is available', async () => {
      const mockScreenLines = [
        '❯ hi',
        '',
        '● Hi! How can I help you today?',
        '',
        '✻ Done · 3:59 PM',
      ];

      const result = await exportCommand.execute([], {
        cwd: tempDir,
        session: { isBusy: false, session: { turns: [] } } as any,
        getScreenLines: () => mockScreenLines,
      });

      expect(result.handled).toBe(true);
      expect(result.message).toContain('Copied conversation transcript to clipboard.');
    });

    it('should export 1:1 UI text to file when filename is provided', async () => {
      const mockScreenLines = [
        '❯ please create sample.txt with hello world',
        '',
        '● write_file(sample.txt)',
        '  └ Wrote 1 line to sample.txt',
        '    1 hello world',
        '',
        '● Done! Created sample.txt with "hello world".',
        '',
        '✻ Done · 4:01 PM',
      ];

      const exportFile = join(tempDir, 'exports', 'transcript.txt');
      const result = await exportCommand.execute([exportFile], {
        cwd: tempDir,
        session: { isBusy: false, session: { turns: [] } } as any,
        getScreenLines: () => mockScreenLines,
      });

      expect(result.handled).toBe(true);
      expect(result.message).toContain('Conversation transcript exported to');
      expect(existsSync(exportFile)).toBe(true);

      const content = readFileSync(exportFile, 'utf-8');
      expect(content).toContain('❯ please create sample.txt with hello world');
      expect(content).toContain('● write_file(sample.txt)');
      expect(content).toContain('  └ Wrote 1 line to sample.txt');
      expect(content).toContain('● Done! Created sample.txt with "hello world".');
      expect(content).toContain('✻ Done · 4:01 PM');
    });
  });
});
