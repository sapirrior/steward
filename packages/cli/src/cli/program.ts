import { Command } from 'commander';
import chalk from 'chalk';
import type { RawCliFlags, ResolvedCliConfig } from './types.js';
import type { StewardSettings } from '../settings/settingsTypes.js';
import { settingsStore } from '../settings/settingsStore.js';
import { themeManager } from '../themes/themeManager.js';
import { UI_GLYPHS, STEWARD_UNICODE_LOGO } from '../constants/icons.js';
import {
  handleLoginOption,
  handleLogoutOption,
  handleAuthStatusOption,
  resolveCliConfig,
} from './options/index.js';
import { runHeadless } from './headless.js';
import { ThreadController } from '../threads/ThreadController.js';

export interface CliRunHandlers {
  onHeadless?: (prompt: string, config: ResolvedCliConfig) => Promise<void>;
  onInteractive?: (config: ResolvedCliConfig) => Promise<void>;
}

function collectRepeatable(val: string, acc: string[] = []): string[] {
  acc.push(val);
  return acc;
}

export function createCliProgram(handlers?: CliRunHandlers): Command {
  const program = new Command();

  program
    .name('steward')
    .description('Interactive AI engineering assistant for the terminal.')
    .version('0.38.0', '-v, --version', 'Output the current version')
    .addHelpText('before', `\n${STEWARD_UNICODE_LOGO}\n`)
    .argument('[prompt...]', 'Optional prompt to execute directly in headless mode')
    .option('-p, --prompt <text>', 'Prompt to execute in headless mode')
    .option('-m, --model <ref>', 'Set default model in provider/modelId or modelId format')
    .option(
      '-e, --effort <effort>',
      'Set default reasoning effort: none | low | medium | high | xhigh',
    )
    .option(
      '--tool <spec>',
      'Toggle tool state (e.g. --tool bash=false, --tool websearch=on)',
      collectRepeatable,
      [],
    )
    .option('--enable-tool <name>', 'Explicitly enable a specific tool', collectRepeatable, [])
    .option('--disable-tool <name>', 'Explicitly disable a specific tool', collectRepeatable, [])
    .option('--auto-approve', 'Auto-approve bash execution without confirmation prompt')
    .option('--no-auto-approve', 'Require confirmation prompt before bash execution')
    .option('--theme <theme>', 'Set visual theme: default | github')
    .option('-t, --thread <id>', 'Resume a specific thread by ID in interactive mode')
    .option('--continue', 'Resume the latest saved thread in interactive mode')
    .option('--thread-list', 'List the 10 most recent conversation threads and exit')
    .option('--login <provider>', 'Authenticate via OAuth (github-copilot, openrouter)')
    .option('--logout [provider]', 'Log out from a provider or all providers')
    .option('--auth-status', 'Show OAuth authentication status')
    .helpOption('-h, --help', 'Display help for steward and available options')
    .action(async (positionalPromptArgs: string[] = [], rawOpts: Record<string, any> = {}) => {
      // Combine -p flag and positional prompt arguments
      let promptText = rawOpts.prompt as string | undefined;
      if (!promptText && positionalPromptArgs.length > 0) {
        promptText = positionalPromptArgs.join(' ').trim();
      }

      const flags: RawCliFlags = {
        prompt: promptText,
        model: rawOpts.model,
        effort: rawOpts.effort,
        tool: rawOpts.tool,
        enableTool: rawOpts.enableTool,
        disableTool: rawOpts.disableTool,
        autoApprove: rawOpts.autoApprove,
        theme: rawOpts.theme,
        thread: rawOpts.thread,
        continueSession: rawOpts.continue,
        threadList: rawOpts.threadList,
      };

      // 1. Resolve configuration (resolves theme from Flags > Env > SettingsStore > Defaults)
      let config: ResolvedCliConfig;
      try {
        config = await resolveCliConfig({ flags });
      } catch (err: any) {
        const colors = themeManager.theme.colors;
        const cross = chalk.hex(colors.error)(UI_GLYPHS.cross);
        console.error(
          `\n${cross} ${chalk.hex(colors.error)(`Configuration Error: ${err?.message || err}`)}\n`,
        );
        process.exit(1);
      }

      // 2. Persist explicit setting overrides to ~/.steward/settings.json
      const hasSettingOverrides =
        rawOpts.theme !== undefined ||
        rawOpts.model !== undefined ||
        rawOpts.effort !== undefined ||
        (rawOpts.tool && rawOpts.tool.length > 0) ||
        (rawOpts.enableTool && rawOpts.enableTool.length > 0) ||
        (rawOpts.disableTool && rawOpts.disableTool.length > 0) ||
        rawOpts.autoApprove !== undefined;

      if (hasSettingOverrides) {
        const updates: Partial<StewardSettings> = {};
        if (rawOpts.theme !== undefined) updates.theme = config.theme;
        if (rawOpts.model !== undefined) {
          updates.provider = config.modelRef.provider;
          updates.model = config.modelRef.modelId;
        }
        if (rawOpts.effort !== undefined) updates.reasoningEffort = config.reasoningEffort;
        if (
          (rawOpts.tool && rawOpts.tool.length > 0) ||
          (rawOpts.enableTool && rawOpts.enableTool.length > 0) ||
          (rawOpts.disableTool && rawOpts.disableTool.length > 0)
        ) {
          updates.tools = config.tools;
        }
        if (rawOpts.autoApprove !== undefined) {
          updates.bash = config.bash;
        }
        await settingsStore.update(updates);
      }

      // 3. Activate the resolved theme immediately across CLI session
      themeManager.setTheme(config.theme);
      const colors = themeManager.theme.colors;

      // 4. Handle OAuth actions using the active theme
      if (rawOpts.login) {
        await handleLoginOption(String(rawOpts.login));
        return;
      }

      if (rawOpts.logout !== undefined) {
        await handleLogoutOption(rawOpts.logout);
        return;
      }

      if (rawOpts.authStatus) {
        await handleAuthStatusOption();
        return;
      }

      // 5. Incompatible flag validations
      const hasOAuthAction = Boolean(
        rawOpts.login || rawOpts.logout !== undefined || rawOpts.authStatus,
      );

      if (config.threadId && config.continueSession) {
        throw new Error('Configuration Error: Cannot combine --thread and --continue.');
      }

      if (config.threadList) {
        if (config.threadId || config.continueSession || config.prompt || hasOAuthAction) {
          throw new Error(
            'Configuration Error: --thread-list is list-only and cannot be combined with execution, resume, or auth flags.',
          );
        }

        const controller = new ThreadController({
          defaultModel: {
            provider: config.modelRef.provider,
            modelId: config.modelRef.modelId,
          },
        });

        const summaries = await controller.listThreads(10);
        if (summaries.length === 0) {
          console.log(chalk.hex(colors.textDim)('No saved conversation threads found.'));
        } else {
          console.log(
            chalk.bold(
              chalk.hex(colors.accent)(`Recent Conversation Threads (${summaries.length}):`),
            ),
          );
          for (const s of summaries) {
            const dateStr = new Date(s.updatedAt).toLocaleString();
            const idStr = chalk.hex(colors.accent)(s.id);
            const modelStr = chalk.hex(colors.textDim)(`${s.model.provider}/${s.model.modelId}`);
            console.log(`  ${idStr}  ${s.title}  [${modelStr}]  (${dateStr})`);
          }
        }
        return;
      }

      // 6. Headless vs Interactive Dispatch
      const isPiped = !process.stdin.isTTY;
      if (config.prompt || isPiped) {
        if (config.threadId || config.continueSession) {
          throw new Error(
            'Configuration Error: Cannot resume a thread (--thread / --continue) alongside a prompt or piped input.',
          );
        }

        if (handlers?.onHeadless) {
          await handlers.onHeadless(config.prompt ?? '', config);
        } else {
          await runHeadless(config.prompt ?? '', config);
        }
      } else {
        if (handlers?.onInteractive) {
          await handlers.onInteractive(config);
        } else {
          const { runInteractive } = await import('../tui/index.js');
          await runInteractive();
        }
      }
    });

  return program;
}
