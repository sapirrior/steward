import { classifyError } from './classifier.js';
import { logError } from './logger.js';

/**
 * Forcefully restores the terminal state to standard mode.
 * Disables raw mode, exits alternate screen buffer, unhides cursor,
 * and resets ANSI color/attribute modes.
 */
export function emergencyRestoreTerminal(): void {
  try {
    if (process.stdin.isTTY && typeof (process.stdin as any).setRawMode === 'function') {
      try {
        (process.stdin as any).setRawMode(false);
      } catch {}
    }

    if (process.stderr.isTTY || process.stdout.isTTY) {
      const resetSeq =
        '\x1b[?2026l' + // Disable synchronized output mode 2026
        '\x1b[?1000l\x1b[?1002l\x1b[?1003l\x1b[?1006l' + // Disable mouse tracking modes
        '\x1b[?1049l' + // Exit alternate screen buffer
        '\x1b[?25h' + // Show cursor
        '\x1b[0m\n'; // Reset text formatting

      try {
        process.stderr.write(resetSeq);
      } catch {
        try {
          process.stdout.write(resetSeq);
        } catch {}
      }
    }
  } catch {
    // Terminal restoration failure should never throw
  }
}

/**
 * Installs production-grade global process error handlers for uncaught exceptions
 * and unhandled promise rejections.
 */
export function setupGlobalErrorHandlers(): void {
  // Prevent duplicate registration
  if ((globalThis as any).__STEWARD_GLOBAL_HANDLERS_INSTALLED__) {
    return;
  }
  (globalThis as any).__STEWARD_GLOBAL_HANDLERS_INSTALLED__ = true;

  process.on('uncaughtException', (error: Error) => {
    const logPath = logError(error, { source: 'uncaughtException', fatal: true });
    emergencyRestoreTerminal();

    const classified = classifyError(error);

    process.stderr.write(
      `\n\x1b[31m✖ Fatal error in Steward:\x1b[0m ${classified.shortMessage}\n`,
    );

    if (classified.suggestedAction) {
      process.stderr.write(`\x1b[36mℹ ${classified.suggestedAction}\x1b[0m\n`);
    }

    if (error.stack) {
      process.stderr.write(`\n\x1b[90mTechnical details:\n${error.stack}\x1b[0m\n`);
    }

    if (logPath) {
      process.stderr.write(`\x1b[33mℹ Detailed diagnostics saved to: ${logPath}\x1b[0m\n\n`);
    }

    process.exit(1);
  });

  process.on('unhandledRejection', (reason: unknown) => {
    const logPath = logError(reason, { source: 'unhandledRejection', fatal: true });
    emergencyRestoreTerminal();

    const classified = classifyError(reason);

    process.stderr.write(
      `\n\x1b[31m✖ Unhandled asynchronous rejection:\x1b[0m ${classified.shortMessage}\n`,
    );

    if (classified.suggestedAction) {
      process.stderr.write(`\x1b[36mℹ ${classified.suggestedAction}\x1b[0m\n`);
    }

    if (reason instanceof Error && reason.stack) {
      process.stderr.write(`\n\x1b[90mTechnical details:\n${reason.stack}\x1b[0m\n`);
    }

    if (logPath) {
      process.stderr.write(`\x1b[33mℹ Detailed diagnostics saved to: ${logPath}\x1b[0m\n\n`);
    }

    process.exit(1);
  });
}
