import { describe, it, expect } from 'bun:test';
import {
  getActiveMode,
  setActiveMode,
  cycleMode,
  listModes,
  isAllowed,
  MODES,
  type ChatMode,
} from '@steward/agents/policy/modes.js';
import { defaultToolCatalog } from '@steward/agents/tools/catalog.js';
import { prepareTurn } from '@steward/agents/engine/turn-context.js';
import { ShellTaskManager } from '@steward/services/tasks/manager.js';
import { saveModeSelection, getSavedMode } from '@steward/services/config/settings.js';

describe('Chat Modes Consistency & Unified State', () => {
  it('should maintain a single unified activeMode state across policy and engine imports', async () => {
    setActiveMode('normal');
    expect(getActiveMode()).toBe('normal');

    // Cycle mode to chat
    cycleMode(); // normal -> chat
    expect(getActiveMode()).toBe('chat');

    const tasks = new ShellTaskManager();
    const prepChat = await prepareTurn(
      'Test prompt',
      {},
      {
        sessionId: 'test-session',
        shellTasks: tasks,
        turnNumber: 1,
        model: { provider: 'gemini', modelId: 'gemini-2.5-flash', effort: 'medium' },
      },
    );

    // In chat mode, active tools must be empty
    expect(prepChat.toolContext.mode).toBe('chat');
    expect(prepChat.activeTools).toHaveLength(0);
    expect(prepChat.instructions).toContain('Mode: CHAT');

    // Switch to review mode
    setActiveMode('review');
    expect(getActiveMode()).toBe('review');

    const prepReview = await prepareTurn(
      'Review prompt',
      {},
      {
        sessionId: 'test-session',
        shellTasks: tasks,
        turnNumber: 2,
        model: { provider: 'gemini', modelId: 'gemini-2.5-flash', effort: 'medium' },
      },
    );

    expect(prepReview.toolContext.mode).toBe('review');
    expect(prepReview.instructions).toContain('Mode: REVIEW');

    // Review mode: read tools allowed, write/exec disallowed
    const availableToolNames = prepReview.activeTools?.map((t) => t.name) ?? [];
    expect(availableToolNames).toContain('read_file');
    expect(availableToolNames).toContain('grep');
    expect(availableToolNames).not.toContain('write_file');
    expect(availableToolNames).not.toContain('edit_file');
    expect(availableToolNames).not.toContain('bash');

    // Switch to build mode
    setActiveMode('build');
    expect(getActiveMode()).toBe('build');

    const prepBuild = await prepareTurn(
      'Build prompt',
      {},
      {
        sessionId: 'test-session',
        shellTasks: tasks,
        turnNumber: 3,
        model: { provider: 'gemini', modelId: 'gemini-2.5-flash', effort: 'medium' },
      },
    );

    expect(prepBuild.toolContext.mode).toBe('build');
    expect(prepBuild.instructions).toContain('Mode: BUILD');
    const buildToolNames = prepBuild.activeTools?.map((t) => t.name) ?? [];
    expect(buildToolNames).toContain('write_file');
    expect(buildToolNames).toContain('edit_file');
    expect(buildToolNames).toContain('bash');

    // Reset back to normal mode
    setActiveMode('normal');
    expect(getActiveMode()).toBe('normal');
  });

  it('should persist and load mode selection from settings', () => {
    saveModeSelection('review');
    expect(getSavedMode()).toBe('review');

    saveModeSelection('normal');
    expect(getSavedMode()).toBe('normal');
  });
});
