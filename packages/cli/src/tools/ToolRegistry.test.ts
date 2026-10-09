import { describe, expect, it } from 'bun:test';
import { ToolRegistry } from './ToolRegistry.js';

describe('ToolRegistry', () => {
  it('registers all core tools and task manager by default', () => {
    const registry = new ToolRegistry();
    const tools = registry.getAllTools();
    const toolNames = tools.map((t) => t.name);

    expect(toolNames).toContain('read');
    expect(toolNames).toContain('glob');
    expect(toolNames).toContain('grep');
    expect(toolNames).toContain('webfetch');
    expect(toolNames).toContain('websearch');
    expect(toolNames).toContain('bash');
    expect(toolNames).toContain('task_manager');
  });

  it('filters tool specs by settings', () => {
    const registry = new ToolRegistry();
    const allSpecs = registry.getToolSpecs();
    expect(allSpecs.length).toBe(7);

    const filteredSpecs = registry.getToolSpecs({
      tools: {
        read: true,
        glob: true,
        grep: false,
        webfetch: false,
        websearch: false,
        bash: true,
      },
    });

    const filteredNames = filteredSpecs.map((s) => s.name);
    expect(filteredNames).toContain('read');
    expect(filteredNames).toContain('glob');
    expect(filteredNames).toContain('bash');
    expect(filteredNames).not.toContain('grep');
    expect(filteredNames).not.toContain('webfetch');
    expect(filteredNames).not.toContain('websearch');
  });

  it('routes and executes tools properly', async () => {
    const registry = new ToolRegistry();
    const res = await registry.executeTool('glob', { pattern: '*.json' }, { cwd: process.cwd() });
    expect(res.success).toBe(true);
  });

  it('handles unknown tool execution gracefully', async () => {
    const registry = new ToolRegistry();
    const res = await registry.executeTool('nonexistent_tool', {}, { cwd: process.cwd() });
    expect(res.success).toBe(false);
    expect(res.output).toContain("Unknown tool 'nonexistent_tool'");
  });
});
