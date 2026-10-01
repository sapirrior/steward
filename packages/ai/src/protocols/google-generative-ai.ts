/**
 * @steward/ai - Google Generative AI Wire Protocol Adapter
 *
 * Implements raw-fetch wire protocol for Google Gemini API
 * (:streamGenerateContent?alt=sse). Supports:
 * - x-goog-api-key direct auth and Bearer token auth
 * - Gemini thinkingConfig & thought parts streaming (thought: true)
 * - thoughtSignature / textSignature tracking
 * - Function declarations (clean schema without $schema/$id/additionalProperties)
 * - Token usage extraction via usageMetadata
 */

import { decodeSSE } from '../util/sse.js';
import { sanitizeSurrogates } from '../util/sanitize.js';
import { withRetry, type HttpError } from '../util/retry.js';
import { clampThinkingEffort } from '../models/thinking.js';
import { transformMessages } from '../transform/messages.js';
import { readErrorBody } from '../util/error-body.js';
import { AIError, classifyHttpError } from '../errors.js';
import type {
  AssistantContent,
  FinishReason,
  InferenceRequest,
  Model,
  TokenUsage,
  ToolCallContent,
} from '../types.js';
import type { ResolvedAuth } from '../auth.js';
import type { AssistantMessageStream } from '../event-stream.js';

const DISALLOWED_SCHEMA_KEYS = new Set([
  '$schema',
  '$id',
  '$ref',
  '$defs',
  'definitions',
  '$comment',
  'additionalProperties',
  'title',
  'default',
]);

function cleanGeminiSchema(schema: unknown): unknown {
  if (typeof schema !== 'object' || schema === null || Array.isArray(schema)) {
    return schema;
  }
  const res: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(schema)) {
    if (DISALLOWED_SCHEMA_KEYS.has(k)) continue;
    if (k === 'type' && typeof v === 'string') {
      res[k] = v.toUpperCase();
    } else {
      res[k] = cleanGeminiSchema(v);
    }
  }
  return res;
}

export async function googleGenerativeAIProtocol(
  model: Model,
  request: InferenceRequest,
  auth: ResolvedAuth,
  fetchFn: typeof fetch,
  stream: AssistantMessageStream,
): Promise<void> {
  const transformed = transformMessages(request.messages, model);

  // 1. Convert messages into Gemini contents & system instruction
  let systemText = '';
  const contents: unknown[] = [];

  for (const msg of transformed) {
    if (msg.role === 'system') {
      const sanitized = sanitizeSurrogates(msg.content);
      systemText = systemText ? `${systemText}\n\n${sanitized}` : sanitized;
      continue;
    }

    if (msg.role === 'user') {
      if (typeof msg.content === 'string') {
        contents.push({ role: 'user', parts: [{ text: sanitizeSurrogates(msg.content) }] });
      } else {
        const parts: unknown[] = [];
        for (const b of msg.content) {
          if (b.type === 'text') {
            parts.push({ text: sanitizeSurrogates(b.text) });
          }
        }
        contents.push({ role: 'user', parts });
      }
      continue;
    }

    if (msg.role === 'assistant') {
      const parts: unknown[] = [];
      for (const block of msg.content) {
        if (block.type === 'text') {
          if (!block.text && !block.textSignature) continue;
          parts.push({
            text: sanitizeSurrogates(block.text || ''),
            ...(block.textSignature ? { thoughtSignature: block.textSignature } : {}),
          });
        } else if (block.type === 'thinking') {
          if (!block.thinking && !block.thinkingSignature) continue;
          parts.push({
            thought: true,
            text: sanitizeSurrogates(block.thinking || ''),
            ...(block.thinkingSignature ? { thoughtSignature: block.thinkingSignature } : {}),
          });
        } else if (block.type === 'tool-call') {
          parts.push({
            functionCall: {
              name: block.name,
              args: block.arguments,
              ...(block.id ? { id: block.id } : {}),
            },
            ...(block.thoughtSignature ? { thoughtSignature: block.thoughtSignature } : {}),
          });
        }
      }
      if (parts.length > 0) {
        contents.push({ role: 'model', parts });
      }
      continue;
    }

    if (msg.role === 'tool') {
      const parts: unknown[] = [];
      for (const res of msg.content) {
        const outStr = typeof res.output === 'string' ? res.output : JSON.stringify(res.output);
        parts.push({
          functionResponse: {
            name: res.toolName,
            response: { result: sanitizeSurrogates(outStr) },
            ...(res.toolCallId ? { id: res.toolCallId } : {}),
          },
        });
      }
      contents.push({ role: 'user', parts });
    }
  }

  // 2. Tools
  const tools =
    request.tools && request.tools.length > 0
      ? [
          {
            functionDeclarations: request.tools.map((t) => ({
              name: t.name,
              description: t.description,
              parameters: cleanGeminiSchema(t.inputSchema),
            })),
          },
        ]
      : undefined;

  // 3. Thinking config
  const requestedEffort = request.effort ?? ('effort' in request.model ? request.model.effort : undefined);
  const effort = clampThinkingEffort(model, requestedEffort);
  const generationConfig: Record<string, unknown> = {};

  if (request.temperature !== undefined && effort === 'none') {
    generationConfig.temperature = request.temperature;
  }

  if (model.reasoning && effort !== 'none') {
    const mapped = model.thinkingLevelMap?.[effort];
    if (typeof mapped === 'string') {
      generationConfig.thinkingConfig = { thinkingLevel: mapped };
    } else if (typeof mapped === 'number') {
      generationConfig.thinkingConfig = { thinkingBudget: mapped };
    } else {
      let budget = 8192;
      if (effort === 'low') budget = 2048;
      else if (effort === 'high') budget = 24576;
      else if (effort === 'xhigh') budget = 32768;
      generationConfig.thinkingConfig = { thinkingBudget: budget };
    }
  }

  // 4. Request body
  const body: Record<string, unknown> = {
    contents,
    generationConfig,
    ...(systemText ? { systemInstruction: { parts: [{ text: systemText }] } } : {}),
    ...(tools ? { tools } : {}),
  };

  // 5. Build URL & headers
  const modelId = model.id.replace(/^models\//, '');
  const baseUrl = auth.baseUrl || model.baseUrl || 'https://generativelanguage.googleapis.com';
  const url = `${baseUrl.replace(/\/+$/, '')}/v1beta/models/${modelId}:streamGenerateContent?alt=sse`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'text/event-stream',
    ...(auth.headers ?? {}),
    ...(model.headers ?? {}),
    ...(request.headers ?? {}),
  };

  if (auth.apiKey) {
    if (auth.scheme === 'bearer') {
      headers['Authorization'] = `Bearer ${auth.apiKey}`;
    } else {
      headers['x-goog-api-key'] = auth.apiKey;
    }
  }

  // 6. Execute request with retry
  let response: Response;
  try {
    response = await withRetry(async () => {
      const res = await fetchFn(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: request.abortSignal,
      });

      if (!res.ok) {
        const errorText = await readErrorBody(res).catch(() => undefined);
        const error = new Error(`HTTP ${res.status}${errorText ? `: ${errorText}` : ''}`) as HttpError;
        error.status = res.status;
        error.headers = res.headers;
        (error as unknown as { detail?: string }).detail = errorText;
        throw error;
      }
      return res;
    }, { signal: request.abortSignal });
  } catch (err) {
    const isAbort = request.abortSignal?.aborted;
    if (isAbort) {
      stream.push({
        type: 'error',
        error: new AIError('Inference request aborted.', {
          code: 'aborted',
          provider: model.provider,
          cause: err,
        }),
      });
      return;
    }

    const httpErr = err as HttpError & { detail?: string };
    if (httpErr.status) {
      stream.push({
        type: 'error',
        error: classifyHttpError(httpErr.status, httpErr.detail, model.provider, err),
      });
      return;
    }

    stream.push({
      type: 'error',
      error: err instanceof AIError
        ? err
        : new AIError(`Google request failed: ${err instanceof Error ? err.message : String(err)}`, {
            code: 'network',
            provider: model.provider,
            cause: err,
          }),
    });
    return;
  }

  if (!response.body) {
    stream.push({
      type: 'error',
      error: new AIError('Google returned an empty response body.', {
        code: 'provider',
        provider: model.provider,
      }),
    });
    return;
  }

  // 7. Stream SSE events
  const assistantContent: AssistantContent[] = [];
  const usage: TokenUsage = { input: 0, output: 0 };
  let finishReason: FinishReason = 'stop';
  let toolCallIdx = 0;

  try {
    for await (const sse of decodeSSE(response.body, request.abortSignal)) {
      if (!sse.data) continue;
      let eventData: Record<string, unknown>;
      try {
        eventData = JSON.parse(sse.data) as Record<string, unknown>;
      } catch {
        continue;
      }

      if (eventData.usageMetadata && typeof eventData.usageMetadata === 'object') {
        const u = eventData.usageMetadata as Record<string, unknown>;
        if (typeof u.promptTokenCount === 'number') usage.input = u.promptTokenCount;
        if (typeof u.candidatesTokenCount === 'number') usage.output = u.candidatesTokenCount;
        if (typeof u.totalTokenCount === 'number') {
          usage.total = u.totalTokenCount;
        } else {
          usage.total = (usage.input ?? 0) + (usage.output ?? 0);
        }
      }

      const candidates = eventData.candidates as unknown[];
      const candidate = candidates?.[0] as Record<string, unknown> | undefined;
      if (candidate) {
        if (typeof candidate.finishReason === 'string') {
          const fr = candidate.finishReason;
          if (fr === 'STOP') finishReason = 'stop';
          else if (fr === 'MAX_TOKENS') finishReason = 'length';
          else if (fr === 'SAFETY') finishReason = 'error';
        }

        const content = candidate.content as Record<string, unknown> | undefined;
        if (Array.isArray(content?.parts)) {
          for (const rawPart of content.parts) {
            const part = rawPart as Record<string, unknown>;
            const thoughtSig = typeof part.thoughtSignature === 'string' ? part.thoughtSignature : undefined;

            if (part.thought) {
              const thoughtDelta = typeof part.text === 'string' ? part.text : '';
              if (thoughtDelta || thoughtSig) {
                const lastBlock = assistantContent[assistantContent.length - 1];
                if (lastBlock && lastBlock.type === 'thinking') {
                  lastBlock.thinking += thoughtDelta;
                  if (thoughtSig) lastBlock.thinkingSignature = thoughtSig;
                } else {
                  assistantContent.push({
                    type: 'thinking',
                    thinking: thoughtDelta,
                    ...(thoughtSig ? { thinkingSignature: thoughtSig } : {}),
                  });
                }
                if (thoughtDelta) stream.push({ type: 'reasoning-delta', delta: thoughtDelta });
              }
            } else if (part.text !== undefined) {
              const textDelta = typeof part.text === 'string' ? part.text : '';
              if (textDelta || thoughtSig) {
                const lastBlock = assistantContent[assistantContent.length - 1];
                if (lastBlock && lastBlock.type === 'text') {
                  lastBlock.text += textDelta;
                  if (thoughtSig) lastBlock.textSignature = thoughtSig;
                } else {
                  assistantContent.push({
                    type: 'text',
                    text: textDelta,
                    ...(thoughtSig ? { textSignature: thoughtSig } : {}),
                  });
                }
                if (textDelta) stream.push({ type: 'text-delta', delta: textDelta });
              }
            } else if (part.functionCall && typeof part.functionCall === 'object') {
              const fc = part.functionCall as Record<string, unknown>;
              toolCallIdx++;
              const toolId =
                (typeof fc.id === 'string' && fc.id) ||
                (typeof fc.callId === 'string' && fc.callId) ||
                `call_${toolCallIdx}`;
              const fnName = typeof fc.name === 'string' ? fc.name : '';
              const fnArgs = (typeof fc.args === 'object' && fc.args !== null ? fc.args : {}) as Record<string, unknown>;
              const toolCall: ToolCallContent = {
                type: 'tool-call',
                id: toolId,
                name: fnName,
                arguments: fnArgs,
                ...(thoughtSig ? { thoughtSignature: thoughtSig } : {}),
              };
              assistantContent.push(toolCall);
              finishReason = 'tool-use';

              stream.push({ type: 'tool-call-start', id: toolId, name: toolCall.name });
              stream.push({ type: 'tool-call-delta', id: toolId, delta: JSON.stringify(toolCall.arguments) });
              stream.push({ type: 'tool-call-end', toolCall });
            }
          }
        }
      }
    }

    const finalMessage = {
      role: 'assistant' as const,
      content: assistantContent,
      meta: {
        provider: model.provider,
        protocol: model.protocol,
        modelId: model.id,
        usage,
        finishReason,
      },
    };

    stream.push({
      type: 'done',
      message: finalMessage,
      usage,
      finishReason,
    });
  } catch (err) {
    stream.push({
      type: 'error',
      error: new AIError(String(err), { code: 'provider', provider: model.provider, cause: err }),
    });
  }
}
