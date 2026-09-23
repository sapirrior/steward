import { describe, expect, it } from 'bun:test';
import { defaultToolCatalog, getAISDKTools } from '../../src/packages/agents/src/tools/index.js';
import type { ToolContext } from '../../src/packages/agents/src/tools/types.js';

describe('ToolCatalog & AI SDK v7 Integration', () => {
  const dummyContext: ToolContext = {
    cwd: process.cwd(),
  };

  it('converts registered tools into AI SDK v7 tool definitions with inputSchema', () => {
    const aiTools = getAISDKTools(dummyContext, defaultToolCatalog);

    expect(Object.keys(aiTools).length).toBeGreaterThan(0);

    // Verify write_file has inputSchema properly attached
    const writeFile = aiTools['write_file'];
    expect(writeFile).toBeDefined();
    expect((writeFile as any).inputSchema).toBeDefined();

    // Verify read_file also has inputSchema properly attached
    const readFile = aiTools['read_file'];
    expect(readFile).toBeDefined();
    expect((readFile as any).inputSchema).toBeDefined();
  });
});
