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

export const TokenCostSchema = z
  .object({
    input: z.number().nullable().optional(),
    output: z.number().nullable().optional(),
    cacheRead: z.number().nullable().optional(),
    cacheWrite: z.number().nullable().optional(),
    total: z.number().nullable().optional(),
  })
  .transform((val) => {
    const input = val.input ?? 0;
    const output = val.output ?? 0;
    const cacheRead = val.cacheRead ?? 0;
    const cacheWrite = val.cacheWrite ?? 0;
    const total = val.total ?? input + output;
    return { input, output, cacheRead, cacheWrite, total };
  });

export const TokenUsageSchema = z
  .object({
    input: z.number().nullable().optional(),
    output: z.number().nullable().optional(),
    total: z.number().nullable().optional(),
    reasoning: z.number().nullable().optional(),
    cacheRead: z.number().nullable().optional(),
    cacheWrite: z.number().nullable().optional(),
    cost: TokenCostSchema.nullable().optional(),
    // Legacy schema v1 field aliases for backwards-compatibility during parse
    inputTokens: z.number().nullable().optional(),
    outputTokens: z.number().nullable().optional(),
    totalTokens: z.number().nullable().optional(),
    reasoningTokens: z.number().nullable().optional(),
    cacheReadTokens: z.number().nullable().optional(),
    cacheWriteTokens: z.number().nullable().optional(),
  })
  .transform((val) => {
    const input = val.input ?? val.inputTokens ?? 0;
    const output = val.output ?? val.outputTokens ?? 0;
    const total = val.total ?? val.totalTokens ?? input + output;
    return {
      input,
      output,
      total,
      reasoning: val.reasoning ?? val.reasoningTokens ?? undefined,
      cacheRead: val.cacheRead ?? val.cacheReadTokens ?? undefined,
      cacheWrite: val.cacheWrite ?? val.cacheWriteTokens ?? undefined,
      cost: val.cost ?? undefined,
    } satisfies TokenUsage;
  });

export const ReasoningEffortSchema = z
  .union([
    z.enum(['none', 'low', 'medium', 'high', 'xhigh']),
    z.string().transform((val) => {
      const lower = val.toLowerCase().trim();
      if (lower === 'none' || lower === 'off' || lower === '0') return 'none';
      if (lower === 'low' || lower === 'minimal' || lower === '1' || lower === '2' || lower === '3')
        return 'low';
      if (
        lower === 'high' ||
        lower === 'xhigh' ||
        lower === 'max' ||
        lower === '5' ||
        lower === '6'
      )
        return 'high';
      if (lower === 'medium' || lower === '4') return 'medium';
      return undefined;
    }),
  ])
  .optional()
  .nullable()
  .transform((val) => val ?? undefined);

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
