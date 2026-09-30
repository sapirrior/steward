/**
 * @steward/ai/testing — Faux provider for offline contract tests
 *
 * Usage:
 *   const faux = createFauxProvider([
 *     { type: 'text', text: 'Hello world' },
 *     { type: 'error', message: 'Something went wrong' },
 *   ]);
 *   const ai = createAI({ credentials: new InMemoryCredentialStore(), providers: [faux] });
 *   const stream = ai.stream({ model: { provider: 'faux', modelId: 'faux-1', effort: 'none' }, messages: [] });
 */

import { AssistantMessageStream } from '../event-stream.js';
import { AIError } from '../errors.js';
import type { InMemoryCredentialStore } from '../auth/memory-store.js';
import type { Provider, ProtocolStream } from '../client.js';
import type { InferenceRequest, Model } from '../types.js';
import type { ResolvedAuth } from '../auth/types.js';

export const FAUX_PROVIDER_ID = 'faux' as const;
export const FAUX_MODEL_ID = 'faux-1' as const;

// ─── Script step types ────────────────────────────────────────────────────────

export type FauxStep =
  | { type: 'text'; text: string }
  | { type: 'thinking'; text: string; signature?: string }
  | { type: 'tool-call'; id: string; name: string; args: Record<string, unknown> }
  | { type: 'error'; message: string; code?: import('../errors.js').AIErrorCode }
  | { type: 'delay'; ms: number }
  | { type: 'done'; finishReason?: import('../types.js').FinishReason };

// ─── Faux protocol stream ─────────────────────────────────────────────────────

function runScript(
  steps: readonly FauxStep[],
  request: InferenceRequest,
  stream: AssistantMessageStream,
): Promise<void> {
  return (async () => {
    try {
      for (const step of steps) {
        if (request.abortSignal?.aborted) {
          stream.end();
          return;
        }

        if (step.type === 'delay') {
          await new Promise<void>((resolve, reject) => {
            const t = setTimeout(resolve, step.ms);
            request.abortSignal?.addEventListener('abort', () => {
              clearTimeout(t);
              reject(new Error('aborted'));
            }, { once: true });
          });

        } else if (step.type === 'text') {
          stream.push({ type: 'text-delta', delta: step.text });

        } else if (step.type === 'thinking') {
          stream.push({ type: 'reasoning-delta', delta: step.text });

        } else if (step.type === 'tool-call') {
          stream.push({ type: 'tool-call-start', id: step.id, name: step.name });
          stream.push({ type: 'tool-call-delta', id: step.id, delta: JSON.stringify(step.args) });
          stream.push({
            type: 'tool-call-end',
            toolCall: { type: 'tool-call', id: step.id, name: step.name, arguments: step.args },
          });

        } else if (step.type === 'error') {
          stream.push({
            type: 'error',
            error: new AIError(step.message, { code: step.code ?? 'provider', provider: FAUX_PROVIDER_ID }),
          });
          return;

        } else if (step.type === 'done') {
          break;
        }
      }

      if (request.abortSignal?.aborted) {
        stream.end();
        return;
      }

      stream.push({
        type: 'done',
        message: { role: 'assistant', content: [] },
        usage: { input: 10, output: 20 },
        finishReason: 'stop',
      });
    } catch (err) {
      if ((err as Error)?.message === 'aborted' || request.abortSignal?.aborted) {
        stream.end();
      } else {
        stream.push({
          type: 'error',
          error: new AIError(String(err), { code: 'provider', provider: FAUX_PROVIDER_ID }),
        });
      }
    }
  })();
}

// ─── Faux model ───────────────────────────────────────────────────────────────

const FAUX_MODEL: Model = {
  id: FAUX_MODEL_ID,
  name: 'Faux Model',
  provider: FAUX_PROVIDER_ID,
  protocol: 'openai-completions',
  baseUrl: 'http://localhost:0',
  reasoning: true,
  maxOutputTokens: 4096,
  default: true,
};

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Creates a faux provider that plays back the given script steps for every
 * stream request. For sequential different responses, pass a steps factory.
 */
export function createFauxProvider(
  steps: readonly FauxStep[] | (() => readonly FauxStep[]),
): Provider {
  const getSteps = typeof steps === 'function' ? steps : () => steps;

  const fauxStream: ProtocolStream = (
    _model: Model,
    request: InferenceRequest,
    _auth: ResolvedAuth,
    _fetch: typeof fetch,
    stream: AssistantMessageStream,
  ) => runScript(getSteps(), request, stream);

  return {
    id: FAUX_PROVIDER_ID,
    name: 'Faux Provider',
    auth: {
      apiKey: {
        envVars: [],
        resolve: () => ({ source: 'faux', apiKey: 'faux-key' }),
      },
    },
    models: () => [FAUX_MODEL],
    streams: {
      'openai-completions': fauxStream,
    },
  };
}

/** Convenience: a no-op InMemoryCredentialStore for use in tests. */
export { InMemoryCredentialStore } from '../auth/memory-store.js';
