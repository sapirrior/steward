/**
 * @steward/ai - Google Gemini Provider Adapter
 */

import { decodeSSE } from '../stream.js';
import type {
  AssistantMessage,
  FinishReason,
  InferenceEvent,
  InferenceRequest,
  InferenceStream,
  Message,
  ReasoningEffort,
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
      return { thinkingBudget: 0 };
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
  contents: any[];
} {
  let systemText = '';
  const contents: any[] = [];

  for (const msg of messages) {
    if (msg.role === 'system') {
      systemText = systemText ? `${systemText}\n\n${msg.content}` : msg.content;
      continue;
    }

    if (msg.role === 'user') {
      const text =
        typeof msg.content === 'string' ? msg.content : msg.content.map((c) => c.text).join('\n');
      contents.push({
        role: 'user',
        parts: [{ text }],
      });
      continue;
    }

    if (msg.role === 'assistant') {
      const parts: any[] = [];
      for (const block of msg.content) {
        if (block.type === 'text') {
          if (!block.text && !block.thoughtSignature) continue;
          parts.push({
            text: block.text || '',
            ...(block.thoughtSignature ? { thoughtSignature: block.thoughtSignature } : {}),
          });
        } else if (block.type === 'thinking') {
          if (!block.thinking && !block.thoughtSignature) continue;
          parts.push({
            thought: true,
            text: block.thinking || '',
            ...(block.thoughtSignature ? { thoughtSignature: block.thoughtSignature } : {}),
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
      const parts: any[] = [];
      for (const res of msg.content) {
        parts.push({
          functionResponse: {
            name: res.toolName,
            response: {
              result: res.output,
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

  const generationConfig: Record<string, any> = {};
  if (request.temperature !== undefined) {
    generationConfig.temperature = request.temperature;
  }
  if (effortConfig?.thinkingBudget !== undefined) {
    generationConfig.thinkingConfig = {
      thinkingBudget: effortConfig.thinkingBudget,
    };
  }

  const body: Record<string, any> = {
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
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:streamGenerateContent?alt=sse&key=${auth.token}`;

  let finalResult:
    { message: AssistantMessage; usage: TokenUsage; finishReason: FinishReason } | undefined;
  let errorResult: Error | undefined;

  async function* eventGenerator(): AsyncGenerator<InferenceEvent, void, unknown> {
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        body: JSON.stringify(body),
        signal: request.abortSignal,
      });
    } catch (err: any) {
      const isAbort = request.abortSignal?.aborted;
      const error = new AIError(
        isAbort ? 'Inference request aborted.' : `Network request to Gemini failed: ${err.message}`,
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
      const errBody = await response.text().catch(() => '');
      const isRateLimit = response.status === 429;
      const isAuth = response.status === 401 || response.status === 403;
      const error = new AIError(`Gemini error (HTTP ${response.status}): ${errBody}`, {
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

    const assistantContent: AssistantMessage['content'] = [];
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
        let eventData: any;
        try {
          eventData = JSON.parse(sse.data);
        } catch {
          continue;
        }

        if (eventData.usageMetadata) {
          const u = eventData.usageMetadata;
          usage.inputTokens = u.promptTokenCount ?? usage.inputTokens;
          usage.outputTokens = u.candidatesTokenCount ?? usage.outputTokens;
          usage.totalTokens = u.totalTokenCount ?? usage.totalTokens;
        }

        const candidate = eventData.candidates?.[0];
        if (candidate) {
          if (candidate.finishReason) {
            const fr = candidate.finishReason;
            if (fr === 'STOP') finishReason = 'stop';
            else if (fr === 'MAX_TOKENS') finishReason = 'length';
            else if (fr === 'SAFETY') finishReason = 'error';
          }

          if (candidate.content?.parts) {
            for (const part of candidate.content.parts) {
              if (part.thought) {
                const thoughtDelta = part.text || '';
                if (thoughtDelta || part.thoughtSignature) {
                  const existing = assistantContent.find(
                    (c): c is Extract<(typeof assistantContent)[0], { type: 'thinking' }> =>
                      c.type === 'thinking',
                  );
                  if (existing) {
                    existing.thinking += thoughtDelta;
                    if (part.thoughtSignature) existing.thoughtSignature = part.thoughtSignature;
                  } else {
                    (assistantContent as any).push({
                      type: 'thinking',
                      thinking: thoughtDelta,
                      thoughtSignature: part.thoughtSignature,
                    });
                  }
                  if (thoughtDelta) {
                    yield { type: 'reasoning-delta', delta: thoughtDelta };
                  }
                }
              } else if (part.text !== undefined) {
                const textDelta = part.text || '';
                if (textDelta || part.thoughtSignature) {
                  const existing = assistantContent.find(
                    (c): c is Extract<(typeof assistantContent)[0], { type: 'text' }> =>
                      c.type === 'text',
                  );
                  if (existing) {
                    existing.text += textDelta;
                    if (part.thoughtSignature) existing.thoughtSignature = part.thoughtSignature;
                  } else {
                    (assistantContent as any).push({
                      type: 'text',
                      text: textDelta,
                      thoughtSignature: part.thoughtSignature,
                    });
                  }
                  if (textDelta) {
                    yield { type: 'text-delta', delta: textDelta };
                  }
                }
              } else if (part.functionCall) {
                toolCallIdx++;
                const toolId = `call_${Date.now()}_${toolCallIdx}`;
                const toolCall: ToolCallContent = {
                  type: 'tool-call',
                  id: toolId,
                  name: part.functionCall.name,
                  arguments: part.functionCall.args || {},
                  thoughtSignature: part.thoughtSignature,
                };
                (assistantContent as any).push(toolCall);
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
    } catch (err: any) {
      const isAbort = request.abortSignal?.aborted;
      const error = new AIError(
        isAbort ? 'Inference request aborted.' : `Gemini stream reading failed: ${err.message}`,
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
