import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import chalk from 'chalk';
import { runHeadlessPrompt, formatHeadlessError } from './headlessRunner.js';
import { themeManager } from '../themes/themeManager.js';
import { SettingsStore } from '../settings/settingsStore.js';
import { ThreadStore } from '../threads/threadStore.js';
import { ToolRegistry } from '../tools/ToolRegistry.js';
import type { AI, InferenceStream, InferenceEvent, InferenceResult } from '@steward/ai';

describe('headlessRunner', () => {
  let tempDir: string;
  let settingsStore: SettingsStore;
  let threadStore: ThreadStore;
  let toolRegistry: ToolRegistry;

  beforeEach(async () => {
    themeManager.setTheme('default');
    tempDir = await mkdtemp(path.join(tmpdir(), 'steward-headless-test-'));
    settingsStore = new SettingsStore(path.join(tempDir, 'settings.json'));
    threadStore = new ThreadStore(path.join(tempDir, 'threads'));
    toolRegistry = new ToolRegistry();
  });

  afterEach(async () => {
    themeManager.setTheme('default');
    process.exitCode = 0;
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('formatHeadlessError', () => {
    it('formats Error instances using active theme error color', () => {
      const err = new Error('Model rate limit reached');
      const formatted = formatHeadlessError(err);

      const expectedColor = themeManager.theme.colors.error;
      expect(formatted).toBe(chalk.hex(expectedColor)('Error: Model rate limit reached'));
    });

    it('strips redundant Error: prefix from message', () => {
      const err = new Error('Error: Something went wrong');
      const formatted = formatHeadlessError(err);

      const expectedColor = themeManager.theme.colors.error;
      expect(formatted).toBe(chalk.hex(expectedColor)('Error: Something went wrong'));
    });

    it('dynamically adapts to active theme colors', () => {
      themeManager.setTheme('github');
      const err = new Error('Permission denied');
      const formatted = formatHeadlessError(err);

      const githubErrorColor = themeManager.theme.colors.error;
      expect(formatted).toBe(chalk.hex(githubErrorColor)('Error: Permission denied'));
    });
  });

  describe('runHeadlessPrompt', () => {
    it('streams response text directly to stdout', async () => {
      let stdoutContent = '';
      let stderrContent = '';

      const mockStdout = {
        write: (chunk: string) => {
          stdoutContent += chunk;
          return true;
        },
      } as unknown as NodeJS.WriteStream;

      const mockStderr = {
        write: (chunk: string) => {
          stderrContent += chunk;
          return true;
        },
      } as unknown as NodeJS.WriteStream;

      const mockAi: AI = {
        stream: () => {
          const events: InferenceEvent[] = [
            { type: 'text-delta', delta: 'Hello from ' },
            { type: 'text-delta', delta: 'headless mode!' },
          ];

          return {
            async *[Symbol.asyncIterator]() {
              for (const e of events) yield e;
            },
            async result(): Promise<InferenceResult> {
              return {
                finishReason: 'stop',
                message: {
                  role: 'assistant',
                  content: [{ type: 'text', text: 'Hello from headless mode!' }],
                },
                usage: { input: 10, output: 5, total: 15 },
              };
            },
          } as unknown as InferenceStream;
        },
      } as unknown as AI;

      const result = await runHeadlessPrompt('test prompt', {
        ai: mockAi,
        settingsStore,
        threadStore,
        toolRegistry,
        stdout: mockStdout,
        stderr: mockStderr,
      });

      expect(result.stopReason).toBe('natural');
      expect(stdoutContent).toContain('Hello from headless mode!\n');
      expect(stderrContent).toBe('');
      expect(process.exitCode).toBe(0);
    });

    it('formats error using theme color to stderr and sets exit code 1 when turn errors', async () => {
      let stdoutContent = '';
      let stderrContent = '';

      const mockStdout = {
        write: (chunk: string) => {
          stdoutContent += chunk;
          return true;
        },
      } as unknown as NodeJS.WriteStream;

      const mockStderr = {
        write: (chunk: string) => {
          stderrContent += chunk;
          return true;
        },
      } as unknown as NodeJS.WriteStream;

      const mockAi: AI = {
        stream: () => {
          return {
            async *[Symbol.asyncIterator]() {
              // empty iterator
            },
            async result(): Promise<InferenceResult> {
              return {
                finishReason: 'error',
                message: { role: 'assistant', content: [] },
                usage: { input: 0, output: 0, total: 0 },
                error: {
                  name: 'AIError',
                  message: 'Authentication failed (invalid API key)',
                  code: 'auth',
                } as any,
              };
            },
          } as unknown as InferenceStream;
        },
      } as unknown as AI;

      const result = await runHeadlessPrompt('failing prompt', {
        ai: mockAi,
        settingsStore,
        threadStore,
        toolRegistry,
        stdout: mockStdout,
        stderr: mockStderr,
      });

      expect(result.stopReason).toBe('error');
      expect(process.exitCode).toBe(1);

      const expectedColor = themeManager.theme.colors.error;
      const expectedError = chalk.hex(expectedColor)('Error: Authentication failed (invalid API key)');
      expect(stderrContent).toContain(expectedError);
    });
  });
});
