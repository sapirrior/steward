import { describe, expect, it } from 'bun:test';
import { defaultToolCatalog, getToolSpecs } from '../../src/packages/agents/src/tools/index.js';
import type { ToolContext } from '../../src/packages/agents/src/tools/types.js';

describe('ToolCatalog & Serialization Integration', () => {
  const dummyContext: ToolContext = {
    cwd: process.cwd(),
  };

  it('converts registered tools into plain serializable ToolSpecs', () => {
    const specs = getToolSpecs(dummyContext, defaultToolCatalog);

    expect(specs.length).toBeGreaterThan(0);

    const writeFile = specs.find((s) => s.name === 'write_file');
    expect(writeFile).toBeDefined();
    expect(writeFile!.inputSchema).toBeDefined();
    expect(typeof writeFile!.inputSchema).toBe('object');

    const readFile = specs.find((s) => s.name === 'read_file');
    expect(readFile).toBeDefined();
    expect(readFile!.inputSchema).toBeDefined();
    expect(typeof readFile!.inputSchema).toBe('object');
  });

  it('validates tool arguments and executes correctly', async () => {
    const listDirTool = defaultToolCatalog.get('list_dir');
    expect(listDirTool).toBeDefined();

    const result = await defaultToolCatalog.execute('list_dir', { path: '.' }, dummyContext);
    expect(result).toBeDefined();
  });
});
