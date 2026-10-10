import { describe, expect, it, afterAll } from 'bun:test';
import { TaskManagerTool } from './TaskManagerTool.js';
import { taskManager } from '../../services/basher/index.js';

describe('TaskManagerTool', () => {
  const tool = new TaskManagerTool();

  afterAll(async () => {
    await taskManager.shutdown();
  });

  it('lists tasks with correct summary', async () => {
    const execution = taskManager.createExecution({
      command: 'sleep 5',
      cwd: process.cwd(),
    });
    execution.start({ handoffDeadlineMs: 0 });

    const res = await tool.execute({ action: 'list', tagline: 'Listing running tasks' }, { cwd: process.cwd() });
    expect(res.success).toBe(true);
    expect(res.data?.summary).toContain('listing tasks');
    expect(res.data?.summary).toContain('running');
    expect(res.output).toContain(execution.taskId);

    await taskManager.kill(execution.taskId);
  });

  it('reads task logs with correct summary', async () => {
    const execution = taskManager.createExecution({
      command: 'echo "line 1" && echo "line 2"',
      cwd: process.cwd(),
    });
    execution.start({ handoffDeadlineMs: 0 });

    // Wait a brief tick for execution
    await new Promise((r) => setTimeout(r, 100));

    const res = await tool.execute(
      { action: 'read', taskId: execution.taskId, lines: 10, tagline: 'Reading task log output' },
      { cwd: process.cwd() }
    );
    expect(res.success).toBe(true);
    expect(res.data?.summary).toBe(`read task ${execution.taskId}`);
    expect(res.output).toContain('line 1');
  });

  it('kills a running task with correct summary', async () => {
    const execution = taskManager.createExecution({
      command: 'sleep 10',
      cwd: process.cwd(),
    });
    execution.start({ handoffDeadlineMs: 0 });

    const res = await tool.execute(
      { action: 'kill', taskId: execution.taskId, tagline: 'Terminating background task' },
      { cwd: process.cwd() }
    );
    expect(res.success).toBe(true);
    expect(res.data?.summary).toBe(`killed task ${execution.taskId}`);
  });

  it('sends stdin input with correct summary', async () => {
    const execution = taskManager.createExecution({
      command: 'cat',
      cwd: process.cwd(),
    });
    execution.start({ handoffDeadlineMs: 0 });

    const res = await tool.execute(
      { action: 'send_input', taskId: execution.taskId, input: 'hello\n', tagline: 'Sending stdin greeting' },
      { cwd: process.cwd() }
    );
    expect(res.success).toBe(true);
    expect(res.data?.summary).toBe(`Send "hello\\n" to task ${execution.taskId}`);

    await taskManager.kill(execution.taskId);
  });

  it('requires tagline in schema validation', () => {
    expect(() => tool.validateInput({ action: 'list' } as any)).toThrow(
      "Invalid arguments for tool 'task_manager'"
    );
    const parsed = tool.validateInput({ action: 'list', tagline: 'Listing tasks' });
    expect(parsed.tagline).toBe('Listing tasks');
  });
});
