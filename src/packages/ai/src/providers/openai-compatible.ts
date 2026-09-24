/**
 * @steward/ai - OpenAI Compatible Adapter (OpenRouter, DeepSeek, Custom)
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
  ProviderId,
  ReasoningEffort,
  ThinkingContent,
  TextContent,
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

const STATIC_PROFILES: Readonly<
  Record<
    'openrouter' | 'deepseek' | 'github-copilot' | 'groq' | 'xai' | 'mistral',
    OpenAICompatibleProfile
  >
> = {
  openrouter: {
    provider: 'openrouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    supportsReasoning: true,
    reasoningFormat: 'openrouter',
    apiPath: '/chat/completions',
    requiresApiKey: true,
  },
  deepseek: {
    provider: 'deepseek',
    baseUrl: 'https://api.deepseek.com',
    supportsReasoning: true,
    reasoningFormat: 'deepseek',
    apiPath: '/chat/completions',
    requiresApiKey: true,
  },
  'github-copilot': {
    provider: 'github-copilot',
    baseUrl: 'https://api.individual.githubcopilot.com',
    supportsReasoning: true,
    reasoningFormat: 'openai',
    apiPath: '/chat/completions',
    requiresApiKey: true,
  },
  groq: {
    provider: 'groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    supportsReasoning: true,
    reasoningFormat: 'deepseek',
    apiPath: '/chat/completions',
    requiresApiKey: true,
  },
  xai: {
    provider: 'xai',
    baseUrl: 'https://api.x.ai/v1',
    supportsReasoning: true,
    reasoningFormat: 'openai',
    apiPath: '/chat/completions',
    requiresApiKey: true,
  },
  mistral: {
    provider: 'mistral',
    baseUrl: 'https://api.mistral.ai/v1',
    supportsReasoning: false,
    reasoningFormat: 'none',
    apiPath: '/chat/completions',
    requiresApiKey: true,
  },
};

function getProfile(provider: ProviderId, customBaseUrl?: string): OpenAICompatibleProfile {
  if (provider in STATIC_PROFILES) {
    return STATIC_PROFILES[provider as keyof typeof STATIC_PROFILES];
  }

  if (provider === 'ollama') {
    return {
      provider: 'ollama',
      baseUrl: customBaseUrl || process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1',
      supportsReasoning: true,
      reasoningFormat: 'deepseek',
      apiPath: '/chat/completions',
      requiresApiKey: false,
    };
  }

  return {
    provider: 'custom',
    baseUrl: customBaseUrl || process.env.CUSTOM_API_URL || 'http://localhost:11434/v1',
    supportsReasoning: true,
    reasoningFormat: 'openai',
    apiPath: '/chat/completions',
    requiresApiKey: false,
  };
}

function mapEffort(effort: ReasoningEffort, format: string): Record<string, unknown> {
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

function convertMessages(messages: readonly Message[]): unknown[] {
  const converted: unknown[] = [];

  for (const msg of messages) {
    if (msg.role === 'system') {
      converted.push({ role: 'system', content: sanitizeSurrogates(msg.content) });
      continue;
    }

    if (msg.role === 'user') {
      const text =
        typeof msg.content === 'string' ? msg.content : msg.content.map((c) => c.text).join('\n');
      converted.push({ role: 'user', content: sanitizeSurrogates(text) });
      continue;
    }

    if (msg.role === 'assistant') {
      let text = '';
      let reasoning_content: string | undefined;
      const tool_calls: unknown[] = [];

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

      const item: Record<string, unknown> = { role: 'assistant' };
      if (text) item.content = sanitizeSurrogates(text);
      if (reasoning_content) item.reasoning_content = sanitizeSurrogates(reasoning_content);
      if (tool_calls.length > 0) item.tool_calls = tool_calls;
      converted.push(item);
      continue;
    }

    if (msg.role === 'tool') {
      for (const res of msg.content) {
        const outStr = typeof res.output === 'string' ? res.output : JSON.stringify(res.output);
        converted.push({
          role: 'tool',
          tool_call_id: res.toolCallId,
          content: sanitizeSurrogates(outStr),
        });
      }
    }
  }

  return converted;
}

interface ToolCallBufferEntry {
  buffer: { id: string; name: string; rawArgs: string };
  slot: ToolCallContent;
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

  const body: Record<string, unknown> = {
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
    } catch (err: unknown) {
      const isAbort = request.abortSignal?.aborted;
      const error = new AIError(
        isAbort
          ? 'Inference request aborted.'
          : `Network request to ${profile.provider} failed: ${err instanceof Error ? err.message : String(err)}`,
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
      const isRateLimit = response.status === 429;
      const isAuth = response.status === 401 || response.status === 403;
      const error = new AIError(
        `${profile.provider} request failed with HTTP status ${response.status}`,
        {
          code: isAuth
            ? auth?.type === 'oauth'
              ? 'oauth'
              : 'auth'
            : isRateLimit
              ? 'rate-limit'
              : 'provider',
          provider: request.model.provider,
          status: response.status,
        },
      );
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

    const assistantContent: AssistantContent[] = [];
    const toolCallBuffers = new Map<number, ToolCallBufferEntry>();
    const usage: TokenUsage = {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
    };
    let finishReason: FinishReason = 'stop';

    try {
      for await (const sse of decodeSSE(response.body, request.abortSignal)) {
        if (!sse.data || sse.data === '[DONE]') continue;
        let eventData: Record<string, unknown>;
        try {
          eventData = JSON.parse(sse.data) as Record<string, unknown>;
        } catch {
          continue;
        }

        if (eventData.usage && typeof eventData.usage === 'object') {
          const u = eventData.usage as Record<string, unknown>;
          if (typeof u.prompt_tokens === 'number') usage.inputTokens = u.prompt_tokens;
          if (typeof u.completion_tokens === 'number') usage.outputTokens = u.completion_tokens;
          if (typeof u.total_tokens === 'number') usage.totalTokens = u.total_tokens;
          const details = u.completion_tokens_details as Record<string, unknown> | undefined;
          if (typeof details?.reasoning_tokens === 'number') {
            usage.reasoningTokens = details.reasoning_tokens;
          }
        }

        const choices = eventData.choices as unknown[];
        const choice = choices?.[0] as Record<string, unknown> | undefined;
        if (!choice) continue;

        if (choice.finish_reason && typeof choice.finish_reason === 'string') {
          const fr = choice.finish_reason;
          if (fr === 'stop') finishReason = 'stop';
          else if (fr === 'length') finishReason = 'length';
          else if (fr === 'tool_calls' || fr === 'function_call') finishReason = 'tool-use';
        }

        const delta = choice.delta as Record<string, unknown> | undefined;
        if (!delta) continue;

        // Reasoning deltas: reasoning_content, reasoning, reasoning_text, reasoning_details.text
        const reasoningDetails = delta.reasoning_details as Record<string, unknown> | undefined;
        const reasoningDelta =
          (typeof delta.reasoning_content === 'string' && delta.reasoning_content) ||
          (typeof delta.reasoning === 'string' && delta.reasoning) ||
          (typeof delta.reasoning_text === 'string' && delta.reasoning_text) ||
          (typeof reasoningDetails?.text === 'string' && reasoningDetails.text) ||
          '';

        if (reasoningDelta) {
          const lastBlock = assistantContent[assistantContent.length - 1];
          if (lastBlock && lastBlock.type === 'thinking') {
            (lastBlock as ThinkingContent).thinking += reasoningDelta;
          } else {
            assistantContent.push({
              type: 'thinking',
              thinking: reasoningDelta,
            });
          }
          yield { type: 'reasoning-delta', delta: reasoningDelta };
        }

        // Text delta
        if (typeof delta.content === 'string' && delta.content) {
          const textDelta = delta.content;
          const lastBlock = assistantContent[assistantContent.length - 1];
          if (lastBlock && lastBlock.type === 'text') {
            (lastBlock as TextContent).text += textDelta;
          } else {
            assistantContent.push({
              type: 'text',
              text: textDelta,
            });
          }
          yield { type: 'text-delta', delta: textDelta };
        }

        // Tool calls
        if (Array.isArray(delta.tool_calls)) {
          for (const tc of delta.tool_calls as Array<Record<string, unknown>>) {
            const idx = typeof tc.index === 'number' ? tc.index : 0;
            const fn = tc.function as Record<string, unknown> | undefined;
            const tcId = typeof tc.id === 'string' ? tc.id : undefined;
            const fnName = typeof fn?.name === 'string' ? fn.name : undefined;
            const fnArgs = typeof fn?.arguments === 'string' ? fn.arguments : undefined;

            let entry = toolCallBuffers.get(idx);
            if (!entry) {
              const buffer = {
                id: tcId || `call_${idx}`,
                name: fnName || '',
                rawArgs: '',
              };
              const slot: ToolCallContent = {
                type: 'tool-call',
                id: buffer.id,
                name: buffer.name,
                arguments: {},
              };
              assistantContent.push(slot);
              entry = { buffer, slot };
              toolCallBuffers.set(idx, entry);

              if (buffer.name) {
                yield { type: 'tool-call-start', id: buffer.id, name: buffer.name };
              }
            } else {
              if (tcId && entry.buffer.id !== tcId) {
                entry.buffer.id = tcId;
                entry.slot.id = tcId;
              }
              if (!entry.buffer.name && fnName) {
                entry.buffer.name = fnName;
                entry.slot.name = fnName;
                yield { type: 'tool-call-start', id: entry.buffer.id, name: entry.buffer.name };
              }
            }

            if (fnArgs) {
              entry.buffer.rawArgs += fnArgs;
              yield {
                type: 'tool-call-delta',
                id: entry.buffer.id,
                delta: fnArgs,
              };
            }
          }
        }
      }

      for (const entry of toolCallBuffers.values()) {
        const parsedArgs = parseStreamingJson(entry.buffer.rawArgs);
        entry.slot.arguments = parsedArgs;
        finishReason = 'tool-use';
        yield { type: 'tool-call-end', toolCall: entry.slot };
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
    } catch (err: unknown) {
      const isAbort = request.abortSignal?.aborted;
      const error = new AIError(
        isAbort
          ? 'Inference request aborted.'
          : `${profile.provider} stream reading failed: ${err instanceof Error ? err.message : String(err)}`,
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
