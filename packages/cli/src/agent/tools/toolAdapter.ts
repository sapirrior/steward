import { tool } from 'ai';
import type { ToolRegistry } from '../../tools/ToolRegistry.js';
import type { Tool } from '../../tools/Tool.js';
import type { AgentToolCallStartEvent, AgentToolCallResultEvent } from '../types.js';

export interface ToolAdapterOptions {
  cwd?: string;
  onToolStart?: (event: AgentToolCallStartEvent) => void;
  onToolResult?: (event: AgentToolCallResultEvent) => void;
}

/**
 * Adapts Steward ToolRegistry (or Tool[]) into native AI SDK tool dictionary.
 * Pure and event-driven: emits all tool events directly to the caller without printing.
 */
export function adaptTools(
  registry: ToolRegistry | Tool[],
  options?: ToolAdapterOptions,
): Record<string, any> {
  const toolsList: Tool<any, any>[] = Array.isArray(registry) ? registry : registry.getAllTools();

  const adapted: Record<string, any> = {};
  const cwd = options?.cwd || process.cwd();

  for (const t of toolsList) {
    adapted[t.name] = tool({
      description: t.description,
      inputSchema: t.schema,
      execute: async (args: any, execOptions?: any) => {
        const startTime = Date.now();
        const tagline = typeof args?.tagline === 'string' ? args.tagline : `${t.name} executing...`;
        const toolCallId =
          execOptions?.toolCallId || `call_${Math.random().toString(36).slice(2, 10)}`;

        options?.onToolStart?.({
          type: 'tool-call-start',
          toolCallId,
          toolName: t.name,
          tagline,
          args,
        });

        try {
          const result = await t.execute(args, {
            cwd,
            signal: execOptions?.abortSignal,
          });
          const durationMs = Date.now() - startTime;

          options?.onToolResult?.({
            type: 'tool-call-result',
            toolCallId,
            toolName: t.name,
            tagline,
            isError: false,
            result,
            durationMs,
          });

          return result;
        } catch (err: unknown) {
          const durationMs = Date.now() - startTime;
          const errorMsg = err instanceof Error ? err.message : String(err);

          options?.onToolResult?.({
            type: 'tool-call-result',
            toolCallId,
            toolName: t.name,
            tagline,
            isError: true,
            result: errorMsg,
            durationMs,
          });

          // Return structured error result so model can self-correct instead of crashing turn
          return {
            isError: true,
            error: errorMsg,
          };
        }
      },
    });
  }

  return adapted;
}
