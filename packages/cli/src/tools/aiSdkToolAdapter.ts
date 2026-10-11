import { tool, type ToolSet } from 'ai';
import type { ToolRegistry } from './ToolRegistry.js';
import type { Tool, ToolProgress, PermissionRequest } from './Tool.js';

export interface AiSdkToolAdapterOptions {
  cwd?: string;
  threadId?: string;
  onProgress?: (progress: ToolProgress) => void;
  askPermission?: (request: PermissionRequest) => Promise<boolean>;
}

/**
 * Adapts Steward ToolRegistry (or Tool[]) into native AI SDK ToolSet.
 * Handles permission validation, execution closures, and graceful error catching.
 */
export function adaptToolsToAiSdk(
  registry: ToolRegistry | Tool[],
  options?: AiSdkToolAdapterOptions
): ToolSet {
  const toolsList: Tool<any, any>[] = Array.isArray(registry)
    ? registry
    : registry.getAllTools();

  const adapted: ToolSet = {};
  const cwd = options?.cwd || process.cwd();

  for (const t of toolsList) {
    adapted[t.name] = tool({
      description: t.description,
      parameters: t.schema,
      execute: async (args: any, execOptions?: { abortSignal?: AbortSignal }) => {
        try {
          const result = await t.execute(args, {
            cwd,
            signal: execOptions?.abortSignal,
            threadId: options?.threadId,
            onProgress: options?.onProgress,
            askPermission: options?.askPermission,
          });
          return result;
        } catch (err: unknown) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          // Return structured error result so model can self-correct
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
