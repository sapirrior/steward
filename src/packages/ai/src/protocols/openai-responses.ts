/**
 * @steward/ai - OpenAI Responses Wire Protocol Adapter
 *
 * Implements raw-fetch wire protocol for OpenAI Responses API (/v1/responses).
 * Supported by modern OpenAI models (GPT-5, o-series, Copilot response gateway).
 * Features:
 * - Direct session input streaming
 * - Streaming tool calls
 * - Native reasoning details
 * - Token usage extraction
 */

import { decodeSSE } from '../util/sse.js';
import { parseStreamingJson } from '../util/json.js';
import { sanitizeSurrogates } from '../util/sanitize.js';
import { withRetry, type HttpError } from '../util/retry.js';
import { clampThinkingEffort } from '../models/thinking.js';
import { transformMessages } from '../transform/messages.js';
import { AIError } from '../errors.js';
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

export async function openAIResponsesProtocol(
  model: Model,
  request: InferenceRequest,
  auth: ResolvedAuth,
  fetchFn: typeof fetch,
  stream: AssistantMessageStream,
): Promise<void> {
  const transformed = transformMessages(request.messages, model);

  // 1. Convert messages to Responses input items format
  const inputItems: unknown[] = [];

  for (const msg of transformed) {
    if (msg.role === 'system') {
      inputItems.push({
        type: 'message',
        role: 'system',
        content: [{ type: 'input_text', text: sanitizeSurrogates(msg.content) }],
      });
      continue;
    }

    if (msg.role === 'user') {
      const text = typeof msg.content === 'string' ? msg.content : msg.content.map((c) => c.text).join('\n');
      inputItems.push({
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text: sanitizeSurrogates(text) }],
      });
      continue;
    }

    if (msg.role === 'assistant') {
      const contentParts: unknown[] = [];
      for (const block of msg.content) {
        if (block.type === 'text') {
          contentParts.push({ type: 'output_text', text: sanitizeSurrogates(block.text) });
        } else if (block.type === 'tool-call') {
          inputItems.push({
            type: 'function_call',
            call_id: block.id,
            name: block.name,
            arguments: JSON.stringify(block.arguments),
          });
        }
      }
      if (contentParts.length > 0) {
        inputItems.push({
          type: 'message',
          role: 'assistant',
          content: contentParts,
        });
      }
      continue;
    }

    if (msg.role === 'tool') {
      for (const res of msg.content) {
        const outStr = typeof res.output === 'string' ? res.output : JSON.stringify(res.output);
        inputItems.push({
          type: 'function_call_output',
          call_id: res.toolCallId,
          output: sanitizeSurrogates(outStr),
        });
      }
    }
  }

  // 2. Tools
  const tools =
    request.tools && request.tools.length > 0
      ? request.tools.map((t) => ({
          type: 'function',
          name: t.name,
          description: t.description,
          parameters: t.inputSchema,
        }))
      : undefined;

  // 3. Reasoning effort
  const effort = clampThinkingEffort(model, request.model.effort);
  const reasoningConfig: Record<string, unknown> = {};
  if (model.reasoning && effort !== 'none') {
    reasoningConfig.reasoning = { effort };
  }

  // 4. Request body
  const body: Record<string, unknown> = {
    model: model.id,
    input: inputItems,
    stream: true,
    max_output_tokens: request.maxTokens ?? model.maxOutputTokens,
    ...reasoningConfig,
  };

  if (tools) body.tools = tools;
  if (request.temperature !== undefined && effort === 'none') {
    body.temperature = request.temperature;
  }

  // 5. URL & Headers
  const baseUrl = auth.baseUrl || model.baseUrl || 'https://api.openai.com/v1';
  const url = `${baseUrl.replace(/\/+$/, '')}/responses`;

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
        const error = new Error(`HTTP ${res.status}`) as HttpError;
        error.status = res.status;
        error.headers = res.headers;
        throw error;
      }
      return res;
    }, { signal: request.abortSignal });
  } catch (err) {
    const isAbort = request.abortSignal?.aborted;
    stream.push({
      type: 'error',
      error: new AIError(
        isAbort ? 'Inference request aborted.' : `OpenAI Responses request failed: ${err instanceof Error ? err.message : String(err)}`,
        {
          code: isAbort ? 'aborted' : 'network',
          provider: model.provider,
          cause: err,
        },
      ),
    });
    return;
  }

  if (!response.body) {
    stream.push({
      type: 'error',
      error: new AIError('OpenAI Responses returned an empty response body.', {
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
  let activeToolCall: { id: string; name: string; args: string } | null = null;

  try {
    for await (const sse of decodeSSE(response.body, request.abortSignal)) {
      if (!sse.data || sse.data === '[DONE]') continue;
      let eventData: Record<string, unknown>;
      try {
        eventData = JSON.parse(sse.data) as Record<string, unknown>;
      } catch {
        continue;
      }

      const eventType = (typeof eventData.type === 'string' && eventData.type) || sse.event || '';

      if (eventType === 'response.output_item.added') {
        const item = eventData.item as Record<string, unknown> | undefined;
        if (item?.type === 'function_call') {
          const callId = typeof item.call_id === 'string' ? item.call_id : `call_${Date.now()}`;
          const fnName = typeof item.name === 'string' ? item.name : '';
          activeToolCall = { id: callId, name: fnName, args: '' };
          stream.push({ type: 'tool-call-start', id: callId, name: fnName });
        }
      } else if (eventType === 'response.function_call_arguments.delta') {
        const delta = typeof eventData.delta === 'string' ? eventData.delta : '';
        if (activeToolCall && delta) {
          activeToolCall.args += delta;
          stream.push({ type: 'tool-call-delta', id: activeToolCall.id, delta });
        }
      } else if (eventType === 'response.output_item.done') {
        const item = eventData.item as Record<string, unknown> | undefined;
        if (item?.type === 'function_call' && activeToolCall) {
          const parsed = parseStreamingJson(activeToolCall.args);
          const toolCall: ToolCallContent = {
            type: 'tool-call',
            id: activeToolCall.id,
            name: activeToolCall.name,
            arguments: parsed,
          };
          assistantContent.push(toolCall);
          finishReason = 'tool-use';
          stream.push({ type: 'tool-call-end', toolCall });
          activeToolCall = null;
        }
      } else if (eventType === 'response.text.delta' || eventType === 'response.output_text.delta') {
        const delta = typeof eventData.delta === 'string' ? eventData.delta : '';
        if (delta) {
          const lastBlock = assistantContent[assistantContent.length - 1];
          if (lastBlock && lastBlock.type === 'text') {
            lastBlock.text += delta;
          } else {
            assistantContent.push({ type: 'text', text: delta });
          }
          stream.push({ type: 'text-delta', delta });
        }
      } else if (eventType === 'response.reasoning.delta') {
        const delta = typeof eventData.delta === 'string' ? eventData.delta : '';
        if (delta) {
          const lastBlock = assistantContent[assistantContent.length - 1];
          if (lastBlock && lastBlock.type === 'thinking') {
            lastBlock.thinking += delta;
          } else {
            assistantContent.push({ type: 'thinking', thinking: delta });
          }
          stream.push({ type: 'reasoning-delta', delta });
        }
      } else if (eventType === 'response.completed' || eventType === 'response.done') {
        const resp = eventData.response as Record<string, unknown> | undefined;
        if (resp?.usage && typeof resp.usage === 'object') {
          const u = resp.usage as Record<string, unknown>;
          if (typeof u.input_tokens === 'number') usage.input = u.input_tokens;
          if (typeof u.output_tokens === 'number') usage.output = u.output_tokens;
        }
        if (typeof resp?.status === 'string') {
          if (resp.status === 'completed') {
            if (finishReason !== 'tool-use') finishReason = 'stop';
          } else if (resp.status === 'incomplete') finishReason = 'length';
          else if (resp.status === 'failed') finishReason = 'error';
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
