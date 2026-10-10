import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import os from 'node:os';
import path from 'node:path';
import { rm, writeFile, mkdir } from 'node:fs/promises';
import {
  ThreadStore,
  ThreadStorageError,
  generateThreadId,
  generateThreadTitle,
  type AssistantModelMessage,
  type ModelMessage,
  type ToolModelMessage,
  type UserModelMessage,
} from './index.js';

describe('ThreadStore Hardened Test Suite', () => {
  let tempDir: string;
  let store: ThreadStore;

  beforeEach(async () => {
    tempDir = path.join(
      os.tmpdir(),
      `steward-threads-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    await mkdir(tempDir, { recursive: true });
    store = new ThreadStore({ baseDir: tempDir });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  // ─── 1. ID and Title Generation ──────────────────────────────────────────

  it('generates deterministic-length SHA-256 thread IDs matching th_<16hex>', () => {
    const id1 = generateThreadId();
    const id2 = generateThreadId();

    expect(id1).toMatch(/^th_[a-f0-9]{16}$/);
    expect(id2).toMatch(/^th_[a-f0-9]{16}$/);
    expect(id1).not.toBe(id2);
  });

  it('handles smart title generation and boundary truncation', () => {
    expect(generateThreadTitle('')).toBe('New Thread');
    expect(generateThreadTitle('   \n\t  ')).toBe('New Thread');
    expect(generateThreadTitle('Quick prompt')).toBe('Quick prompt');
    expect(generateThreadTitle('   Clean up   multiple   spaces and   tabs  \t\n ')).toBe(
      'Clean up multiple spaces and tabs',
    );

    const longPrompt =
      'Refactor the terminal differential reconciler to support fast paste and synchronized output';
    const title = generateThreadTitle(longPrompt);
    expect(title.length).toBeLessThanOrEqual(51);
    expect(title.endsWith('...')).toBe(true);
    expect(title).toBe('Refactor the terminal differential reconciler...');
  });

  // ─── 2. Lifecycle, Creation, and Full Roundtrip ───────────────────────────

  it('creates, saves, and loads a ThreadDocument with untouched ModelMessage[]', async () => {
    const userMessage: UserModelMessage = {
      role: 'user',
      content: 'Fix memory leak in stitchable',
    };

    const assistantMessage: AssistantModelMessage = {
      role: 'assistant',
      content: [
        {
          type: 'reasoning',
          text: 'Analyzing heap snapshot...',
          signature: 'sig_123',
        },
        {
          type: 'tool-call',
          toolCallId: 'call_grep_01',
          toolName: 'grep',
          args: { pattern: 'ScreenBuffer' },
        },
      ],
    };

    const toolMessage: ToolModelMessage = {
      role: 'tool',
      content: [
        {
          type: 'tool-result',
          toolCallId: 'call_grep_01',
          toolName: 'grep',
          result: { matches: 4 },
          isError: false,
        },
      ],
    };

    const messages: ModelMessage[] = [userMessage, assistantMessage, toolMessage];

    const thread = store.create({
      model: {
        provider: 'anthropic',
        modelId: 'claude-3-7-sonnet',
        reasoning: 'high',
      },
      cwd: '/workspace/test',
      git: {
        branch: 'feat/threads',
        commit: 'abc1234',
      },
      messages,
      usage: {
        inputTokens: 1000,
        outputTokens: 200,
        reasoningTokens: 150,
      },
    });

    expect(thread.id).toMatch(/^th_[a-f0-9]{16}$/);
    expect(thread.title).toBe('Fix memory leak in stitchable');
    expect(thread.version).toBe(1);

    await store.save(thread);

    const loaded = await store.load(thread.id);
    expect(loaded).not.toBeNull();
    expect(loaded?.id).toBe(thread.id);
    expect(loaded?.model.modelId).toBe('claude-3-7-sonnet');
    expect(loaded?.metadata.cwd).toBe('/workspace/test');
    expect(loaded?.metadata.git?.branch).toBe('feat/threads');
    expect(loaded?.usage.inputTokens).toBe(1000);
    expect(loaded?.usage.reasoningTokens).toBe(150);
    expect(loaded?.messages.length).toBe(3);

    // Verify raw assistant structure is preserved verbatim
    const loadedAssistant = loaded?.messages[1] as AssistantModelMessage;
    expect(Array.isArray(loadedAssistant.content)).toBe(true);
    if (Array.isArray(loadedAssistant.content)) {
      expect(loadedAssistant.content.length).toBe(2);
      expect(loadedAssistant.content[0]?.type).toBe('reasoning');
      expect(loadedAssistant.content[1]?.type).toBe('tool-call');
    }
  });

  // ─── 3. Atomic Mutations ─────────────────────────────────────────────────

  it('performs safe, serialized mutations via mutate() without lost updates', async () => {
    const thread = store.create({
      model: { provider: 'openai', modelId: 'gpt-4o' },
      title: 'Original Title',
    });
    await store.save(thread);

    // Run 20 concurrent mutations on the same thread
    const increments = Array.from({ length: 20 }, (_, i) => i);
    await Promise.all(
      increments.map((step) =>
        store.mutate(thread.id, (t) => {
          t.usage.inputTokens += 10;
          t.messages.push({
            role: 'user',
            content: `Message step ${step}`,
          });
        }),
      ),
    );

    const reloaded = await store.load(thread.id);
    expect(reloaded).not.toBeNull();
    expect(reloaded?.usage.inputTokens).toBe(200);
    expect(reloaded?.messages.length).toBe(20);
  });

  it('throws NOT_FOUND when mutating a non-existent thread', async () => {
    expect(store.mutate('th_nonexistent', () => {})).rejects.toThrow(ThreadStorageError);
  });

  // ─── 4. Concurrency Stress Test ──────────────────────────────────────────

  it('handles 40 concurrent thread creations and atomic writes cleanly', async () => {
    const count = 40;
    const promises = Array.from({ length: count }, async (_, i) => {
      const doc = store.create({
        model: { provider: 'anthropic', modelId: 'claude-3-7-sonnet' },
        title: `Concurrent Thread ${i}`,
        messages: [{ role: 'user', content: `Prompt ${i}` }],
      });
      await store.save(doc);
      return doc.id;
    });

    const ids = await Promise.all(promises);
    expect(ids.length).toBe(count);

    const summaries = await store.list();
    expect(summaries.length).toBe(count);
  });

  // ─── 5. Security & Path Traversal Neutralization ──────────────────────────

  it('neutralizes malicious path traversal identifiers', () => {
    const malicious = [
      '../../etc/passwd',
      '../../../root/.ssh/id_rsa',
      '..\\..\\windows\\system32',
      'th_bad/nested/file',
      'th_bad\x00nullbyte',
    ];

    for (const badId of malicious) {
      const resolved = store.getThreadPath(badId);
      expect(path.dirname(resolved)).toBe(tempDir);
    }
  });

  // ─── 6. Resilience Against Corrupted & Non-JSON Files ─────────────────────

  it('resiliently ignores non-JSON files, empty files, and corrupted JSON in list()', async () => {
    // 1. Valid thread
    const valid = store.create({
      model: { provider: 'anthropic', modelId: 'claude-3-7-sonnet' },
      title: 'Valid One',
    });
    await store.save(valid);

    // 2. Corrupted JSON syntax
    await writeFile(path.join(tempDir, 'th_corrupt.json'), '{"id": broken json');

    // 3. Valid JSON with wrong structure
    await writeFile(path.join(tempDir, 'th_invalid_schema.json'), '{"notAThread": true}');

    // 4. Empty file
    await writeFile(path.join(tempDir, 'th_empty.json'), '');

    // 5. Dangling temp file
    await writeFile(path.join(tempDir, '.tmp.th_valid.12345.abcd.json'), JSON.stringify(valid));

    // 6. Non-JSON files
    await writeFile(path.join(tempDir, '.DS_Store'), 'binary');
    await writeFile(path.join(tempDir, 'notes.txt'), 'text notes');

    // list() should return only the valid thread
    const summaries = await store.list();
    expect(summaries.length).toBe(1);
    expect(summaries[0]?.id).toBe(valid.id);

    // load() on empty file returns null
    const emptyLoad = await store.load('th_empty');
    expect(emptyLoad).toBeNull();
  });

  // ─── 7. Sorting & Deletion ───────────────────────────────────────────────

  it('sorts summaries by updatedAt DESC and respects delete()', async () => {
    const t1 = store.create({
      model: { provider: 'test', modelId: 'm1' },
      title: 'First',
    });
    await store.save(t1);

    await new Promise((r) => setTimeout(r, 10));
    const t2 = store.create({
      model: { provider: 'test', modelId: 'm2' },
      title: 'Second',
    });
    await store.save(t2);

    let list = await store.list();
    expect(list.map((s) => s.id)).toEqual([t2.id, t1.id]);

    const latest = await store.getLatest();
    expect(latest?.id).toBe(t2.id);

    // Delete t2
    const deleted = await store.delete(t2.id);
    expect(deleted).toBe(true);

    const deletedAgain = await store.delete(t2.id);
    expect(deletedAgain).toBe(false);

    list = await store.list();
    expect(list.map((s) => s.id)).toEqual([t1.id]);
  });
});
