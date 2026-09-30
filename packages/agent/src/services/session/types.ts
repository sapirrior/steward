import type { ModelSelection } from '../services/contracts.js';
import type { SessionDocument } from './schema.js';

export { SESSION_SCHEMA_VERSION, type SessionDocument, type SessionTurn } from './schema.js';

/** Canonical session document type */
export type SessionData = SessionDocument;

export type ToolExecutionStatus = 'running' | 'completed' | 'failed';

export interface UIHistoryItem {
  id: string;
  turnId?: string;
  type: 'user' | 'assistant' | 'reasoning' | 'tool' | 'system';
  content: string;
  toolData?: {
    toolName: string;
    displayName?: string;
    icon?: string;
    argsSummary?: string;
    status: ToolExecutionStatus;
    durationMs?: number;
    error?: string;
    toolOutput?: string;
    args?: any;
    result?: any;
  };
}

/**
 * Lightweight metadata used when listing sessions for /resume.
 */
export interface SessionSummary {
  id: string;
  name: string;
  date: string;
  createdAt: string;
  updatedAt: string;
  model: ModelSelection;
  totalTokens: number;
  turnCount: number;
  filePath: string;
}

export interface QuarantineResult {
  recovered: false;
  reason: 'invalid-json' | 'schema-mismatch' | 'unknown-version';
  quarantinedPath: string;
}

export type LoadSessionResult = SessionDocument | null;
