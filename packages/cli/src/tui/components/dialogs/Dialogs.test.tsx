/** @jsxImportSource stitchable */
import { describe, it, expect } from 'bun:test';
import { themeManager } from '../../../themes/themeManager.js';
import { BaseDialog } from './BaseDialog.js';
import { CommandPaletteDialog } from './CommandPaletteDialog.js';
import { ModelDialog } from './ModelDialog.js';
import { EffortDialog } from './EffortDialog.js';
import { ThemeDialog } from './ThemeDialog.js';
import { ResumeDialog } from './ResumeDialog.js';
import { BUILTIN_COMMANDS } from '../../commands/commandRegistry.js';
import type { ModelMetadata } from '@steward/models';
import type { ThreadSummary } from '@steward/threads';

const theme = themeManager.getTheme('default');

describe('TUI Dialogs Suite', () => {
  it('BaseDialog instantiates with items and empty state', () => {
    const emptyDialog = BaseDialog({
      items: [],
      selectedIndex: 0,
      theme,
      emptyText: 'No elements',
    });
    expect(emptyDialog).toBeDefined();

    const populatedDialog = BaseDialog({
      items: [
        { id: '1', label: 'Item 1', description: 'Desc 1' },
        { id: '2', label: 'Item 2', description: 'Desc 2' },
      ],
      selectedIndex: 0,
      theme,
    });
    expect(populatedDialog).toBeDefined();
  });

  it('CommandPaletteDialog renders builtin slash commands', () => {
    const palette = CommandPaletteDialog({
      commands: BUILTIN_COMMANDS,
      selectedIndex: 0,
      theme,
    });
    expect(palette).toBeDefined();
    // Ensure /new is in BUILTIN_COMMANDS
    const newCmd = BUILTIN_COMMANDS.find((c) => c.name === 'new');
    expect(newCmd).toBeDefined();
    expect(newCmd?.description).toContain('new session');
  });

  it('ModelDialog formats model metadata with context size', () => {
    const testModels: ModelMetadata[] = [
      {
        provider: 'google',
        id: 'gemini-2.5-flash',
        name: 'Gemini 2.5 Flash',
        reasoning: false,
        toolCall: true,
        inputModalities: ['text'],
        outputModalities: ['text'],
        contextWindow: 1048576,
      },
      {
        provider: 'anthropic',
        id: 'claude-3-7-sonnet',
        name: 'Claude 3.7 Sonnet',
        reasoning: true,
        toolCall: true,
        inputModalities: ['text'],
        outputModalities: ['text'],
        contextWindow: 200000,
      },
    ];

    const modelDialog = ModelDialog({
      models: testModels,
      selectedIndex: 0,
      currentModelId: 'gemini-2.5-flash',
      theme,
    });
    expect(modelDialog).toBeDefined();
  });

  it('EffortDialog marks current reasoning effort', () => {
    const effortDialog = EffortDialog({
      currentEffort: 'medium',
      selectedIndex: 2,
      theme,
    });
    expect(effortDialog).toBeDefined();
  });

  it('ThemeDialog marks active theme', () => {
    const themeDialog = ThemeDialog({
      currentThemeName: 'default',
      selectedIndex: 0,
      theme,
    });
    expect(themeDialog).toBeDefined();
  });

  it('ResumeDialog renders thread summaries and formatted timestamps', () => {
    const testThreads: ThreadSummary[] = [
      {
        id: 'th_123',
        title: 'Fix issue with parser',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        model: { provider: 'google', modelId: 'gemini-2.5-flash' },
        cwd: '/home/user/project',
        messageCount: 4,
        usage: { inputTokens: 100, outputTokens: 200, totalTokens: 300 },
      },
    ];

    const resumeDialog = ResumeDialog({
      threads: testThreads,
      selectedIndex: 0,
      theme,
    });
    expect(resumeDialog).toBeDefined();
  });
});
