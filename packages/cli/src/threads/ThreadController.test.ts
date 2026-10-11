import { describe, it, expect, beforeEach } from 'bun:test';
import { ThreadController } from './ThreadController.js';
import { ThreadStore } from '@steward/threads';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

describe('ThreadController', () => {
  let tempDir: string;
  let store: ThreadStore;
  let controller: ThreadController;

  const defaultModel = {
    provider: 'anthropic',
    modelId: 'claude-3-7-sonnet',
    reasoning: 'medium',
  };

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), 'steward-thread-ctrl-test-'));
    store = new ThreadStore({ baseDir: tempDir });
    controller = new ThreadController({
      store,
      defaultModel,
      cwd: '/test/workspace',
    });
  });

  it('creates and returns an active thread with default model and cwd', () => {
    const thread = controller.getActiveThread();
    expect(thread).toBeDefined();
    expect(thread.id).toMatch(/^th_[a-f0-9]{16}$/);
    expect(thread.model).toEqual(defaultModel);
    expect(thread.metadata.cwd).toBe('/test/workspace');
  });

  it('records turns and persists them atomically to disk', async () => {
    await controller.recordTurn({
      userPrompt: 'Run unit test',
      responseMessages: [
        {
          role: 'assistant',
          content: [{ type: 'text', text: 'Running tests now...' }],
        },
      ],
      usageDelta: {
        inputTokens: 100,
        outputTokens: 50,
        totalTokens: 150,
      },
    });

    const thread = controller.getActiveThread();
    expect(thread.messages.length).toBe(2);
    expect(thread.usage.inputTokens).toBe(100);
    expect(thread.usage.outputTokens).toBe(50);

    // Verify it was persisted to disk by loading directly from store
    const loaded = await store.load(thread.id);
    expect(loaded).toBeDefined();
    expect(loaded?.messages.length).toBe(2);
    expect(loaded?.usage.totalTokens).toBe(150);
  });

  it('loads existing thread by ID and switches active thread', async () => {
    const doc1 = controller.createNewThread({
      provider: 'openai',
      modelId: 'gpt-4o',
      reasoning: 'none',
    });
    await controller.saveActiveThread();

    const doc2 = controller.createNewThread({
      provider: 'google',
      modelId: 'gemini-2.5-pro',
      reasoning: 'high',
    });
    await controller.saveActiveThread();

    expect(controller.getActiveThread().id).toBe(doc2.id);

    const reloadedDoc1 = await controller.loadThread(doc1.id);
    expect(reloadedDoc1.id).toBe(doc1.id);
    expect(controller.getActiveThread().id).toBe(doc1.id);
    expect(controller.getActiveThread().model.modelId).toBe('gpt-4o');
  });

  it('resumes latest thread from disk', async () => {
    const doc = controller.getActiveThread();
    await controller.recordTurn({
      userPrompt: 'First prompt',
      responseMessages: [{ role: 'assistant', content: 'First response' }],
    });

    const newController = new ThreadController({
      store,
      defaultModel,
    });

    const resumed = await newController.resumeLatest();
    expect(resumed).toBeDefined();
    expect(resumed?.id).toBe(doc.id);
    expect(resumed?.messages.length).toBe(2);
  });
});
