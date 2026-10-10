import { describe, expect, it } from 'bun:test';
import { z } from 'zod';
import { Tool, type ToolContext, type ToolExecutionResult } from './Tool.js';

class MockTool extends Tool<{ query: string; limit?: number }, { count: number }> {
  readonly name = 'mock_search';
  readonly glyph = '✱';
  readonly description = 'A mock search tool for testing';
  readonly schema = z.object({
    query: z.string().describe('Search query string'),
    limit: z.number().optional().describe('Maximum number of items'),
  });

  async execute(
    params: { query: string; limit?: number },
    _context: ToolContext
  ): Promise<ToolExecutionResult<{ count: number }>> {
    if (params.query === 'fail') {
      return this.error('Query failed intentionally');
    }
    return this.success(`Found results for ${params.query}`, { count: 42 });
  }
}

describe('Tool Base Class', () => {
  it('generates valid ToolSpec with inputSchema from Zod', () => {
    const tool = new MockTool();
    const spec = tool.toSpec();

    expect(spec.name).toBe('mock_search');
    expect(spec.description).toBe('A mock search tool for testing');
    expect(spec.inputSchema).toBeDefined();
    expect((spec.inputSchema as any).type).toBe('object');
    expect((spec.inputSchema as any).properties.query).toBeDefined();
  });

  it('validates correct arguments', () => {
    const tool = new MockTool();
    const parsed = tool.validateInput({ query: 'hello world', limit: 10 });
    expect(parsed.query).toBe('hello world');
    expect(parsed.limit).toBe(10);
  });

  it('throws descriptive error on invalid arguments', () => {
    const tool = new MockTool();
    expect(() => tool.validateInput({ limit: 'not a number' } as any)).toThrow(
      "Invalid arguments for tool 'mock_search'"
    );
  });

  it('executes successful operation and returns formatted output', async () => {
    const tool = new MockTool();
    const res = await tool.execute({ query: 'test' }, { cwd: '/test' });
    expect(res.success).toBe(true);
    expect(res.output).toBe('Found results for test');
    expect(res.data?.count).toBe(42);
  });

  it('handles error execution', async () => {
    const tool = new MockTool();
    const res = await tool.execute({ query: 'fail' }, { cwd: '/test' });
    expect(res.success).toBe(false);
    expect(res.error).toBe('Query failed intentionally');
    expect(res.output).toContain('Error in mock_search: Query failed intentionally');
  });
});
