import { describe, it, expect } from 'bun:test';
import { createAI } from '../src/client.ts';
import {
  createFauxProvider,
  FAUX_PROVIDER_ID,
  FAUX_MODEL_ID,
  FAUX_MODEL,
} from '../src/testing/faux.ts';
import { AIError } from '../src/errors.ts';
import type { InferenceEvent } from '../src/types.ts';

function makeAI(steps: Parameters<typeof createFauxProvider>[0] = []) {
  return createAI({
    providers: [createFauxProvider(steps)],
    models: [FAUX_MODEL],
  });
}

function fauxRequest(extra: Partial<Parameters<ReturnType<typeof makeAI>['stream']>[0]> = {}) {
  return {
    model: { provider: FAUX_PROVIDER_ID, modelId: FAUX_MODEL_ID, effort: 'none' as const },
    messages: [],
    ...extra,
  };
}

async function collectEvents(
  stream: ReturnType<ReturnType<typeof makeAI>['stream']>,
): Promise<InferenceEvent[]> {
  const events: InferenceEvent[] = [];
  for await (const e of stream) events.push(e);
  return events;
}

// ─── §4.4 Stream contract ──────────────────────────────────────────────────────

describe('client-contract — §4.4 stream contract', () => {
  it('stream() returns synchronously and never throws', () => {
    const ai = makeAI();
    // Must not throw, must return synchronously
    let stream: ReturnType<typeof ai.stream> | undefined;
    expect(() => {
      stream = ai.stream(fauxRequest());
    }).not.toThrow();
    expect(stream).toBeDefined();
  });

  it('unknown provider → single terminal error event (never throws)', async () => {
    const ai = makeAI();
    const stream = ai.stream({
      model: { provider: 'does-not-exist', modelId: 'x', effort: 'none' },
      messages: [],
    });
    const events = await collectEvents(stream);
    const terminals = events.filter((e) => e.type === 'done' || e.type === 'error');
    expect(terminals).toHaveLength(1);
    expect(terminals[0].type).toBe('error');
  });

  it('result() never rejects on unknown provider', async () => {
    const ai = makeAI();
    const stream = ai.stream({
      model: { provider: 'does-not-exist', modelId: 'x', effort: 'none' },
      messages: [],
    });
    const result = await stream.result(); // must resolve, not reject
    expect(result.finishReason).toBe('error');
    expect(result.error).toBeInstanceOf(AIError);
  });

  it('normal text stream → done event with finishReason stop', async () => {
    const ai = makeAI([{ type: 'text', text: 'Hello!' }]);
    const events = await collectEvents(ai.stream(fauxRequest()));
    const done = events.find((e) => e.type === 'done');
    expect(done).toBeDefined();
    expect((done as { finishReason: string }).finishReason).toBe('stop');
  });

  it('exactly one terminal event on success', async () => {
    const ai = makeAI([{ type: 'text', text: 'hi' }]);
    const events = await collectEvents(ai.stream(fauxRequest()));
    const terminals = events.filter((e) => e.type === 'done' || e.type === 'error');
    expect(terminals).toHaveLength(1);
  });

  it('exactly one terminal event on error', async () => {
    const ai = makeAI([{ type: 'error', message: 'bang' }]);
    const events = await collectEvents(ai.stream(fauxRequest()));
    const terminals = events.filter((e) => e.type === 'done' || e.type === 'error');
    expect(terminals).toHaveLength(1);
    expect(terminals[0].type).toBe('error');
  });

  it('result() never rejects on scripted error', async () => {
    const ai = makeAI([{ type: 'error', message: 'bang' }]);
    const result = await ai.stream(fauxRequest()).result();
    expect(result.finishReason).toBe('error');
    expect(result.error?.message).toBe('bang');
  });

  it('abort before first byte → finishReason aborted, result() resolves', async () => {
    const controller = new AbortController();
    controller.abort(); // abort immediately

    const ai = makeAI([
      { type: 'delay', ms: 500 },
      { type: 'text', text: 'never' },
    ]);
    const stream = ai.stream(fauxRequest({ abortSignal: controller.signal }));
    const result = await stream.result();
    expect(result.finishReason).toBe('aborted');
  });

  it('abort mid-stream → finishReason aborted, partial content preserved', async () => {
    const controller = new AbortController();
    const ai = makeAI([
      { type: 'text', text: 'partial' },
      { type: 'delay', ms: 300 },
      { type: 'text', text: 'never' },
    ]);
    const stream = ai.stream(fauxRequest({ abortSignal: controller.signal }));

    // Collect first event then abort
    for await (const event of stream) {
      if (event.type === 'text-delta') {
        controller.abort();
        break;
      }
    }

    const result = await stream.result();
    expect(result.finishReason).toBe('aborted');
    // Partial text preserved
    const textBlock = result.message.content.find((b) => b.type === 'text');
    expect(textBlock).toBeDefined();
  });

  it('unknown model id uses synthetic fallback — still streams', async () => {
    const ai = makeAI([{ type: 'text', text: 'fallback works' }]);
    const stream = ai.stream({
      model: { provider: FAUX_PROVIDER_ID, modelId: 'unknown-future-model', effort: 'none' },
      messages: [],
    });
    const result = await stream.result();
    expect(result.finishReason).toBe('stop');
  });

  it('missing credentials → error event (not throw)', async () => {
    // No provider registered → unknown provider → error event
    const ai = createAI({ providers: [] });
    const stream = ai.stream(fauxRequest());
    const result = await stream.result();
    expect(result.finishReason).toBe('error');
    expect(result.error).toBeInstanceOf(AIError);
  });

  it('events arrive in push order (text → done)', async () => {
    const ai = makeAI([{ type: 'text', text: 'abc' }]);
    const events = await collectEvents(ai.stream(fauxRequest()));
    const types = events.map((e) => e.type);
    expect(types).toEqual(['text-delta', 'done']);
  });

  it('thinking → text → done order preserved', async () => {
    const ai = makeAI([
      { type: 'thinking', text: 'hmm' },
      { type: 'text', text: 'answer' },
    ]);
    const events = await collectEvents(ai.stream(fauxRequest()));
    const types = events.map((e) => e.type);
    expect(types).toEqual(['reasoning-delta', 'text-delta', 'done']);
  });
});

// ─── Registry ─────────────────────────────────────────────────────────────────

describe('client-contract — provider registry', () => {
  it('registerProvider adds and replaces by id', () => {
    const ai = makeAI();
    expect(ai.providers()).toHaveLength(1);
    ai.registerProvider({ ...createFauxProvider([]), id: 'faux2', name: 'Faux 2' } as ReturnType<
      typeof createFauxProvider
    >);
    expect(ai.providers()).toHaveLength(2);
    // Upsert — re-register same id
    ai.registerProvider(createFauxProvider([]));
    expect(ai.providers()).toHaveLength(2);
  });

  it('unregisterProvider removes it', () => {
    const ai = makeAI();
    ai.unregisterProvider(FAUX_PROVIDER_ID);
    expect(ai.providers()).toHaveLength(0);
  });

  it('models() returns models from registered providers', () => {
    const ai = makeAI();
    expect(ai.models().length).toBeGreaterThan(0);
    expect(ai.models(FAUX_PROVIDER_ID)).toHaveLength(1);
    expect(ai.models('nonexistent')).toHaveLength(0);
  });

  it('model() looks up a specific model', () => {
    const ai = makeAI();
    const m = ai.model(FAUX_PROVIDER_ID, FAUX_MODEL_ID);
    expect(m).toBeDefined();
    expect(m?.id).toBe(FAUX_MODEL_ID);
  });
});
