/**
 * @steward/ai — Transformer: Stream Pump
 *
 * Consumes AI SDK streamText result.fullStream and translates events into Steward InferenceEvents,
 * pushing them into AssistantMessageStream.
 */

import type { LanguageModelUsage, streamText } from 'ai';
import type { AssistantMessageStream } from '../event-stream.js';
import type { AssistantMeta, InferenceRequest, Model, TokenUsage } from '../types.js';
import type { NamespaceConfig } from './config.js';
import { normalizeError } from './errors.js';
import { MessageBuilder } from './message-builder.js';
import { normalizeFinishReason, normalizeUsage } from './usage.js';

export async function pumpSdkStream(
  streamResult: ReturnType<typeof streamText>,
  stream: AssistantMessageStream,
  model: Model,
  request: InferenceRequest,
  config: NamespaceConfig,
): Promise<void> {
  const builder = new MessageBuilder();
  let latestUsage: TokenUsage = {};
  let finishReasonFromStream: string | undefined = undefined;
  let hasToolCalls = false;

  const meta: AssistantMeta = {
    modelId: model.id,
    provider: model.provider,
    protocol: model.protocol,
  };

  try {
    for await (const part of streamResult.fullStream) {
      if (part.type === 'text-delta') {
        builder.appendText(part.text);
        stream.push({ type: 'text-delta', delta: part.text });
      } else if (part.type === 'reasoning-delta') {
        const signature =
          config.metadataToLegacy.thinkingSignature && part.providerMetadata
            ? (part.providerMetadata[config.metadataToLegacy.thinkingSignature] as unknown as string | undefined)
            : undefined;
        builder.appendReasoning(part.text, signature);
        stream.push({ type: 'reasoning-delta', delta: part.text });
      } else if (part.type === 'tool-input-start') {
        hasToolCalls = true;
        builder.startTool(part.id, part.toolName);
        stream.push({ type: 'tool-call-start', id: part.id, name: part.toolName });
      } else if (part.type === 'tool-input-delta') {
        builder.appendToolDelta(part.id, part.delta);
        stream.push({ type: 'tool-call-delta', id: part.id, delta: part.delta });
      } else if (part.type === 'tool-call') {
        hasToolCalls = true;
        const normalizedId = config.toolCallId.normalize(part.toolCallId);
        const toolCallObj: import('../types.js').ToolCallContent = {
          type: 'tool-call',
          id: normalizedId,
          name: part.toolName,
          arguments: ((part.input ?? {}) as Record<string, unknown>) as import('../types.js').JsonObject,
        };
        builder.endTool(toolCallObj);
        stream.push({ type: 'tool-call-end', toolCall: toolCallObj });
      } else if (part.type === 'finish-step') {
        finishReasonFromStream = part.finishReason;
        if (part.usage) {
          latestUsage = normalizeUsage(part.usage, config);
        }
      } else if (part.type === 'finish') {
        if (part.finishReason && !finishReasonFromStream) {
          finishReasonFromStream = part.finishReason;
        }
        if (part.totalUsage && Object.keys(latestUsage).length === 0) {
          latestUsage = normalizeUsage(part.totalUsage, config);
        }
      } else if (part.type === 'error') {
        const aiError = normalizeError(part.error, model.provider);
        const partialMessage = builder.build(meta);
        stream.push({
          type: 'error',
          error: aiError,
          partial: partialMessage,
        });
        return;
      }
    }

    // Try awaiting usage if not captured in chunks
    try {
      const sdkUsage = await streamResult.usage;
      if (sdkUsage) {
        latestUsage = normalizeUsage(sdkUsage, config);
      }
    } catch {
      // Ignore errors reading total usage
    }

    const { finishReason, errorMessage } = normalizeFinishReason(
      finishReasonFromStream,
      config,
      hasToolCalls,
    );

    meta.usage = latestUsage;
    const finalMessage = builder.build(meta);

    if (finishReason === 'error') {
      stream.push({
        type: 'error',
        error: normalizeError(new Error(errorMessage ?? 'Generation failed'), model.provider),
        partial: finalMessage,
      });
    } else {
      stream.push({
        type: 'done',
        message: finalMessage,
        usage: latestUsage,
        finishReason,
      });
    }
  } catch (err) {
    const aiError = normalizeError(err, model.provider);
    const partialMessage = builder.build(meta);
    stream.push({
      type: 'error',
      error: aiError,
      partial: partialMessage,
    });
  }
}
