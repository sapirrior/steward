import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { initCommand } from '../src/app/commands/init/index.js';
import { copyCommand } from '../src/app/commands/copy/index.js';
import { compileHooksConfig } from '../src/packages/plugins/src/hooks/config.js';

describe('Slash Commands: /init and /copy', () => {
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
});
