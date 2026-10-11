import { describe, it, expect } from 'bun:test';
import { AppController } from './AppController.js';
import { themeManager } from '../../themes/themeManager.js';
import type { AppState } from '../types.js';

const theme = themeManager.getTheme('default');

const mockState: AppState = {
  settings: {
    version: 1,
    provider: 'google',
    model: 'gemini-3.1-flash-lite',
    reasoningEffort: 'low',
    theme: 'default',
    bash: { autoApprove: false, timeoutMs: 30000 },
    tools: { read: true, glob: true, grep: true, webfetch: true, websearch: true, bash: true },
  },
  theme,
  modelRef: { provider: 'google', modelId: 'gemini-3.1-flash-lite' },
  reasoningEffort: 'low',
  status: 'idle',
  history: [],
  activeTurn: null,
  metrics: {
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalTokens: 0,
    estimatedCostUsd: 0,
  },
  permissionRequest: null,
  cwd: process.cwd(),
};

describe('AppController', () => {
  it('manages modal dialog opening and closing', () => {
    let dispatched: any[] = [];
    const controller = new AppController({
      state: mockState,
      dispatch: (action: any) => dispatched.push(action),
      exitFn: () => {},
    });

    expect(controller.activeDialog).toBeNull();
    controller.openDialog('model');
    expect(controller.activeDialog).toBe('model');
    expect(controller.selectedIndex).toBe(0);

    controller.setSelectedIndex(2);
    expect(controller.selectedIndex).toBe(2);

    controller.closeDialog();
    expect(controller.activeDialog).toBeNull();
    expect(controller.selectedIndex).toBe(0);
  });

  it('routes slash commands to dialogs without touching conversation history', async () => {
    let dispatched: any[] = [];
    const controller = new AppController({
      state: mockState,
      dispatch: (action: any) => dispatched.push(action),
      exitFn: () => {},
    });

    await controller.executePrompt('/model');
    expect(controller.activeDialog).toBe('model');
    expect(dispatched.length).toBe(0); // Did not add a fake turn!

    controller.closeDialog();
    await controller.executePrompt('/settings');
    expect(controller.activeDialog).toBe('settings');
    expect(dispatched.length).toBe(0);
  });

  it('handles permission approval and denial cleanly', () => {
    let resolvedValue: any = null;
    const stateWithPermission: AppState = {
      ...mockState,
      permissionRequest: {
        toolName: 'bash',
        command: 'rm -rf node_modules',
        tagline: 'Deletes dependencies',
        resolve: (val) => {
          resolvedValue = val;
        },
      },
    };

    let dispatched: any[] = [];
    const controller = new AppController({
      state: stateWithPermission,
      dispatch: (action: any) => dispatched.push(action),
      exitFn: () => {},
    });

    controller.approvePermission();
    expect(resolvedValue).toBe(true);
    expect(dispatched).toEqual([{ type: 'SET_PERMISSION_REQUEST', request: null }]);
  });
});
