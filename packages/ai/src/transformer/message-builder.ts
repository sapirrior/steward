/**
 * @steward/ai — Transformer: Message Builder
 *
 * Incrementally accumulates stream parts into a final AssistantMessage.
 * Fixes D-A (capturing signatures) & D-B (attaching meta).
 */

import type {
  AssistantContent,
  AssistantMessage,
  AssistantMeta,
  JsonObject,
  TextContent,
  ThinkingContent,
  ToolCallContent,
} from '../types.js';

export class MessageBuilder {
  private textMap = new Map<number, string>();
  private thinkingMap = new Map<number, { text: string; signature?: string; redacted?: boolean }>();
  private toolMap = new Map<
    string,
    { id: string; name: string; args: string; thoughtSig?: string; parsedArgs?: JsonObject }
  >();
  private order: Array<
    { kind: 'text' | 'thinking'; index: number } | { kind: 'tool'; id: string }
  > = [];

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

  appendReasoning(delta: string, signature?: string, index = 0): void {
    this.ensureThinking(index);
    const t = this.thinkingMap.get(index)!;
    t.text += delta;
    if (signature) {
      t.signature = signature;
    }
  }

  setReasoningSignature(signature: string, index = 0): void {
    this.ensureThinking(index);
    const t = this.thinkingMap.get(index)!;
    t.signature = signature;
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

  build(meta?: AssistantMeta): AssistantMessage {
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

    return {
      role: 'assistant',
      content: blocks,
      meta,
    };
  }
}
