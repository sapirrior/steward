/**
 * @steward/ai - Context overflow detection
 *
 * Detects when a request exceeded a model's context window, covering:
 * - Error message pattern matching (most providers)
 * - Silent overflow via usage.input > contextWindow (z.ai style)
 * - Length-stop with zero output filling the window (Xiaomi MiMo style)
 */

import type { InferenceResult } from '../types.js';

/**
 * Regex patterns for context overflow errors across providers.
 * Ordered from most-specific to most-generic.
 */
const OVERFLOW_PATTERNS: RegExp[] = [
  /prompt (?:is )?too long/i,                                                            // Anthropic, z.ai
  /request_too_large/i,                                                                   // Anthropic HTTP 413
  /exceeds the context window/i,                                                          // OpenAI Completions & Responses
  /exceeds (?:the )?(?:model'?s )?maximum context length(?: of [\d,]+ tokens?|\s*\([\d,]+\))/i, // OpenAI-compatible / LiteLLM
  /input token count.*exceeds the maximum/i,                                              // Google Gemini
  /maximum prompt length is \d+/i,                                                        // xAI Grok
  /reduce the length of the messages/i,                                                   // Groq
  /maximum context length is \d+ tokens/i,                                                // OpenRouter
  /exceeds (?:the )?maximum allowed input length of [\d,]+ tokens?/i,                    // OpenRouter/Poolside
  /input \(\d+ tokens\) is longer than the model'?s context length \(\d+ tokens\)/i,     // Together AI
  /exceeds the limit of \d+/i,                                                            // GitHub Copilot
  /exceeds the available context size/i,                                                  // llama.cpp
  /greater than the context length/i,                                                     // LM Studio
  /context window exceeds limit/i,                                                        // MiniMax
  /exceeded model token limit/i,                                                          // Kimi for Coding
  /too large for model with \d+ maximum context length/i,                                 // Mistral
  /prompt has [\d,]+ tokens?, but the configured context size is [\d,]+ tokens?/i,       // DS4
  /model_context_window_exceeded/i,                                                       // z.ai non-standard finish_reason
  /prompt too long; exceeded (?:max )?context length/i,                                  // Ollama
  /range of input length should be/i,                                                     // DashScope / Qwen
  /context[_ ]length[_ ]exceeded/i,                                                       // Generic fallback
  /too many tokens/i,                                                                     // Generic fallback
  /token limit exceeded/i,                                                                // Generic fallback
];

/** Patterns that indicate non-overflow errors (e.g. rate limiting) — take priority. */
const NON_OVERFLOW_PATTERNS: RegExp[] = [
  /rate limit/i,
  /too many requests/i,
];

/**
 * Returns true when an InferenceResult represents a context overflow condition.
 *
 * @param result      - The completed inference result to check
 * @param contextWindow - Optional: model's context window size for silent-overflow detection
 */
export function isContextOverflow(result: InferenceResult, contextWindow?: number): boolean {
  const { message, finishReason, error } = result;

  // Case 1: Error-based overflow — check AIError message or detail
  if (finishReason === 'error' && error) {
    const text = `${error.message} ${error.detail ?? ''}`.trim();
    const isNonOverflow = NON_OVERFLOW_PATTERNS.some((p) => p.test(text));
    if (!isNonOverflow && OVERFLOW_PATTERNS.some((p) => p.test(text))) {
      return true;
    }
  }

  const usage = message.meta?.usage;
  if (!usage) return false;

  // Case 2: Silent overflow — successful but input tokens exceed context window
  if (contextWindow && finishReason === 'stop') {
    const inputTokens = (usage.input ?? 0) + (usage.cacheRead ?? 0);
    if (inputTokens > contextWindow) return true;
  }

  // Case 3: Length-stop overflow — model truncated input, leaving no room for output
  if (contextWindow && finishReason === 'length' && (usage.output ?? 0) === 0) {
    const inputTokens = (usage.input ?? 0) + (usage.cacheRead ?? 0);
    if (inputTokens >= contextWindow * 0.99) return true;
  }

  return false;
}
