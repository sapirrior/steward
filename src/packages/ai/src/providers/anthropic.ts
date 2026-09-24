/**
 * @steward/ai - Anthropic Messages Provider Adapter
 */

import { decodeSSE } from '../stream.js';
import { parseStreamingJson } from '../json.js';
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

export interface AnthropicStreamOptions {
  request: InferenceRequest;
  auth: ResolvedAuth;
}

function mapAnthropicEffort(
  effort: ReasoningEffort,
): { type: 'enabled'; budget_tokens: number } | undefined {
  switch (effort) {
    case 'none':
      return undefined;
    case 'low':
      return { type: 'enabled', budget_tokens: 2048 };
    case 'medium':
      return { type: 'enabled', budget_tokens: 8192 };
    case 'high':
      return { type: 'enabled', budget_tokens: 24576 };
    default:
      return { type: 'enabled', budget_tokens: 8192 };
  }
}

function convertMessages(messages: readonly Message[]): {
  system?: string;
  anthropicMessages: any[];
} {
  let system: string | undefined;
  const anthropicMessages: any[] = [];

  for (const msg of messages) {
    if (msg.role === 'system') {
      system = system ? `${system}\n\n${msg.content}` : msg.content;
      continue;
    }

    if (msg.role === 'user') {
      if (typeof msg.content === 'string') {
        anthropicMessages.push({ role: 'user', content: msg.content });
      } else {
        const text = msg.content.map((c) => c.text).join('\n');
        anthropicMessages.push({ role: 'user', content: text });
      }
      continue;
    }

    if (msg.role === 'assistant') {
      const content: any[] = [];
      for (const block of msg.content) {
        if (block.type === 'text') {
          content.push({ type: 'text', text: block.text });
        } else if (block.type === 'thinking') {
          content.push({
            type: 'thinking',
            thinking: block.thinking,
            signature: block.thinkingSignature,
          });
        } else if (block.type === 'tool-call') {
          content.push({
            type: 'tool_use',
            id: block.id,
            name: block.name,
            input: block.arguments,
          });
        }
      }
      anthropicMessages.push({ role: 'assistant', content });
      continue;
    }

    if (msg.role === 'tool') {
      const content: any[] = [];
      for (const res of msg.content) {
        content.push({
          type: 'tool_result',
          tool_use_id: res.toolCallId,
          content: typeof res.output === 'string' ? res.output : JSON.stringify(res.output),
          is_error: res.isError,
        });
      }
      anthropicMessages.push({ role: 'user', content });
    }
  }

  return { system, anthropicMessages };
}

export function streamAnthropic(options: AnthropicStreamOptions): InferenceStream {
  const { request, auth } = options;
  const thinkingConfig = mapAnthropicEffort(request.model.effort);

  const { system, anthropicMessages } = convertMessages(request.messages);

  const tools = request.tools?.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.inputSchema,
  }));

  const body: Record<string, any> = {
    model: request.model.modelId,
    messages: anthropicMessages,
    max_tokens: thinkingConfig ? 32000 : 8192,
    stream: true,
  };

  if (system) {
    body.system = system;
  }
  if (tools && tools.length > 0) {
    body.tools = tools;
  }
  if (thinkingConfig) {
    body.thinking = thinkingConfig;
  }
  if (request.temperature !== undefined && !thinkingConfig) {
    body.temperature = request.temperature;
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'text/event-stream',
    'anthropic-version': '2023-06-01',
    ...auth.headers,
  };

  if (auth.type === 'api-key') {
    headers['x-api-key'] = auth.token;
  } else {
    headers['Authorization'] = `Bearer ${auth.token}`;
  }

  let finalResult:
    { message: AssistantMessage; usage: TokenUsage; finishReason: FinishReason } | undefined;
  let errorResult: Error | undefined;

  async function* eventGenerator(): AsyncGenerator<InferenceEvent, void, unknown> {
    let response: Response;
    try {
      response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: request.abortSignal,
      });
    } catch (err: any) {
      const isAbort = request.abortSignal?.aborted;
      const error = new AIError(
        isAbort
          ? 'Inference request aborted.'
          : `Network request to Anthropic failed: ${err.message}`,
        {
          code: isAbort ? 'aborted' : 'network',
          provider: 'anthropic',
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
      const error = new AIError(`Anthropic error (HTTP ${response.status}): ${errBody}`, {
        code: isAuth
          ? auth.type === 'oauth'
            ? 'oauth'
            : 'auth'
          : isRateLimit
            ? 'rate-limit'
            : 'provider',
        provider: 'anthropic',
        status: response.status,
      });
      errorResult = error;
      yield { type: 'error', error };
      return;
    }

    if (!response.body) {
      const error = new AIError('Anthropic returned an empty response body.', {
        code: 'provider',
        provider: 'anthropic',
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
    let hasMessageStop = false;

    // Track active content blocks by index
    let currentBlock:
      | { type: 'text'; text: string }
      | { type: 'thinking'; thinking: string; signature?: string }
      | { type: 'tool-call'; id: string; name: string; rawArgs: string }
      | null = null;

    try {
      for await (const sse of decodeSSE(response.body, request.abortSignal)) {
        if (!sse.data) continue;
        let eventData: any;
        try {
          eventData = JSON.parse(sse.data);
        } catch {
          continue;
        }

        const eventType = sse.event || eventData.type;

        switch (eventType) {
          case 'message_start': {
            if (eventData.message?.usage) {
              const u = eventData.message.usage;
              usage.inputTokens = u.input_tokens ?? 0;
              usage.cacheReadTokens = u.cache_read_input_tokens ?? 0;
              usage.cacheWriteTokens = u.cache_creation_input_tokens ?? 0;
            }
            break;
          }

          case 'content_block_start': {
            const block = eventData.content_block;
            if (block.type === 'text') {
              currentBlock = { type: 'text', text: block.text || '' };
              if (block.text) {
                yield { type: 'text-delta', delta: block.text };
              }
            } else if (block.type === 'thinking') {
              currentBlock = {
                type: 'thinking',
                thinking: block.thinking || '',
                signature: block.signature,
              };
              if (block.thinking) {
                yield { type: 'reasoning-delta', delta: block.thinking };
              }
            } else if (block.type === 'tool_use') {
              currentBlock = {
                type: 'tool-call',
                id: block.id,
                name: block.name,
                rawArgs: '',
              };
              yield { type: 'tool-call-start', id: block.id, name: block.name };
            }
            break;
          }

          case 'content_block_delta': {
            const delta = eventData.delta;
            if (!delta) break;

            if (delta.type === 'text_delta') {
              if (currentBlock && currentBlock.type === 'text') {
                currentBlock.text += delta.text;
              }
              yield { type: 'text-delta', delta: delta.text };
            } else if (delta.type === 'thinking_delta') {
              if (currentBlock && currentBlock.type === 'thinking') {
                currentBlock.thinking += delta.thinking;
              }
              yield { type: 'reasoning-delta', delta: delta.thinking };
            } else if (delta.type === 'signature_delta') {
              if (currentBlock && currentBlock.type === 'thinking') {
                currentBlock.signature = (currentBlock.signature || '') + delta.signature;
              }
            } else if (delta.type === 'input_json_delta') {
              if (currentBlock && currentBlock.type === 'tool-call') {
                currentBlock.rawArgs += delta.partial_json;
                yield {
                  type: 'tool-call-delta',
                  id: currentBlock.id,
                  delta: delta.partial_json,
                };
              }
            }
            break;
          }

          case 'content_block_stop': {
            if (currentBlock) {
              if (currentBlock.type === 'text') {
                (assistantContent as any).push({
                  type: 'text',
                  text: currentBlock.text,
                });
              } else if (currentBlock.type === 'thinking') {
                (assistantContent as any).push({
                  type: 'thinking',
                  thinking: currentBlock.thinking,
                  thinkingSignature: currentBlock.signature,
                });
              } else if (currentBlock.type === 'tool-call') {
                const parsedArgs = parseStreamingJson(currentBlock.rawArgs);
                const toolCall: ToolCallContent = {
                  type: 'tool-call',
                  id: currentBlock.id,
                  name: currentBlock.name,
                  arguments: parsedArgs,
                };
                (assistantContent as any).push(toolCall);
                yield { type: 'tool-call-end', toolCall };
              }
              currentBlock = null;
            }
            break;
          }

          case 'message_delta': {
            if (eventData.delta?.stop_reason) {
              const sr = eventData.delta.stop_reason;
              if (sr === 'end_turn' || sr === 'stop_sequence') finishReason = 'stop';
              else if (sr === 'max_tokens') finishReason = 'length';
              else if (sr === 'tool_use') finishReason = 'tool-use';
            }
            if (eventData.usage?.output_tokens) {
              usage.outputTokens = eventData.usage.output_tokens;
            }
            break;
          }

          case 'message_stop': {
            hasMessageStop = true;
            break;
          }

          case 'error': {
            const err = eventData.error;
            const error = new AIError(
              `Anthropic stream error: ${err?.message || JSON.stringify(err)}`,
              {
                code: 'provider',
                provider: 'anthropic',
              },
            );
            errorResult = error;
            yield { type: 'error', error };
            return;
          }
        }
      }

      if (!hasMessageStop) {
        const error = new AIError(
          'Anthropic stream terminated unexpectedly without message_stop.',
          {
            code: 'provider',
            provider: 'anthropic',
          },
        );
        errorResult = error;
        yield { type: 'error', error };
        return;
      }

      usage.totalTokens = usage.inputTokens + usage.outputTokens;

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
        isAbort ? 'Inference request aborted.' : `Stream reading failed: ${err.message}`,
        {
          code: isAbort ? 'aborted' : 'provider',
          provider: 'anthropic',
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
      // Consume the stream if not already consumed
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
