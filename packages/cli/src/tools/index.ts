import { ToolCatalog } from './catalog.js';
import { readFileTool } from './FileReadTool/index.js';
import { writeFileTool } from './FileWriteTool/index.js';
import { editFileTool } from './FileEditTool/index.js';
import { globTool } from './GlobTool/index.js';
import { grepTool } from './GrepTool/index.js';
import { listDirTool } from './DirectoryListTool/index.js';
import { sleepTool } from './SleepTool/index.js';
import { bashTool } from './BashTool/index.js';
import { taskReadTool } from './TaskReadTool/index.js';
import { taskSendInputTool } from './TaskSendInputTool/index.js';
import { taskKillTool } from './TaskKillTool/index.js';
import { taskListTool } from './TaskListTool/index.js';
import { webFetchTool } from './WebFetchTool/index.js';
import { webSearchTool } from './WebSearchTool/index.js';
import { skillListTool } from './SkillListTool/index.js';
import { skillReadTool } from './SkillReadTool/index.js';
import type { ToolContext, ToolDefinition } from './types.js';

export const builtInTools: ToolDefinition<any, any>[] = [
  readFileTool,
  writeFileTool,
  editFileTool,
  globTool,
  grepTool,
  listDirTool,
  sleepTool,
  bashTool,
  taskListTool,
  taskReadTool,
  taskSendInputTool,
  taskKillTool,
  webFetchTool,
  webSearchTool,
  skillListTool,
  skillReadTool,
];

export function createDefaultToolCatalog(): ToolCatalog {
  const catalog = new ToolCatalog();
  for (const tool of builtInTools) {
    catalog.register(tool);
  }
  return catalog;
}

export const defaultToolCatalog: ToolCatalog = createDefaultToolCatalog();

/**
 * Returns plain ToolSpec array for all registered tools allowed in the given context.
 */
export function getToolSpecs(context: ToolContext, catalog: ToolCatalog = defaultToolCatalog) {
  return catalog.getSpecs(context);
}

export * from './catalog.js';
export * from './FileReadTool/index.js';
export * from './FileWriteTool/index.js';
export * from './FileEditTool/index.js';
export * from './GlobTool/index.js';
export * from './GrepTool/index.js';
export * from './DirectoryListTool/index.js';
export * from './SleepTool/index.js';
export * from './BashTool/index.js';
export * from './TaskListTool/index.js';
export * from './TaskReadTool/index.js';
export * from './TaskSendInputTool/index.js';
export * from './TaskKillTool/index.js';
export * from './WebFetchTool/index.js';
export * from './WebSearchTool/index.js';
export * from './SkillListTool/index.js';
export * from './SkillReadTool/index.js';
export * from './summary.js';
export * from './types.js';
