import chalk from 'chalk';
import type { ModelMessage } from '@steward/threads';
import { threadStore } from '@steward/threads';
import { createStewardSDK } from '@steward/sdk';
import { themeManager } from '../themes/themeManager.js';
import { UI_GLYPHS, TOOL_GLYPHS } from '../constants/icons.js';
import { buildSystemPrompt } from '../services/context/systemPrompt.js';
import { FileReadTool } from '../tools/FileReadTool/index.js';
import { GlobTool } from '../tools/GlobTool/index.js';
import { GrepTool } from '../tools/GrepTool/index.js';
import { WebSearchTool } from '../tools/WebSearchTool/index.js';
import { WebFetchTool } from '../tools/WebFetchTool/index.js';
import { adaptToolsToAiSdk } from '../tools/aiSdkToolAdapter.js';
import { resolveCliCredentials } from '../services/providerCredentials.js';
import type { Tool } from '../tools/Tool.js';
import type { ResolvedCliConfig } from './types.js';

const MAX_STDIN_BYTES = 10 * 1024 * 1024; // 10MB safety cap

/**
 * Safely reads piped input from process.stdin if non-TTY.
 * Handles binary stripping, size capping, and stream lifecycle.
 */
export async function readPipedStdin(
  maxBytes: number = MAX_STDIN_BYTES,
): Promise<string | undefined> {
  if (process.stdin.isTTY || process.stdin.destroyed) {
    return undefined;
  }

  return new Promise<string | undefined>((resolve, reject) => {
    let accumulated = '';
    let totalBytes = 0;
    let exceeded = false;

    process.stdin.setEncoding('utf8');

    const onData = (chunk: string) => {
      if (exceeded) return;
      totalBytes += Buffer.byteLength(chunk, 'utf8');
      if (totalBytes > maxBytes) {
        exceeded = true;
        process.stdin.pause();
        // Take substring up to limit
        accumulated += chunk;
        cleanup();
        resolve(accumulated.replace(/\0/g, '').trim());
        return;
      }
      accumulated += chunk;
    };

    const onEnd = () => {
      cleanup();
      const cleaned = accumulated.replace(/\0/g, '').trim();
      resolve(cleaned.length > 0 ? cleaned : undefined);
    };

    const onError = (err: Error) => {
      cleanup();
      reject(err);
    };

    const cleanup = () => {
      process.stdin.removeListener('data', onData);
      process.stdin.removeListener('end', onEnd);
      process.stdin.removeListener('error', onError);
    };

    process.stdin.on('data', onData);
    process.stdin.once('end', onEnd);
    process.stdin.once('error', onError);

    // If stream is already ended or paused with no data flowing
    if (process.stdin.readableEnded) {
      onEnd();
    } else {
      process.stdin.resume();
    }
  });
}

/**
 * Formats combined user prompt and piped stdin for optimal LLM comprehension.
 */
export function formatEffectivePrompt(
  promptText?: string,
  pipedInput?: string,
): string | undefined {
  const trimmedPrompt = promptText?.trim();
  const trimmedPiped = pipedInput?.trim();

  if (!trimmedPrompt && !trimmedPiped) {
    return undefined;
  }

  if (trimmedPiped && trimmedPrompt) {
    return `<piped_stdin>\n${trimmedPiped}\n</piped_stdin>\n\n${trimmedPrompt}`;
  }

  if (trimmedPiped && !trimmedPrompt) {
    return `Please analyze and respond to the following input:\n\n<piped_stdin>\n${trimmedPiped}\n</piped_stdin>`;
  }

  return trimmedPrompt;
}

/**
 * Executes a one-shot query in headless mode, streaming output directly to stdout.
 *
 * Safety Invariant:
 * Mutating/shell tools (bash, task_manager) are always disabled in headless mode.
 * Only safe inspection tools (read, glob, grep, webfetch, websearch) are active.
 */
export async function runHeadless(prompt: string, config: ResolvedCliConfig): Promise<void> {
  const colors = themeManager.theme.colors;

  // 1. Capture any piped stdin input
  let pipedStdin: string | undefined;
  try {
    pipedStdin = await readPipedStdin();
  } catch (err: any) {
    const cross = chalk.hex(colors.error)(UI_GLYPHS.cross);
    console.error(
      `\n${cross} ${chalk.hex(colors.error)(`Failed to read piped stdin: ${err?.message || err}`)}\n`,
    );
    process.exitCode = 1;
    return;
  }

  // 2. Build the effective prompt with LLM optimization
  const effectivePrompt = formatEffectivePrompt(prompt, pipedStdin);
  if (!effectivePrompt) {
    const cross = chalk.hex(colors.error)(UI_GLYPHS.cross);
    console.error(
      `\n${cross} ${chalk.hex(colors.error)('Error: No prompt or piped input provided.')}\n`,
    );
    process.exitCode = 1;
    return;
  }

  // 3. Assemble safe inspection tools (obeying config.tools toggles, never bash or task-manager)
  const activeTools: Tool<any, any>[] = [];
  if (config.tools.read) activeTools.push(new FileReadTool());
  if (config.tools.glob) activeTools.push(new GlobTool());
  if (config.tools.grep) activeTools.push(new GrepTool());
  if (config.tools.websearch) activeTools.push(new WebSearchTool());
  if (config.tools.webfetch) activeTools.push(new WebFetchTool());

  const adaptedTools = adaptToolsToAiSdk(activeTools, { cwd: process.cwd() });

  // 4. Prepare user message & in-memory session
  const userMessage: ModelMessage = {
    role: 'user',
    content: effectivePrompt,
  };

  // Create persistent thread document in @steward/threads
  const threadDoc = threadStore.create({
    model: config.modelRef,
    messages: [userMessage],
    cwd: process.cwd(),
  });

  // 5. Build headless system prompt with runtime environment
  const instructions = buildSystemPrompt({
    cwd: process.cwd(),
    isHeadless: true,
  });

  // 6. Resolve credentials for provider
  const keyMetadata = await resolveCliCredentials(config.modelRef.provider);

  // Print prompt header
  const chevron = chalk.hex(colors.accentActive)(UI_GLYPHS.promptChevron);
  const promptSummary = prompt.trim() || '[Piped Stdin]';
  const promptDisplay = chalk.hex(colors.text)(`Prompt: "${promptSummary}"`);
  const meta = chalk.hex(colors.textDim)(
    `· ${config.modelRef.provider}/${config.modelRef.modelId} · effort: ${config.reasoningEffort}`,
  );
  console.log(`${chevron} ${promptDisplay} ${meta}\n`);

  const sdk = createStewardSDK();
  const modelIdentifier = `${config.modelRef.provider}/${config.modelRef.modelId}`;
  let hasEmittedText = false;

  const toolStartTimes = new Map<string, number>();

  for await (const event of sdk.stream({
    model: modelIdentifier,
    instructions,
    messages: [], // No prior history in one-shot headless run
    message: effectivePrompt,
    tools: adaptedTools,
    reasoning: config.reasoningEffort,
    keyMetadata,
  })) {
    switch (event.type) {
      case 'tool-call': {
        toolStartTimes.set(event.toolCallId, Date.now());
        const glyph = (TOOL_GLYPHS as Record<string, string>)[event.toolName] || '✱';
        console.log(
          `  ${chalk.hex(colors.textMuted)(glyph)} ${chalk.hex(colors.textMuted)(event.toolName)}`,
        );
        break;
      }

      case 'tool-result': {
        const startTime = toolStartTimes.get(event.toolCallId);
        const durationMs = startTime ? Date.now() - startTime : 0;
        const duration = chalk.hex(colors.textDim)(`(${durationMs}ms)`);
        if (event.isError) {
          const cross = chalk.hex(colors.error)(UI_GLYPHS.cross);
          console.log(`  ${cross} ${chalk.hex(colors.error)(event.toolName)} ${duration}`);
        } else {
          const check = chalk.hex(colors.textDim)(UI_GLYPHS.check);
          console.log(`  ${check} ${chalk.hex(colors.textMuted)(event.toolName)} ${duration}`);
        }
        break;
      }

      case 'retry': {
        const spinner = chalk.hex(colors.warning)(UI_GLYPHS.runningSpinner);
        console.log(
          `\n  ${spinner} ${chalk.hex(colors.warning)(`[Retry ${event.attempt}/${event.maxRetries}] ${event.error.message} (waiting ${(event.elapsedDelayMs / 1000).toFixed(1)}s...)`)}`,
        );
        break;
      }

      case 'text-delta': {
        if (!hasEmittedText) {
          hasEmittedText = true;
          process.stdout.write('\n');
        }
        process.stdout.write(event.text);
        break;
      }

      case 'finish': {
        if (event.responseMessages && event.responseMessages.length > 0) {
          threadDoc.messages.push(...(event.responseMessages as ModelMessage[]));
          threadDoc.usage = {
            inputTokens: event.usage.inputTokens,
            outputTokens: event.usage.outputTokens,
            totalTokens: event.usage.totalTokens,
            reasoningTokens: event.usage.reasoningTokens,
            cacheReadTokens: event.usage.cacheReadTokens,
            cacheWriteTokens: event.usage.cacheWriteTokens,
          };
          try {
            await threadStore.save(threadDoc);
          } catch {
            // Non-fatal if thread save fails
          }
        }
        break;
      }

      case 'error': {
        const cross = chalk.hex(colors.error)(UI_GLYPHS.cross);
        console.error(`\n${cross} ${chalk.hex(colors.error)(event.error.message)}\n`);
        process.exitCode = 1;
        break;
      }

      case 'aborted': {
        const cross = chalk.hex(colors.error)(UI_GLYPHS.cross);
        console.error(`\n${cross} ${chalk.hex(colors.error)('Operation aborted.')}\n`);
        process.exitCode = 1;
        break;
      }
    }
  }

  if (hasEmittedText) {
    process.stdout.write('\n\n');
  }
}
