import { describe, expect, it, afterAll } from 'bun:test';
import { BashTool } from './BashTool.js';
import { taskManager } from '../../services/basher/index.js';

describe('BashTool', () => {
  const tool = new BashTool();

  afterAll(async () => {
    await taskManager.shutdown();
  });

  it('executes a quick command in the foreground', async () => {
    const res = await tool.execute({ command: 'echo "hello steward"' }, { cwd: process.cwd() });
    expect(res.success).toBe(true);
    expect(res.output).toContain('hello steward');
    expect(res.data?.exitCode).toBe(0);
    expect(res.data?.isBackground).toBe(false);
  });

  it('captures exit errors from failed commands', async () => {
    const res = await tool.execute({ command: 'exit 42' }, { cwd: process.cwd() });
    expect(res.success).toBe(false);
    expect(res.data?.exitCode).toBe(42);
    expect(res.output).toContain('[Command exited with error code 42]');
  });

  it('spawns immediate background tasks when runInBackground is true', async () => {
    const res = await tool.execute(
      { command: 'sleep 1 && echo "done"', runInBackground: true },
      { cwd: process.cwd() }
    );
    expect(res.success).toBe(true);
    expect(res.data?.isBackground).toBe(true);
    expect(res.data?.taskId).toBeDefined();
    expect(res.output).toContain('Command spawned in background');

    if (res.data?.taskId) {
      const task = taskManager.get(res.data.taskId);
      expect(task).toBeDefined();
      await taskManager.kill(res.data.taskId);
    }
  });

  it('auto-backgrounds long-running commands when handoff deadline is exceeded', async () => {
    // Pass a 100ms timeout so test runs fast
    const res = await tool.execute(
      { command: 'sleep 1 && echo "finished"', timeout: 100 },
      { cwd: process.cwd() }
    );
    expect(res.success).toBe(true);
    expect(res.data?.isBackground).toBe(true);
    expect(res.data?.autoBackgrounded).toBe(true);
    expect(res.data?.taskId).toBeDefined();
    expect(res.output).toContain('exceeded foreground execution threshold');

    if (res.data?.taskId) {
      await taskManager.kill(res.data.taskId);
    }
  });

  it('enforces permission checks on mutating commands', async () => {
    let asked = false;
    const res = await tool.execute(
      { command: 'echo "test" > temp_test.txt' },
      {
        cwd: process.cwd(),
        askPermission: async (req) => {
          asked = true;
          expect(req.command).toContain('temp_test.txt');
          return false; // Deny
        },
      }
    );

    expect(asked).toBe(true);
    expect(res.success).toBe(false);
    expect(res.output).toContain('Permission denied by user');
  });
});
