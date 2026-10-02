import { z } from 'zod';
import type { Message, ModelSelection, TokenUsage } from '../../ports/model.js';

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

export const TokenCostSchema = z.object({
  input: z.number(),
  output: z.number(),
  cacheRead: z.number(),
  cacheWrite: z.number(),
  total: z.number(),
});

export const TokenUsageSchema = z
  .object({
    input: z.number().optional(),
    output: z.number().optional(),
    total: z.number().optional(),
    reasoning: z.number().optional(),
    cacheRead: z.number().optional(),
    cacheWrite: z.number().optional(),
    cost: TokenCostSchema.optional(),
    // Legacy schema v1 field aliases for backwards-compatibility during parse
    inputTokens: z.number().optional(),
    outputTokens: z.number().optional(),
    totalTokens: z.number().optional(),
    reasoningTokens: z.number().optional(),
    cacheReadTokens: z.number().optional(),
    cacheWriteTokens: z.number().optional(),
  })
  .transform((val) => {
    const input = val.input ?? val.inputTokens ?? 0;
    const output = val.output ?? val.outputTokens ?? 0;
    const total = val.total ?? val.totalTokens ?? input + output;
    return {
      input,
      output,
      total,
      reasoning: val.reasoning ?? val.reasoningTokens,
      cacheRead: val.cacheRead ?? val.cacheReadTokens,
      cacheWrite: val.cacheWrite ?? val.cacheWriteTokens,
      cost: val.cost,
    } satisfies TokenUsage;
  });

export const ReasoningEffortSchema = z.enum(['none', 'low', 'medium', 'high', 'xhigh']).optional();

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
