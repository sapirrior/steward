import { randomUUID } from 'node:crypto';
import type { Message, ToolSpec } from '@steward/ai';
import { SessionLogWriter } from '@steward/services/session/index.js';
import {
  MutationCheckpointTracker,
  globalMutationLockManager,
} from '@steward/services/checkpoint/index.js';
import { defaultToolCatalog } from '../tools/index.js';
import type { ToolContext } from '../tools/types.js';
import { ShellTaskManager } from '@steward/services/tasks/manager.js';
import { getActiveMode, MODES } from './mode.js';
import { buildSystemPrompt } from './system-prompt.js';
import type { AgentEvent, AgentEventListener } from './events.js';
import type { ModelSelection, SubmitPromptOptions } from './types.js';
import { translateAgentEventToLogEvent } from './agent-session.js';

export interface PrepareTurnDeps {
  sessionId: string;
  shellTasks: ShellTaskManager;
  sessionLogWriter?: SessionLogWriter;
  turnNumber: number;
  model: ModelSelection;
}

export interface PreparedTurn {
  turnId: string;
  turnStartedAt: string;
  turnStartMonotonic: number;
  userMessage: Message;
  abortController: AbortController;
  tracker: MutationCheckpointTracker;
  activeTools: readonly ToolSpec[] | undefined;
  toolContext: ToolContext;
  instructions: string;
  wrappedOnEvent: AgentEventListener;
}

/**
 * Prepares the turn execution context (ID, tracker, tool context, system prompt, and event logging wrapper).
 */
export async function prepareTurn(
  trimmedPrompt: string,
  options: SubmitPromptOptions,
  deps: PrepareTurnDeps,
): Promise<PreparedTurn> {
  const userMessage: Message = {
    role: 'user',
    content: trimmedPrompt,
  };

  const abortController = new AbortController();
  const turnId = randomUUID();
  const turnStartedAt = new Date().toISOString();
  const turnStartMonotonic = performance.now();

  deps.sessionLogWriter?.append({
    schemaVersion: 1,
    sessionId: deps.sessionId,
    turnId,
    type: 'turn-start',
    timestamp: turnStartedAt,
    startedAt: turnStartedAt,
    model: {
      provider: deps.model.provider,
      modelId: deps.model.modelId,
      effort: deps.model.effort,
    },
  });

  const cwd = options.cwd ?? process.cwd();
  const tracker = new MutationCheckpointTracker({
    workspaceRoot: cwd,
    sessionId: deps.sessionId,
    lockManager: globalMutationLockManager,
  });
  await tracker.beginTurn(turnId, deps.turnNumber);

  const mode = getActiveMode();
  const effectiveFilePermission = MODES[mode]?.autoApproveFiles
    ? async (_req: import('../tools/types.js').FilePermissionRequest) => ({ allowed: true })
    : options.requestFilePermission;

  const toolContext: ToolContext = {
    cwd,
    mode,
    sessionId: deps.sessionId,
    abortSignal: abortController.signal,
    checkpointTracker: tracker,
    mutationLocks: globalMutationLockManager,
    requestBashPermission: options.requestBashPermission,
    requestFilePermission: effectiveFilePermission,
    shellTasks: deps.shellTasks,
  };

  let activeTools: readonly ToolSpec[] | undefined;
  if (typeof options.tools === 'function') {
    activeTools = (options.tools as any)(toolContext);
  } else if (Array.isArray(options.tools)) {
    activeTools = options.tools;
  } else {
    activeTools = defaultToolCatalog.getSpecs(toolContext);
  }

  const instructions = buildSystemPrompt({
    cwd,
    extraInstructions: options.extraInstructions,
    chatMode: mode,
  });

  const wrappedOnEvent: AgentEventListener = (event: AgentEvent) => {
    const logEvent = translateAgentEventToLogEvent(event, {
      sessionId: deps.sessionId,
      turnId,
    });
    if (logEvent) {
      deps.sessionLogWriter?.append(logEvent);
    }
    options.onEvent?.(event);
  };

  return {
    turnId,
    turnStartedAt,
    turnStartMonotonic,
    userMessage,
    abortController,
    tracker,
    activeTools,
    toolContext,
    instructions,
    wrappedOnEvent,
  };
}
