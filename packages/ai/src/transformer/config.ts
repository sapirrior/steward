/**
 * @steward/ai — Transformer Configuration Table
 *
 * THE single source of provider-specific behavior for the transformer layer.
 * Keyed by SDK namespace (providerMetadata key). Contains ONLY pure data — no
 * functions with branching logic, no provider literals in transformer code.
 *
 * Swapping the AI SDK for another backend = change the namespace keys here.
 * Zero changes needed in messages.ts, stream.ts, usage.ts, or errors.ts.
 */

import type { FinishReason } from '../types.js';

// ─── Types ────────────────────────────────────────────────────────────────────

/** How to derive Steward canonical `input` (uncached) from SDK usage */
export type UsageMode =
  | 'no-cache-field' // use inputTokenDetails.noCacheTokens when available, else inputTokens
  | 'already-uncached'; // inputTokens already excludes cache (rare)

/** Replay policy for thinking/reasoning blocks from same-model vs foreign sessions */
export interface ReplayPolicy {
  /** Replay providerMetadata as providerOptions for same-model turns */
  sameModel: boolean;
  /** Convert thinking→text for foreign model turns */
  foreignToText: boolean;
  /** Drop empty (non-redacted) thinking blocks */
  dropEmpty: boolean;
}

/** SDK finish reason → Steward FinishReason mapping entry */
export interface FinishReasonMapEntry {
  steward: FinishReason;
  /** If set, emit an error with this message alongside the finish reason */
  errorMessage?: string;
}

/** Per-namespace provider behavior configuration */
export interface NamespaceConfig {
  /** Maps SDK metadata keys → legacy Steward field names for session replay */
  metadataToLegacy: {
    thinkingSignature?: string; // SDK metadata key that holds the thinking signature
    textSignature?: string;     // SDK metadata key for text block signature (Google)
    toolThoughtSignature?: string; // SDK metadata key for tool-call thought sig (Google)
    reasoningEncryptedContent?: string; // SDK key for OpenAI encrypted reasoning
    itemId?: string;            // SDK key for OpenAI item ID
  };
  /** Replay policy for reasoning content across turns */
  replay: ReplayPolicy;
  /** Tool call ID normalization rule */
  toolCallId: {
    /** Regex the provider-returned IDs must match */
    pattern: RegExp;
    /** Normalize foreign IDs to match the pattern */
    normalize: (id: string) => string;
  };
  /** SDK unified finish reason → Steward FinishReason */
  finishReasonMap: Partial<Record<string, FinishReasonMapEntry>>;
  /** How to derive canonical uncached input tokens from SDK usage */
  usageMode: UsageMode;
  /**
   * Provider options always included in every streamText call.
   * Merged before per-request options so they can be overridden.
   */
  requestDefaults: Record<string, unknown>;
  /** Temperature policy: omit temperature when reasoning is active */
  omitTemperatureWithReasoning: boolean;
  /** Whether to infer tool-use finish reason from presence of tool-call parts */
  inferToolUseFromParts: boolean;
}

// ─── Shared defaults ──────────────────────────────────────────────────────────

const DEFAULT_TOOL_CALL_ID = {
  pattern: /^[a-zA-Z0-9_-]{1,64}$/,
  normalize: (id: string) => id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64) || 'call_0',
};

const DEFAULT_FINISH_REASON_MAP: Partial<Record<string, FinishReasonMapEntry>> = {
  stop: { steward: 'stop' },
  length: { steward: 'length' },
  'tool-calls': { steward: 'tool-use' },
  'content-filter': { steward: 'error', errorMessage: 'blocked by content filter' },
  error: { steward: 'error' },
  other: { steward: 'stop' },
  unknown: { steward: 'stop' },
};

const DEFAULT_REPLAY: ReplayPolicy = {
  sameModel: true,
  foreignToText: true,
  dropEmpty: true,
};

// ─── Config table ─────────────────────────────────────────────────────────────

const CONFIG: Record<string, NamespaceConfig> = {
  anthropic: {
    metadataToLegacy: {
      thinkingSignature: 'signature', // [S10] Anthropic signature field
    },
    replay: DEFAULT_REPLAY,
    toolCallId: DEFAULT_TOOL_CALL_ID,
    finishReasonMap: DEFAULT_FINISH_REASON_MAP,
    usageMode: 'no-cache-field',
    requestDefaults: {},
    omitTemperatureWithReasoning: true, // [REPO] Anthropic rejects temperature with thinking
    inferToolUseFromParts: true,
  },

  openai: {
    metadataToLegacy: {
      itemId: 'itemId',                             // [S11] OpenAI reasoning item ID
      reasoningEncryptedContent: 'reasoningEncryptedContent', // [S11] encrypted reasoning
    },
    replay: DEFAULT_REPLAY,
    toolCallId: DEFAULT_TOOL_CALL_ID,
    finishReasonMap: DEFAULT_FINISH_REASON_MAP,
    usageMode: 'no-cache-field',
    requestDefaults: {
      // store:false — Steward owns conversation history locally (Decision D8)
      // reasoningSummary:'auto' — keep summaries concise vs SDK default 'detailed' (D8)
      providerOptions: {
        openai: { store: false, reasoningSummary: 'auto' },
      },
    },
    omitTemperatureWithReasoning: false,
    inferToolUseFromParts: true,
  },

  google: {
    metadataToLegacy: {
      thinkingSignature: 'thinkingSignature', // [REPO google-generative-ai.ts]
      textSignature: 'textSignature',
      toolThoughtSignature: 'thoughtSignature',
    },
    replay: DEFAULT_REPLAY,
    toolCallId: DEFAULT_TOOL_CALL_ID,
    finishReasonMap: DEFAULT_FINISH_REASON_MAP,
    usageMode: 'no-cache-field',
    requestDefaults: {},
    omitTemperatureWithReasoning: false,
    inferToolUseFromParts: true,
  },

  mistral: {
    metadataToLegacy: {},
    replay: DEFAULT_REPLAY,
    toolCallId: DEFAULT_TOOL_CALL_ID,
    finishReasonMap: DEFAULT_FINISH_REASON_MAP,
    usageMode: 'no-cache-field',
    requestDefaults: {},
    omitTemperatureWithReasoning: false,
    inferToolUseFromParts: true,
  },

  xai: {
    metadataToLegacy: {},
    replay: DEFAULT_REPLAY,
    toolCallId: DEFAULT_TOOL_CALL_ID,
    finishReasonMap: DEFAULT_FINISH_REASON_MAP,
    usageMode: 'no-cache-field',
    requestDefaults: {},
    omitTemperatureWithReasoning: false,
    inferToolUseFromParts: true,
  },

  deepseek: {
    metadataToLegacy: {},
    replay: DEFAULT_REPLAY,
    toolCallId: DEFAULT_TOOL_CALL_ID,
    finishReasonMap: DEFAULT_FINISH_REASON_MAP,
    usageMode: 'no-cache-field',
    requestDefaults: {},
    omitTemperatureWithReasoning: false,
    inferToolUseFromParts: true,
  },

  groq: {
    metadataToLegacy: {},
    replay: DEFAULT_REPLAY,
    toolCallId: DEFAULT_TOOL_CALL_ID,
    finishReasonMap: DEFAULT_FINISH_REASON_MAP,
    usageMode: 'no-cache-field',
    requestDefaults: {},
    omitTemperatureWithReasoning: false,
    inferToolUseFromParts: true,
  },

  openrouter: {
    metadataToLegacy: {},
    replay: DEFAULT_REPLAY,
    toolCallId: DEFAULT_TOOL_CALL_ID,
    finishReasonMap: DEFAULT_FINISH_REASON_MAP,
    usageMode: 'no-cache-field',
    requestDefaults: {},
    omitTemperatureWithReasoning: false,
    inferToolUseFromParts: true,
  },

  ollama: {
    metadataToLegacy: {},
    replay: DEFAULT_REPLAY,
    toolCallId: DEFAULT_TOOL_CALL_ID,
    finishReasonMap: DEFAULT_FINISH_REASON_MAP,
    usageMode: 'no-cache-field',
    requestDefaults: {},
    omitTemperatureWithReasoning: false,
    inferToolUseFromParts: false,
  },

  'github-copilot': {
    metadataToLegacy: {},
    replay: DEFAULT_REPLAY,
    toolCallId: DEFAULT_TOOL_CALL_ID,
    finishReasonMap: DEFAULT_FINISH_REASON_MAP,
    usageMode: 'no-cache-field',
    requestDefaults: {},
    omitTemperatureWithReasoning: false,
    inferToolUseFromParts: true,
  },
};

/** Safe default for unknown/custom namespaces */
const DEFAULT_CONFIG: NamespaceConfig = {
  metadataToLegacy: {},
  replay: DEFAULT_REPLAY,
  toolCallId: DEFAULT_TOOL_CALL_ID,
  finishReasonMap: DEFAULT_FINISH_REASON_MAP,
  usageMode: 'no-cache-field',
  requestDefaults: {},
  omitTemperatureWithReasoning: false,
  inferToolUseFromParts: true,
};

/** Look up namespace config — falls back to safe defaults for unknown namespaces */
export function getNamespaceConfig(namespace: string | undefined): NamespaceConfig {
  if (!namespace) return DEFAULT_CONFIG;
  return CONFIG[namespace] ?? DEFAULT_CONFIG;
}

export { DEFAULT_TOOL_CALL_ID, DEFAULT_FINISH_REASON_MAP };
