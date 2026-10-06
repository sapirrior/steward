import { defaultCommandRegistry } from '../src/slash/index.js';

describe('Slash Command Registry Characterization', () => {
  it('registers all 17 commands in exact order', () => {
    const names = defaultCommandRegistry.getAll().map((c) => c.name);
    expect(names).toEqual([
      'bug',
      'init',
      'copy',
      'export',
      'usage',
      'rewind',
      'model',
      'effort',
      'mode',
      'login',
      'logout',
      'clear',
      'exit',
      'quit',
      'resume',
      'rename',
      'skills',
    ]);
  });
});
