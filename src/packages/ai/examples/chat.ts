#!/usr/bin/env bun
/**
 * @steward/ai - Interactive REPL Chat Example
 *
 * Demonstrates:
 * - In-memory multi-turn chat session with cross-model message transformation
 * - Dynamic provider & model switching (.model, .provider, .effort)
 * - Model discovery & listing (.list, .providers)
 * - Zero-dependency real-time streaming with reasoning & cost calculation
 *
 * Usage:
 *   bun run examples/chat.ts
 *   or: bun run chat
 */

import * as readline from 'node:readline';
import {
  createAI,
  type Message,
  type ModelSelection,
  type ReasoningEffort,
  type InferenceEvent,
  supportsImages,
  supportsReasoning,
  inferProviderFromModelId,
  REASONING_EFFORTS,
} from '../src/index.js';

// ANSI escape codes for clean terminal output
const ANSI = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  italic: '\x1b[3m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
  gray: '\x1b[90m',
};

async function main() {
  const ai = createAI();

  // Try auto-resolving default model based on available environment variables
  let currentSelection: ModelSelection;
  try {
    currentSelection = await ai.resolveModel();
  } catch {
    currentSelection = {
      provider: 'anthropic',
      modelId: 'claude-3-5-sonnet-20241022',
      effort: 'medium',
    };
  }

  const messages: Message[] = [];

  console.log(`${ANSI.bold}${ANSI.cyan}─── @steward/ai Interactive Chat ───${ANSI.reset}`);
  console.log(`${ANSI.dim}Type ${ANSI.bold}.help${ANSI.reset}${ANSI.dim} to see available commands or type a message to chat.${ANSI.reset}\n`);

  // Show auth status of providers
  const providers = ai.providers();
  const configuredProviders: string[] = [];
  for (const p of providers) {
    const isConfig = await ai.isConfigured(p.id);
    if (isConfig) configuredProviders.push(p.id);
  }

  if (configuredProviders.length === 0) {
    console.log(
      `${ANSI.yellow}⚠️  No API keys detected in environment.${ANSI.reset}\n` +
      `   Set one of: ${ANSI.bold}ANTHROPIC_API_KEY, OPENAI_API_KEY, OPENROUTER_API_KEY, GEMINI_API_KEY${ANSI.reset}\n`
    );
  } else {
    console.log(`${ANSI.dim}Active providers:${ANSI.reset} ${configuredProviders.map(p => `${ANSI.green}${p}${ANSI.reset}`).join(', ')}`);
  }

  console.log(
    `${ANSI.dim}Current model:${ANSI.reset} ${ANSI.bold}${currentSelection.provider}:${currentSelection.modelId}${ANSI.reset} ${ANSI.dim}(effort: ${currentSelection.effort})${ANSI.reset}\n`
  );

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  });

  const promptUser = () => {
    const promptStr = `${ANSI.magenta}${currentSelection.provider}${ANSI.reset}:${ANSI.cyan}${currentSelection.modelId}${ANSI.reset} > `;
    rl.question(promptStr, async (input) => {
      const line = input.trim();

      if (!line) {
        promptUser();
        return;
      }

      // Handle dot commands
      if (line.startsWith('.')) {
        const [cmd, ...args] = line.split(/\s+/);
        const handled = await handleCommand(cmd.toLowerCase(), args, {
          ai,
          currentSelection,
          setSelection: (s) => { currentSelection = s; },
          messages,
          clearMessages: () => { messages.length = 0; },
          rl,
        });

        if (handled === 'exit') {
          rl.close();
          return;
        }

        promptUser();
        return;
      }

      // Add user message to session history
      messages.push({
        role: 'user',
        content: [{ type: 'text', text: line }],
      });

      // Stream assistant response
      try {
        process.stdout.write(`\n${ANSI.bold}Assistant:${ANSI.reset}\n`);
        let inThinking = false;

        const stream = ai.stream({
          model: currentSelection,
          effort: currentSelection.effort,
          messages,
        });

        for await (const event of stream) {
          switch (event.type) {
            case 'reasoning-delta': {
              if (!inThinking) {
                process.stdout.write(`${ANSI.gray}${ANSI.italic}Thinking: `);
                inThinking = true;
              }
              process.stdout.write(event.delta);
              break;
            }
            case 'text-delta': {
              if (inThinking) {
                process.stdout.write(`${ANSI.reset}\n\n`);
                inThinking = false;
              }
              process.stdout.write(event.delta);
              break;
            }
            case 'error': {
              if (inThinking) {
                process.stdout.write(`${ANSI.reset}\n`);
                inThinking = false;
              }
              console.error(`\n${ANSI.red}Error [${event.error.code}]: ${event.error.message}${ANSI.reset}`);
              break;
            }
            case 'done': {
              if (inThinking) {
                process.stdout.write(`${ANSI.reset}\n`);
                inThinking = false;
              }
              messages.push(event.message);
              const u = event.usage;
              const inTok = u.input ?? 0;
              const outTok = u.output ?? 0;
              const totalTok = u.total ?? (inTok + outTok);
              const costStr = event.message.meta?.cost?.total !== undefined
                ? ` • $${event.message.meta.cost.total.toFixed(5)}`
                : '';
              console.log(
                `\n${ANSI.dim}─── tokens: ${inTok} in / ${outTok} out / ${totalTok} total${costStr} (${event.finishReason}) ───${ANSI.reset}\n`
              );
              break;
            }
          }
        }
      } catch (err: any) {
        console.error(`\n${ANSI.red}Execution error: ${err?.message ?? err}${ANSI.reset}\n`);
      }

      promptUser();
    });
  };

  promptUser();
}

interface CommandContext {
  ai: ReturnType<typeof createAI>;
  currentSelection: ModelSelection;
  setSelection: (s: ModelSelection) => void;
  messages: Message[];
  clearMessages: () => void;
  rl: readline.Interface;
}

async function handleCommand(
  cmd: string,
  args: string[],
  ctx: CommandContext
): Promise<'continue' | 'exit'> {
  const { ai, currentSelection, setSelection, messages, clearMessages } = ctx;

  switch (cmd) {
    case '.exit':
    case '.quit': {
      console.log(`${ANSI.dim}Goodbye!${ANSI.reset}`);
      return 'exit';
    }

    case '.help': {
      console.log(`\n${ANSI.bold}Available Commands:${ANSI.reset}`);
      console.log(`  ${ANSI.cyan}.list [provider]${ANSI.reset}     List models for configured providers (or specified provider)`);
      console.log(`  ${ANSI.cyan}.providers${ANSI.reset}           List all providers and configuration / API key status`);
      console.log(`  ${ANSI.cyan}.model <name>${ANSI.reset}        Switch model (e.g. .model openai:gpt-4o or .model claude-3-5-sonnet-20241022)`);
      console.log(`  ${ANSI.cyan}.effort <level>${ANSI.reset}      Set reasoning effort (none | low | medium | high | max)`);
      console.log(`  ${ANSI.cyan}.clear${ANSI.reset}               Clear current in-memory conversation history`);
      console.log(`  ${ANSI.cyan}.history${ANSI.reset}             Show conversation turn count and message overview`);
      console.log(`  ${ANSI.cyan}.help${ANSI.reset}                Show this help message`);
      console.log(`  ${ANSI.cyan}.exit / .quit${ANSI.reset}        Exit the chat session\n`);
      return 'continue';
    }

    case '.clear':
    case '.reset': {
      clearMessages();
      console.log(`${ANSI.green}✓ Conversation history cleared.${ANSI.reset}\n`);
      return 'continue';
    }

    case '.history': {
      console.log(`\n${ANSI.bold}Session History (${messages.length} messages):${ANSI.reset}`);
      messages.forEach((m, idx) => {
        const preview = typeof m.content === 'string'
          ? m.content.slice(0, 60)
          : Array.isArray(m.content)
            ? m.content.map(c => c.type === 'text' ? c.text : `[${c.type}]`).join(' ').slice(0, 60)
            : '';
        console.log(`  ${idx + 1}. [${ANSI.cyan}${m.role}${ANSI.reset}] ${preview}...`);
      });
      console.log('');
      return 'continue';
    }

    case '.providers': {
      console.log(`\n${ANSI.bold}Providers & Auth Status:${ANSI.reset}`);
      for (const p of ai.providers()) {
        const isConfig = await ai.isConfigured(p.id);
        const status = await ai.authStatus(p.id);
        const check = isConfig ? `${ANSI.green}✓ Configured${ANSI.reset}` : `${ANSI.yellow}✗ Missing Key${ANSI.reset}`;
        const envs = status.envVars.join(', ');
        console.log(`  • ${ANSI.bold}${p.id.padEnd(16)}${ANSI.reset} ${check} ${ANSI.dim}(env: ${envs})${ANSI.reset}`);
      }
      console.log('');
      return 'continue';
    }

    case '.list':
    case '.models': {
      const targetProvider = args[0]?.trim();
      let models = targetProvider
        ? ai.models(targetProvider as any)
        : await ai.availableModels();

      if (models.length === 0) {
        if (targetProvider) {
          console.log(`${ANSI.yellow}No models found for provider: ${targetProvider}${ANSI.reset}\n`);
        } else {
          console.log(
            `${ANSI.yellow}No configured providers found. Showing all known catalog models instead:${ANSI.reset}\n`
          );
          models = ai.models();
        }
      }

      console.log(`\n${ANSI.bold}Available Models (${models.length}):${ANSI.reset}`);
      console.log(
        `  ${ANSI.dim}${'PROVIDER'.padEnd(14)} ${'MODEL ID'.padEnd(36)} ${'MAX OUT'.padEnd(10)} ${'VISION'.padEnd(8)} ${'THINKING'}${ANSI.reset}`
      );
      console.log(`  ${'─'.repeat(80)}`);

      for (const m of models.slice(0, 100)) {
        const isCurrent = m.provider === currentSelection.provider && m.id === currentSelection.modelId;
        const marker = isCurrent ? `${ANSI.green}* ${ANSI.reset}` : '  ';
        const provStr = m.provider.padEnd(12);
        const idStr = m.id.padEnd(36);
        const maxOut = `${m.maxOutputTokens || '-'}`.padEnd(10);
        const vision = supportsImages(m) ? `${ANSI.cyan}yes${ANSI.reset}    ` : `${ANSI.dim}no${ANSI.reset}     `;
        const thinking = supportsReasoning(m) ? `${ANSI.magenta}yes${ANSI.reset}` : `${ANSI.dim}no${ANSI.reset}`;

        console.log(`${marker}${provStr} ${idStr} ${maxOut} ${vision} ${thinking}`);
      }

      if (models.length > 100) {
        console.log(`  ${ANSI.dim}... and ${models.length - 100} more models. Filter by provider with .list <provider>${ANSI.reset}`);
      }
      console.log('');
      return 'continue';
    }

    case '.model': {
      const modelArg = args[0]?.trim();
      if (!modelArg) {
        console.log(`\n${ANSI.bold}Current Model:${ANSI.reset} ${currentSelection.provider}:${currentSelection.modelId} (effort: ${currentSelection.effort})\n`);
        return 'continue';
      }

      // 1. Direct match by exact model ID in catalog
      const exactMatch = ai.models().find(
        m => m.id === modelArg || m.id.toLowerCase() === modelArg.toLowerCase()
      );
      if (exactMatch) {
        setSelection({
          provider: exactMatch.provider,
          modelId: exactMatch.id,
          effort: currentSelection.effort,
        });
        console.log(`${ANSI.green}✓ Switched model to:${ANSI.reset} ${exactMatch.provider}:${exactMatch.id}\n`);
        return 'continue';
      }

      // 2. Explicit provider:modelId syntax (e.g. openrouter:openrouter/free or openai:gpt-4o)
      if (modelArg.includes(':')) {
        const [prov, ...rest] = modelArg.split(':');
        const candidateModelId = rest.join(':');
        if (ai.provider(prov as any)) {
          setSelection({
            provider: prov as any,
            modelId: candidateModelId,
            effort: currentSelection.effort,
          });
          console.log(`${ANSI.green}✓ Switched model to:${ANSI.reset} ${prov}:${candidateModelId}\n`);
          return 'continue';
        }
      }

      // 3. Fallback: infer provider or retain current provider
      const inferred = inferProviderFromModelId(modelArg);
      const targetProvider = inferred ?? currentSelection.provider;
      const targetModelId = modelArg;

      setSelection({
        provider: targetProvider,
        modelId: targetModelId,
        effort: currentSelection.effort,
      });

      console.log(`${ANSI.green}✓ Switched model to:${ANSI.reset} ${targetProvider}:${targetModelId}\n`);
      return 'continue';
    }

    case '.effort': {
      const effortArg = args[0]?.trim().toLowerCase() as ReasoningEffort;
      if (!effortArg || !REASONING_EFFORTS.includes(effortArg)) {
        console.log(`\n${ANSI.yellow}Valid reasoning effort levels:${ANSI.reset} ${REASONING_EFFORTS.join(', ')}\n`);
        return 'continue';
      }

      setSelection({
        ...currentSelection,
        effort: effortArg,
      });

      console.log(`${ANSI.green}✓ Set reasoning effort to:${ANSI.reset} ${effortArg}\n`);
      return 'continue';
    }

    default: {
      console.log(`${ANSI.yellow}Unknown command: ${cmd}. Type .help for available commands.${ANSI.reset}\n`);
      return 'continue';
    }
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
