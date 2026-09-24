/**
 * @steward/ai - Normalized Inference Entry Point & AIEngine
 */

import type {
  InferenceRequest,
  InferenceStream,
  ModelSelection,
  ProviderId,
  ModelDescriptor,
} from './types.js';
import { AuthManager, createAuthManager } from './auth/manager.js';
import { ModelSelectionRequest, resolveModelSelection } from './models/selection.js';
import { streamOpenAI } from './providers/openai.js';
import { streamAnthropic } from './providers/anthropic.js';
import { streamGemini } from './providers/gemini.js';
import { streamOpenAICompatible } from './providers/openai-compatible.js';
import { AIError } from './errors.js';

export interface AIEngineOptions {
  auth?: AuthManager;
  customBaseUrl?: string;
}

export interface AIEngine {
  readonly auth: AuthManager;
  stream(request: InferenceRequest): InferenceStream;
  resolveModel(request?: ModelSelectionRequest): Promise<ModelSelection>;
  listModels?(provider?: ProviderId): readonly ModelDescriptor[];
}

export function streamInference(
  request: InferenceRequest,
  authManager: AuthManager = createAuthManager(),
  customBaseUrl?: string,
): InferenceStream {
  const provider = request.model.provider;

  let streamPromise: Promise<InferenceStream> | null = null;
  const getStream = async (): Promise<InferenceStream> => {
    const resolvedAuth = await authManager.resolve(provider, request.abortSignal);
    if (!resolvedAuth && provider !== 'custom' && provider !== 'ollama') {
      throw new AIError(`No credentials configured for provider: ${provider}`, {
        code: 'auth',
        provider,
      });
    }

    const auth = resolvedAuth ?? {
      type: 'api-key',
      token: 'none',
      source: 'custom',
    };

    switch (provider) {
      case 'anthropic':
        return streamAnthropic({ request, auth });
      case 'gemini':
        return streamGemini({ request, auth });
      case 'openai':
        return streamOpenAI({ request, auth });
      case 'deepseek':
      case 'openrouter':
      case 'github-copilot':
      case 'groq':
      case 'xai':
      case 'mistral':
      case 'ollama':
      case 'custom':
        return streamOpenAICompatible({ request, auth, customBaseUrl });
      default:
        throw new AIError(`Unsupported provider: "${provider}"`, {
          code: 'invalid-request',
          provider,
        });
    }
  };

  streamPromise = getStream();

  return {
    async *[Symbol.asyncIterator]() {
      const activeStream = await streamPromise!;
      for await (const event of activeStream) {
        yield event;
      }
    },
    async result() {
      const activeStream = await streamPromise!;
      return await activeStream.result();
    },
  };
}

export class DefaultAIEngine implements AIEngine {
  public readonly auth: AuthManager;
  private readonly customBaseUrl?: string;

  constructor(options?: AIEngineOptions) {
    this.auth = options?.auth ?? createAuthManager();
    this.customBaseUrl = options?.customBaseUrl;
  }

  public stream(request: InferenceRequest): InferenceStream {
    return streamInference(request, this.auth, this.customBaseUrl);
  }

  public async resolveModel(request?: ModelSelectionRequest): Promise<ModelSelection> {
    return await resolveModelSelection(request, {
      isConfigured: async (p) => {
        const status = await this.auth.getStatus(p);
        return status.configured;
      },
      getSavedSelection: () => undefined,
      getCustomModelName: () => process.env.CUSTOM_API_MODEL_NAME,
    });
  }
}

export function createAIEngine(options?: AIEngineOptions): AIEngine {
  return new DefaultAIEngine(options);
}
