import { describe, it, expect } from 'bun:test';
import { spawnSync } from 'child_process';
import { join } from 'path';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';

describe('CLI Entry Characterization', () => {
  const cliRoot = join(import.meta.dir, '..');
  const mainTs = join(cliRoot, 'src/main.ts');

  function runCli(args: string[], env: Record<string, string> = {}) {
    const res = spawnSync('bun', [mainTs, ...args], {
      cwd: cliRoot,
      env: { ...process.env, ...env },
      encoding: 'utf-8',
    });
    return {
      stdout: res.stdout,
      stderr: res.stderr,
      status: res.status,
    };
  }

  it('handles version subcommand and flags', () => {
    const res = runCli(['version']);
    expect(res.status).toBe(0);
    expect(res.stdout).toMatch(/^steward \d+\.\d+\.\d+\n$/);
  });

  it('handles help subcommand and flags', () => {
    const res = runCli(['help']);
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('Steward — Interactive AI engineering assistant for the terminal');
    expect(res.stdout).toContain('Usage:');
  });

  it('handles repo subcommand', () => {
    const res = runCli(['repo']);
    expect(res.status).toBe(0);
    expect(res.stdout).toBe('https://github.com/sapirrior/steward\n');
  });

  it('handles config command lifecycle', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'steward-test-'));
    try {
      const env = { STEWARD_SETTINGS_DIR: tempDir };

      const resAll = runCli(['config'], env);
      expect(resAll.status).toBe(0);
      expect(resAll.stdout).toContain('Current settings:');

      const resMode = runCli(['config', 'mode'], env);
      expect(resMode.status).toBe(0);
      expect(resMode.stdout).toContain('Current default mode:');
      expect(resMode.stdout).toContain('Available modes:');

      const resSet = runCli(['config', 'mode', 'build'], env);
      expect(resSet.status).toBe(0);
      expect(resSet.stdout).toBe('Default mode set to: build\n');

      const resGetAfterSet = runCli(['config', 'mode'], env);
      expect(resGetAfterSet.stdout).toContain('Current default mode: build');

      const resBadMode = runCli(['config', 'mode', 'bogus'], env);
      expect(resBadMode.status).toBe(1);
      expect(resBadMode.stderr).toContain('Unknown mode "bogus"');

      const resBadTarget = runCli(['config', 'bogus'], env);
      expect(resBadTarget.status).toBe(1);
      expect(resBadTarget.stderr).toContain('Unknown configuration target "bogus"');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  }, 30000);

  it('handles unknown options and arguments', () => {
    const resOpt = runCli(['--bogus']);
    expect(resOpt.status).toBe(1);
    expect(resOpt.stderr).toContain('Unknown option "--bogus". Run "steward --help" for usage.');

    const resArg = runCli(['bogus']);
    expect(resArg.status).toBe(1);
    expect(resArg.stderr).toContain('Unknown argument "bogus". Run "steward --help" for usage.');
  });
});
