import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import type { SessionDocument } from '@steward/services/session/types.js';
import type { CommandContext, CommandResult, SlashCommand } from '../types.js';

/**
 * Strips terminal ANSI escape sequences.
 */
function stripAnsi(str: string): string {
  return str.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
}

/**
 * Copies text to the OS clipboard across platforms with timeout and OSC 52 terminal fallback.
 */
async function copyToClipboard(text: string): Promise<boolean> {
  const isTermux = Boolean(
    process.env.TERMUX_VERSION ||
    existsSync('/data/data/com.termux/files/usr/bin/termux-clipboard-set'),
  );
  const [cmd, ...args] = isTermux
    ? ['termux-clipboard-set']
    : process.platform === 'darwin'
      ? ['pbcopy']
      : process.platform === 'win32'
        ? ['clip.exe']
        : process.env.WAYLAND_DISPLAY
          ? ['wl-copy']
          : ['xclip', '-selection', 'clipboard'];

  const sendOSC52 = () => {
    try {
      process.stdout.write(`\x1b]52;c;${Buffer.from(text, 'utf8').toString('base64')}\x07`);
      return true;
    } catch {
      return false;
    }
  };

  return new Promise((resolvePromise) => {
    let resolved = false;
    const finish = (ok: boolean) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timer);
      resolvePromise(ok || sendOSC52());
    };

    const timer = setTimeout(() => finish(false), 1200);

    try {
      const proc = spawn(cmd, args, { stdio: ['pipe', 'ignore', 'ignore'] });
      proc.on('error', () => finish(false));
      proc.on('close', (code) => finish(code === 0));
      proc.stdin?.on('error', () => finish(false));
      proc.stdin?.end(text);
    } catch {
      finish(false);
    }
  });
}

/**
 * Summarizes tool arguments into a clean single-line preview.
 */
function formatToolArgs(args: Record<string, any>): string {
  if (!args || typeof args !== 'object') return '';
  if (args.command) return String(args.command);
  if (args.path || args.filePath || args.targetFile) {
    return String(args.path || args.filePath || args.targetFile);
  }
  if (args.pattern) return String(args.pattern);
  if (args.url) return String(args.url);
  if (args.query) return String(args.query);
  const firstVal = Object.values(args)[0];
  if (typeof firstVal === 'string') return firstVal;
  return '';
}

/**
 * Summarizes tool output into clean lines with "└" prefix.
 */
function formatToolOutput(output: any): string[] {
  if (output === undefined || output === null) return [];
  let text = '';
  if (typeof output === 'string') {
    text = output;
  } else if (typeof output === 'object') {
    text = output.message || output.output || JSON.stringify(output);
  } else {
    text = String(output);
  }

  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];
  const preview = lines.slice(0, 5);
  return preview.map((l, idx) => (idx === 0 ? `  └ ${l}` : `    ${l}`));
}

/**
 * Fallback generator that reconstructs 1:1 UI text lines from session data if live buffer is unavailable.
 */
export function generateTranscriptFromSession(sessionData: SessionDocument): string {
  const lines: string[] = [];
  const turns = sessionData.turns ?? [];

  for (let turnIdx = 0; turnIdx < turns.length; turnIdx++) {
    const turn = turns[turnIdx]!;
    if (turnIdx > 0) {
      lines.push(``);
    }

    const messages = turn.messages ?? [];

    for (const msg of messages) {
      if (msg.role === 'user') {
        const text =
          typeof msg.content === 'string'
            ? msg.content
            : Array.isArray(msg.content)
              ? msg.content.map((c: any) => c.text || '').join('\n')
              : '';
        lines.push(`❯ ${text}`);
        lines.push(``);
      } else if (msg.role === 'assistant') {
        if (Array.isArray(msg.content)) {
          for (const block of msg.content) {
            if (block.type === 'thinking' && block.thinking) {
              lines.push(`  Thought for ${Math.max(1, Math.round(block.thinking.length / 500))}s`);
              lines.push(``);
            } else if (block.type === 'tool-call') {
              const argPreview = formatToolArgs(block.arguments);
              lines.push(`● ${block.name}${argPreview ? `(${argPreview})` : '()'}`);
            } else if (block.type === 'text' && block.text) {
              const textLines = block.text.trim().split(/\r?\n/);
              for (let i = 0; i < textLines.length; i++) {
                lines.push(i === 0 ? `● ${textLines[i]}` : `  ${textLines[i]}`);
              }
              lines.push(``);
            }
          }
        } else if (typeof msg.content === 'string' && msg.content.trim()) {
          const textLines = msg.content.trim().split(/\r?\n/);
          for (let i = 0; i < textLines.length; i++) {
            lines.push(i === 0 ? `● ${textLines[i]}` : `  ${textLines[i]}`);
          }
          lines.push(``);
        }
      } else if (msg.role === 'tool') {
        if (Array.isArray(msg.content)) {
          for (const toolRes of msg.content) {
            const formatted = formatToolOutput(toolRes.output);
            for (const l of formatted) {
              lines.push(l);
            }
          }
          lines.push(``);
        }
      }
    }

    if (turn.timestamp) {
      const timeStr = new Date(turn.timestamp).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });
      lines.push(`✻ Done · ${timeStr}`);
    }
  }

  return lines.join('\n').trim() + '\n';
}

/**
 * /export slash command: exports the exact 1:1 UI text transcript to clipboard or a file.
 */
export const exportCommand: SlashCommand = {
  name: 'export',
  description: 'Exports the exact 1:1 UI conversation text to the clipboard or a file',
  usage: '/export [filename]',

  async execute(args: string[], context: CommandContext): Promise<CommandResult> {
    if (context.session.isBusy) {
      return { handled: true, message: 'Cannot export while the agent is generating a response.' };
    }

    let transcript = '';

    // 1. Grab exact 1:1 text lines directly from the TUI history screen buffer if available
    if (typeof context.getScreenLines === 'function') {
      const screenLines = context.getScreenLines();
      if (screenLines && screenLines.length > 0) {
        transcript = screenLines.map(stripAnsi).join('\n').trim() + '\n';
      }
    }

    // 2. Fallback to session turn history if live buffer is not attached
    if (!transcript.trim()) {
      const sessionData = context.session.session;
      transcript = generateTranscriptFromSession(sessionData);
    }

    if (!transcript.trim()) {
      return { handled: true, message: 'No conversation messages found to export.' };
    }

    const targetArg = args.join(' ').trim();

    // 3. If no filename provided: copy full 1:1 UI transcript to clipboard
    if (!targetArg) {
      await copyToClipboard(transcript);
      return {
        handled: true,
        message: 'Copied conversation transcript to clipboard.',
      };
    }

    // 4. If filename provided: save 1:1 UI transcript to file
    try {
      const cwd = context.cwd || process.cwd();
      const filePath = isAbsolute(targetArg) ? targetArg : resolve(cwd, targetArg);
      const targetPath =
        filePath.endsWith('.txt') || filePath.endsWith('.md') ? filePath : `${filePath}.txt`;

      mkdirSync(dirname(targetPath), { recursive: true });
      writeFileSync(targetPath, transcript, 'utf-8');

      return {
        handled: true,
        message: `Conversation transcript exported to ${targetPath}`,
      };
    } catch (err) {
      return {
        handled: true,
        message: `Failed to export transcript: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  },
};
