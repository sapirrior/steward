import chalk from 'chalk';
import type { ModelMessage } from '@steward/threads';
import { threadStore } from '@steward/threads';
import { AgentRunner } from '../agent/AgentRunner.js';
import { themeManager } from '../themes/themeManager.js';
import { UI_GLYPHS, TOOL_GLYPHS } from '../constants/icons.js';
import { buildSystemPrompt } from '../services/context/systemPrompt.js';
import { FileReadTool } from '../tools/FileReadTool/index.js';
import { GlobTool } from '../tools/GlobTool/index.js';
import { GrepTool } from '../tools/GrepTool/index.js';
import { WebFetchTool } from '../tools/WebFetchTool/index.js';
import { WebSearchTool } from '../tools/WebSearchTool/index.js';
import type { ResolvedCliConfig } from './types.js';

/**
 * Executes a one-shot query in headless mode, streaming output directly to stdout.
 *
 * Safety Invariant:
 * Mutating/shell tools (bash, task_manager) are always disabled in headless mode.
 * Only safe inspection tools (read, glob, grep, webfetch, websearch) are active.
 */
export async function runHeadless(prompt: string, config: ResolvedCliConfig): Promise<void> {
  const colors = themeManager.theme.colors;

  // 1. Assemble safe inspection tools (obeying config.tools toggles)
  const activeTools: any[] = [];
  if (config.tools.read) activeTools.push(new FileReadTool());
  if (config.tools.glob) activeTools.push(new GlobTool());
  if (config.tools.grep) activeTools.push(new GrepTool());
  if (config.tools.websearch) activeTools.push(new WebSearchTool());
  if (config.tools.webfetch) activeTools.push(new WebFetchTool());

  // 2. Prepare user message & in-memory session
  const userMessage: ModelMessage = {
    role: 'user',
    content: prompt.trim(),
  };
  const messages: ModelMessage[] = [userMessage];

  // 3. Create persistent thread document in @steward/threads
  const threadDoc = threadStore.create({
    model: config.modelRef,
    messages,
    cwd: process.cwd(),
  });

  // 4. Build headless system prompt with runtime environment
  const systemPrompt = buildSystemPrompt({
    cwd: process.cwd(),
    isHeadless: true,
  });

  const runner = new AgentRunner();

  // Print prompt header
  const chevron = chalk.hex(colors.accentActive)(UI_GLYPHS.promptChevron);
  const promptDisplay = chalk.hex(colors.text)(`Prompt: "${prompt}"`);
  const meta = chalk.hex(colors.textDim)(
    `· ${config.modelRef.provider}/${config.modelRef.modelId} · effort: ${config.reasoningEffort}`,
  );
  console.log(`${chevron} ${promptDisplay} ${meta}\n`);

  let hasEmittedText = false;

  const stream = runner.runStream(
    {
      modelRef: config.modelRef,
      messages,
      tools: activeTools,
      reasoning: config.reasoningEffort,
      systemPrompt,
    },
    (event) => {
      if (event.type === 'tool-call-start') {
        const glyph = (TOOL_GLYPHS as Record<string, string>)[event.toolName] || '✱';
        console.log(
          `  ${chalk.hex(colors.textMuted)(glyph)} ${chalk.hex(colors.textMuted)(`${event.toolName}: ${event.tagline}`)}`,
        );
      } else if (event.type === 'tool-call-result') {
        const duration = chalk.hex(colors.textDim)(`(${event.durationMs}ms)`);
        if (event.isError) {
          const cross = chalk.hex(colors.error)(UI_GLYPHS.cross);
          console.log(
            `  ${cross} ${chalk.hex(colors.error)(`${event.toolName}: ${event.tagline}`)} ${duration}`,
          );
        } else {
          const check = chalk.hex(colors.textDim)(UI_GLYPHS.check);
          console.log(
            `  ${check} ${chalk.hex(colors.textMuted)(`${event.toolName}: ${event.tagline}`)} ${duration}`,
          );
        }
      } else if (event.type === 'retry') {
        const spinner = chalk.hex(colors.warning)(UI_GLYPHS.runningSpinner);
        console.log(
          `\n  ${spinner} ${chalk.hex(colors.warning)(`[Retry ${event.attempt}/${event.maxRetries}] ${event.error.message} (waiting ${(event.delayMs / 1000).toFixed(1)}s...)`)}`,
        );
      } else if (event.type === 'error') {
        const cross = chalk.hex(colors.error)(UI_GLYPHS.cross);
        console.error(`\n${cross} ${chalk.hex(colors.error)(event.error.message)}\n`);
        process.exitCode = 1;
      }
    },
  );

  for await (const event of stream) {
    if (event.type === 'text-delta') {
      if (!hasEmittedText) {
        hasEmittedText = true;
        // Add a clean spacing line before first markdown response chunk
        process.stdout.write('\n');
      }
      process.stdout.write(event.text);
    }
  }

  const result = await stream.next();
  const finalResult = result.value;

  if (finalResult && finalResult.responseMessages.length > 0) {
    threadDoc.messages.push(...finalResult.responseMessages);
    threadDoc.usage = finalResult.usage;
    try {
      await threadStore.save(threadDoc);
    } catch {
      // Non-fatal if thread save fails
    }
  }

  if (hasEmittedText) {
    process.stdout.write('\n\n');
  }
}
