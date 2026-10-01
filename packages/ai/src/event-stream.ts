/**
 * @steward/ai - Inference Event Stream
 *
 * FIFO-queue-backed AsyncIterable<InferenceEvent> with a result() promise
 * that NEVER rejects. All failures are terminal `error` events.
 *
 * Contract (§4.4):
 * 1. push() and end() are called by protocol adapters.
 * 2. Exactly one terminal event (done | error). Nothing emitted after it.
 * 3. result() resolves with InferenceResult in all cases (stop, error, abort).
 * 4. Partial content accumulated before error/abort is preserved in result().
 * 5. Cost is computed on done before yielding; overflow conditions are detected.
 */

import { AIError } from './errors.js';
import { calculateCost } from './util/cost.js';
import { isContextOverflow } from './util/overflow.js';
import type {
  AssistantContent,
  AssistantMessage,
  AssistantMeta,
  FinishReason,
  InferenceEvent,
  InferenceResult,
  InferenceStream,
  Model,
  TextContent,
  ThinkingContent,
  TokenUsage,
  ToolCallContent,
} from './types.js';

class FifoQueue<T> {
  private incoming: T[] = [];
  private outgoing: T[] = [];

  get length(): number {
    return this.incoming.length + this.outgoing.length;
  }

  enqueue(value: T): void {
    this.incoming.push(value);
  }

  dequeue(): T | undefined {
    if (this.outgoing.length === 0) {
      while (this.incoming.length > 0) {
        this.outgoing.push(this.incoming.pop()!);
      }
    }
    return this.outgoing.pop();
  }
}

/**
 * Mutable builder that accumulates streaming events into a final AssistantMessage.
 */
class ContentAccumulator {
  private textMap = new Map<number, string>(); // index → accumulated text
  private thinkingMap = new Map<number, { text: string; signature?: string; redacted?: boolean }>();
  private toolMap = new Map<string, { id: string; name: string; args: string; thoughtSig?: string; parsedArgs?: JsonObject }>();
  private order: Array<{ kind: 'text' | 'thinking'; index: number } | { kind: 'tool'; id: string }> = [];

  private ensureText(index: number) {
    if (!this.textMap.has(index)) {
      this.textMap.set(index, '');
      this.order.push({ kind: 'text', index });
    }
  }

  private ensureThinking(index: number) {
    if (!this.thinkingMap.has(index)) {
      this.thinkingMap.set(index, { text: '' });
      this.order.push({ kind: 'thinking', index });
    }
  }

  appendText(delta: string, index = 0): void {
    this.ensureText(index);
    this.textMap.set(index, (this.textMap.get(index) ?? '') + delta);
  }

  appendReasoning(delta: string, index = 0): void {
    this.ensureThinking(index);
    const t = this.thinkingMap.get(index)!;
    t.text += delta;
  }

  startTool(id: string, name: string): void {
    const existing = this.toolMap.get(id);
    if (existing) {
      if (name && !existing.name) existing.name = name;
      return;
    }
    this.toolMap.set(id, { id, name, args: '' });
    this.order.push({ kind: 'tool', id });
  }

  appendToolDelta(id: string, delta: string): void {
    let t = this.toolMap.get(id);
    if (!t) {
      this.startTool(id, '');
      t = this.toolMap.get(id)!;
    }
    t.args += delta;
  }

  endTool(toolCall: ToolCallContent): void {
    const existing = this.toolMap.get(toolCall.id);
    if (existing) {
      if (toolCall.name) existing.name = toolCall.name;
      existing.parsedArgs = toolCall.arguments;
      if (toolCall.thoughtSignature) existing.thoughtSig = toolCall.thoughtSignature;
    } else {
      this.toolMap.set(toolCall.id, {
        id: toolCall.id,
        name: toolCall.name,
        args: JSON.stringify(toolCall.arguments),
        thoughtSig: toolCall.thoughtSignature,
        parsedArgs: toolCall.arguments,
      });
      this.order.push({ kind: 'tool', id: toolCall.id });
    }
  }

  build(): readonly AssistantContent[] {
    const blocks: AssistantContent[] = [];
    const seen = new Set<string>();

    for (const item of this.order) {
      if (item.kind === 'text') {
        const key = `text:${item.index}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const text = this.textMap.get(item.index) ?? '';
        if (text) blocks.push({ type: 'text', text } satisfies TextContent);
      } else if (item.kind === 'thinking') {
        const key = `thinking:${item.index}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const t = this.thinkingMap.get(item.index)!;
        if (t.text || t.redacted) {
          blocks.push({
            type: 'thinking',
            thinking: t.text,
            thinkingSignature: t.signature,
            redacted: t.redacted,
          } satisfies ThinkingContent);
        }
      } else if (item.kind === 'tool') {
        const key = `tool:${item.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const t = this.toolMap.get(item.id)!;
        let args: JsonObject = t.parsedArgs ?? {};
        if (!t.parsedArgs) {
          try {
            args = JSON.parse(t.args || '{}') as JsonObject;
          } catch {
            /* partial JSON handled gracefully */
          }
        }
        blocks.push({
          type: 'tool-call',
          id: t.id,
          name: t.name,
          arguments: args,
          thoughtSignature: t.thoughtSig,
        } satisfies ToolCallContent);
      }
    }

    return blocks;
  }
}

export interface AssistantMessageStreamOptions {
  model?: Model;
}

export class AssistantMessageStream implements InferenceStream {
  private queue = new FifoQueue<InferenceEvent>();
  private waiters = new FifoQueue<(r: IteratorResult<InferenceEvent>) => void>();
  private terminated = false;
  private readonly model?: Model;

  private resultResolve!: (r: InferenceResult) => void;
  private readonly resultPromise: Promise<InferenceResult>;

  private acc = new ContentAccumulator();
  private usage: TokenUsage = {};
  private meta: AssistantMeta | undefined;

  constructor(options: AssistantMessageStreamOptions = {}) {
    this.model = options.model;
    this.resultPromise = new Promise((resolve) => {
      this.resultResolve = resolve;
    });
  }

  // ── Called by protocol adapters ──────────────────────────────────────────

  push(event: InferenceEvent): void {
    if (this.terminated) return;

    // Accumulate content for result()
    if (event.type === 'text-delta') {
      this.acc.appendText(event.delta);
    } else if (event.type === 'reasoning-delta') {
      this.acc.appendReasoning(event.delta);
    } else if (event.type === 'tool-call-start') {
      this.acc.startTool(event.id, event.name);
    } else if (event.type === 'tool-call-delta') {
      this.acc.appendToolDelta(event.id, event.delta);
    } else if (event.type === 'tool-call-end') {
      this.acc.endTool(event.toolCall);
    } else if (event.type === 'done') {
      if (event.usage.total === undefined) {
        event.usage.total = (event.usage.input ?? 0) + (event.usage.output ?? 0);
      }
      // Calculate USD cost
      if (this.model) {
        event.usage.cost = calculateCost(this.model, event.usage);
      }
      this.usage = event.usage;
      if (event.message.meta) {
        event.message.meta.usage = event.usage;
      }
      this.meta = event.message.meta;

      let finishReason = event.finishReason;
      let overflowError: AIError | undefined = undefined;

      const provisionalResult: InferenceResult = {
        message: event.message,
        usage: this.usage,
        finishReason,
      };

      if (this.model && isContextOverflow(provisionalResult, this.model.contextWindow)) {
        finishReason = 'error';
        overflowError = new AIError('Context overflow: context length limit exceeded.', {
          code: 'context-overflow',
          provider: this.model.provider,
        });
      }

      this.terminated = true;
      this.deliver(event);
      this.resolveResult(finishReason, overflowError);
      return;
    } else if (event.type === 'error') {
      this.terminated = true;
      this.deliver(event);
      this.resolveResult('error', event.error, event.partial);
      return;
    }

    this.deliver(event);
  }

  end(): void {
    if (this.terminated) return;
    this.terminated = true;
    this.resolveResult('aborted', undefined);
    this.drainWaiters();
  }

  // ── AsyncIterable ────────────────────────────────────────────────────────

  async *[Symbol.asyncIterator](): AsyncGenerator<InferenceEvent> {
    while (true) {
      if (this.queue.length > 0) {
        yield this.queue.dequeue()!;
      } else if (this.terminated) {
        return;
      } else {
        const item = await new Promise<IteratorResult<InferenceEvent>>((resolve) =>
          this.waiters.enqueue(resolve),
        );
        if (item.done) return;
        yield item.value;
      }
    }
  }

  result(): Promise<InferenceResult> {
    return this.resultPromise;
  }

  // ── Internals ────────────────────────────────────────────────────────────

  private deliver(event: InferenceEvent): void {
    const waiter = this.waiters.dequeue();
    if (waiter) {
      waiter({ value: event, done: false });
    } else {
      this.queue.enqueue(event);
    }
  }

  private drainWaiters(): void {
    while (this.waiters.length > 0) {
      this.waiters.dequeue()!({ value: undefined as never, done: true });
    }
  }

  private resolveResult(
    finishReason: FinishReason,
    error: AIError | undefined,
    partial?: AssistantMessage,
  ): void {
    const content = partial?.content ?? this.acc.build();
    const message: AssistantMessage = {
      role: 'assistant',
      content,
      meta: this.meta,
    };
    this.resultResolve({ message, usage: this.usage, finishReason, error });
    this.drainWaiters();
  }
}
