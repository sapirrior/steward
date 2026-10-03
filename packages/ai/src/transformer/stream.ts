/**
 * @steward/ai — Transformer: Stream Pump
 *
 * Consumes AI SDK streamText.fullStream and pushes Steward InferenceEvents.
 *
 * The SDK handles all provider-specific wire details (signatures, encrypted content,
 * finish reason normalization, tool call IDs) natively. We just translate the schema.
 */

import type { streamText } from 'ai';
import type { AssistantMessageStream } from '../event-stream.js';
import type { AssistantMeta, InferenceRequest, Model, TokenUsage } from '../types.js';
import { normalizeError } from './errors.js';
import { MessageBuilder } from './message-builder.js';
import { normalizeFinishReason, normalizeUsage } from './usage.js';

export async function pumpSdkStream(
  streamResult: ReturnType<typeof streamText>,
  stream: AssistantMessageStream,
  model: Model,
  _request: InferenceRequest,
): Promise<void> {
  const builder = new MessageBuilder();
  let latestUsage: TokenUsage = {};
  let sdkFinishReason: string | undefined;
  let hasToolCalls = false;

  const meta: AssistantMeta = {
    modelId: model.id,
    provider: model.provider,
    protocol: model.protocol,
  };

  try {
    for await (const part of streamResult.fullStream) {
      switch (part.type) {
        case 'text-delta':
          builder.appendText(part.text);
          stream.push({ type: 'text-delta', delta: part.text });
          break;

        case 'reasoning-delta':
          // Signature/encrypted-content replay: the SDK round-trips providerMetadata
          // back as providerOptions automatically — nothing to extract here.
          builder.appendReasoning(part.text);
          stream.push({ type: 'reasoning-delta', delta: part.text });
          break;

        case 'tool-input-start':
          hasToolCalls = true;
          builder.startTool(part.id, part.toolName);
          stream.push({ type: 'tool-call-start', id: part.id, name: part.toolName });
          break;

        case 'tool-input-delta':
          builder.appendToolDelta(part.id, part.delta);
          stream.push({ type: 'tool-call-delta', id: part.id, delta: part.delta });
          break;

        case 'tool-call': {
          hasToolCalls = true;
          const toolCallObj: import('../types.js').ToolCallContent = {
            type: 'tool-call',
            id: part.toolCallId,
            name: part.toolName,
            arguments: (part.input ?? {}) as import('../types.js').JsonObject,
          };
          builder.endTool(toolCallObj);
          stream.push({ type: 'tool-call-end', toolCall: toolCallObj });
          break;
        }

        case 'finish-step':
          sdkFinishReason = part.finishReason;
          if (part.usage) latestUsage = normalizeUsage(part.usage);
          break;

        case 'finish':
          if (!sdkFinishReason) sdkFinishReason = part.finishReason;
          if (Object.keys(latestUsage).length === 0 && part.totalUsage) {
            latestUsage = normalizeUsage(part.totalUsage);
          }
          break;

        case 'error': {
          const aiError = normalizeError(part.error, model.provider);
          stream.push({ type: 'error', error: aiError, partial: builder.build(meta) });
          return;
        }
      }
    }

    // Fallback: read usage from the promise if not captured in stream chunks
    try {
      const u = await streamResult.usage;
      if (u && Object.keys(latestUsage).length === 0) latestUsage = normalizeUsage(u);
    } catch { /* ignore */ }

    const finishReason = normalizeFinishReason(sdkFinishReason, hasToolCalls);
    meta.usage = latestUsage;
    const finalMessage = builder.build(meta);

    if (finishReason === 'error') {
      stream.push({
        type: 'error',
        error: normalizeError(new Error('Generation failed'), model.provider),
        partial: finalMessage,
      });
    } else {
      stream.push({ type: 'done', message: finalMessage, usage: latestUsage, finishReason });
    }
  } catch (err) {
    stream.push({
      type: 'error',
      error: normalizeError(err, model.provider),
      partial: builder.build(meta),
    });
  }
}
