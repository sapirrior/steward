import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { QueryEngine } from './QueryEngine.js';
import { SettingsStore } from '../settings/settingsStore.js';
import { ThreadStore } from '../threads/threadStore.js';
import { ToolRegistry } from '../tools/ToolRegistry.js';
import { FileReadTool } from '../tools/FileReadTool/FileReadTool.js';
import { BashTool } from '../tools/BashTool/BashTool.js';
import { GlobTool } from '../tools/GlobTool/GlobTool.js';
import type { AI, InferenceStream, InferenceEvent, InferenceResult } from '@steward/ai';
import type { QueryEngineEvent } from './types.js';

describe('QueryEngine', () => {
  let tempDir: string;
  let settingsStore: SettingsStore;
  let threadStore: ThreadStore;
  let toolRegistry: ToolRegistry;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), 'steward-query-test-'));
    settingsStore = new SettingsStore(path.join(tempDir, 'settings.json'));
    threadStore = new ThreadStore(path.join(tempDir, 'threads'));
    toolRegistry = new ToolRegistry();
    toolRegistry.register(new FileReadTool());
    toolRegistry.register(new GlobTool());
    toolRegistry.register(new BashTool());
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('strictly excludes bash tool in headless mode', async () => {
    const settings = await settingsStore.load();
    expect(settings.tools.bash).toBe(true);

    const interactiveEngine = new QueryEngine({
      settingsStore,
      threadStore,
      toolRegistry,
      isHeadless: false,
    });
    const interactiveSpecs = interactiveEngine.getActiveToolSpecs(settings);
    expect(interactiveSpecs.some((s) => s.name === 'bash')).toBe(true);

    const headlessEngine = new QueryEngine({
      settingsStore,
      threadStore,
      toolRegistry,
      isHeadless: true,
    });
    const headlessSpecs = headlessEngine.getActiveToolSpecs(settings);
    expect(headlessSpecs.some((s) => s.name === 'bash')).toBe(false);
    expect(headlessSpecs.some((s) => s.name === 'read')).toBe(true);
    expect(headlessSpecs.some((s) => s.name === 'glob')).toBe(true);
  });

  it('respects other enabled and disabled tools in settings', async () => {
    await settingsStore.update({
      tools: {
        read: true,
        glob: false,
        grep: false,
        webfetch: false,
        websearch: false,
        bash: true,
      },
    });

    const settings = await settingsStore.load();

    const headlessEngine = new QueryEngine({
      settingsStore,
      threadStore,
      toolRegistry,
      isHeadless: true,
    });

    const specs = headlessEngine.getActiveToolSpecs(settings);
    const names = specs.map((s) => s.name);

    expect(names).toContain('read');
    expect(names).not.toContain('glob');
    expect(names).not.toContain('bash');
  });

  it('executes a text streaming turn and persists to thread store', async () => {
    const mockEvents: InferenceEvent[] = [
      { type: 'text-delta', delta: 'The quick ' },
      { type: 'text-delta', delta: 'brown fox.' },
      {
        type: 'done',
        message: {
          role: 'assistant',
          content: [{ type: 'text', text: 'The quick brown fox.' }],
        },
        usage: { input: 12, output: 6, total: 18 },
        finishReason: 'stop',
      },
    ];

    const mockResult: InferenceResult = {
      message: {
        role: 'assistant',
        content: [{ type: 'text', text: 'The quick brown fox.' }],
      },
      usage: { input: 12, output: 6, total: 18 },
      finishReason: 'stop',
    };

    const mockAi = {
      stream: mock(() => ({
        async *[Symbol.asyncIterator]() {
          for (const ev of mockEvents) yield ev;
        },
        async result() {
          return mockResult;
        },
      })),
    } as unknown as AI;

    const engine = new QueryEngine({
      cwd: tempDir,
      settingsStore,
      threadStore,
      toolRegistry,
      ai: mockAi,
      isHeadless: true,
    });

    const events: QueryEngineEvent[] = [];
    const turnResult = await engine.submitMessage('Hello!', (ev) => {
      events.push(ev);
    });

    expect(turnResult.text).toBe('The quick brown fox.');
    expect(turnResult.stopReason).toBe('natural');
    expect(turnResult.totalUsage.total).toBe(18);

    // Verify events were emitted
    const textDeltas = events.filter((e) => e.type === 'text-delta');
    expect(textDeltas.length).toBe(2);

    // Verify messages persisted to thread store
    const savedThread = await threadStore.load(engine.getThreadId());
    expect(savedThread).not.toBeNull();
    expect(savedThread?.messages.some((m) => m.role === 'user')).toBe(true);
    expect(savedThread?.messages.some((m) => m.role === 'assistant')).toBe(true);
    expect(savedThread?.totalUsage.total).toBe(18);
  });

  it('executes a multi-step tool call and completes', async () => {
    const testFilePath = path.join(tempDir, 'demo.txt');
    await writeFile(testFilePath, 'Sample File Content', 'utf-8');

    let callCount = 0;
    const mockAi = {
      stream: mock((_req) => {
        callCount++;
        if (callCount === 1) {
          // First step: model calls 'read' tool
          return {
            async *[Symbol.asyncIterator]() {
              yield {
                type: 'tool-call-start',
                id: 'call_1',
                name: 'read',
              };
              yield {
                type: 'tool-call-end',
                toolCall: {
                  type: 'tool-call',
                  id: 'call_1',
                  name: 'read',
                  arguments: { path: testFilePath },
                },
              };
              yield {
                type: 'done',
                message: {
                  role: 'assistant',
                  content: [
                    {
                      type: 'tool-call',
                      id: 'call_1',
                      name: 'read',
                      arguments: { path: testFilePath },
                    },
                  ],
                },
                usage: { input: 10, output: 5, total: 15 },
                finishReason: 'tool-calls',
              };
            },
            async result() {
              return {
                message: {
                  role: 'assistant',
                  content: [
                    {
                      type: 'tool-call',
                      id: 'call_1',
                      name: 'read',
                      arguments: { path: testFilePath },
                    },
                  ],
                },
                usage: { input: 10, output: 5, total: 15 },
                finishReason: 'tool-calls',
              };
            },
          };
        } else {
          // Second step: model answers after receiving tool result
          return {
            async *[Symbol.asyncIterator]() {
              yield { type: 'text-delta', delta: 'File content read successfully.' };
              yield {
                type: 'done',
                message: {
                  role: 'assistant',
                  content: [{ type: 'text', text: 'File content read successfully.' }],
                },
                usage: { input: 20, output: 5, total: 25 },
                finishReason: 'stop',
              };
            },
            async result() {
              return {
                message: {
                  role: 'assistant',
                  content: [{ type: 'text', text: 'File content read successfully.' }],
                },
                usage: { input: 20, output: 5, total: 25 },
                finishReason: 'stop',
              };
            },
          };
        }
      }),
    } as unknown as AI;

    const engine = new QueryEngine({
      cwd: tempDir,
      settingsStore,
      threadStore,
      toolRegistry,
      ai: mockAi,
      isHeadless: true,
    });

    const emittedToolStarts: any[] = [];
    const turnResult = await engine.submitMessage('Read demo.txt', (ev) => {
      if (ev.type === 'tool-call-start') {
        emittedToolStarts.push(ev);
      }
    });

    expect(turnResult.text).toBe('File content read successfully.');
    expect(emittedToolStarts.length).toBe(1);
    expect(emittedToolStarts[0].name).toBe('read');
    expect(turnResult.toolResults.length).toBe(1);
    expect(turnResult.toolResults[0].isError).toBe(false);
  });
});
