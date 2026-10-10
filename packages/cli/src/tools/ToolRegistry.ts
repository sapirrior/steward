/**
 * @file ToolRegistry.ts
 * @description Centralized registry managing the 6 core CLI tools.
 * Handles dynamic enabling/disabling via user settings, ToolSpec conversion for LLMs,
 * validated tool routing, and unified error boundary protection.
 */

import { Tool, type ToolContext, type ToolExecutionResult, type ToolSpec } from './Tool.js';
import { FileReadTool } from './FileReadTool/index.js';
import { GlobTool } from './GlobTool/index.js';
import { GrepTool } from './GrepTool/index.js';
import { WebFetchTool } from './WebFetchTool/index.js';
import { WebSearchTool } from './WebSearchTool/index.js';
import { BashTool } from './BashTool/index.js';
import { TaskManagerTool } from './TaskManagerTool/index.js';
import type { ToolSettings } from '../settings/settingsTypes.js';

export class ToolRegistry {
  private tools = new Map<string, Tool<any, any>>();

  constructor() {
    this.registerDefaults();
  }

  private registerDefaults(): void {
    this.register(new FileReadTool());
    this.register(new GlobTool());
    this.register(new GrepTool());
    this.register(new WebFetchTool());
    this.register(new WebSearchTool());
    this.register(new BashTool());
    this.register(new TaskManagerTool());
  }

  /**
   * Registers a tool instance in the registry.
   */
  public register(tool: Tool<any, any>): void {
    this.tools.set(tool.name, tool);
  }

  /**
   * Retrieves a tool by its unique name.
   */
  public getTool(name: string): Tool<any, any> | undefined {
    return this.tools.get(name);
  }

  /**
   * Returns all registered tools.
   */
  public getAllTools(): Tool<any, any>[] {
    return Array.from(this.tools.values());
  }

  /**
   * Returns active ToolSpec definitions for the LLM stream, filtered by user settings.
   */
  public getToolSpecs(settings?: { tools?: ToolSettings }): ToolSpec[] {
    const activeTools: ToolSpec[] = [];

    for (const tool of this.tools.values()) {
      const toolName = tool.name as keyof ToolSettings;
      const isEnabled = settings?.tools ? settings.tools[toolName] !== false : true;

      if (isEnabled) {
        activeTools.push(tool.toSpec());
      }
    }

    return activeTools;
  }

  /**
   * Executes a tool with argument validation and standardized error catching.
   */
  public async executeTool(
    name: string,
    rawInput: unknown,
    context: ToolContext
  ): Promise<ToolExecutionResult> {
    const tool = this.tools.get(name);

    if (!tool) {
      return {
        success: false,
        output: `Error: Unknown tool '${name}'. Available tools: ${Array.from(this.tools.keys()).join(', ')}`,
        error: `Tool '${name}' not found`,
      };
    }

    try {
      const parsedParams = tool.validateInput(rawInput);
      return await tool.execute(parsedParams, context);
    } catch (err: any) {
      return {
        success: false,
        output: `Error executing tool '${name}': ${err.message || String(err)}`,
        error: err.message || String(err),
      };
    }
  }
}

export const toolRegistry = new ToolRegistry();
