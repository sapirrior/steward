import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';

/**
 * Cross-platform helper to launch URLs in the user's default browser.
 * Handles Android Termux, Windows, macOS, and Linux/BSD.
 */
export async function launchBrowser(url: string): Promise<void> {
  if (process.env.STEWARD_DISABLE_BROWSER_OPEN === '1') {
    return;
  }
  const platform = process.platform;

  try {
    // 1. Termux support (Android Termux CLI)
    if (
      process.env.TERMUX_VERSION ||
      existsSync('/data/data/com.termux/files/usr/bin/termux-open-url')
    ) {
      const child = spawn('termux-open-url', [url], {
        detached: true,
        stdio: 'ignore',
      });
      child.unref();
      return;
    }

    // 2. Windows support
    if (platform === 'win32') {
      const escapedUrl = url.replace(/&/g, '^&');
      const child = spawn('cmd.exe', ['/c', 'start', '""', escapedUrl], {
        detached: true,
        stdio: 'ignore',
      });
      child.unref();
      return;
    }

    // 3. macOS
    if (platform === 'darwin') {
      const child = spawn('open', [url], {
        detached: true,
        stdio: 'ignore',
      });
      child.unref();
      return;
    }

    // 4. Linux / BSD / other Unix
    const child = spawn('xdg-open', [url], {
      detached: true,
      stdio: 'ignore',
    });
    child.unref();
  } catch {
    // Non-fatal if browser cannot be launched in headless/terminal environment
  }
}
