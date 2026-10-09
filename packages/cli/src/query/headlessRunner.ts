import chalk from 'chalk';
import { themeManager } from '../themes/themeManager.js';
import { QueryEngine } from './QueryEngine.js';
import type { QueryTurnResult, QueryEngineConfig } from './types.js';

export interface HeadlessRunnerOptions extends Omit<QueryEngineConfig, 'isHeadless'> {
  stdout?: NodeJS.WriteStream;
  stderr?: NodeJS.WriteStream;
}

/**
 * Formats an error into a clean string styled with the active theme's error color.
 * No hardcoded ANSI codes or extraneous hints.
 */
export function formatHeadlessError(err: unknown): string {
  const rawMsg = err instanceof Error ? err.message : String(err);
  const cleanMsg = rawMsg.replace(/^Error:\s*/i, '');
  const errorColor = themeManager.theme.colors.error;
  return chalk.hex(errorColor)(`Error: ${cleanMsg}`);
}

/**
 * Executes a prompt non-interactively in headless mode.
 * - Streams output directly to stdout.
 * - Strictly excludes the 'bash' tool.
 * - Injects headless system prompt instructions for structured markdown output.
 * - Formats all errors cleanly using active theme colors to stderr.
 */
export async function runHeadlessPrompt(
  prompt: string,
  options: HeadlessRunnerOptions = {},
): Promise<QueryTurnResult> {
  const stdout = options.stdout ?? process.stdout;
  const stderr = options.stderr ?? process.stderr;

  const engine = new QueryEngine({
    ...options,
    isHeadless: true,
  });

  let hasPrintedError = false;
  const printError = (err: unknown) => {
    if (hasPrintedError) return;
    hasPrintedError = true;
    stderr.write(`\n${formatHeadlessError(err)}\n`);
  };

  let result: QueryTurnResult;
  try {
    result = await engine.submitMessage(prompt, (event) => {
      switch (event.type) {
        case 'text-delta':
          stdout.write(event.delta);
          break;

        case 'tool-call-start': {
          const badge = event.badge ?? event.name;
          const dimColor = themeManager.theme.colors.textDim;
          stdout.write(`\n${chalk.hex(dimColor)(`${event.glyph} ${badge}`)}\n`);
          break;
        }

        case 'error':
          printError(event.error);
          break;
      }
    });
  } catch (err) {
    printError(err);
    process.exitCode = 1;
    throw err;
  }

  // Ensure trailing newline
  stdout.write('\n');

  if (result.stopReason === 'error') {
    process.exitCode = 1;
    if (result.error) {
      printError(result.error);
    }
  }

  return result;
}
