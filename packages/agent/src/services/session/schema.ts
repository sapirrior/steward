import { z } from 'zod';
import type { Message, ModelSelection, TokenUsage } from '../services/contracts.js';

export const SESSION_SCHEMA_VERSION = 1;

export interface SessionTurn {
  id: string;
  timestamp: string;
  status: 'complete' | 'interrupted' | 'errored';
  usage: TokenUsage;
  /** Canonical source of truth for conversation replay and history */
  messages: Message[];
}

export interface SessionDocument {
  schemaVersion: 1;
  id: string;
  name: string;
  date: string;
  createdAt: string;
  updatedAt: string;
  model: ModelSelection;
  totalUsage: TokenUsage;
  turns: SessionTurn[];
}

export const TokenUsageSchema = z.object({
  inputTokens: z.number(),
  outputTokens: z.number(),
  totalTokens: z.number(),
  reasoningTokens: z.number().optional(),
  cacheReadTokens: z.number().optional(),
  cacheWriteTokens: z.number().optional(),
});

export const ReasoningEffortSchema = z.enum(['none', 'low', 'medium', 'high']).optional();

export const ModelSelectionSchema = z.object({
  provider: z.string() as z.ZodType<any>,
  modelId: z.string(),
  effort: ReasoningEffortSchema,
});

export const SessionTurnSchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  status: z.enum(['complete', 'interrupted', 'errored']),
  usage: TokenUsageSchema,
  messages: z.array(z.any()),
});

export const SessionDocumentSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string(),
  name: z.string(),
  date: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  model: ModelSelectionSchema,
  totalUsage: TokenUsageSchema,
  turns: z.array(SessionTurnSchema),
});
