import { describe, it, expect } from 'bun:test';
import { AssistantMessageStream } from '../src/event-stream.ts';
import { anthropicMessagesProtocol } from '../src/protocols/anthropic-messages.ts';
import { openAICompletionsProtocol } from '../src/protocols/openai-completions.ts';
import { openAIResponsesProtocol } from '../src/protocols/openai-responses.ts';
import { googleGenerativeAIProtocol } from '../src/protocols/google-generative-ai.ts';
import type { InferenceRequest, Model } from '../src/types.ts';

function createMockFetch(sseLines: string[], status = 200): typeof fetch {
  const enc = new TextEncoder();
  const body = new ReadableStream({
    start(controller) {
      for (const line of sseLines) {
        controller.enqueue(enc.encode(`${line}\n\n`));
      }
      controller.close();
    },
  });

  return async () => new Response(body, { status, headers: { 'Content-Type': 'text/event-stream' } });
}

describe('protocols/anthropic-messages', () => {
  const model: Model = {
    id: 'claude-sonnet-4-5',
    name: 'Claude Sonnet 4.5',
    provider: 'anthropic',
    protocol: 'anthropic-messages',
    baseUrl: 'https://api.anthropic.com',
    reasoning: true,
    maxOutputTokens: 8192,
  };

  const req: InferenceRequest = {
    model: { provider: 'anthropic', modelId: 'claude-sonnet-4-5', effort: 'medium' },
    messages: [{ role: 'user', content: 'Hello' }],
  };

  it('streams text and produces done result', async () => {
    const sse = [
      'event: message_start\ndata: {"type":"message_start","message":{"usage":{"input_tokens":10}}}',
      'event: content_block_start\ndata: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}',
      'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hi from Claude!"}}',
      'event: content_block_stop\ndata: {"type":"content_block_stop","index":0}',
      'event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":5}}',
      'event: message_stop\ndata: {"type":"message_stop"}',
    ];

    const stream = new AssistantMessageStream();
    const fetchFn = createMockFetch(sse);

    await anthropicMessagesProtocol(model, req, { apiKey: 'sk-ant-test', source: 'test' }, fetchFn, stream);
    const res = await stream.result();

    expect(res.finishReason).toBe('stop');
    expect(res.usage.input).toBe(10);
    expect(res.usage.output).toBe(5);
    expect(res.message.content[0]).toEqual({ type: 'text', text: 'Hi from Claude!' });
  });
});

describe('protocols/openai-completions', () => {
  const model: Model = {
    id: 'gpt-5.4',
    name: 'GPT-5.4',
    provider: 'openai',
    protocol: 'openai-completions',
    baseUrl: 'https://api.openai.com/v1',
    reasoning: true,
    maxOutputTokens: 8192,
  };

  const req: InferenceRequest = {
    model: { provider: 'openai', modelId: 'gpt-5.4', effort: 'medium' },
    messages: [{ role: 'user', content: 'Hello' }],
  };

  it('streams reasoning and text deltas with usage', async () => {
    const sse = [
      'data: {"choices":[{"delta":{"reasoning_content":"Thinking deeply..."}}]}',
      'data: {"choices":[{"delta":{"content":"Hello world!"},"finish_reason":"stop"}],"usage":{"prompt_tokens":12,"completion_tokens":8}}',
      'data: [DONE]',
    ];

    const stream = new AssistantMessageStream();
    const fetchFn = createMockFetch(sse);

    await openAICompletionsProtocol(model, req, { apiKey: 'sk-test', source: 'test' }, fetchFn, stream);
    const res = await stream.result();

    expect(res.finishReason).toBe('stop');
    expect(res.usage.input).toBe(12);
    expect(res.usage.output).toBe(8);
    expect(res.message.content).toHaveLength(2);
    expect(res.message.content[0]).toEqual({ type: 'thinking', thinking: 'Thinking deeply...' });
    expect(res.message.content[1]).toEqual({ type: 'text', text: 'Hello world!' });
  });
});

describe('protocols/google-generative-ai', () => {
  const model: Model = {
    id: 'gemini-3.5-flash',
    name: 'Gemini 3.5 Flash',
    provider: 'google',
    protocol: 'google-generative-ai',
    baseUrl: 'https://generativelanguage.googleapis.com',
    reasoning: true,
    maxOutputTokens: 8192,
  };

  const req: InferenceRequest = {
    model: { provider: 'google', modelId: 'gemini-3.5-flash', effort: 'medium' },
    messages: [{ role: 'user', content: 'Hello' }],
  };

  it('streams thought parts and function calls', async () => {
    const sse = [
      'data: {"candidates":[{"content":{"parts":[{"thought":true,"text":"Analyzing code..."}]}}]}',
      'data: {"candidates":[{"content":{"parts":[{"functionCall":{"name":"read_file","args":{"path":"main.ts"}}}]},"finishReason":"STOP"}],"usageMetadata":{"promptTokenCount":15,"candidatesTokenCount":10}}',
    ];

    const stream = new AssistantMessageStream();
    const fetchFn = createMockFetch(sse);

    await googleGenerativeAIProtocol(model, req, { apiKey: 'AIzaSyTest', source: 'test' }, fetchFn, stream);
    const res = await stream.result();

    expect(res.finishReason).toBe('tool-use');
    expect(res.usage.input).toBe(15);
    expect(res.usage.output).toBe(10);
    expect(res.message.content[0]).toEqual({ type: 'thinking', thinking: 'Analyzing code...' });
    expect(res.message.content[1]).toEqual({
      type: 'tool-call',
      id: 'call_1',
      name: 'read_file',
      arguments: { path: 'main.ts' },
    });
  });
});

describe('protocols/openai-responses', () => {
  const model: Model = {
    id: 'gpt-5.4-pro',
    name: 'GPT-5.4 Pro',
    provider: 'openai',
    protocol: 'openai-responses',
    baseUrl: 'https://api.openai.com/v1',
    reasoning: true,
    maxOutputTokens: 8192,
  };

  const req: InferenceRequest = {
    model: { provider: 'openai', modelId: 'gpt-5.4-pro', effort: 'high' },
    messages: [{ role: 'user', content: 'Hello' }],
  };

  it('streams responses output_text and function_call items', async () => {
    const sse = [
      'data: {"type":"response.reasoning.delta","delta":"Let us solve this"}',
      'data: {"type":"response.output_text.delta","delta":"Here is the solution"}',
      'data: {"type":"response.output_item.added","item":{"type":"function_call","call_id":"call_resp_1","name":"bash"}}',
      'data: {"type":"response.function_call_arguments.delta","delta":"{\\"command\\":\\"ls\\"}"}',
      'data: {"type":"response.output_item.done","item":{"type":"function_call"}}',
      'data: {"type":"response.completed","response":{"status":"completed","usage":{"input_tokens":20,"output_tokens":15}}}',
    ];

    const stream = new AssistantMessageStream();
    const fetchFn = createMockFetch(sse);

    await openAIResponsesProtocol(model, req, { apiKey: 'sk-resp-test', source: 'test' }, fetchFn, stream);
    const res = await stream.result();

    expect(res.finishReason).toBe('tool-use');
    expect(res.usage.input).toBe(20);
    expect(res.usage.output).toBe(15);
    expect(res.message.content[0]).toEqual({ type: 'thinking', thinking: 'Let us solve this' });
    expect(res.message.content[1]).toEqual({ type: 'text', text: 'Here is the solution' });
    expect(res.message.content[2]).toEqual({
      type: 'tool-call',
      id: 'call_resp_1',
      name: 'bash',
      arguments: { command: 'ls' },
    });
  });
});
