import { describe, expect, it } from 'bun:test';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  FileCredentialStore,
  inferProviderFromModelId,
  fetchAvailableModels,
  startOAuthCallbackServer,
  AIError,
} from '../../src/packages/ai/src/index.js';
import { fetchOpenRouterModels } from '../../src/packages/ai/src/models/discovery.js';
import { streamGemini } from '../../src/packages/ai/src/providers/gemini.js';
import { streamOpenAICompatible } from '../../src/packages/ai/src/providers/openai-compatible.js';
import { pollOAuthDeviceCodeFlow } from '../../src/packages/ai/src/auth/device-code.js';

describe('Steward @steward/ai Regression Suite', () => {
  describe('1 & 2. Gemini signatures and key transport', () => {
    it('uses textSignature, thinkingSignature, thoughtSignature and sends key in header without URL query', async () => {
      let capturedUrl = '';
      let capturedHeaders: Record<string, string> = {};
      let capturedBody: any = null;

      const originalFetch = globalThis.fetch;
      globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        capturedUrl = String(input);
        capturedHeaders = (init?.headers as Record<string, string>) || {};
        capturedBody = init?.body ? JSON.parse(String(init.body)) : null;

        const sseData = [
          'data: ' +
            JSON.stringify({
              candidates: [
                {
                  content: {
                    parts: [
                      {
                        thought: true,
                        text: 'Thinking step',
                        thoughtSignature: 'sig_thought_1',
                      },
                      {
                        text: 'Hello response',
                        thoughtSignature: 'sig_text_1',
                      },
                    ],
                  },
                },
              ],
            }) +
            '\n\n',
        ].join('');

        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(sseData));
            controller.close();
          },
        });

        return new Response(stream, {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        });
      }) as typeof fetch;

      try {
        const resultStream = streamGemini({
          request: {
            model: { provider: 'gemini', modelId: 'gemini-2.5-flash', effort: 'medium' },
            messages: [
              {
                role: 'assistant',
                content: [
                  {
                    type: 'thinking',
                    thinking: 'previous thought',
                    thinkingSignature: 'prev_think_sig',
                  },
                  {
                    type: 'text',
                    text: 'previous text',
                    textSignature: 'prev_text_sig',
                  },
                  {
                    type: 'tool-call',
                    id: 'call_1',
                    name: 'test_tool',
                    arguments: { q: 'hello' },
                    thoughtSignature: 'tool_thought_sig',
                  },
                ],
              },
            ],
          },
          auth: {
            type: 'api-key',
            token: 'secret-gemini-key',
            source: 'api-key',
          },
        });

        const res = await resultStream.result();

        // 1. Verify URL has no query key
        expect(capturedUrl).not.toContain('key=');
        expect(capturedUrl).toContain(':streamGenerateContent?alt=sse');
        // 2. Verify header has x-goog-api-key
        expect(capturedHeaders['x-goog-api-key']).toBe('secret-gemini-key');

        // 3. Verify outgoing payload mapped signatures properly
        const modelContent = capturedBody?.contents?.[0];
        expect(modelContent?.parts?.[0]?.thoughtSignature).toBe('prev_think_sig');
        expect(modelContent?.parts?.[1]?.thoughtSignature).toBe('prev_text_sig');
        expect(modelContent?.parts?.[2]?.thoughtSignature).toBe('tool_thought_sig');

        // 4. Verify received message normalized signatures
        expect(res.message.content.length).toBe(2);
        expect(res.message.content[0].type).toBe('thinking');
        expect((res.message.content[0] as any).thinkingSignature).toBe('sig_thought_1');
        expect(res.message.content[1].type).toBe('text');
        expect((res.message.content[1] as any).textSignature).toBe('sig_text_1');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  describe('3 & 4. Interleaved canonical stream ordering', () => {
    it('preserves thinking -> text -> tool-call -> text ordering in OpenAI-compatible stream', async () => {
      const originalFetch = globalThis.fetch;
      const sseChunks = [
        'data: ' +
          JSON.stringify({
            choices: [{ delta: { reasoning_content: 'Step 1' } }],
          }) +
          '\n\n',
        'data: ' +
          JSON.stringify({
            choices: [{ delta: { content: 'Intro text' } }],
          }) +
          '\n\n',
        'data: ' +
          JSON.stringify({
            choices: [
              {
                delta: {
                  tool_calls: [
                    {
                      index: 0,
                      id: 'call_abc',
                      function: { name: 'calculator', arguments: '{"expr":' },
                    },
                  ],
                },
              },
            ],
          }) +
          '\n\n',
        'data: ' +
          JSON.stringify({
            choices: [
              {
                delta: {
                  tool_calls: [
                    {
                      index: 0,
                      function: { arguments: '"2+2"}' },
                    },
                  ],
                },
              },
            ],
          }) +
          '\n\n',
        'data: ' +
          JSON.stringify({
            choices: [{ delta: { content: 'Conclusion text' } }],
          }) +
          '\n\n',
        'data: [DONE]\n\n',
      ];

      globalThis.fetch = (async () => {
        const stream = new ReadableStream({
          start(controller) {
            for (const chunk of sseChunks) {
              controller.enqueue(new TextEncoder().encode(chunk));
            }
            controller.close();
          },
        });
        return new Response(stream, {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        });
      }) as typeof fetch;

      try {
        const stream = streamOpenAICompatible({
          request: {
            model: { provider: 'deepseek', modelId: 'deepseek-reasoner', effort: 'medium' },
            messages: [{ role: 'user', content: 'compute' }],
          },
        });

        const res = await stream.result();
        const content = res.message.content;

        expect(content.length).toBe(4);
        expect(content[0].type).toBe('thinking');
        expect((content[0] as any).thinking).toBe('Step 1');

        expect(content[1].type).toBe('text');
        expect((content[1] as any).text).toBe('Intro text');

        expect(content[2].type).toBe('tool-call');
        expect((content[2] as any).id).toBe('call_abc');
        expect((content[2] as any).name).toBe('calculator');
        expect((content[2] as any).arguments).toEqual({ expr: '2+2' });

        expect(content[3].type).toBe('text');
        expect((content[3] as any).text).toBe('Conclusion text');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('identifies OpenAI provider on transport failures', async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = (async () => {
        return new Response(JSON.stringify({ error: { message: 'Invalid API key' } }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }) as typeof fetch;

      try {
        const stream = streamOpenAICompatible({
          request: {
            model: { provider: 'openai', modelId: 'gpt-4o', effort: 'medium' },
            messages: [{ role: 'user', content: 'hello' }],
          },
          auth: {
            type: 'api-key',
            token: 'bad-key',
            source: 'api-key',
          },
          profile: {
            provider: 'openai',
            baseUrl: 'https://api.openai.com/v1',
            supportsReasoning: true,
            reasoningFormat: 'openai',
            apiPath: '/chat/completions',
            requiresApiKey: true,
          },
        });

        let thrownError: any = null;
        try {
          await stream.result();
        } catch (err) {
          thrownError = err;
        }

        expect(thrownError).toBeInstanceOf(AIError);
        expect(thrownError.provider).toBe('openai');
        expect(thrownError.message).toContain('openai request failed with HTTP status 401');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  describe('5 & 6. OpenRouter pagination security', () => {
    it('rejects untrusted pagination next URL and prevents infinite loops', async () => {
      const originalFetch = globalThis.fetch;
      let callCount = 0;

      globalThis.fetch = (async (input: RequestInfo | URL) => {
        callCount++;
        const urlStr = String(input);

        if (callCount === 1) {
          return new Response(
            JSON.stringify({
              data: [{ id: 'meta-llama/llama-3.3-70b-instruct' }],
              links: {
                next: 'https://attacker.com/steal-keys?page=2',
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }

        return new Response(JSON.stringify({ data: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }) as typeof fetch;

      try {
        const models = await fetchOpenRouterModels('test-key');
        // Untrusted attacker.com URL was ignored, stopped at page 1
        expect(callCount).toBe(1);
        expect(models.length).toBe(1);
        expect(models[0].modelId).toBe('meta-llama/llama-3.3-70b-instruct');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('prevents loops when pagination next URL points to already seen URL', async () => {
      const originalFetch = globalThis.fetch;
      let callCount = 0;

      globalThis.fetch = (async () => {
        callCount++;
        return new Response(
          JSON.stringify({
            data: [{ id: `model-page-${callCount}` }],
            links: {
              next: 'https://openrouter.ai/api/v1/models', // loops back to initial page
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }) as typeof fetch;

      try {
        const models = await fetchOpenRouterModels('test-key');
        expect(callCount).toBe(1);
        expect(models.length).toBe(1);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  describe('7 & 8. Credential store validation and write serialization', () => {
    it('rejects malformed credential store JSON', async () => {
      const tmpDir = path.join(os.tmpdir(), `steward-auth-corrupt-${Date.now()}`);
      await fs.mkdir(tmpDir, { recursive: true });
      const authPath = path.join(tmpDir, 'auth.json');

      await fs.writeFile(
        authPath,
        JSON.stringify({
          version: 2, // invalid version
          credentials: { anthropic: { type: 'oauth', accessToken: 12345 } },
        }),
        'utf-8',
      );

      const store = new FileCredentialStore({ storageDir: tmpDir });
      let thrown: any = null;
      try {
        await store.read('anthropic');
      } catch (err) {
        thrown = err;
      }

      expect(thrown).toBeInstanceOf(AIError);
      expect(thrown.code).toBe('auth');
      await fs.rm(tmpDir, { recursive: true, force: true });
    });

    it('serializes modifications across multiple store instances in the same process', async () => {
      const tmpDir = path.join(os.tmpdir(), `steward-auth-race-${Date.now()}`);
      const store1 = new FileCredentialStore({ storageDir: tmpDir });
      const store2 = new FileCredentialStore({ storageDir: tmpDir });

      await Promise.all([
        store1.modify('anthropic', async () => ({
          type: 'oauth',
          accessToken: 'token-anthropic',
          expiresAt: Date.now() + 10000,
        })),
        store2.modify('openrouter', async () => ({
          type: 'oauth',
          accessToken: 'token-openrouter',
          expiresAt: Date.now() + 10000,
        })),
      ]);

      const cred1 = await store1.read('anthropic');
      const cred2 = await store2.read('openrouter');

      expect(cred1?.accessToken).toBe('token-anthropic');
      expect(cred2?.accessToken).toBe('token-openrouter');

      await fs.rm(tmpDir, { recursive: true, force: true });
    });
  });

  describe('9 & 10. Device code cancellation and OAuth server cleanup', () => {
    it('normalizes device code flow cancellation to AIError(code: aborted)', async () => {
      const abortCtrl = new AbortController();
      abortCtrl.abort();

      let thrown: any = null;
      try {
        await pollOAuthDeviceCodeFlow({
          poll: async () => ({ status: 'pending' }),
          signal: abortCtrl.signal,
        });
      } catch (err) {
        thrown = err;
      }

      expect(thrown).toBeInstanceOf(AIError);
      expect(thrown.code).toBe('aborted');
    });

    it('cleans up callback server resources on cancellation', async () => {
      const abortCtrl = new AbortController();
      const server = await startOAuthCallbackServer({
        host: '127.0.0.1',
        port: 58123,
        path: '/callback',
        signal: abortCtrl.signal,
      });

      abortCtrl.abort();

      let waitThrown: any = null;
      try {
        await server.wait();
      } catch (err) {
        waitThrown = err;
      }

      expect(waitThrown).toBeInstanceOf(AIError);
      expect(waitThrown.code).toBe('aborted');
      await server.close();
    });
  });

  describe('11 & 12. Model ID inference and discovery catalog', () => {
    it('infers Ollama tagged models and OpenAI o-series conservatively', () => {
      // Ollama tagged models
      expect(inferProviderFromModelId('qwen2.5-coder:7b')).toBe('ollama');
      expect(inferProviderFromModelId('llama3.2:3b')).toBe('ollama');
      expect(inferProviderFromModelId('phi4:latest')).toBe('ollama');

      // OpenAI o-series
      expect(inferProviderFromModelId('o1')).toBe('openai');
      expect(inferProviderFromModelId('o1-mini')).toBe('openai');
      expect(inferProviderFromModelId('o3')).toBe('openai');
      expect(inferProviderFromModelId('o3-mini')).toBe('openai');
      expect(inferProviderFromModelId('o4-preview')).toBe('openai');

      // OpenRouter namespaced
      expect(inferProviderFromModelId('anthropic/claude-3.5-sonnet')).toBe('openrouter');
      expect(inferProviderFromModelId('meta-llama/llama-3.3-70b-instruct')).toBe('openrouter');
    });

    it('initializes all 11 providers in fetchAvailableModels', async () => {
      const result = await fetchAvailableModels({
        getApiKey: () => undefined,
        getOllamaEndpoint: () => 'http://127.0.0.1:99999/v1', // unreachable
      });

      const expectedProviders = [
        'gemini',
        'anthropic',
        'openai',
        'deepseek',
        'openrouter',
        'github-copilot',
        'groq',
        'xai',
        'mistral',
        'ollama',
        'custom',
      ];

      for (const p of expectedProviders) {
        expect(result.providers[p as keyof typeof result.providers]).toBeDefined();
        expect(result.providers[p as keyof typeof result.providers].status).toBe('unconfigured');
      }
    });
  });
});
