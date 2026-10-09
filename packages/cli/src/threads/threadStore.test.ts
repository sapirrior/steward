import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import os from 'node:os';
import path from 'node:path';
import { rm, writeFile, mkdir, readdir } from 'node:fs/promises';
import { ThreadStore, ThreadStorageError } from './threadStore.js';
import type { Message, AssistantMessage, ToolMessage, UserMessage } from '@steward/ai';

describe('ThreadStore Hardcore Test Suite', () => {
  let tempDir: string;
  let store: ThreadStore;

  beforeEach(async () => {
    tempDir = path.join(
      os.tmpdir(),
      `steward-threads-hardcore-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    await mkdir(tempDir, { recursive: true });
    store = new ThreadStore(tempDir);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  // ─── 1. Basic Lifecycle & Integrity ──────────────────────────────────────────

  it('creates and saves a thread atomically with complete metadata', async () => {
    const thread = store.create({
      model: 'claude-3-7-sonnet',
      cwd: '/workspace/project',
      gitBranch: 'feature/hardcore-tests',
      messages: [{ role: 'user', content: 'Explain quantum computing in simple terms' }],
    });

    expect(thread.id).toMatch(/^th_[a-z0-9]+/);
    expect(thread.createdAt).toBeDefined();
    expect(thread.updatedAt).toBeDefined();

    await store.save(thread);

    const loaded = await store.load(thread.id);
    expect(loaded).not.toBeNull();
    expect(loaded?.id).toBe(thread.id);
    expect(loaded?.model).toBe('claude-3-7-sonnet');
    expect(loaded?.cwd).toBe('/workspace/project');
    expect(loaded?.gitBranch).toBe('feature/hardcore-tests');
    expect(loaded?.title).toBe('Explain quantum computing in simple terms');
    expect(loaded?.messages.length).toBe(1);
  });

  // ─── 2. Auto-Title Extraction Edge Cases ─────────────────────────────────────

  it('handles diverse title extraction edge cases', async () => {
    // A. Plain short prompt
    expect(store.generateTitle('Hello world')).toBe('Hello world');

    // B. Extra whitespace & newlines
    expect(store.generateTitle('   \n  Fix   the  bug  in  \t parser.ts  \n ')).toBe(
      'Fix the bug in parser.ts',
    );

    // C. Long prompt needing truncation without cutting words
    const longPrompt =
      'Refactor the entire authentication system to use asymmetric cryptography and PKCE flow with OAuth providers';
    const title = store.generateTitle(longPrompt);
    expect(title.length).toBeLessThanOrEqual(52);
    expect(title.endsWith('...')).toBe(true);
    expect(title).toBe('Refactor the entire authentication system to...');

    // D. Empty prompt
    expect(store.generateTitle('')).toBe('New Thread');
    expect(store.generateTitle('   ')).toBe('New Thread');

    // E. Multimodal TextContent[] message
    const thread = store.create({
      model: 'claude-3-7-sonnet',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Inspect the system architecture diagram' },
          ],
        },
      ],
    });
    await store.save(thread);
    expect(thread.title).toBe('Inspect the system architecture diagram');
  });

  // ─── 3. Concurrent Stress & Atomic Writes ────────────────────────────────────

  it('handles 50 concurrent atomic writes without corruption', async () => {
    const threadCount = 50;
    const writePromises = Array.from({ length: threadCount }, async (_, i) => {
      const thread = store.create({
        id: `th_stress_${String(i).padStart(3, '0')}`,
        model: i % 2 === 0 ? 'claude-3-7-sonnet' : 'gemini-2.5-flash',
        title: `Stress Thread ${i}`,
        messages: [
          { role: 'user', content: `Message from thread ${i}` },
          {
            role: 'assistant',
            content: [{ type: 'text', text: `Response payload for thread ${i}` }],
          },
        ],
      });
      await store.save(thread);
    });

    await Promise.all(writePromises);

    const list = await store.list();
    expect(list.length).toBe(threadCount);

    // Verify all 50 threads can be loaded cleanly
    for (let i = 0; i < threadCount; i++) {
      const loaded = await store.load(`th_stress_${String(i).padStart(3, '0')}`);
      expect(loaded).not.toBeNull();
      expect(loaded?.title).toBe(`Stress Thread ${i}`);
      expect(loaded?.messages.length).toBe(2);
    }
  });

  it('handles rapid sequential mutations to the same thread', async () => {
    const thread = store.create({ model: 'claude-3-7-sonnet', title: 'Sequential Test' });
    await store.save(thread);

    for (let step = 1; step <= 20; step++) {
      thread.messages.push({
        role: 'user',
        content: `Step ${step} user request`,
      });
      thread.messages.push({
        role: 'assistant',
        content: [{ type: 'text', text: `Step ${step} assistant answer` }],
      });
      thread.totalUsage = {
        total: step * 100,
        input: step * 80,
        output: step * 20,
      };
      await store.save(thread);
    }

    const reloaded = await store.load(thread.id);
    expect(reloaded).not.toBeNull();
    expect(reloaded?.messages.length).toBe(40);
    expect(reloaded?.totalUsage?.total).toBe(2000);
  });

  // ─── 4. Massive Payload & Rich Content ───────────────────────────────────────

  it('serializes and deserializes massive payloads with rich tool calls and thinking blocks', async () => {
    const userMsg: UserMessage = {
      role: 'user',
      content: 'Run deep analysis on codebase and verify all boundary conditions',
    };

    const assistantMsg: AssistantMessage = {
      role: 'assistant',
      content: [
        {
          type: 'thinking',
          thinking: 'The user wants to analyze boundary rules across 100 modules. Let me inspect imports.',
          thinkingSignature: 'sig_think_12345',
        },
        {
          type: 'tool-call',
          id: 'call_bash_01',
          name: 'bash',
          arguments: { command: 'bun run lint:boundaries' },
        },
        {
          type: 'text',
          text: 'I ran the boundary linter and verified all module exports.',
        },
      ],
      meta: {
        provider: 'anthropic',
        protocol: 'anthropic-messages',
        modelId: 'claude-3-7-sonnet',
        usage: { input: 12000, output: 450, reasoning: 1800, total: 14250 },
      },
    };

    const toolMsg: ToolMessage = {
      role: 'tool',
      content: [
        {
          type: 'tool-result',
          toolCallId: 'call_bash_01',
          toolName: 'bash',
          output: '✓ All 18 boundary rules passed with 0 violations.',
          isError: false,
        },
      ],
    };

    const largeArrayMessages: Message[] = [userMsg, assistantMsg, toolMsg];
    // Duplicate messages to simulate a 300-turn session
    for (let i = 0; i < 100; i++) {
      largeArrayMessages.push({
        role: 'user',
        content: `User follow-up message #${i} with extended context: ${'x'.repeat(200)}`,
      });
      largeArrayMessages.push({
        role: 'assistant',
        content: [{ type: 'text', text: `Assistant response #${i} with results: ${'y'.repeat(500)}` }],
      });
    }

    const largeThread = store.create({
      model: 'claude-3-7-sonnet',
      messages: largeArrayMessages,
    });

    await store.save(largeThread);

    const loaded = await store.load(largeThread.id);
    expect(loaded).not.toBeNull();
    expect(loaded?.messages.length).toBe(largeArrayMessages.length);

    // Verify rich assistant structure intact
    const loadedAssistant = loaded?.messages[1] as AssistantMessage;
    expect(loadedAssistant.content.length).toBe(3);
    expect(loadedAssistant.content[0]?.type).toBe('thinking');
    expect((loadedAssistant.content[0] as any).thinking).toContain('The user wants to analyze');
    expect(loadedAssistant.content[1]?.type).toBe('tool-call');
    expect((loadedAssistant.content[1] as any).arguments.command).toBe('bun run lint:boundaries');
  });

  // ─── 5. Path Traversal & Security Invariant ─────────────────────────────────

  it('sanitizes malicious thread IDs against directory traversal', async () => {
    const maliciousIds = [
      '../../etc/passwd',
      '../../../root/.ssh/id_rsa',
      '..\\..\\windows\\system32',
      'th_test/nested/file',
      'th_test\x00nullbyte',
    ];

    for (const maliciousId of maliciousIds) {
      const resolvedPath = store.getThreadPath(maliciousId);
      // Path must always reside directly inside tempDir
      expect(path.dirname(resolvedPath)).toBe(tempDir);
      expect(path.isAbsolute(resolvedPath)).toBe(true);
    }
  });

  // ─── 6. Directory Pollutants, Corrupt Files & Cleanup ────────────────────────

  it('resiliently ignores non-JSON files, empty files, and corrupted JSON', async () => {
    // 1. Valid thread
    const valid = store.create({ id: 'th_valid_01', model: 'claude-3-7-sonnet', title: 'Valid Thread' });
    await store.save(valid);

    // 2. Corrupt JSON syntax
    await writeFile(path.join(tempDir, 'th_corrupted_syntax.json'), '{ "id": "th_1", invalid json');

    // 3. Valid JSON but invalid structure (array instead of object)
    await writeFile(path.join(tempDir, 'th_invalid_array.json'), '[1, 2, 3]');

    // 4. Valid JSON object but missing messages array
    await writeFile(path.join(tempDir, 'th_missing_messages.json'), JSON.stringify({ id: 'th_nomessages', title: 'Test' }));

    // 5. Completely empty JSON file
    await writeFile(path.join(tempDir, 'th_empty.json'), '');

    // 6. Lingering temp files
    await writeFile(path.join(tempDir, '.tmp.th_valid_01.12345.abc.json'), JSON.stringify(valid));

    // 7. Non-JSON files (.DS_Store, subfolders, readme.txt)
    await writeFile(path.join(tempDir, '.DS_Store'), 'binary data');
    await writeFile(path.join(tempDir, 'notes.txt'), 'random notes');
    await mkdir(path.join(tempDir, 'nested_folder'), { recursive: true });

    // .list() should not crash; it should return only the 1 valid thread
    const list = await store.list();
    expect(list.length).toBe(1);
    expect(list[0]?.id).toBe('th_valid_01');

    // .load() on empty or invalid structure throws or returns null safely
    const emptyLoad = await store.load('th_empty');
    expect(emptyLoad).toBeNull();
  });

  // ─── 7. Deletion & Sorting Verification ─────────────────────────────────────

  it('verifies sorting order, getLatest, and safe delete behavior', async () => {
    const t1 = store.create({ id: 'th_alpha', model: 'claude-3-7-sonnet', title: 'Alpha' });
    await store.save(t1);

    await new Promise((r) => setTimeout(r, 15));
    const t2 = store.create({ id: 'th_beta', model: 'claude-3-7-sonnet', title: 'Beta' });
    await store.save(t2);

    await new Promise((r) => setTimeout(r, 15));
    const t3 = store.create({ id: 'th_gamma', model: 'claude-3-7-sonnet', title: 'Gamma' });
    await store.save(t3);

    // Initial order: Gamma (newest), Beta, Alpha (oldest)
    let list = await store.list();
    expect(list.map((t) => t.id)).toEqual(['th_gamma', 'th_beta', 'th_alpha']);

    // Now update Alpha (should jump to top)
    await new Promise((r) => setTimeout(r, 15));
    t1.messages.push({ role: 'user', content: 'New message in alpha' });
    await store.save(t1);

    list = await store.list();
    expect(list.map((t) => t.id)).toEqual(['th_alpha', 'th_gamma', 'th_beta']);

    const latest = await store.getLatest();
    expect(latest?.id).toBe('th_alpha');

    // Delete Gamma
    const deletedGamma = await store.delete('th_gamma');
    expect(deletedGamma).toBe(true);

    // Delete already deleted thread
    const deletedAgain = await store.delete('th_gamma');
    expect(deletedAgain).toBe(false);

    // Remaining list
    list = await store.list();
    expect(list.map((t) => t.id)).toEqual(['th_alpha', 'th_beta']);
  });
});
