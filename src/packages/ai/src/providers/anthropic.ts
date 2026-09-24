/**
 * @steward/ai - Anthropic Messages Provider Adapter
 */

import { decodeSSE } from '../stream.js';
import { parseStreamingJson, sanitizeSurrogates } from '../json.js';
import type {
  AssistantContent,
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
  anthropicMessages: unknown[];
} {
  let system: string | undefined;
  const anthropicMessages: unknown[] = [];

  for (const msg of messages) {
    if (msg.role === 'system') {
      system = system ? `${system}\n\n${msg.content}` : msg.content;
      continue;
    }

    if (msg.role === 'user') {
      if (typeof msg.content === 'string') {
        anthropicMessages.push({ role: 'user', content: sanitizeSurrogates(msg.content) });
      } else {
        const text = msg.content.map((c) => c.text).join('\n');
        anthropicMessages.push({ role: 'user', content: sanitizeSurrogates(text) });
      }
      continue;
    }

    if (msg.role === 'assistant') {
      const content: unknown[] = [];
      for (const block of msg.content) {
        if (block.type === 'text') {
          content.push({ type: 'text', text: sanitizeSurrogates(block.text) });
        } else if (block.type === 'thinking') {
          content.push({
            type: 'thinking',
            thinking: sanitizeSurrogates(block.thinking),
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
      const content: unknown[] = [];
      for (const res of msg.content) {
        const outStr = typeof res.output === 'string' ? res.output : JSON.stringify(res.output);
        content.push({
          type: 'tool_result',
          tool_use_id: res.toolCallId,
          content: sanitizeSurrogates(outStr),
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

  const tools = request.tools?.map((t, idx, arr) => ({
    name: t.name,
    description: t.description,
    input_schema: t.inputSchema,
    ...(idx === arr.length - 1 ? { cache_control: { type: 'ephemeral' } } : {}),
  }));

  const body: Record<string, unknown> = {
    model: request.model.modelId,
    messages: anthropicMessages,
    max_tokens: thinkingConfig ? 32000 : 8192,
    stream: true,
  };

  if (system) {
    body.system = [
      {
        type: 'text',
        text: sanitizeSurrogates(system),
        cache_control: { type: 'ephemeral' },
      },
    ];
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
    ...(auth.headers || {}),
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
    } catch (err: unknown) {
      const isAbort = request.abortSignal?.aborted;
      const error = new AIError(
        isAbort
          ? 'Inference request aborted.'
          : `Network request to Anthropic failed: ${err instanceof Error ? err.message : String(err)}`,
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
      const isRateLimit = response.status === 429;
      const isAuth = response.status === 401 || response.status === 403;
      const error = new AIError(`Anthropic request failed with HTTP status ${response.status}`, {
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

    const assistantContent: AssistantContent[] = [];
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
        let eventData: Record<string, unknown>;
        try {
          eventData = JSON.parse(sse.data) as Record<string, unknown>;
        } catch {
          continue;
        }

        const eventType =
          (typeof sse.event === 'string' && sse.event) ||
          (typeof eventData.type === 'string' && eventData.type) ||
          '';

        switch (eventType) {
          case 'message_start': {
            const msg = eventData.message as Record<string, unknown> | undefined;
            if (msg?.usage && typeof msg.usage === 'object') {
              const u = msg.usage as Record<string, unknown>;
              if (typeof u.input_tokens === 'number') usage.inputTokens = u.input_tokens;
              if (typeof u.cache_read_input_tokens === 'number')
                usage.cacheReadTokens = u.cache_read_input_tokens;
              if (typeof u.cache_creation_input_tokens === 'number')
                usage.cacheWriteTokens = u.cache_creation_input_tokens;
            }
            break;
          }

          case 'content_block_start': {
            const block = eventData.content_block as Record<string, unknown> | undefined;
            if (!block || typeof block !== 'object' || typeof block.type !== 'string') {
              const error = new AIError('Malformed Anthropic content_block_start event', {
                code: 'parse',
                provider: 'anthropic',
              });
              errorResult = error;
              yield { type: 'error', error };
              return;
            }

            if (block.type === 'text') {
              const blockText = typeof block.text === 'string' ? block.text : '';
              currentBlock = { type: 'text', text: blockText };
              if (blockText) {
                yield { type: 'text-delta', delta: blockText };
              }
            } else if (block.type === 'thinking') {
              const blockThinking = typeof block.thinking === 'string' ? block.thinking : '';
              const blockSig = typeof block.signature === 'string' ? block.signature : undefined;
              currentBlock = {
                type: 'thinking',
                thinking: blockThinking,
                signature: blockSig,
              };
              if (blockThinking) {
                yield { type: 'reasoning-delta', delta: blockThinking };
              }
            } else if (block.type === 'tool_use') {
              const blockId = typeof block.id === 'string' ? block.id : '';
              const blockName = typeof block.name === 'string' ? block.name : '';
              currentBlock = {
                type: 'tool-call',
                id: blockId,
                name: blockName,
                rawArgs: '',
              };
              yield { type: 'tool-call-start', id: blockId, name: blockName };
            }
            break;
          }

          case 'content_block_delta': {
            const delta = eventData.delta as Record<string, unknown> | undefined;
            if (!delta || typeof delta.type !== 'string') break;

            if (delta.type === 'text_delta') {
              const deltaText = typeof delta.text === 'string' ? delta.text : '';
              if (currentBlock && currentBlock.type === 'text') {
                currentBlock.text += deltaText;
              }
              yield { type: 'text-delta', delta: deltaText };
            } else if (delta.type === 'thinking_delta') {
              const deltaThinking = typeof delta.thinking === 'string' ? delta.thinking : '';
              if (currentBlock && currentBlock.type === 'thinking') {
                currentBlock.thinking += deltaThinking;
              }
              yield { type: 'reasoning-delta', delta: deltaThinking };
            } else if (delta.type === 'signature_delta') {
              const deltaSig = typeof delta.signature === 'string' ? delta.signature : '';
              if (currentBlock && currentBlock.type === 'thinking') {
                currentBlock.signature = (currentBlock.signature || '') + deltaSig;
              }
            } else if (delta.type === 'input_json_delta') {
              const partialJson = typeof delta.partial_json === 'string' ? delta.partial_json : '';
              if (currentBlock && currentBlock.type === 'tool-call') {
                currentBlock.rawArgs += partialJson;
                yield {
                  type: 'tool-call-delta',
                  id: currentBlock.id,
                  delta: partialJson,
                };
              }
            }
            break;
          }

          case 'content_block_stop': {
            if (currentBlock) {
              if (currentBlock.type === 'text') {
                assistantContent.push({
                  type: 'text',
                  text: currentBlock.text,
                });
              } else if (currentBlock.type === 'thinking') {
                assistantContent.push({
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
                assistantContent.push(toolCall);
                yield { type: 'tool-call-end', toolCall };
              }
              currentBlock = null;
            }
            break;
          }

          case 'message_delta': {
            const delta = eventData.delta as Record<string, unknown> | undefined;
            if (delta && typeof delta.stop_reason === 'string') {
              const sr = delta.stop_reason;
              if (sr === 'end_turn' || sr === 'stop_sequence') finishReason = 'stop';
              else if (sr === 'max_tokens') finishReason = 'length';
              else if (sr === 'tool_use') finishReason = 'tool-use';
            }
            const u = eventData.usage as Record<string, unknown> | undefined;
            if (typeof u?.output_tokens === 'number') {
              usage.outputTokens = u.output_tokens;
            }
            break;
          }

          case 'message_stop': {
            hasMessageStop = true;
            break;
          }

          case 'error': {
            const err = eventData.error as Record<string, unknown> | undefined;
            const errMsg =
              typeof err?.message === 'string' ? err.message : 'Unknown provider error';
            const error = new AIError(`Anthropic stream error: ${errMsg}`, {
              code: 'provider',
              provider: 'anthropic',
            });
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
    } catch (err: unknown) {
      const isAbort = request.abortSignal?.aborted;
      const error = new AIError(
        isAbort
          ? 'Inference request aborted.'
          : `Stream reading failed: ${err instanceof Error ? err.message : String(err)}`,
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
