import type { ToolSettings } from '../../settings/settingsTypes.js';
import { VALID_TOOL_NAMES, type ToolName } from '../types.js';

function parseBooleanValue(val: string): boolean {
  const normalized = val.trim().toLowerCase();
  if (['true', '1', 'on', 'yes', 'enabled'].includes(normalized)) {
    return true;
  }
  if (['false', '0', 'off', 'no', 'disabled'].includes(normalized)) {
    return false;
  }
  throw new Error(`Invalid boolean value '${val}'. Use true/false, on/off, or 1/0.`);
}

/**
 * Parses and merges tool toggle flags on top of base tool settings.
 *
 * Supports:
 * - `--tool <name=state>` or `--tool <name:state>` (e.g. `--tool bash=false`, `--tool websearch=on`)
 * - `--enable-tool <name>` (e.g. `--enable-tool bash`)
 * - `--disable-tool <name>` (e.g. `--disable-tool webfetch`)
 */
export function resolveToolOptions(
  base: ToolSettings,
  options: {
    tool?: string[];
    enableTool?: string[];
    disableTool?: string[];
  },
): ToolSettings {
  const result: ToolSettings = { ...base };

  const normalizeToolName = (raw: string): ToolName => {
    const trimmed = raw.trim().toLowerCase() as ToolName;
    if (!VALID_TOOL_NAMES.includes(trimmed)) {
      throw new Error(`Unknown tool: '${raw}'. Valid tools are: ${VALID_TOOL_NAMES.join(', ')}`);
    }
    return trimmed;
  };

  // 1. Process `--tool <name=state>`
  if (options.tool && options.tool.length > 0) {
    for (const spec of options.tool) {
      if (!spec || !spec.trim()) continue;
      const separatorIndex = spec.includes('=') ? spec.indexOf('=') : spec.indexOf(':');

      if (separatorIndex === -1) {
        // If passed without value (e.g. `--tool bash`), treat as enabled
        const toolName = normalizeToolName(spec);
        result[toolName] = true;
      } else {
        const rawName = spec.slice(0, separatorIndex);
        const rawVal = spec.slice(separatorIndex + 1);
        const toolName = normalizeToolName(rawName);
        result[toolName] = parseBooleanValue(rawVal);
      }
    }
  }

  // 2. Process `--enable-tool <name>`
  if (options.enableTool && options.enableTool.length > 0) {
    for (const name of options.enableTool) {
      if (!name || !name.trim()) continue;
      const toolName = normalizeToolName(name);
      result[toolName] = true;
    }
  }

  // 3. Process `--disable-tool <name>`
  if (options.disableTool && options.disableTool.length > 0) {
    for (const name of options.disableTool) {
      if (!name || !name.trim()) continue;
      const toolName = normalizeToolName(name);
      result[toolName] = false;
    }
  }

  return result;
}
