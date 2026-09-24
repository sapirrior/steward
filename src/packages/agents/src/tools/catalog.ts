/**
 * @steward/agents - Central Tool Catalog
 */

import { z } from 'zod';
import type { JsonSchema, ToolSpec } from '@steward/ai';
import { isAllowed, MODES, type ChatMode } from '../policy/modes.js';
import type { ToolContext, ToolDefinition } from './types.js';

export class ToolCatalog {
  private tools = new Map<string, ToolDefinition>();

  /**
   * Registers a tool into the catalog.
   */
  public register<TParams extends z.ZodTypeAny, TResult>(
    definition: ToolDefinition<TParams, TResult>,
  ): this {
    this.tools.set(definition.name, definition as unknown as ToolDefinition);
    return this;
  }

  /**
   * Retrieves a tool by name.
   */
  public get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  /**
   * Returns all registered tools.
   */
  public getAll(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  /**
   * Checks whether a tool exists in the catalog.
   */
  public has(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Returns all available tools allowed by the context mode.
   */
  public getAvailable(context: ToolContext): ToolDefinition[] {
    const mode: ChatMode = context.mode ?? 'normal';
    return Array.from(this.tools.values()).filter((def) => isAllowed(mode, def.access));
  }

  /**
   * Converts registered tools allowed by the active mode into plain serializable ToolSpec[].
   */
  public getSpecs(context: ToolContext): ToolSpec[] {
    const available = this.getAvailable(context);
    return available.map((def) => {
      let inputSchema: JsonSchema;
      try {
        inputSchema = z.toJSONSchema(def.parameters) as JsonSchema;
      } catch {
        inputSchema = { type: 'object' };
      }
      return {
        name: def.name,
        description: def.description,
        inputSchema,
      };
    });
  }

  /**
   * Validates and executes a tool safely through the catalog pipeline.
   */
  public async execute(name: string, input: unknown, context: ToolContext): Promise<unknown> {
    const def = this.get(name);
    if (!def) {
      throw new Error(`Tool "${name}" not found in catalog.`);
    }

    const mode: ChatMode = context.mode ?? 'normal';
    if (!isAllowed(mode, def.access)) {
      const modeLabel = MODES[mode]?.label ?? mode;
      throw new Error(`Tool "${name}" is not available in ${modeLabel} mode.`);
    }

    // Validate parameters schema
    const parsedArgs = def.parameters.parse(input);

    return await def.execute(parsedArgs, context);
  }
}

/**
 * Global default tool catalog instance.
 */
export const defaultToolCatalog = new ToolCatalog();
