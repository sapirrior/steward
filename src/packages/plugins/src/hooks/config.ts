/**
 * @steward/plugins - Strict Configuration Loading and Compilation
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { z } from 'zod';
import {
  DEFAULT_HOOK_TIMEOUT_MS,
  HOOK_EVENT_NAMES,
  MIN_HOOK_TIMEOUT_MS,
  MAX_HOOK_TIMEOUT_MS,
  type CompiledHook,
  type HookEventName,
  type HookSourceType,
  type RawHooksConfig,
} from './types.js';
import { compileMatcher, supportsMatcher } from './match.js';

const rawHookDefinitionSchema = z
  .object({
    name: z.string().min(1, 'Hook name must not be empty.'),
    command: z.string().min(1, 'Hook command must not be empty.'),
    matcher: z.string().optional(),
    timeoutMs: z
      .number()
      .int()
      .min(MIN_HOOK_TIMEOUT_MS, `timeoutMs must be at least ${MIN_HOOK_TIMEOUT_MS}ms.`)
      .max(MAX_HOOK_TIMEOUT_MS, `timeoutMs must not exceed ${MAX_HOOK_TIMEOUT_MS}ms.`)
      .optional(),
    enabled: z.boolean().optional(),
    description: z.string().optional(),
  })
  .strict();

export const rawHooksConfigSchema = z
  .object({
    version: z.literal(1, {
      errorMap: () => ({ message: 'Hooks config version must be 1.' }),
    }),
    hooks: z
      .object({
        SessionStart: z.array(rawHookDefinitionSchema).optional(),
        UserPromptSubmit: z.array(rawHookDefinitionSchema).optional(),
        BeforeToolUse: z.array(rawHookDefinitionSchema).optional(),
        AfterToolUse: z.array(rawHookDefinitionSchema).optional(),
        ToolUseFailure: z.array(rawHookDefinitionSchema).optional(),
        AgentStop: z.array(rawHookDefinitionSchema).optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

/**
 * Validates and compiles a raw hooks configuration object into immutable runtime CompiledHook records.
 */
export function compileHooksConfig(
  rawConfig: unknown,
  source: HookSourceType,
  sourcePath?: string,
): { hooks: CompiledHook[]; error?: string } {
  const parseResult = rawHooksConfigSchema.safeParse(rawConfig);
  if (!parseResult.success) {
    const errorMsg = parseResult.error.issues
      .map((i) => `${i.path.join('.') || 'root'}: ${i.message}`)
      .join('; ');
    return { hooks: [], error: `Invalid hooks configuration: ${errorMsg}` };
  }

  const validConfig = parseResult.data as RawHooksConfig;
  const compiled: CompiledHook[] = [];

  if (!validConfig.hooks) {
    return { hooks: compiled };
  }

  for (const eventName of HOOK_EVENT_NAMES) {
    const hookDefs = validConfig.hooks[eventName];
    if (!hookDefs || !Array.isArray(hookDefs)) {
      continue;
    }

    for (let index = 0; index < hookDefs.length; index++) {
      const def = hookDefs[index]!;
      if (def.matcher !== undefined && !supportsMatcher(eventName)) {
        return {
          hooks: [],
          error: `Hook "${def.name}" on event "${eventName}" cannot define a matcher; matchers are only supported on SessionStart, BeforeToolUse, AfterToolUse, and ToolUseFailure.`,
        };
      }

      const { allTools, matcherSet } = compileMatcher(eventName, def.matcher);

      compiled.push({
        source,
        sourcePath,
        event: eventName,
        name: def.name,
        command: def.command,
        matcher: def.matcher,
        allTools,
        matcherSet,
        timeoutMs: def.timeoutMs ?? DEFAULT_HOOK_TIMEOUT_MS,
        enabled: def.enabled ?? true,
        description: def.description,
      });
    }
  }

  return { hooks: compiled };
}

/**
 * Resolves the user hooks.json path (~/.steward/hooks.json or STEWARD_SETTINGS_DIR/hooks.json).
 */
export function getUserHooksPath(): string {
  const dir = process.env.STEWARD_SETTINGS_DIR || join(homedir(), '.steward');
  return join(dir, 'hooks.json');
}

/**
 * Resolves the project hooks.json path (.steward/hooks.json in projectDir).
 */
export function getProjectHooksPath(projectDir: string): string {
  return join(projectDir, '.steward', 'hooks.json');
}

/**
 * Safely loads and parses a hooks JSON configuration file from disk.
 * If file does not exist, returns empty hooks without error.
 * If file contains malformed JSON or invalid schema, returns empty hooks with error message.
 */
export function loadHooksConfigFile(
  filePath: string,
  source: HookSourceType,
): { hooks: CompiledHook[]; error?: string } {
  if (!existsSync(filePath)) {
    return { hooks: [] };
  }

  let content: string;
  try {
    content = readFileSync(filePath, 'utf-8');
  } catch (err: any) {
    return {
      hooks: [],
      error: `Failed to read hooks configuration from ${filePath}: ${err.message}`,
    };
  }

  const trimmed = content.trim();
  if (!trimmed) {
    return { hooks: [] };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch (err: any) {
    return {
      hooks: [],
      error: `Failed to parse JSON in hooks configuration from ${filePath}: ${err.message}`,
    };
  }

  return compileHooksConfig(parsed, source, filePath);
}
