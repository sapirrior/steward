import { describe, expect, it } from 'bun:test';
import { adaptToolsToAiSdk } from './aiSdkToolAdapter.js';
import { ToolRegistry } from './ToolRegistry.js';
import type { Tool, ToolContext } from './Tool.js';
import { z } from 'zod';

class MockEchoTool implements Tool<{ message: string }, { echo: string }> {
  readonly name = 'echo';
  readonly description = 'Echo back message';
  readonly schema = z.object({ message: z.string() });

  async execute(args: { message: string }, context: ToolContext): Promise<{ echo: string }> {
    if (args.message === 'fail') {
      throw new Error('Explosion');
    }
    return { echo: `Echo: ${args.message} from ${context.cwd}` };
  }
}

describe('adaptToolsToAiSdk', () => {
  it('converts ToolRegistry into AI SDK ToolSet', async () => {
    const registry = new ToolRegistry();
    registry.register(new MockEchoTool());

    const toolSet = adaptToolsToAiSdk(registry, { cwd: '/test/workspace' });
    expect(toolSet.echo).toBeDefined();
    expect(toolSet.echo.description).toBe('Echo back message');

    const result = await (toolSet.echo as any).execute({ message: 'hello' });
    expect(result).toEqual({ echo: 'Echo: hello from /test/workspace' });
  });

  it('catches execution errors and returns error payload', async () => {
    const toolSet = adaptToolsToAiSdk([new MockEchoTool()]);
    const result = await (toolSet.echo as any).execute({ message: 'fail' });
    expect(result).toEqual({ isError: true, error: 'Explosion' });
  });
});
