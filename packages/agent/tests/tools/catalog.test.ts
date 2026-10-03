import { describe, expect, it } from 'bun:test';
import { defaultToolCatalog, getToolSpecs } from '../../src/tools/index.js';
import type { ToolContext } from '../../src/tools/types.js';

describe('ToolCatalog & Serialization Integration', () => {
  const dummyContext: ToolContext = {
    cwd: process.cwd(),
  };

  it('converts registered tools into plain serializable ToolSpecs', () => {
    const specs = getToolSpecs(dummyContext, defaultToolCatalog);

    expect(specs.length).toBeGreaterThanOrEqual(16);

    const expectedTools = [
      'read_file',
      'write_file',
      'edit_file',
      'glob',
      'grep',
      'list_dir',
      'sleep',
      'bash',
      'task_list',
      'task_read',
      'task_send_input',
      'task_kill',
      'web_fetch',
      'web_search',
      'skill_list',
      'skill_read',
    ];

    for (const toolName of expectedTools) {
      const spec = specs.find((s) => s.name === toolName);
      expect(spec, `Tool ${toolName} missing from getToolSpecs`).toBeDefined();
      expect(spec!.inputSchema).toBeDefined();
      expect(typeof spec!.inputSchema).toBe('object');

      const toolDef = defaultToolCatalog.get(toolName);
      expect(toolDef, `Tool ${toolName} missing from defaultToolCatalog`).toBeDefined();
    }
  });

  it('validates tool arguments and executes correctly', async () => {
    const listDirTool = defaultToolCatalog.get('list_dir');
    expect(listDirTool).toBeDefined();

    const result = await defaultToolCatalog.execute('list_dir', { path: '.' }, dummyContext);
    expect(result).toBeDefined();
  });

  it('safely summarizes tools when args or results are undefined / malformed', () => {
    const { summarizeToolResult } = require('../../src/tools/summary.js');
    for (const tool of defaultToolCatalog.getAll()) {
      expect(() => summarizeToolResult(tool, undefined, undefined)).not.toThrow();
      expect(() => summarizeToolResult(tool, {}, undefined)).not.toThrow();
      expect(() => summarizeToolResult(tool, undefined, { resultCount: 5 })).not.toThrow();
    }
  });
});
