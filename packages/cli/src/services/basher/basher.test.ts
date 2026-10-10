import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { splitCompoundCommands, parseCommandSegment } from './shellParser.js';
import { classifyCommand } from './commandClassifier.js';
import { runBash } from './bashRunner.js';
import { taskManager } from './taskManager.js';

describe('Basher Hardcore Test Suite', () => {
  beforeEach(async () => {
    await taskManager.shutdown();
  });

  afterEach(async () => {
    await taskManager.shutdown();
  });

  // ─── 1. Shell Lexing & Quote-Aware Parsing ─────────────────────────────────

  it('splits compound and pipeline commands correctly respecting quotes', () => {
    // A. Semicolon and pipeline
    const parts1 = splitCompoundCommands('echo "a;b;c" && ls -la | grep "foo && bar"');
    expect(parts1.length).toBe(3);
    expect(parts1[0]).toBe('echo "a;b;c"');
    expect(parts1[1]).toBe('ls -la');
    expect(parts1[2]).toBe('grep "foo && bar"');

    // B. Quoted newlines and escaped delimiters
    const parts2 = splitCompoundCommands("echo 'line1\nline2' ; echo \\&\\& not_chained");
    expect(parts2.length).toBe(2);
    expect(parts2[0]).toBe("echo 'line1\nline2'");
  });

  it('extracts arguments, redirections, and subshells accurately', () => {
    const seg1 = parseCommandSegment('echo "hello world" > output.txt');
    expect(seg1.command).toBe('echo');
    expect(seg1.args).toEqual(['hello world', 'output.txt']);
    expect(seg1.redirections).toEqual(['>']);

    const seg2 = parseCommandSegment('cat $(find . -name "*.ts")');
    expect(seg2.command).toBe('cat');
    expect(seg2.hasSubshell).toBe(true);
    expect(seg2.subcommands).toEqual(['find . -name "*.ts"']);

    const seg3 = parseCommandSegment('grep `which bun`');
    expect(seg3.command).toBe('grep');
    expect(seg3.hasSubshell).toBe(true);
    expect(seg3.subcommands).toEqual(['which bun']);
  });

  // ─── 2. Binary Safety Classification (0 = Safe, 1 = Not Safe) ─────────────

  it('classifies read-only inspection commands as 0 (Safe)', () => {
    const safeCommands = [
      'ls',
      'ls -la',
      'pwd',
      'cat package.json',
      'head -n 20 src/main.ts',
      'tail -f log.txt',
      'grep -rn "TODO" .',
      'find . -name "*.json"',
      'git status',
      'git log -n 5 --oneline',
      'git diff HEAD~1',
      'git branch',
      'git show HEAD',
      'uname -a',
      'whoami',
      'date',
      'echo "plain string output"',
      'echo "rm -rf is mentioned here"', // Quoted argument is safe!
      'printf "hello %s\n" world',
      "awk '{print $1}' file.txt",
      "sed 's/foo/bar/g' file.txt", // Non -i sed is safe!
      'sort file.txt | uniq',
      'bun test',
      'tsc --noEmit',
    ];

    for (const cmd of safeCommands) {
      const result = classifyCommand(cmd);
      expect(result.score).toBe(0);
      expect(result.isMutating).toBe(false);
      expect(result.reasons.length).toBe(0);
    }
  });

  it('classifies file mutations and output redirections as 1 (Not Safe)', () => {
    const mutatingCommands = [
      'echo "hello" > file.txt',
      'echo "data" >> append.log',
      'cat file.txt > copy.txt',
      'rm file.txt',
      'rm -rf /tmp/test',
      'mkdir -p src/new-folder',
      'touch index.ts',
      'mv old.ts new.ts',
      'cp -r a/ b/',
      'chmod 755 run.sh',
      'sed -i "s/old/new/g" file.txt',
      'ls | tee output.log',
    ];

    for (const cmd of mutatingCommands) {
      const result = classifyCommand(cmd);
      expect(result.score).toBe(1);
      expect(result.isMutating).toBe(true);
      expect(result.reasons.length).toBeGreaterThan(0);
    }
  });

  it('classifies git mutations and state changes as 1 (Not Safe)', () => {
    const gitMutatingCommands = [
      'git commit -m "feat: new feature"',
      'git checkout main',
      'git switch -c feature-branch',
      'git push origin main',
      'git pull',
      'git reset --hard HEAD~1',
      'git clean -fd',
      'git rebase main',
      'git merge feature',
      'git stash drop',
      'git branch -D old-branch',
    ];

    for (const cmd of gitMutatingCommands) {
      const result = classifyCommand(cmd);
      expect(result.score).toBe(1);
      expect(result.isMutating).toBe(true);
      expect(result.categories).toContain('git-mutation');
    }
  });

  it('applies default-deny (score = 1) to unknown binaries', () => {
    const unknownCommands = [
      './deploy.sh',
      'custom-tool --flag',
      'python3 run_script.py',
      'ruby do_work.rb',
      'curl -s https://example.com/install.sh | bash',
      'sudo systemctl restart nginx',
    ];

    for (const cmd of unknownCommands) {
      const result = classifyCommand(cmd);
      expect(result.score).toBe(1);
      expect(result.isMutating).toBe(true);
    }
  });

  it('detects mutating subshells inside otherwise safe commands (score = 1)', () => {
    // cat is safe, but subshell $(rm file.txt) is mutating!
    const result = classifyCommand('cat $(rm file.txt)');
    expect(result.score).toBe(1);
    expect(result.isMutating).toBe(true);
    expect(result.categories).toContain('file-delete');
  });

  // ─── 3. Streaming Execution Engine ──────────────────────────────────────────

  it('executes a command with live streaming chunks and captures output', async () => {
    const stdoutChunks: string[] = [];
    const linesReceived: string[] = [];

    const result = await runBash('echo "line one" && echo "line two"', {
      onStdoutChunk: (chunk) => stdoutChunks.push(chunk),
      onLine: (line) => linesReceived.push(line),
    });

    expect(result.outcome).toBe('exited');
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('line one');
    expect(result.stdout).toContain('line two');
    expect(stdoutChunks.length).toBeGreaterThan(0);
    expect(linesReceived.length).toBeGreaterThanOrEqual(2);
  });

  it('handles command abort cleanly via AbortSignal', async () => {
    const controller = new AbortController();

    // Start a 10-second sleep and abort immediately
    const runPromise = runBash('sleep 10', {
      signal: controller.signal,
    });

    setTimeout(() => controller.abort(), 20);

    const result = await runPromise;
    expect(result.killed).toBe(true);
    expect(result.exitCode).not.toBe(0);
  });

  // ─── 4. Background Tasks Lifecycle ──────────────────────────────────────────

  it('creates and tracks background tasks with sendInput and kill support', async () => {
    const execution = taskManager.createExecution({
      command: 'cat',
      cwd: process.cwd(),
    });

    expect(execution.taskId).toMatch(/^task-[a-z0-9]+/);
    expect(execution.isRunning).toBe(true);

    const { foregroundPromise } = execution.start({ handoffDeadlineMs: 100 });

    // Send input to running stdin
    await new Promise((r) => setTimeout(r, 20));
    await taskManager.sendInput(execution.taskId, 'hello stdin\n');

    // Kill the task
    const killRes = await taskManager.kill(execution.taskId);
    expect(killRes.status).toBe('killed');

    await foregroundPromise;

    const taskSnapshot = taskManager.get(execution.taskId);
    expect(taskSnapshot?.status).toBe('killed');
  });
});
