/**
 * @steward/ai — Transformer: Tools Normalization
 *
 * Converts Steward Tool definitions into AI SDK ToolSet using jsonSchema / tool helper.
 * Pure functions, no I/O.
 */

import { jsonSchema, tool, type ToolSet } from 'ai';
import type { ToolSpec } from '../types.js';

export function normalizeTools(tools?: readonly ToolSpec[]): ToolSet | undefined {
  if (!tools || tools.length === 0) {
    return undefined;
  }

  const result: ToolSet = {};

  for (const t of tools) {
    result[t.name] = tool({
      description: t.description,
      inputSchema: jsonSchema(t.inputSchema as any),
    });
  }

  return result;
}
