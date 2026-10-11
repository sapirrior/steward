import {
  isStepCount,
  streamText,
  type LanguageModel,
  type ModelMessage,
  type ProviderOptions,
  type ToolSet,
  type UserModelMessage,
} from 'ai';
import { DEFAULT_MAX_RETRIES, DEFAULT_MAX_STEPS } from '../constants.js';
import { normalizeSDKError, StewardSDKError } from '../errors.js';
import { mapStreamPartToEvent, normalizeUsage } from '../events/mapper.js';
import type { SDKEvent, SDKFinishReason, SDKUsage } from '../events/events.js';
import { cloneModelMessages, cloneUserContent } from '../messages/messageCopy.js';
import { parseModelIdentifier } from '../modelId.js';
import { ProviderRegistry } from '../providers/registry.js';
import type { ProviderAdapter } from '../providers/types.js';
import type {
  ProviderKeyMetadata,
  ReasoningEffort,
  SDKErrorDetails,
} from '../types.js';

export interface SDKRunInput {
  /** Steward model reference, e.g. `anthropic/claude-sonnet-4-5` or `openrouter/openrouter/free`. */
  model: string;
  /** Optional trusted instructions/system prompt. */
  instructions?: string;
  /** Prior conversation history before the current prompt. Read-only. */
  messages: readonly ModelMessage[];
  /** The new prompt's content. Wrapped by the SDK as a role: 'user' message. */
  message: UserModelMessage['content'];
  /** Native AI SDK tools. */
  tools?: ToolSet;
  /** Reasoning effort setting. */
  reasoning?: ReasoningEffort;
  /** Native AI SDK provider options. */
  providerOptions?: ProviderOptions;
  /** Abort signal for cancellation. */
  signal?: AbortSignal;
  /** Max steps for tool-execution loop. Defaults to DEFAULT_MAX_STEPS. */
  maxSteps?: number;
  /** Max retries for transient requests. */
  maxRetries?: number;
  /** Optional per-call credential overrides. */
  keyMetadata?: Readonly<ProviderKeyMetadata>;
}

export interface SDKOptions {
  /** Additional custom providers or plugins to register */
  additionalProviders?: readonly ProviderAdapter[];
  /**
   * Whether to silence AI SDK console warning flushes (default: true to protect TUI stdout)
   */
  silenceConsoleWarnings?: boolean;
}

export interface StewardSDK {
  stream(input: SDKRunInput): AsyncIterable<SDKEvent>;
}

export function createStewardSDK(options?: SDKOptions): StewardSDK {
  const registry = new ProviderRegistry(options?.additionalProviders);

  if (options?.silenceConsoleWarnings !== false) {
    (globalThis as any).AI_SDK_LOG_WARNINGS = false;
  }

  return {
    async *stream(input: SDKRunInput): AsyncIterable<SDKEvent> {
      let terminalEmitted = false;
      const parsed = parseModelIdentifier(input.model);
      const providerId = parsed.provider;
      const modelId = parsed.modelId;

      // Check pre-abort before any work
      if (input.signal?.aborted) {
        terminalEmitted = true;
        const err = new StewardSDKError({
          kind: 'abort',
          message: 'Operation was aborted before execution started.',
          retryable: false,
          provider: providerId,
          modelId,
        });
        yield { type: 'aborted', error: err.toJSON() };
        return;
      }

      let model: LanguageModel;
      try {
        model = registry.resolve(providerId, modelId, input.keyMetadata);
      } catch (err: unknown) {
        terminalEmitted = true;
        const norm = normalizeSDKError(err, { provider: providerId, modelId });
        yield { type: 'error', error: norm.toJSON() };
        return;
      }

      // Prepare immutable input sequence
      const clonedHistory = cloneModelMessages(input.messages);
      const clonedPromptContent = cloneUserContent(input.message);
      const currentUserMessage: UserModelMessage = {
        role: 'user',
        content: clonedPromptContent,
      };
      const modelMessages: ModelMessage[] = [...clonedHistory, currentUserMessage];

      const maxSteps = input.maxSteps ?? DEFAULT_MAX_STEPS;
      const maxRetries = input.maxRetries ?? DEFAULT_MAX_RETRIES;

      // Reasoning option mapping
      const reasoningSetting =
        !input.reasoning || input.reasoning === 'none'
          ? undefined
          : input.reasoning;

      let stepIndex = 1;
      let finalFinishReason: SDKFinishReason = 'stop';

      try {
        const streamResult = streamText({
          model,
          instructions: input.instructions,
          messages: modelMessages,
          tools: input.tools,
          stopWhen: isStepCount(maxSteps),
          reasoning: reasoningSetting as any,
          providerOptions: input.providerOptions,
          abortSignal: input.signal,
          maxRetries,
        });

        for await (const part of streamResult.stream) {
          if (input.signal?.aborted) {
            terminalEmitted = true;
            const err = new StewardSDKError({
              kind: 'abort',
              message: 'The operation was aborted.',
              retryable: false,
              provider: providerId,
              modelId,
            });
            yield { type: 'aborted', error: err.toJSON() };
            return;
          }

          if (part.type === 'start-step') {
            const ev = mapStreamPartToEvent(part, stepIndex);
            if (ev) yield ev;
            continue;
          }

          if (part.type === 'finish-step') {
            const ev = mapStreamPartToEvent(part, stepIndex);
            if (ev) yield ev;
            stepIndex++;
            continue;
          }

          if (part.type === 'finish') {
            const reason = (part as any).finishReason;
            if (reason === 'tool-calls') {
              finalFinishReason = 'tool-calls';
            } else if (stepIndex > maxSteps) {
              finalFinishReason = 'max-steps';
            } else if (reason === 'length') {
              finalFinishReason = 'length';
            } else if (reason === 'content-filter') {
              finalFinishReason = 'content-filter';
            } else if (reason === 'error') {
              finalFinishReason = 'error';
            } else {
              finalFinishReason = 'stop';
            }
            continue;
          }

          if (part.type === 'abort') {
            terminalEmitted = true;
            const err = new StewardSDKError({
              kind: 'abort',
              message: 'The operation was aborted by the model provider.',
              retryable: false,
              provider: providerId,
              modelId,
            });
            yield { type: 'aborted', error: err.toJSON() };
            return;
          }

          if (part.type === 'error') {
            terminalEmitted = true;
            const norm = normalizeSDKError((part as any).error, {
              provider: providerId,
              modelId,
            });
            yield { type: 'error', error: norm.toJSON() };
            return;
          }

          const ev = mapStreamPartToEvent(part, stepIndex);
          if (ev) {
            yield ev;
          }
        }

        // On stream completion, extract authoritative response messages and usage
        const [responseMessages, usage] = await Promise.all([
          streamResult.responseMessages,
          streamResult.usage,
        ]);

        const normalizedUsage = normalizeUsage(usage);

        terminalEmitted = true;
        yield {
          type: 'finish',
          finishReason: finalFinishReason,
          responseMessages,
          usage: normalizedUsage,
          totalUsage: normalizedUsage,
          steps: Math.max(1, stepIndex - 1),
        };
      } catch (err: unknown) {
        if (!terminalEmitted) {
          terminalEmitted = true;
          if (input.signal?.aborted) {
            const abortErr = new StewardSDKError({
              kind: 'abort',
              message: 'The operation was aborted.',
              retryable: false,
              provider: providerId,
              modelId,
            });
            yield { type: 'aborted', error: abortErr.toJSON() };
          } else {
            const norm = normalizeSDKError(err, { provider: providerId, modelId });
            yield { type: 'error', error: norm.toJSON() };
          }
        }
      }
    },
  };
}
