/**
 * try.ts - Simple stdin/stdout interactive in-memory session chat for @steward/ai.
 * Supports Google, OpenRouter, and other providers with browser OAuth, API key login,
 * model listing, and multi-turn chat.
 *
 * Usage:
 *   bun run try.ts
 */

import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { exec } from 'node:child_process';
import {
  createAI,
  builtinProviders,
  InMemoryCredentialStore,
  type Message,
  type Model,
  type ReasoningEffort,
  type ProviderId,
  type AI,
  type AuthInteraction,
  type AuthPrompt,
  type AuthEvent,
} from './src/packages/ai/src/index.js';

interface SessionState {
  id: string;
  createdAt: number;
  providerId: ProviderId;
  model: Model;
  effort: ReasoningEffort;
  messages: Message[];
  totalInputTokens: number;
  totalOutputTokens: number;
}

let lastListedModels: Model[] = [];

function openBrowser(url: string) {
  const platform = process.platform;
  try {
    if (platform === 'darwin') {
      exec(`open "${url}"`);
    } else if (platform === 'win32') {
      exec(`start "" "${url}"`);
    } else {
      exec(`xdg-open "${url}" 2>/dev/null || sensible-browser "${url}" 2>/dev/null || x-www-browser "${url}" 2>/dev/null`);
    }
  } catch {}
}

async function main() {
  const rl = readline.createInterface({ input, output });

  // 1. Initialize In-Memory Credential Store
  const credentialStore = new InMemoryCredentialStore();

  // Pre-load existing env keys if available
  if (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) {
    await credentialStore.modify('google', async () => ({
      type: 'api-key',
      key: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY!,
    }));
  }

  if (process.env.OPENROUTER_API_KEY) {
    await credentialStore.modify('openrouter', async () => ({
      type: 'api-key',
      key: process.env.OPENROUTER_API_KEY!,
    }));
  }

  // 2. Initialize AI engine
  const ai = createAI({
    providers: builtinProviders(),
    credentialStore,
  });

  // Default provider
  const initialProvider: ProviderId = process.env.OPENROUTER_API_KEY ? 'openrouter' : 'google';

  const session: SessionState = {
    id: `sess_${Date.now()}`,
    createdAt: Date.now(),
    providerId: initialProvider,
    model: initialProvider === 'openrouter'
      ? {
          id: 'anthropic/claude-3.7-sonnet',
          name: 'Claude 3.7 Sonnet (OpenRouter)',
          provider: 'openrouter',
          protocol: 'openai-completions',
          baseUrl: 'https://openrouter.ai/api/v1',
          contextWindow: 200000,
          maxOutputTokens: 8192,
          reasoning: true,
        }
      : {
          id: 'gemini-2.5-flash',
          name: 'Gemini 2.5 Flash',
          provider: 'google',
          protocol: 'google-generative-ai',
          baseUrl: 'https://generativelanguage.googleapis.com',
          contextWindow: 1048576,
          maxOutputTokens: 8192,
          reasoning: true,
        },
    effort: 'low',
    messages: [
      {
        role: 'system',
        content: 'You are Steward, a concise and brilliant engineering assistant.',
      },
    ],
    totalInputTokens: 0,
    totalOutputTokens: 0,
  };

  printWelcome(session);

  try {
    while (true) {
      let line: string;
      try {
        line = await rl.question('\nYou > ');
      } catch {
        break; // EOF
      }

      const prompt = line.trim();
      if (!prompt) continue;

      // Handle Slash Commands
      if (prompt.startsWith('/')) {
        const [cmd, ...args] = prompt.split(' ');
        const result = await handleCommand(cmd.toLowerCase(), args, session, ai, rl);
        if (result === 'exit') break;
        continue;
      }

      if (prompt.toLowerCase() === 'exit' || prompt.toLowerCase() === 'quit') {
        console.log(`\nSession finished. Total tokens used: ${session.totalInputTokens + session.totalOutputTokens}`);
        break;
      }

      // Add user message
      session.messages.push({
        role: 'user',
        content: prompt,
      });

      process.stdout.write(`\n${session.model.name || session.model.id} > `);

      const stream = ai.stream({
        model: session.model,
        messages: session.messages,
        effort: session.effort,
      });

      let inReasoning = false;

      for await (const event of stream) {
        if (event.type === 'reasoning-delta') {
          if (!inReasoning) {
            process.stdout.write('[Thinking: ');
            inReasoning = true;
          }
          process.stdout.write(event.delta);
        } else if (event.type === 'text-delta') {
          if (inReasoning) {
            process.stdout.write(']\n\n');
            inReasoning = false;
          }
          process.stdout.write(event.delta);
        } else if (event.type === 'error') {
          console.error(`\n[Stream Error: ${event.error.message}]`);
        }
      }

      if (inReasoning) {
        process.stdout.write(']\n');
      } else {
        process.stdout.write('\n');
      }

      const result = await stream.result();

      if (result.error) {
        console.error(`[Error: ${result.error.message}]`);
      } else {
        session.messages.push(result.message);

        const inTok = result.usage?.input ?? 0;
        const outTok = result.usage?.output ?? 0;
        session.totalInputTokens += inTok;
        session.totalOutputTokens += outTok;

        console.log(`(tokens: ${inTok} in / ${outTok} out — session: ${session.totalInputTokens + session.totalOutputTokens})`);
      }
    }
  } finally {
    rl.close();
  }
}

function printWelcome(session: SessionState) {
  console.log('=== @steward/ai Interactive Session ===');
  console.log(`Current Provider : ${session.providerId}`);
  console.log(`Active Model     : ${session.model.id}`);
  console.log(`Reasoning Effort : ${session.effort}`);
  console.log('Commands:');
  console.log('  /login <provider>           - Authenticate (OAuth opens browser automatically)');
  console.log('  /list [provider|search]    - List models (e.g. /list openrouter, /list google, /list claude)');
  console.log('  /model <id|#|search>        - Switch active model');
  console.log('  /effort <none|low|med|high> - Change reasoning effort');
  console.log('  /history                    - View conversation turn history');
  console.log('  /clear                      - Reset conversation history');
  console.log('  /exit                       - Quit');
  console.log('=======================================');
}

async function handleCommand(
  cmd: string,
  args: string[],
  session: SessionState,
  ai: AI,
  rl: readline.Interface,
): Promise<string | void> {
  switch (cmd) {
    case '/login': {
      const providerArg = (args[0] || session.providerId).toLowerCase() as ProviderId;
      console.log(`\nLogging in to: ${providerArg}`);

      const interaction: AuthInteraction = {
        async prompt(req: AuthPrompt): Promise<string> {
          if (req.type === 'manual-code' || req.type === 'url') {
            // Browser OAuth is active; wait for callback server completion or signal abort
            return new Promise((resolve) => {
              if (req.signal?.aborted) return resolve('');
              req.signal?.addEventListener('abort', () => resolve(''), { once: true });
            });
          }
          // Direct secret / text prompts (e.g. entering API key)
          return (await rl.question(`${req.message} `)).trim();
        },
        notify(event: AuthEvent) {
          if (event.type === 'auth-url') {
            console.log(`\nOpening browser for authorization...`);
            console.log(`If your browser does not open automatically, visit:\n  ${event.url}\n`);
            openBrowser(event.url);
          } else if (event.type === 'browser-opened') {
            console.log(`[Browser opened for authorization]`);
          } else if (event.type === 'code-received') {
            console.log(`[Authorization code received! Finalizing token...]`);
          } else if (event.type === 'progress') {
            console.log(`[${event.message}]`);
          } else if (event.type === 'slow-down') {
            console.log(`[Rate limit: slowing down polling...]`);
          }
        },
      };

      try {
        let cred;
        if (providerArg === 'openrouter') {
          const methodChoice = (args[1] || '').toLowerCase();
          if (methodChoice === 'key' || methodChoice === 'api-key') {
            cred = await ai.login('openrouter', 'api-key', interaction);
          } else if (methodChoice === 'oauth') {
            cred = await ai.login('openrouter', 'oauth', interaction);
          } else {
            console.log(`Choose login method for OpenRouter:`);
            console.log(`  (1) OAuth (browser login) [Recommended]`);
            console.log(`  (2) API Key`);
            const choice = (await rl.question('Enter 1 or 2 [default 1]: ')).trim();
            if (choice === '2') {
              cred = await ai.login('openrouter', 'api-key', interaction);
            } else {
              cred = await ai.login('openrouter', 'oauth', interaction);
            }
          }
        } else {
          // Google, Anthropic, OpenAI, etc. use direct API key
          cred = await ai.login(providerArg, 'api-key', interaction);
        }

        console.log(`✔ Successfully authenticated with ${providerArg}! (${cred.type})`);
        session.providerId = providerArg;
        if (providerArg === 'openrouter') {
          session.model = {
            id: 'anthropic/claude-3.7-sonnet',
            name: 'Claude 3.7 Sonnet (OpenRouter)',
            provider: 'openrouter',
            protocol: 'openai-completions',
            baseUrl: 'https://openrouter.ai/api/v1',
            contextWindow: 200000,
            maxOutputTokens: 8192,
            reasoning: true,
          };
        } else if (providerArg === 'google') {
          session.model = {
            id: 'gemini-2.5-flash',
            name: 'Gemini 2.5 Flash',
            provider: 'google',
            protocol: 'google-generative-ai',
            baseUrl: 'https://generativelanguage.googleapis.com',
            contextWindow: 1048576,
            maxOutputTokens: 8192,
            reasoning: true,
          };
        }
        console.log(`Active provider set to: ${session.providerId} (model: ${session.model.id})`);
      } catch (err: any) {
        console.error(`❌ Login failed: ${err.message}`);
      }
      return;
    }

    case '/list':
    case '/models': {
      const query = (args[0] || '').trim().toLowerCase();
      let targetProvider: ProviderId | undefined;

      if (['google', 'openrouter', 'anthropic', 'openai', 'github-copilot'].includes(query)) {
        targetProvider = query as ProviderId;
      } else if (!query) {
        targetProvider = session.providerId;
      }

      console.log(`\nFetching models${targetProvider ? ` for ${targetProvider}` : ''}...`);

      let models: readonly Model[] = [];
      try {
        models = await ai.availableModels(targetProvider);
      } catch (err: any) {
        console.error(`Failed to fetch models: ${err.message}`);
      }

      if (models.length === 0) {
        console.log(`No models returned. Use '/login ${targetProvider || session.providerId}' if credentials are needed.`);
        return;
      }

      // Filter by search string if query wasn't a provider
      let displayed = [...models];
      if (query && query !== targetProvider) {
        displayed = displayed.filter(
          (m) => m.id.toLowerCase().includes(query) || m.name.toLowerCase().includes(query),
        );
      }

      lastListedModels = displayed;

      console.log(`\nFound ${displayed.length} model(s):`);
      for (const [idx, m] of displayed.entries()) {
        const num = String(idx + 1).padStart(3, ' ');
        const isActive = m.id === session.model.id && m.provider === session.model.provider ? ' *[ACTIVE]' : '';
        const reasoning = m.reasoning ? ' [reasoning]' : '';
        const ctx = m.contextWindow ? ` (${Math.round(m.contextWindow / 1024)}k ctx)` : '';
        console.log(`  ${num}. [${m.provider}] ${m.id}${reasoning}${ctx}${isActive}`);
      }
      console.log(`\nTo switch model: /model <# number> or /model <model-id>`);
      return;
    }

    case '/model': {
      const target = args[0]?.trim();
      if (!target) {
        console.log(`Current model: [${session.model.provider}] ${session.model.id} (${session.model.name})`);
        console.log(`Usage: /model <id | number | search> (e.g. /model 1 or /model anthropic/claude-3.7-sonnet)`);
        return;
      }

      // 1. Check if number index from last /list
      const index = parseInt(target, 10);
      if (!isNaN(index) && index >= 1 && index <= lastListedModels.length) {
        const chosen = lastListedModels[index - 1];
        session.model = chosen;
        session.providerId = chosen.provider;
        console.log(`✔ Switched model to: [${chosen.provider}] ${chosen.name || chosen.id} (${chosen.id})`);
        return;
      }

      // 2. Search in last listed models
      const found = lastListedModels.find(
        (m) => m.id.toLowerCase() === target.toLowerCase() || m.id.toLowerCase().includes(target.toLowerCase()),
      );
      if (found) {
        session.model = found;
        session.providerId = found.provider;
        console.log(`✔ Switched model to: [${found.provider}] ${found.name || found.id} (${found.id})`);
        return;
      }

      // 3. Direct model setup
      const isGoogle = target.startsWith('gemini-') || target.startsWith('gemma-');
      const provider: ProviderId = isGoogle ? 'google' : (session.providerId === 'google' ? 'google' : 'openrouter');

      session.model = {
        id: target,
        name: target,
        provider,
        protocol: provider === 'google' ? 'google-generative-ai' : 'openai-completions',
        baseUrl: provider === 'google' ? 'https://generativelanguage.googleapis.com' : 'https://openrouter.ai/api/v1',
        contextWindow: 128000,
        maxOutputTokens: 8192,
        reasoning: true,
      };
      session.providerId = provider;
      console.log(`✔ Set active model to: [${provider}] ${target}`);
      return;
    }

    case '/effort': {
      const effort = args[0] as ReasoningEffort;
      if (['none', 'low', 'medium', 'high', 'xhigh'].includes(effort)) {
        session.effort = effort;
        console.log(`✔ Reasoning effort set to: ${effort}`);
      } else {
        console.log(`Usage: /effort <none|low|medium|high|xhigh>`);
      }
      return;
    }

    case '/history': {
      console.log(`\n--- History (${session.messages.length} messages) ---`);
      for (const [i, msg] of session.messages.entries()) {
        let contentStr = '';
        if (typeof msg.content === 'string') {
          contentStr = msg.content;
        } else if (Array.isArray(msg.content)) {
          contentStr = msg.content
            .map((b) => (b.type === 'text' ? b.text : `[${b.type}]`))
            .join(' ');
        }
        console.log(`${i + 1}. [${msg.role.toUpperCase()}]: ${contentStr.slice(0, 80)}...`);
      }
      return;
    }

    case '/clear':
    case '/reset': {
      session.messages = [
        {
          role: 'system',
          content: 'You are Steward, a concise and brilliant engineering assistant.',
        },
      ];
      session.totalInputTokens = 0;
      session.totalOutputTokens = 0;
      console.log(`✔ Session history cleared.`);
      return;
    }

    case '/exit':
    case '/quit': {
      console.log(`\nSession finished. Total tokens used: ${session.totalInputTokens + session.totalOutputTokens}`);
      return 'exit';
    }

    default:
      console.log(`Unknown command: ${cmd}. Type /list, /model, /login, /effort, /history, /clear, or /exit`);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
