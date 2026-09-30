import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import type { Message } from '@steward/ai';
import type { CommandContext, CommandResult, SlashCommand } from '../types.js';

/**
 * Extracts plain text from an assistant message, ignoring thinking blocks and tool calls.
 */
function extractAssistantText(msg: Message): string {
  if (msg.role !== 'assistant') return '';
  if (typeof msg.content === 'string') return msg.content.trim();
  if (!Array.isArray(msg.content)) return '';
  return msg.content
    .filter(
      (b): b is { type: 'text'; text: string } => b?.type === 'text' && typeof b.text === 'string',
    )
    .map((b) => b.text.trim())
    .filter(Boolean)
    .join('\n\n');
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

  return new Promise((resolve) => {
    let resolved = false;
    const finish = (ok: boolean) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timer);
      resolve(ok || sendOSC52());
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
 * /copy slash command: copies the last AI response to the clipboard.
 */
export const copyCommand: SlashCommand = {
  name: 'copy',
  description: 'Copies the last AI response to the clipboard',
  usage: '/copy',

  async execute(_args: string[], context: CommandContext): Promise<CommandResult> {
    if (context.session.isBusy) {
      return { handled: true, message: 'Cannot copy while the agent is generating a response.' };
    }

    const history = context.session.getHistory();
    // Scan backwards for the latest assistant message containing text
    let targetText = '';
    for (let i = history.length - 1; i >= 0; i--) {
      const text = extractAssistantText(history[i]!);
      if (text) {
        targetText = text;
        break;
      }
    }

    if (!targetText) {
      return { handled: true, message: 'No previous AI response found to copy.' };
    }

    await copyToClipboard(targetText);
    return { handled: true, message: 'Copied last AI response to clipboard.' };
  },
};
