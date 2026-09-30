/**
 * @steward/ai - OpenAI Completions Wire Protocol Adapter
 *
 * Implements raw-fetch wire protocol for OpenAI Chat Completions API
 * (/v1/chat/completions). Supports:
 * - OpenAI, OpenRouter, DeepSeek, Groq, xAI, Mistral, Ollama, Custom
 * - Multiple reasoning delta formats:
 *   - reasoning_content (DeepSeek, OpenRouter)
 *   - reasoning_details (OpenAI reasoning models)
 *   - reasoning (standard legacy)
 * - Reasoning effort parameter mapping ('none' | 'low' | 'medium' | 'high' | 'xhigh')
 * - Tool calls accumulation and partial streaming
 * - Token usage extraction via stream_options: { include_usage: true }
 */

import { decodeSSE } from '../util/sse.js';
import { parseStreamingJson } from '../util/json.js';
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

interface ToolCallBufferEntry {
  buffer: { id: string; name: string; rawArgs: string };
  slot: ToolCallContent;
}

export async function openAICompletionsProtocol(
  model: Model,
  request: InferenceRequest,
  auth: ResolvedAuth,
  fetchFn: typeof fetch,
  stream: AssistantMessageStream,
): Promise<void> {
  const transformed = transformMessages(request.messages, model);

  // 1. Convert messages to OpenAI chat completions format
  const apiMessages: unknown[] = [];
  const systemRole = model.compat?.supportsDeveloperRole ? 'developer' : 'system';

  for (const msg of transformed) {
    if (msg.role === 'system') {
      apiMessages.push({ role: systemRole, content: sanitizeSurrogates(msg.content) });
      continue;
    }

    if (msg.role === 'user') {
      if (typeof msg.content === 'string') {
        apiMessages.push({ role: 'user', content: sanitizeSurrogates(msg.content) });
      } else {
        const parts: unknown[] = [];
        for (const b of msg.content) {
          if (b.type === 'text') {
            parts.push({ type: 'text', text: sanitizeSurrogates(b.text) });
          } else if (b.type === 'image') {
            if (!b.data || !b.mimeType) {
              throw new AIError('Invalid image content: missing base64 data or mimeType', { code: 'invalid-request' });
            }
            parts.push({
              type: 'image_url',
              image_url: { url: `data:${b.mimeType};base64,${b.data}` },
            });
          }
        }
        apiMessages.push({ role: 'user', content: parts });
      }
      continue;
    }

    if (msg.role === 'assistant') {
      let text = '';
      let reasoning_content = '';
      const tool_calls: unknown[] = [];

      for (const block of msg.content) {
        if (block.type === 'text') {
          text += block.text;
        } else if (block.type === 'thinking') {
          reasoning_content += block.thinking;
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
      if (reasoning_content) {
        const fieldName = model.interleavedReasoningField ?? 'reasoning_content';
        item[fieldName] = sanitizeSurrogates(reasoning_content);
      }
      if (tool_calls.length > 0) item.tool_calls = tool_calls;
      apiMessages.push(item);
      continue;
    }

    if (msg.role === 'tool') {
      const syntheticToolImages: unknown[] = [];
      for (const res of msg.content) {
        const outStr = typeof res.output === 'string' ? res.output : JSON.stringify(res.output);
        apiMessages.push({
          role: 'tool',
          tool_call_id: res.toolCallId,
          content: sanitizeSurrogates(outStr),
        });
        if (res.images && res.images.length > 0) {
          for (const img of res.images) {
            if (!img.data || !img.mimeType) {
              throw new AIError('Invalid image content: missing base64 data or mimeType', { code: 'invalid-request' });
            }
            syntheticToolImages.push({
              type: 'image_url',
              image_url: { url: `data:${img.mimeType};base64,${img.data}` },
            });
          }
        }
      }
      if (syntheticToolImages.length > 0) {
        apiMessages.push({
          role: 'user',
          content: [
            { type: 'text', text: 'Images from tool result:' },
            ...syntheticToolImages,
          ],
        });
      }
      continue;
    }
  }

  // 2. Build Tools payload
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

  // 3. Reasoning effort mapping
  const requestedEffort = request.effort ?? ('effort' in request.model ? request.model.effort : undefined);
  const effort = clampThinkingEffort(model, requestedEffort);
  const reasoningParams: Record<string, unknown> = {};

  if (model.reasoning && effort !== 'none') {
    const wireVal = model.thinkingLevelMap?.[effort] ?? effort;
    if (model.provider === 'openrouter') {
      reasoningParams.reasoning = { effort: wireVal };
    } else {
      reasoningParams.reasoning_effort = wireVal;
    }
  }

  // 4. Construct request body
  const maxTokensKey = model.compat?.maxTokensField ?? 'max_tokens';
  const body: Record<string, unknown> = {
    model: model.id,
    messages: apiMessages,
    stream: true,
    stream_options: { include_usage: true },
    [maxTokensKey]: request.maxTokens ?? model.maxOutputTokens,
    ...reasoningParams,
  };

  if (tools) body.tools = tools;
  if (request.temperature !== undefined && effort === 'none') {
    body.temperature = request.temperature;
  }

  // 5. Construct URL & Headers
  const rawBase = (auth.baseUrl || model.baseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '');
  const url = rawBase.endsWith('/v1') ? `${rawBase}/chat/completions` : `${rawBase}/v1/chat/completions`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'text/event-stream',
    ...(auth.headers ?? {}),
    ...(model.headers ?? {}),
    ...(request.headers ?? {}),
  };

  if (auth.apiKey) {
    headers['Authorization'] = `Bearer ${auth.apiKey}`;
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
        : new AIError(`${model.provider} request failed: ${err instanceof Error ? err.message : String(err)}`, {
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
      error: new AIError('OpenAI returned an empty response body.', {
        code: 'provider',
        provider: model.provider,
      }),
    });
    return;
  }

  // 7. Stream SSE events
  const assistantContent: AssistantContent[] = [];
  const toolCallBuffers = new Map<number, ToolCallBufferEntry>();
  const usage: TokenUsage = { input: 0, output: 0 };
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
        if (typeof u.prompt_tokens === 'number') usage.input = u.prompt_tokens;
        if (typeof u.completion_tokens === 'number') usage.output = u.completion_tokens;
        if (typeof u.total_tokens === 'number') {
          usage.total = u.total_tokens;
        } else {
          usage.total = (usage.input ?? 0) + (usage.output ?? 0);
        }
        const details = u.completion_tokens_details as Record<string, unknown> | undefined;
        if (typeof details?.reasoning_tokens === 'number') {
          usage.reasoning = details.reasoning_tokens;
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

      // Reasoning deltas
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
          lastBlock.thinking += reasoningDelta;
        } else {
          assistantContent.push({ type: 'thinking', thinking: reasoningDelta });
        }
        stream.push({ type: 'reasoning-delta', delta: reasoningDelta });
      }

      // Text delta
      if (typeof delta.content === 'string' && delta.content) {
        const textDelta = delta.content;
        const lastBlock = assistantContent[assistantContent.length - 1];
        if (lastBlock && lastBlock.type === 'text') {
          lastBlock.text += textDelta;
        } else {
          assistantContent.push({ type: 'text', text: textDelta });
        }
        stream.push({ type: 'text-delta', delta: textDelta });
      }

      // Tool call deltas
      if (Array.isArray(delta.tool_calls)) {
        for (const tc of delta.tool_calls as Array<Record<string, unknown>>) {
          const idx = typeof tc.index === 'number' ? tc.index : 0;
          const fn = tc.function as Record<string, unknown> | undefined;
          const tcId = typeof tc.id === 'string' ? tc.id : undefined;
          const fnName = typeof fn?.name === 'string' ? fn.name : undefined;
          const fnArgs = typeof fn?.arguments === 'string' ? fn.arguments : undefined;

          let entry = toolCallBuffers.get(idx);
          if (!entry) {
            const buffer = { id: tcId || `call_${idx}`, name: fnName || '', rawArgs: '' };
            const slot: ToolCallContent = { type: 'tool-call', id: buffer.id, name: buffer.name, arguments: {} };
            assistantContent.push(slot);
            entry = { buffer, slot };
            toolCallBuffers.set(idx, entry);

            if (buffer.name) {
              stream.push({ type: 'tool-call-start', id: buffer.id, name: buffer.name });
            }
          } else {
            if (tcId && entry.buffer.id !== tcId) {
              entry.buffer.id = tcId;
              entry.slot.id = tcId;
            }
            if (!entry.buffer.name && fnName) {
              entry.buffer.name = fnName;
              entry.slot.name = fnName;
              stream.push({ type: 'tool-call-start', id: entry.buffer.id, name: entry.buffer.name });
            }
          }

          if (fnArgs) {
            entry.buffer.rawArgs += fnArgs;
            stream.push({ type: 'tool-call-delta', id: entry.buffer.id, delta: fnArgs });
          }
        }
      }
    }

    // Flush tool call arguments
    for (const entry of toolCallBuffers.values()) {
      const parsedArgs = parseStreamingJson(entry.buffer.rawArgs);
      entry.slot.arguments = parsedArgs;
      finishReason = 'tool-use';
      stream.push({ type: 'tool-call-end', toolCall: entry.slot });
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
