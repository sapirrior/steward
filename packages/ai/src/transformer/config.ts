/**
 * @steward/ai — Transformer Configuration
 *
 * MINIMAL. The AI SDK handles all provider-specific wire details natively.
 * We only configure the tiny things that are genuinely OUR responsibility:
 *
 * 1. omitTemperatureWithReasoning — Anthropic rejects temperature when thinking is active
 * 2. requestDefaults — per-namespace providerOptions we always want set
 *
 * Everything else (signatures, encrypted content, finish reasons, tool IDs) = SDK's job.
 */

export interface NamespaceConfig {
  /** Omit temperature param when reasoning/thinking is active */
  omitTemperatureWithReasoning: boolean;
  /** providerOptions merged into every streamText call for this namespace */
  requestDefaults: Record<string, unknown>;
}

const CONFIG: Record<string, NamespaceConfig> = {
  anthropic: {
    omitTemperatureWithReasoning: true, // Anthropic API rejects temperature with extended thinking
    requestDefaults: {},
  },
  openai: {
    omitTemperatureWithReasoning: false,
    requestDefaults: {
      // store:false — Steward owns history locally, don't store on OpenAI servers
      // reasoningSummary:'auto' — concise summaries vs SDK default 'detailed'
      providerOptions: { openai: { store: false, reasoningSummary: 'auto' } },
    },
  },
};

const DEFAULT_CONFIG: NamespaceConfig = {
  omitTemperatureWithReasoning: false,
  requestDefaults: {},
};

export function getNamespaceConfig(namespace: string | undefined): NamespaceConfig {
  if (!namespace) return DEFAULT_CONFIG;
  return CONFIG[namespace] ?? DEFAULT_CONFIG;
}
