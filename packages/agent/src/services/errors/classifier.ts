import { AIError } from '@steward/ai';
import type { StructuredError } from './types.js';

/**
 * Classifies raw exceptions from @steward/ai, providers, and tools
 * into actionable, structured error objects.
 */
export function classifyError(error: unknown): StructuredError {
  if (!error) {
    return {
      category: 'unknown',
      shortMessage: 'Unknown error occurred',
      isRetryable: false,
    };
  }

  // 1. User / Signal Abort
  if (
    (error as any)?.name === 'AbortError' ||
    (error as any)?.message?.includes('aborted') ||
    (error as any)?.message?.includes('AbortError') ||
    (error instanceof AIError && error.code === 'aborted')
  ) {
    return {
      category: 'aborted',
      code: 'ABORTED',
      shortMessage: 'Interrupted by user',
      isRetryable: false,
      originalError: error,
    };
  }

  // 2. AIError from @steward/ai
  if (error instanceof AIError) {
    const status = error.status;
    const code = error.code;

    if (code === 'auth' || code === 'oauth' || status === 401) {
      return {
        category: 'auth',
        statusCode: status ?? 401,
        shortMessage: error.message || 'Authentication failed',
        isRetryable: false,
        suggestedAction:
          code === 'oauth'
            ? 'Run /login to authenticate with OAuth or /logout to clear credentials'
            : 'Check your API key in ~/.env or select a model with /model',
        originalError: error,
      };
    }

    if (status === 403) {
      return {
        category: 'forbidden',
        statusCode: 403,
        shortMessage: '403 Forbidden - Access denied',
        isRetryable: false,
        suggestedAction: 'Verify model permissions or credit balance on your provider account',
        originalError: error,
      };
    }

    if (code === 'rate-limit' || status === 429) {
      return {
        category: 'rate-limit',
        statusCode: 429,
        shortMessage: '429 Rate limit reached',
        isRetryable: true,
        retryAfterSec: 5,
        suggestedAction: 'Provider quota reached. Waiting before retry or switch models via /model',
        originalError: error,
      };
    }

    if (code === 'network') {
      return {
        category: 'network',
        shortMessage: 'Unable to connect to model API server',
        isRetryable: true,
        retryAfterSec: 4,
        suggestedAction:
          'Verify network connection, local model server (e.g. Ollama/vLLM), or endpoint URL',
        originalError: error,
      };
    }

    if (code === 'parse') {
      return {
        category: 'validation',
        code: 'PARSE_ERROR',
        shortMessage: 'Failed to parse model response',
        isRetryable: true,
        suggestedAction: 'Model produced an unexpected format. Retrying may succeed',
        originalError: error,
      };
    }

    return {
      category: 'server-error',
      statusCode: status,
      shortMessage: error.message?.slice(0, 100) || `AI error (${status || code})`,
      isRetryable: error.retryable,
      originalError: error,
    };
  }

  // 5. Generic Error Strings & Common Network Failures
  const msg = (error instanceof Error ? error.message : String(error)) || '';
  const lower = msg.toLowerCase();

  const statusCode = (error as any)?.statusCode ?? (error as any)?.status;

  if (
    statusCode === 401 ||
    lower.includes('401') ||
    lower.includes('unauthorized') ||
    lower.includes('user not found')
  ) {
    return {
      category: 'auth',
      statusCode: 401,
      shortMessage: '401 User not found / Invalid API key',
      isRetryable: false,
      suggestedAction: 'Please verify your API key in environment or run /model',
      originalError: error,
    };
  }

  if (
    statusCode === 429 ||
    lower.includes('429') ||
    lower.includes('rate limit') ||
    lower.includes('quota')
  ) {
    return {
      category: 'rate-limit',
      statusCode: 429,
      shortMessage: '429 Rate limit reached',
      isRetryable: true,
      retryAfterSec: 5,
      suggestedAction: 'Rate limit encountered. Retrying shortly',
      originalError: error,
    };
  }

  if (
    lower.includes('fetch failed') ||
    lower.includes('econnrefused') ||
    lower.includes('enotfound') ||
    lower.includes('connectionrefused') ||
    lower.includes('unable to connect') ||
    lower.includes('cannot connect to api') ||
    lower.includes('timeout')
  ) {
    return {
      category: 'network',
      shortMessage: 'Unable to connect to model API server',
      isRetryable: true,
      retryAfterSec: 4,
      suggestedAction:
        'Verify network connection, local model server (e.g. Ollama/vLLM), or endpoint URL',
      originalError: error,
    };
  }

  if (
    (error as any)?.name === 'AI_NoOutputGeneratedError' ||
    lower.includes('no output generated')
  ) {
    return {
      category: 'server-error',
      shortMessage: 'Model generated empty output',
      isRetryable: true,
      retryAfterSec: 3,
      suggestedAction:
        'The provider closed the stream without content. Retrying or switching models may help',
      originalError: error,
    };
  }

  return {
    category: 'unknown',
    shortMessage: msg.length > 100 ? `${msg.slice(0, 97)}…` : msg || 'Unexpected execution error',
    isRetryable: false,
    suggestedAction: 'If issue persists, run /clear or check ~/.steward/logs',
    originalError: error,
  };
}
