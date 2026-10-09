import type { Message, TokenUsage } from '@steward/ai';

/**
 * Lightweight metadata for thread list picker (/threads dialog)
 */
export interface ThreadMeta {
  id: string;              // e.g. "th_01jk982abc"
  title: string;           // First user prompt preview or auto-generated summary
  createdAt: string;       // ISO 8601
  updatedAt: string;       // ISO 8601
  model: string;           // Model ID used (e.g. "claude-3-7-sonnet")
  cwd: string;             // Active working directory where session started
  gitBranch?: string;      // Current git branch if inside a repo
  messageCount: number;    // Total message turns
  totalUsage?: TokenUsage; // Accumulated tokens and pricing
}

/**
 * Full persistent thread entity (~/.steward/threads/<threadId>.json)
 */
export interface Thread {
  version: 1;
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  model: string;
  cwd: string;
  gitBranch?: string;
  totalUsage?: TokenUsage;
  messages: Message[];
}
