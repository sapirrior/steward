import { defaultToolCatalog } from '../tools/index.js';
import { type ToolCatalog } from '../tools/catalog.js';
import type { ToolContext } from '../tools/types.js';
import type { ToolCallContent, ToolResult } from '@steward/agent';

export async function executeToolCall(
  call: ToolCallContent,
  context: ToolContext,
  catalog: ToolCatalog = defaultToolCatalog,
): Promise<ToolResult> {
  const startedAt = new Date().toISOString();
  const monotonicStart = performance.now();

  try {
    const result = await catalog.execute(call.name, call.arguments, context);
    const finishedAt = new Date().toISOString();
    const durationMs = Math.max(0, Math.round(performance.now() - monotonicStart));

    return {
      id: call.id,
      name: call.name,
      args: call.arguments,
      result,
      isError: false,
      durationMs,
      startedAt,
      finishedAt,
    };
  } catch (err: any) {
    const finishedAt = new Date().toISOString();
    const durationMs = Math.max(0, Math.round(performance.now() - monotonicStart));
    const errorMsg = err instanceof Error ? err.message : String(err);

    return {
      id: call.id,
      name: call.name,
      args: call.arguments,
      result: errorMsg,
      isError: true,
      durationMs,
      startedAt,
      finishedAt,
    };
  }
}
