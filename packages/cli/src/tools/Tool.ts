/**
 * @file Tool.ts
 * @description Abstract base class and contracts for all Steward CLI tools.
 * Provides declarative Zod schema validation, JSON schema serialization for LLMs,
 * progress streaming, and standardized execution context.
 */

import { z } from 'zod';

export type JsonSchema = Record<string, unknown>;

export interface ToolSpec {
  name: string;
  description: string;
  inputSchema: JsonSchema;
}

// ─── Progress & Context Contracts ─────────────────────────────────────────────

export interface ToolProgress {
  type: 'status' | 'delta' | 'log';
  message?: string;
  delta?: string;
  bytes?: number;
  totalBytes?: number;
}

export interface PermissionRequest {
  toolName: string;
  action: string;
  command?: string;
  target?: string;
  reason?: string;
}

export interface ToolContext {
  cwd: string;
  signal?: AbortSignal;
  threadId?: string;
  onProgress?: (progress: ToolProgress) => void;
  askPermission?: (request: PermissionRequest) => Promise<boolean>;
}

// ─── Result Contracts ─────────────────────────────────────────────────────────

export interface ToolExecutionResult<TData = unknown> {
  success: boolean;
  data?: TData;
  output: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

// ─── Base Tool Abstract Class ─────────────────────────────────────────────────

export abstract class Tool<TParams = Record<string, unknown>, TResult = unknown> {
  /**
   * Unique name of the tool (e.g., 'read', 'glob', 'grep', 'bash', 'webfetch', 'websearch').
   */
  abstract readonly name: string;

  /**
   * Visual icon glyph for TUI representation (e.g., '✱', '✻', '$').
   */
  abstract readonly glyph: string;

  /**
   * Comprehensive tool description provided to the LLM.
   */
  abstract readonly description: string;

  /**
   * Declarative Zod schema for runtime argument validation.
   */
  abstract readonly schema: z.ZodType<TParams>;

  /**
   * Whether this tool executes mutating or potentially hazardous actions by default.
   */
  readonly isDangerous: boolean = false;

  private _cachedJsonSchema?: JsonSchema;

  /**
   * Automatically derives the JSON Schema specification from the Zod schema.
   */
  get inputSchema(): JsonSchema {
    if (!this._cachedJsonSchema) {
      this._cachedJsonSchema = z.toJSONSchema(this.schema) as JsonSchema;
    }
    return this._cachedJsonSchema;
  }

  /**
   * Converts this tool into a ToolSpec compatible with `@steward/agent`.
   */
  toSpec(): ToolSpec {
    return {
      name: this.name,
      description: this.description,
      inputSchema: this.inputSchema,
    };
  }

  /**
   * Validates and parses incoming raw parameters against the Zod schema.
   */
  validateInput(input: unknown): TParams {
    const parsed = this.schema.safeParse(input ?? {});
    if (!parsed.success) {
      const issueDetails = parsed.error.issues
        .map((issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`)
        .join('; ');
      throw new Error(`Invalid arguments for tool '${this.name}': ${issueDetails}`);
    }
    return parsed.data;
  }

  /**
   * Executes the tool logic with the provided parsed parameters and execution context.
   */
  abstract execute(params: TParams, context: ToolContext): Promise<ToolExecutionResult<TResult>>;

  /**
   * Helper to construct a standardized successful execution result.
   */
  protected success(
    output: string,
    data?: TResult,
    metadata?: Record<string, unknown>
  ): ToolExecutionResult<TResult> {
    return {
      success: true,
      output,
      data,
      metadata,
    };
  }

  /**
   * Helper to construct a standardized error execution result.
   */
  protected error(
    message: string,
    errorObj?: unknown,
    metadata?: Record<string, unknown>
  ): ToolExecutionResult<TResult> {
    const errorDetails = errorObj instanceof Error ? errorObj.message : String(errorObj ?? message);
    return {
      success: false,
      output: `Error in ${this.name}: ${message}${errorObj ? ` (${errorDetails})` : ''}`,
      error: message,
      metadata,
    };
  }
}
