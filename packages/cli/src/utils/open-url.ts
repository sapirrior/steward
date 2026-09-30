import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';

export function openUrl(url: string): void {
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
      const child = spawn('cmd.exe', ['/c', 'start', '""', url], {
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
    // Graceful fallback if opening browser fails in headless or restricted environments
  }
}
