import { describe, it, expect } from 'bun:test';
import { CommandRegistry } from './CommandRegistry.js';
import { NewCommand } from './NewCommand/NewCommand.js';
import { SettingsCommand } from './SettingsCommand/SettingsCommand.js';

describe('CommandRegistry', () => {
  it('registers commands with single aliases and formats display labels properly', () => {
    const registry = new CommandRegistry();

    const newCmd = registry.get('new');
    expect(newCmd).toBeDefined();
    expect(newCmd?.name).toBe('new');
    expect(newCmd?.alias).toBe('clear');
    expect(newCmd?.displayLabel).toBe('/new (clear)');

    const settingsCmd = registry.get('settings');
    expect(settingsCmd).toBeDefined();
    expect(settingsCmd?.name).toBe('settings');
    expect(settingsCmd?.alias).toBe('config');
    expect(settingsCmd?.displayLabel).toBe('/settings (config)');

    const modelCmd = registry.get('model');
    expect(modelCmd).toBeDefined();
    expect(modelCmd?.alias).toBeUndefined();
    expect(modelCmd?.displayLabel).toBe('/model');
  });

  it('resolves commands via both canonical name and single alias', () => {
    const registry = new CommandRegistry();

    // Canonical lookup
    expect(registry.get('new')?.name).toBe('new');
    expect(registry.get('/new')?.name).toBe('new');

    // Single alias lookup
    expect(registry.get('clear')?.name).toBe('new');
    expect(registry.get('/clear')?.name).toBe('new');

    expect(registry.get('config')?.name).toBe('settings');
    expect(registry.get('/config')?.name).toBe('settings');

    expect(registry.get('quit')?.name).toBe('exit');
  });

  it('filters commands by query for autocomplete', () => {
    const registry = new CommandRegistry();

    const matchesSet = registry.filter('set');
    expect(matchesSet.length).toBe(1);
    expect(matchesSet[0].name).toBe('settings');

    const matchesAlias = registry.filter('con');
    expect(matchesAlias.length).toBe(1);
    expect(matchesAlias[0].name).toBe('settings');
  });

  it('executes command and returns structured outcome without touching chat history', async () => {
    const registry = new CommandRegistry();

    let openedDialog: any = null;
    const dummyContext: any = {
      openDialog: (id: string) => {
        openedDialog = id;
      },
    };

    const outcome = await registry.execute('/model', dummyContext);
    expect(outcome.type).toBe('open-dialog');
    if (outcome.type === 'open-dialog') {
      expect(outcome.dialogId).toBe('model');
    }
    expect(openedDialog).toBe('model');
  });

  it('returns structured error for unknown commands', async () => {
    const registry = new CommandRegistry();
    const outcome = await registry.execute('/unknownCommand', {} as any);
    expect(outcome.type).toBe('error');
    if (outcome.type === 'error') {
      expect(outcome.message).toContain('Unknown command "/unknownCommand"');
    }
  });
});
