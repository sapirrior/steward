/**
 * @steward/ai - OpenAI Compatible Adapter (OpenRouter, DeepSeek, Custom)
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
  ProviderId,
  ReasoningEffort,
  TokenUsage,
  ToolCallContent,
} from '../types.js';
import type { ResolvedAuth } from '../auth/types.js';
import { AIError } from '../errors.js';

export interface OpenAICompatibleProfile {
  provider: ProviderId;
  baseUrl: string;
  supportsReasoning: boolean;
  reasoningFormat: 'openrouter' | 'deepseek' | 'openai' | 'none';
  apiPath: string;
  requiresApiKey: boolean;
}

export interface OpenAICompatibleStreamOptions {
  request: InferenceRequest;
  auth?: ResolvedAuth;
  profile?: OpenAICompatibleProfile;
  customBaseUrl?: string;
}

function getProfile(provider: ProviderId, customBaseUrl?: string): OpenAICompatibleProfile {
  switch (provider) {
    case 'openrouter':
      return {
        provider: 'openrouter',
        baseUrl: 'https://openrouter.ai/api/v1',
        supportsReasoning: true,
        reasoningFormat: 'openrouter',
        apiPath: '/chat/completions',
        requiresApiKey: true,
      };
    case 'deepseek':
      return {
        provider: 'deepseek',
        baseUrl: 'https://api.deepseek.com',
        supportsReasoning: true,
        reasoningFormat: 'deepseek',
        apiPath: '/chat/completions',
        requiresApiKey: true,
      };
    case 'github-copilot':
      return {
        provider: 'github-copilot',
        baseUrl: 'https://api.individual.githubcopilot.com',
        supportsReasoning: true,
        reasoningFormat: 'openai',
        apiPath: '/chat/completions',
        requiresApiKey: true,
      };
    case 'groq':
      return {
        provider: 'groq',
        baseUrl: 'https://api.groq.com/openai/v1',
        supportsReasoning: true,
        reasoningFormat: 'deepseek',
        apiPath: '/chat/completions',
        requiresApiKey: true,
      };
    case 'xai':
      return {
        provider: 'xai',
        baseUrl: 'https://api.x.ai/v1',
        supportsReasoning: true,
        reasoningFormat: 'openai',
        apiPath: '/chat/completions',
        requiresApiKey: true,
      };
    case 'mistral':
      return {
        provider: 'mistral',
        baseUrl: 'https://api.mistral.ai/v1',
        supportsReasoning: false,
        reasoningFormat: 'none',
        apiPath: '/chat/completions',
        requiresApiKey: true,
      };
    case 'ollama':
      return {
        provider: 'ollama',
        baseUrl: customBaseUrl || process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1',
        supportsReasoning: true,
        reasoningFormat: 'deepseek',
        apiPath: '/chat/completions',
        requiresApiKey: false,
      };
    case 'custom':
    default:
      return {
        provider: 'custom',
        baseUrl: customBaseUrl || process.env.CUSTOM_API_URL || 'http://localhost:11434/v1',
        supportsReasoning: true,
        reasoningFormat: 'openai',
        apiPath: '/chat/completions',
        requiresApiKey: false,
      };
  }
}

function mapEffort(effort: ReasoningEffort, format: string): Record<string, any> {
  if (effort === 'none') return {};
  if (format === 'openrouter') {
    return {
      reasoning: {
        effort,
      },
    };
  }
  if (format === 'openai' || format === 'deepseek') {
    return {
      reasoning_effort: effort,
    };
  }
  return {};
}

function convertMessages(messages: readonly Message[]): any[] {
  const converted: any[] = [];

  for (const msg of messages) {
    if (msg.role === 'system') {
      converted.push({ role: 'system', content: msg.content });
      continue;
    }

    if (msg.role === 'user') {
      const text =
        typeof msg.content === 'string' ? msg.content : msg.content.map((c) => c.text).join('\n');
      converted.push({ role: 'user', content: text });
      continue;
    }

    if (msg.role === 'assistant') {
      let text = '';
      let reasoning_content: string | undefined;
      const tool_calls: any[] = [];

      for (const block of msg.content) {
        if (block.type === 'text') {
          text += block.text;
        } else if (block.type === 'thinking') {
          reasoning_content = (reasoning_content || '') + block.thinking;
        } else if (block.type === 'tool-call') {
          tool_calls.push({
            id: block.id,
            type: 'function',
            function: {
              name: block.name,
              arguments: JSON.stringify(block.arguments),
            },
          });
        }
      }

      const item: any = { role: 'assistant' };
      if (text) item.content = text;
      if (reasoning_content) item.reasoning_content = reasoning_content;
      if (tool_calls.length > 0) item.tool_calls = tool_calls;
      converted.push(item);
      continue;
    }

    if (msg.role === 'tool') {
      for (const res of msg.content) {
        converted.push({
          role: 'tool',
          tool_call_id: res.toolCallId,
          content: typeof res.output === 'string' ? res.output : JSON.stringify(res.output),
        });
      }
    }
  }

  return converted;
}

export function streamOpenAICompatible(options: OpenAICompatibleStreamOptions): InferenceStream {
  const { request, auth, customBaseUrl } = options;
  const profile = options.profile ?? getProfile(request.model.provider, customBaseUrl);
  const effortExtra = mapEffort(request.model.effort, profile.reasoningFormat);

  const messages = convertMessages(request.messages);

  const tools =
    request.tools && request.tools.length > 0
      ? request.tools.map((t) => ({
          type: 'function',
          function: {
            name: t.name,
            description: t.description,
            parameters: t.inputSchema,
          },
        }))
      : undefined;

  const body: Record<string, any> = {
    model: request.model.modelId,
    messages,
    stream: true,
    stream_options: { include_usage: true },
    ...effortExtra,
  };

  if (tools) {
    body.tools = tools;
  }
  if (request.temperature !== undefined) {
    body.temperature = request.temperature;
  }

  const baseUrl = (auth?.extra?.baseUrl as string) || profile.baseUrl;
  const endpoint = `${baseUrl.replace(/\/+$/, '')}${profile.apiPath}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'text/event-stream',
    ...(auth?.headers || {}),
  };

  if (auth?.token && auth.token !== 'none') {
    headers['Authorization'] = `Bearer ${auth.token}`;
  }

  let finalResult:
    { message: AssistantMessage; usage: TokenUsage; finishReason: FinishReason } | undefined;
  let errorResult: Error | undefined;

  async function* eventGenerator(): AsyncGenerator<InferenceEvent, void, unknown> {
    let response: Response;
    try {
      response = await fetch(endpoint, {
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
          : `Network request to ${profile.provider} failed: ${err.message}`,
        {
          code: isAbort ? 'aborted' : 'network',
          provider: request.model.provider,
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
      const error = new AIError(`${profile.provider} error (HTTP ${response.status}): ${errBody}`, {
        code: isAuth
          ? auth?.type === 'oauth'
            ? 'oauth'
            : 'auth'
          : isRateLimit
            ? 'rate-limit'
            : 'provider',
        provider: request.model.provider,
        status: response.status,
      });
      errorResult = error;
      yield { type: 'error', error };
      return;
    }

    if (!response.body) {
      const error = new AIError(`${profile.provider} returned an empty response body.`, {
        code: 'provider',
        provider: request.model.provider,
      });
      errorResult = error;
      yield { type: 'error', error };
      return;
    }

    let textContent = '';
    let reasoningContent = '';
    const toolCallBuffers = new Map<number, { id: string; name: string; rawArgs: string }>();
    const usage: TokenUsage = {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
    };
    let finishReason: FinishReason = 'stop';

    try {
      for await (const sse of decodeSSE(response.body, request.abortSignal)) {
        if (!sse.data || sse.data === '[DONE]') continue;
        let eventData: any;
        try {
          eventData = JSON.parse(sse.data);
        } catch {
          continue;
        }

        if (eventData.usage) {
          const u = eventData.usage;
          usage.inputTokens = u.prompt_tokens ?? usage.inputTokens;
          usage.outputTokens = u.completion_tokens ?? usage.outputTokens;
          usage.totalTokens = u.total_tokens ?? usage.totalTokens;
          if (u.completion_tokens_details?.reasoning_tokens) {
            usage.reasoningTokens = u.completion_tokens_details.reasoning_tokens;
          }
        }

        const choice = eventData.choices?.[0];
        if (!choice) continue;

        if (choice.finish_reason) {
          const fr = choice.finish_reason;
          if (fr === 'stop') finishReason = 'stop';
          else if (fr === 'length') finishReason = 'length';
          else if (fr === 'tool_calls' || fr === 'function_call') finishReason = 'tool-use';
        }

        const delta = choice.delta;
        if (!delta) continue;

        // Reasoning deltas: reasoning_content, reasoning, reasoning_text, etc.
        const reasoningDelta =
          delta.reasoning_content ||
          delta.reasoning ||
          delta.reasoning_text ||
          delta.reasoning_details?.text;
        if (reasoningDelta) {
          reasoningContent += reasoningDelta;
          yield { type: 'reasoning-delta', delta: reasoningDelta };
        }

        // Text delta
        if (delta.content) {
          textContent += delta.content;
          yield { type: 'text-delta', delta: delta.content };
        }

        // Tool calls
        if (delta.tool_calls && Array.isArray(delta.tool_calls)) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index ?? 0;
            let buffer = toolCallBuffers.get(idx);
            if (!buffer) {
              buffer = {
                id: tc.id || `call_${Date.now()}_${idx}`,
                name: tc.function?.name || '',
                rawArgs: '',
              };
              toolCallBuffers.set(idx, buffer);
              if (buffer.name) {
                yield { type: 'tool-call-start', id: buffer.id, name: buffer.name };
              }
            } else {
              if (!buffer.name && tc.function?.name) {
                buffer.name = tc.function.name;
                yield { type: 'tool-call-start', id: buffer.id, name: buffer.name };
              }
            }

            if (tc.function?.arguments) {
              buffer.rawArgs += tc.function.arguments;
              yield {
                type: 'tool-call-delta',
                id: buffer.id,
                delta: tc.function.arguments,
              };
            }
          }
        }
      }

      const assistantContent: AssistantMessage['content'] = [];
      if (reasoningContent) {
        (assistantContent as any).push({
          type: 'thinking',
          thinking: reasoningContent,
        });
      }
      if (textContent) {
        (assistantContent as any).push({
          type: 'text',
          text: textContent,
        });
      }

      for (const [_, buffer] of toolCallBuffers.entries()) {
        const parsedArgs = parseStreamingJson(buffer.rawArgs);
        const toolCall: ToolCallContent = {
          type: 'tool-call',
          id: buffer.id,
          name: buffer.name,
          arguments: parsedArgs,
        };
        (assistantContent as any).push(toolCall);
        finishReason = 'tool-use';
        yield { type: 'tool-call-end', toolCall };
      }

      usage.totalTokens = usage.totalTokens || usage.inputTokens + usage.outputTokens;

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
        isAbort
          ? 'Inference request aborted.'
          : `${profile.provider} stream reading failed: ${err.message}`,
        {
          code: isAbort ? 'aborted' : 'provider',
          provider: request.model.provider,
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
