import type { AI, ProviderId, ReasoningEffort } from '@steward/ai';
import type { StreamFn, StreamRequest, ModelStream, StreamEvent, StreamResult } from '@steward/agent';

export interface ModelResolution {
  provider: string;
  modelId: string;
  effort?: ReasoningEffort;
}

/**
 * Creates a @steward/agent compatible StreamFn powered by @steward/ai.
 */
export function createStreamAdapter(
  ai: AI,
  model: ModelResolution,
  defaultEffort?: ReasoningEffort,
): StreamFn {
  return (req: StreamRequest): ModelStream => {
    const effort = req.effort ?? model.effort ?? defaultEffort;

    const inferenceStream = ai.stream({
      model: {
        provider: model.provider as ProviderId,
        modelId: model.modelId,
        effort,
      },
      messages: req.messages,
      tools: req.tools,
      effort,
      temperature: req.temperature,
      abortSignal: req.signal,
    });

    return {
      async *[Symbol.asyncIterator](): AsyncIterator<StreamEvent> {
        for await (const event of inferenceStream) {
          yield event as StreamEvent;
        }
      },
      async result(): Promise<StreamResult> {
        const res = await inferenceStream.result();
        return res as unknown as StreamResult;
      },
    };
  };
}
