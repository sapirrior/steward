/**
 * @file agentRunner.ts
 * @description Coordinates the LLM streaming execution with tool calling,
 * live UI turn updates, and interactive permission handling.
 */

import { createStewardSDK, type ModelMessage } from '@steward/sdk';
import { ToolRegistry } from '../tools/ToolRegistry.js';
import { adaptToolsToAiSdk } from '../tools/aiSdkToolAdapter.js';
import { resolveCliCredentials } from './providerCredentials.js';
import { buildSystemPromptSections } from './context/systemPrompt.js';
import type { ChatTurn } from '../ui/components/TurnView.js';
import type { ToolCallItem } from '../ui/components/ToolUseMessage.js';
import type { PendingPermissionRequest } from '../ui/components/PermissionQueue.js';

export interface RunAgentOptions {
  prompt: string;
  provider: string;
  model: string;
  cwd: string;
  reasoningEffort?: string;
  conversationHistory: readonly ModelMessage[];
  onTurnUpdate: (turn: ChatTurn) => void;
  onRequestPermission?: (request: PendingPermissionRequest) => void;
  signal?: AbortSignal;
}

export async function runAgentTurn({
  prompt,
  provider,
  model,
  cwd,
  reasoningEffort,
  conversationHistory,
  onTurnUpdate,
  onRequestPermission,
  signal,
}: RunAgentOptions): Promise<{ finalTurn: ChatTurn; newMessages: ModelMessage[] }> {
  const turnId = `turn-${Date.now()}`;
  const registry = new ToolRegistry();

  // Create tool execution tracking map
  const toolCallsMap = new Map<string, ToolCallItem>();

  const activeTurn: ChatTurn = {
    id: turnId,
    userPrompt: prompt,
    isBash: false,
    assistantContent: '',
    thinking: '',
    toolCalls: [],
  };

  const notifyUpdate = () => {
    onTurnUpdate({
      ...activeTurn,
      toolCalls: Array.from(toolCallsMap.values()),
    });
  };

  // Convert registry tools to AI SDK ToolSet with permission hooks
  const tools = adaptToolsToAiSdk(registry, {
    cwd,
    onProgress: (progress) => {
      // Progress from tools
    },
    askPermission: async (req) => {
      if (!onRequestPermission) return true;
      return new Promise<boolean>((resolve) => {
        onRequestPermission({
          id: `perm-${Date.now()}`,
          type: 'bash',
          command: req.command,
          description: req.reason,
          onAllow: () => resolve(true),
          onDeny: () => resolve(false),
        });
      });
    },
  });

  // Resolve API credentials
  const credentials = await resolveCliCredentials(provider, { signal });

  // Build system instructions
  const promptSections = buildSystemPromptSections({ cwd });
  const instructions = Object.values(promptSections).join('\n\n');

  // Format full model ID (e.g. google/gemini-2.5-flash)
  const fullModel = model.includes('/') ? model : `${provider}/${model}`;

  const sdk = createStewardSDK();

  try {
    const stream = sdk.stream({
      model: fullModel,
      instructions,
      messages: conversationHistory,
      message: prompt,
      tools,
      reasoning: reasoningEffort as any,
      keyMetadata: credentials,
      signal,
    });

    let lastThrottle = 0;
    const throttledNotify = () => {
      const now = Date.now();
      if (now - lastThrottle > 40) {
        lastThrottle = now;
        notifyUpdate();
      }
    };

    let responseMessagesFromFinish: readonly ModelMessage[] = [];

    for await (const event of stream) {
      if (signal?.aborted) break;

      switch (event.type) {
        case 'text-delta': {
          activeTurn.assistantContent = (activeTurn.assistantContent || '') + event.text;
          throttledNotify();
          break;
        }

        case 'reasoning-delta': {
          activeTurn.thinking = (activeTurn.thinking || '') + event.text;
          throttledNotify();
          break;
        }

        case 'tool-call': {
          toolCallsMap.set(event.toolCallId, {
            id: event.toolCallId,
            name: event.toolName,
            input: (event.input as Record<string, any>) || {},
            status: 'running',
          });
          notifyUpdate();
          break;
        }

        case 'tool-result': {
          const existing = toolCallsMap.get(event.toolCallId);
          if (existing) {
            existing.status = event.isError ? 'error' : 'success';
            existing.output = typeof event.output === 'string' ? event.output : JSON.stringify(event.output);
            if (event.isError) {
              existing.error = typeof event.output === 'string' ? event.output : 'Tool execution failed';
            }
          }
          notifyUpdate();
          break;
        }

        case 'finish': {
          responseMessagesFromFinish = event.responseMessages || [];
          notifyUpdate();
          break;
        }

        case 'error': {
          activeTurn.error = event.error.message;
          notifyUpdate();
          break;
        }
      }
    }

    notifyUpdate();

    const finalTurn: ChatTurn = {
      ...activeTurn,
      toolCalls: Array.from(toolCallsMap.values()),
    };

    const newMessages: ModelMessage[] = [
      { role: 'user', content: prompt },
      ...(responseMessagesFromFinish.length > 0
        ? responseMessagesFromFinish
        : [{ role: 'assistant', content: finalTurn.assistantContent || '' } as ModelMessage]),
    ];

    return { finalTurn, newMessages };
  } catch (err: any) {
    activeTurn.error = err.message || String(err);
    if (!activeTurn.assistantContent) {
      activeTurn.assistantContent = `Error: ${activeTurn.error}`;
    }
    notifyUpdate();

    const finalTurn: ChatTurn = {
      ...activeTurn,
      toolCalls: Array.from(toolCallsMap.values()),
    };

    return {
      finalTurn,
      newMessages: [
        { role: 'user', content: prompt },
        { role: 'assistant', content: finalTurn.assistantContent || '' },
      ],
    };
  }
}
