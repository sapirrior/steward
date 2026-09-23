import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

/**
 * Returns the base root directory for Steward on-disk storage (~/.steward).
 */
export function getStewardHomeDir(): string {
  if (process.env.STEWARD_SETTINGS_DIR) {
    return process.env.STEWARD_SETTINGS_DIR;
  }
  return join(homedir(), '.steward');
}

/**
 * Resolves directory path for settings (~/.steward or overridden by STEWARD_SETTINGS_DIR).
 */
export function getSettingsDir(): string {
  if (process.env.STEWARD_SETTINGS_DIR) {
    return process.env.STEWARD_SETTINGS_DIR;
  }
  return getStewardHomeDir();
}

/**
 * Resolves path to ~/.steward/settings.json.
 */
export function getSettingsPath(): string {
  return join(getSettingsDir(), 'settings.json');
}

/**
 * Resolves directory path for sessions (~/.steward/sessions or overridden by STEWARD_SESSIONS_DIR).
 */
export function getSessionsRootDir(): string {
  if (process.env.STEWARD_SESSIONS_DIR) {
    return process.env.STEWARD_SESSIONS_DIR;
  }
  return join(getStewardHomeDir(), 'sessions');
}

/**
 * Resolves full file path for a session document: ~/.steward/sessions/<date>/<sessionId>.json
 */
export function getSessionFilePath(date: string, sessionId: string): string {
  return join(getSessionsRootDir(), date, `${sessionId}.json`);
}

/**
 * Resolves base directory for session presentation logs: ~/.steward/session-logs
 */
export function getSessionLogsRootDir(): string {
  if (process.env.STEWARD_SESSIONS_DIR) {
    return join(dirname(process.env.STEWARD_SESSIONS_DIR), 'session-logs');
  }
  return join(getStewardHomeDir(), 'session-logs');
}

/**
 * Resolves full file path for a session log: ~/.steward/session-logs/<date>/<sessionId>.jsonl
 */
export function getSessionLogPath(date: string, sessionId: string): string {
  return join(getSessionLogsRootDir(), date, `${sessionId}.jsonl`);
}

/**
 * Resolves base directory for mutation checkpoints: ~/.steward/checkpoints
 */
export function getCheckpointsRootDir(): string {
  if (process.env.STEWARD_CHECKPOINTS_DIR) {
    return process.env.STEWARD_CHECKPOINTS_DIR;
  }
  return join(getStewardHomeDir(), 'checkpoints');
}

export function getWorkspaceCasDir(workspaceHash: string): string {
  return join(getCheckpointsRootDir(), workspaceHash, 'cas');
}

export function getBlobPath(workspaceHash: string, sha256: string): string {
  return join(getWorkspaceCasDir(workspaceHash), sha256);
}

export function getManifestsDir(workspaceHash: string): string {
  return join(getCheckpointsRootDir(), workspaceHash, 'manifests');
}

export function getManifestPath(workspaceHash: string, sessionId: string): string {
  return join(getManifestsDir(workspaceHash), `${sessionId}.json`);
}

export function getJournalsDir(workspaceHash: string): string {
  return join(getCheckpointsRootDir(), workspaceHash, 'journals');
}

export function getJournalPath(workspaceHash: string, sessionId: string): string {
  return join(getJournalsDir(workspaceHash), `${sessionId}.json`);
}

/**
 * Resolves base directory for background shell tasks: ~/.steward/tasks
 */
export function getTasksDir(): string {
  return join(getStewardHomeDir(), 'tasks');
}

/**
 * Resolves directory for diagnostic error logs: ~/.steward/logs
 */
export function getLogsDir(): string {
  if (process.env.STEWARD_LOGS_DIR) {
    return process.env.STEWARD_LOGS_DIR;
  }
  return join(getStewardHomeDir(), 'logs');
}

/**
 * Resolves user skills directory: ~/.steward/skills
 */
export function getUserSkillsDir(): string {
  return join(getStewardHomeDir(), 'skills');
}
