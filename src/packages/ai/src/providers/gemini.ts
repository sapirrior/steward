/**
 * @steward/ai - Google Gemini Provider Adapter
 */

import { decodeSSE } from '../stream.js';
import { sanitizeSurrogates } from '../json.js';
import type {
  AssistantContent,
  AssistantMessage,
  FinishReason,
  InferenceEvent,
  InferenceRequest,
  InferenceStream,
  Message,
  ReasoningEffort,
  TextContent,
  ThinkingContent,
  TokenUsage,
  ToolCallContent,
} from '../types.js';
import type { ResolvedAuth } from '../auth/types.js';
import { AIError } from '../errors.js';

export interface GeminiStreamOptions {
  request: InferenceRequest;
  auth: ResolvedAuth;
}

const JSON_SCHEMA_DISALLOWED_KEYS = new Set([
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

function sanitizeSchema(schema: unknown): unknown {
  if (typeof schema !== 'object' || schema === null || Array.isArray(schema)) {
    return schema;
  }
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(schema)) {
    if (JSON_SCHEMA_DISALLOWED_KEYS.has(key)) continue;
    if (key === 'type' && typeof value === 'string') {
      result[key] = value.toUpperCase();
    } else {
      result[key] = sanitizeSchema(value);
    }
  }
  return result;
}

function mapGeminiEffort(effort: ReasoningEffort): { thinkingBudget?: number } | undefined {
  switch (effort) {
    case 'none':
      return undefined;
    case 'low':
      return { thinkingBudget: 2048 };
    case 'medium':
      return { thinkingBudget: 8192 };
    case 'high':
      return { thinkingBudget: 24576 };
    default:
      return undefined;
  }
}

function convertMessages(messages: readonly Message[]): {
  systemInstruction?: { parts: Array<{ text: string }> };
  contents: unknown[];
} {
  let systemText = '';
  const contents: unknown[] = [];

  for (const msg of messages) {
    if (msg.role === 'system') {
      const sanitized = sanitizeSurrogates(msg.content);
      systemText = systemText ? `${systemText}\n\n${sanitized}` : sanitized;
      continue;
    }

    if (msg.role === 'user') {
      const text =
        typeof msg.content === 'string'
          ? sanitizeSurrogates(msg.content)
          : msg.content.map((c) => sanitizeSurrogates(c.text)).join('\n');
      contents.push({
        role: 'user',
        parts: [{ text }],
      });
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
            },
            ...(block.thoughtSignature ? { thoughtSignature: block.thoughtSignature } : {}),
          });
        }
      }
      if (parts.length > 0) {
        contents.push({
          role: 'model',
          parts,
        });
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
            response: {
              result: sanitizeSurrogates(outStr),
            },
          },
        });
      }
      contents.push({
        role: 'user',
        parts,
      });
    }
  }

  return {
    systemInstruction: systemText ? { parts: [{ text: systemText }] } : undefined,
    contents,
  };
}

export function streamGemini(options: GeminiStreamOptions): InferenceStream {
  const { request, auth } = options;
  const effortConfig = mapGeminiEffort(request.model.effort);
  const { systemInstruction, contents } = convertMessages(request.messages);

  const tools =
    request.tools && request.tools.length > 0
      ? [
          {
            functionDeclarations: request.tools.map((t) => ({
              name: t.name,
              description: t.description,
              parameters: sanitizeSchema(t.inputSchema),
            })),
          },
        ]
      : undefined;

  const generationConfig: Record<string, unknown> = {};
  if (request.temperature !== undefined) {
    generationConfig.temperature = request.temperature;
  }
  if (effortConfig?.thinkingBudget !== undefined) {
    generationConfig.thinkingConfig = {
      thinkingBudget: effortConfig.thinkingBudget,
    };
  }

  const body: Record<string, unknown> = {
    contents,
    generationConfig,
  };

  if (systemInstruction) {
    body.systemInstruction = systemInstruction;
  }
  if (tools) {
    body.tools = tools;
  }

  const modelId = request.model.modelId.replace(/^models\//, '');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:streamGenerateContent?alt=sse`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'text/event-stream',
    ...(auth.headers || {}),
  };

  if (auth.token && auth.token !== 'none') {
    headers['x-goog-api-key'] = auth.token;
  }

  let finalResult:
    { message: AssistantMessage; usage: TokenUsage; finishReason: FinishReason } | undefined;
  let errorResult: Error | undefined;

  async function* eventGenerator(): AsyncGenerator<InferenceEvent, void, unknown> {
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: request.abortSignal,
      });
    } catch (err: unknown) {
      const isAbort = request.abortSignal?.aborted;
      const error = new AIError(
        isAbort
          ? 'Inference request aborted.'
          : `Network request to Gemini failed: ${err instanceof Error ? err.message : String(err)}`,
        {
          code: isAbort ? 'aborted' : 'network',
          provider: 'gemini',
          cause: err,
        },
      );
      errorResult = error;
      yield { type: 'error', error };
      return;
    }

    if (!response.ok) {
      const isRateLimit = response.status === 429;
      const isAuth = response.status === 401 || response.status === 403;
      const error = new AIError(`Gemini request failed with HTTP status ${response.status}`, {
        code: isAuth ? 'auth' : isRateLimit ? 'rate-limit' : 'provider',
        provider: 'gemini',
        status: response.status,
      });
      errorResult = error;
      yield { type: 'error', error };
      return;
    }

    if (!response.body) {
      const error = new AIError('Gemini returned an empty response body.', {
        code: 'provider',
        provider: 'gemini',
      });
      errorResult = error;
      yield { type: 'error', error };
      return;
    }

    const assistantContent: AssistantContent[] = [];
    const usage: TokenUsage = {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
    };
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
          if (typeof u.promptTokenCount === 'number') usage.inputTokens = u.promptTokenCount;
          if (typeof u.candidatesTokenCount === 'number')
            usage.outputTokens = u.candidatesTokenCount;
          if (typeof u.totalTokenCount === 'number') usage.totalTokens = u.totalTokenCount;
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
              const thoughtSig =
                typeof part.thoughtSignature === 'string' ? part.thoughtSignature : undefined;

              if (part.thought) {
                const thoughtDelta = typeof part.text === 'string' ? part.text : '';
                if (thoughtDelta || thoughtSig) {
                  const lastBlock = assistantContent[assistantContent.length - 1];
                  if (lastBlock && lastBlock.type === 'thinking') {
                    (lastBlock as ThinkingContent).thinking += thoughtDelta;
                    if (thoughtSig) {
                      (lastBlock as ThinkingContent).thinkingSignature = thoughtSig;
                    }
                  } else {
                    assistantContent.push({
                      type: 'thinking',
                      thinking: thoughtDelta,
                      ...(thoughtSig ? { thinkingSignature: thoughtSig } : {}),
                    });
                  }
                  if (thoughtDelta) {
                    yield { type: 'reasoning-delta', delta: thoughtDelta };
                  }
                }
              } else if (part.text !== undefined) {
                const textDelta = typeof part.text === 'string' ? part.text : '';
                if (textDelta || thoughtSig) {
                  const lastBlock = assistantContent[assistantContent.length - 1];
                  if (lastBlock && lastBlock.type === 'text') {
                    (lastBlock as TextContent).text += textDelta;
                    if (thoughtSig) {
                      (lastBlock as TextContent).textSignature = thoughtSig;
                    }
                  } else {
                    assistantContent.push({
                      type: 'text',
                      text: textDelta,
                      ...(thoughtSig ? { textSignature: thoughtSig } : {}),
                    });
                  }
                  if (textDelta) {
                    yield { type: 'text-delta', delta: textDelta };
                  }
                }
              } else if (part.functionCall && typeof part.functionCall === 'object') {
                const fc = part.functionCall as Record<string, unknown>;
                toolCallIdx++;
                const toolId = `call_${toolCallIdx}`;
                const fnName = typeof fc.name === 'string' ? fc.name : '';
                const fnArgs = (
                  typeof fc.args === 'object' && fc.args !== null ? fc.args : {}
                ) as Record<string, unknown>;
                const toolCall: ToolCallContent = {
                  type: 'tool-call',
                  id: toolId,
                  name: fnName,
                  arguments: fnArgs,
                  ...(thoughtSig ? { thoughtSignature: thoughtSig } : {}),
                };
                assistantContent.push(toolCall);
                finishReason = 'tool-use';

                yield { type: 'tool-call-start', id: toolId, name: toolCall.name };
                yield {
                  type: 'tool-call-delta',
                  id: toolId,
                  delta: JSON.stringify(toolCall.arguments),
                };
                yield { type: 'tool-call-end', toolCall };
              }
            }
          }
        }
      }

      const finalMessage: AssistantMessage = {
        role: 'assistant',
        content: assistantContent,
      };

      finalResult = {
        message: finalMessage,
        usage,
        finishReason,
      };

      yield {
        type: 'done',
        message: finalMessage,
        usage,
        finishReason,
      };
    } catch (err: unknown) {
      const isAbort = request.abortSignal?.aborted;
      const error = new AIError(
        isAbort
          ? 'Inference request aborted.'
          : `Gemini stream reading failed: ${err instanceof Error ? err.message : String(err)}`,
        {
          code: isAbort ? 'aborted' : 'provider',
          provider: 'gemini',
          cause: err,
        },
      );
      errorResult = error;
      yield { type: 'error', error };
    }
  }

  const iterator = eventGenerator();

  return {
    [Symbol.asyncIterator]() {
      return iterator;
    },
    async result() {
      if (!finalResult && !errorResult) {
        for await (const _ of this) {
          // draining
        }
      }
      if (errorResult) throw errorResult;
      if (!finalResult)
        throw new AIError('Stream completed without a result', { code: 'provider' });
      return finalResult;
    },
  };
}
