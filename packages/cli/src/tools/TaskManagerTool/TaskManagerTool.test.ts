import { describe, expect, it, afterAll } from 'bun:test';
import { TaskManagerTool } from './TaskManagerTool.js';
import { taskManager } from '../../services/basher/index.js';

describe('TaskManagerTool', () => {
  const tool = new TaskManagerTool();

  afterAll(async () => {
    await taskManager.shutdown();
  });

  it('lists tasks with correct summary badge', async () => {
    const execution = taskManager.createExecution({
      command: 'sleep 5',
      cwd: process.cwd(),
    });
    execution.start({ handoffDeadlineMs: 0 });

    const res = await tool.execute({ action: 'list' }, { cwd: process.cwd() });
    expect(res.success).toBe(true);
    expect(res.badge).toContain('listing tasks');
    expect(res.badge).toContain('running');
    expect(res.output).toContain(execution.taskId);

    await taskManager.kill(execution.taskId);
  });

  it('reads task logs with correct badge format', async () => {
    const execution = taskManager.createExecution({
      command: 'echo "line 1" && echo "line 2"',
      cwd: process.cwd(),
    });
    execution.start({ handoffDeadlineMs: 0 });

    // Wait a brief tick for execution
    await new Promise((r) => setTimeout(r, 100));

    const res = await tool.execute(
      { action: 'read', taskId: execution.taskId, lines: 10 },
      { cwd: process.cwd() }
    );
    expect(res.success).toBe(true);
    expect(res.badge).toBe(`read task ${execution.taskId}`);
    expect(res.output).toContain('line 1');
  });

  it('kills a running task with correct badge format', async () => {
    const execution = taskManager.createExecution({
      command: 'sleep 10',
      cwd: process.cwd(),
    });
    execution.start({ handoffDeadlineMs: 0 });

    const res = await tool.execute(
      { action: 'kill', taskId: execution.taskId },
      { cwd: process.cwd() }
    );
    expect(res.success).toBe(true);
    expect(res.badge).toBe(`killed task ${execution.taskId}`);
  });

  it('sends stdin input with correct badge format', async () => {
    const execution = taskManager.createExecution({
      command: 'cat',
      cwd: process.cwd(),
    });
    execution.start({ handoffDeadlineMs: 0 });

    const res = await tool.execute(
      { action: 'send_input', taskId: execution.taskId, input: 'hello\n' },
      { cwd: process.cwd() }
    );
    expect(res.success).toBe(true);
    expect(res.badge).toBe(`Send "hello\\n" to task ${execution.taskId}`);

    await taskManager.kill(execution.taskId);
  });
});
