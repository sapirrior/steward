import chalk from 'chalk';
import { login, logout, logoutAll, authStatus, launch } from '@steward/oauth';
import { themeManager } from '../../themes/themeManager.js';
import { UI_GLYPHS } from '../../constants/icons.js';

export const VALID_OAUTH_PROVIDERS = ['github-copilot', 'openrouter'] as const;
export type OAuthProvider = (typeof VALID_OAUTH_PROVIDERS)[number];

/**
 * Handles `--login <provider>` for the two supported OAuth providers: github-copilot and openrouter.
 */
export async function handleLoginOption(providerInput: string): Promise<void> {
  const colors = themeManager.theme.colors;
  const provider = providerInput.trim().toLowerCase();

  if (!VALID_OAUTH_PROVIDERS.includes(provider as OAuthProvider)) {
    const cross = chalk.hex(colors.error)(UI_GLYPHS.cross);
    console.log(
      `\n${cross} ${chalk.hex(colors.error)(`Unsupported OAuth provider: '${providerInput}'. Supported providers: ${VALID_OAUTH_PROVIDERS.join(', ')}`)}\n`,
    );
    process.exitCode = 1;
    return;
  }

  const spinner = chalk.hex(colors.accent)(UI_GLYPHS.runningSpinner);
  console.log(
    `\n${spinner} ${chalk.bold(chalk.hex(colors.text)(`Initiating authentication for ${provider}...`))}`,
  );

  try {
    const result = await login(provider, {
      onAuthUrl: (url) => {
        console.log(`  ${chalk.hex(colors.textDim)(`Opening browser for authorization: ${url}`)}`);
        launch(url).catch(() => {});
      },
      onDeviceCode: (info) => {
        const chevron = chalk.hex(colors.accentActive)(UI_GLYPHS.promptChevron);
        console.log(
          `\n  ${chevron} Open your browser: ${chalk.bold.underline(chalk.hex(colors.accent)(info.verificationUri))}`,
        );
        console.log(
          `  ${chevron} Enter device code:   ${chalk.bold(chalk.hex(colors.success)(info.userCode))}\n`,
        );
        console.log(chalk.hex(colors.textDim)('  Waiting for authorization in browser...'));
      },
    });

    if (result.success) {
      const check = chalk.hex(colors.success)(UI_GLYPHS.check);
      const accountInfo = result.account ? ` as ${chalk.bold(result.account)}` : '';
      console.log(
        `\n${check} ${chalk.hex(colors.text)(`Successfully logged in to ${provider}${accountInfo}.`)}\n`,
      );
    } else {
      const cross = chalk.hex(colors.error)(UI_GLYPHS.cross);
      console.log(
        `\n${cross} ${chalk.hex(colors.error)(`Authentication failed: ${result.error || 'Unknown error'}`)}\n`,
      );
      process.exitCode = 1;
    }
  } catch (err: any) {
    const cross = chalk.hex(colors.error)(UI_GLYPHS.cross);
    console.log(`\n${cross} ${chalk.hex(colors.error)(`Login error: ${err?.message || err}`)}\n`);
    process.exitCode = 1;
  }
}

/**
 * Handles `--logout [provider]` for a specific provider or all.
 */
export async function handleLogoutOption(providerInput?: string | boolean): Promise<void> {
  const colors = themeManager.theme.colors;

  try {
    if (
      typeof providerInput === 'string' &&
      providerInput.trim() &&
      providerInput.trim() !== 'all'
    ) {
      const provider = providerInput.trim().toLowerCase();
      const removed = await logout(provider);
      if (removed) {
        const check = chalk.hex(colors.success)(UI_GLYPHS.check);
        console.log(
          `\n${check} ${chalk.hex(colors.text)(`Successfully logged out of ${provider}.`)}\n`,
        );
      } else {
        const bullet = chalk.hex(colors.warning)(UI_GLYPHS.bullet);
        console.log(
          `\n${bullet} ${chalk.hex(colors.textMuted)(`No active credentials found for ${provider}.`)}\n`,
        );
      }
    } else {
      const count = await logoutAll();
      const check = chalk.hex(colors.success)(UI_GLYPHS.check);
      console.log(
        `\n${check} ${chalk.hex(colors.text)(`Cleared credentials for all providers (${count} removed).`)}\n`,
      );
    }
  } catch (err: any) {
    const cross = chalk.hex(colors.error)(UI_GLYPHS.cross);
    console.log(`\n${cross} ${chalk.hex(colors.error)(`Logout error: ${err?.message || err}`)}\n`);
    process.exitCode = 1;
  }
}

/**
 * Handles `--auth-status` displaying OAuth status for github-copilot and openrouter.
 */
export async function handleAuthStatusOption(): Promise<void> {
  const colors = themeManager.theme.colors;

  try {
    const status = await authStatus();
    const bar = chalk.hex(colors.accent)(UI_GLYPHS.accentBar);
    console.log(`\n${bar} ${chalk.bold(chalk.hex(colors.text)('Steward OAuth Status'))}`);

    for (const provider of VALID_OAUTH_PROVIDERS) {
      const info = status[provider];
      if (info && info.loggedIn) {
        const check = chalk.hex(colors.success)(UI_GLYPHS.check);
        const accountStr = info.account ? ` (${info.account})` : '';
        const typeStr = info.type ? ` [${info.type}]` : '';
        console.log(
          `  ${check} ${chalk.hex(colors.text)(provider)}${chalk.hex(colors.textDim)(accountStr)}${chalk.hex(colors.textDim)(typeStr)}: ${chalk.hex(colors.success)('Active')}`,
        );
      } else {
        const cross = chalk.hex(colors.textDim)(UI_GLYPHS.cross);
        console.log(`  ${cross} ${chalk.hex(colors.textDim)(`${provider}: Not logged in`)}`);
      }
    }
    console.log('');
  } catch (err: any) {
    const cross = chalk.hex(colors.error)(UI_GLYPHS.cross);
    console.log(
      `\n${cross} ${chalk.hex(colors.error)(`Failed to retrieve auth status: ${err?.message || err}`)}\n`,
    );
    process.exitCode = 1;
  }
}
