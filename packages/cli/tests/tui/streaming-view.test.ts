import { describe, it, expect } from 'bun:test';
import StreamingView from '../../src/interface/components/StreamingView.js';
import { stripAnsi } from '../../src/interface/utils/format.js';

describe('StreamingView Thinking Indicator & Transitions', () => {
  it('renders blinking bullet with Thinking.. and subline status', () => {
    const view = new StreamingView();
    view.setThinking(true);

    const rendered = view.render(80);
    expect(rendered.length).toBe(2);

    const plainFirst = stripAnsi(rendered[0]!);
    const plainSecond = stripAnsi(rendered[1]!);

    expect(plainFirst).toContain('Thinking..');
    expect(plainSecond).toContain('└');

    view.reset();
  });

  it('immediately replaces Thinking.. when text stream starts', () => {
    const view = new StreamingView();
    view.setThinking(true);

    expect(stripAnsi(view.render(80)[0]!)).toContain('Thinking..');

    // Assistant text starts streaming
    view.setStream('Here is the explanation.', true);
    const rendered = view.render(80);

    const textJoined = rendered.map((l) => stripAnsi(l)).join('\n');
    expect(textJoined).not.toContain('Thinking..');
    expect(textJoined).toContain('Here is the explanation.');

    view.reset();
  });

  it('immediately replaces Thinking.. when active tool starts', () => {
    const view = new StreamingView();
    view.setThinking(true);

    expect(stripAnsi(view.render(80)[0]!)).toContain('Thinking..');

    // Tool call starts
    view.setActiveTool({
      id: 'tool-1',
      name: 'bash',
      displayName: 'Bash',
      args: { command: 'ls -la' },
      startTime: performance.now(),
    });

    const rendered = view.render(80);
    const textJoined = rendered.map((l) => stripAnsi(l)).join('\n');
    expect(textJoined).not.toContain('Thinking..');
    expect(textJoined).toContain('Bash(ls -la)');

    view.reset();
  });

  it('suppresses Thinking.. between multi-tool calls in event router until all tools complete', () => {
    const { createAgentEventHandler } = require('../../src/interface/agent-event-router.js');
    const view = new StreamingView();
    const state = {
      accumulatedText: '',
      activeToolStartTimes: new Map(),
      turnStartTime: performance.now(),
    };
    const commits: any[] = [];
    const engine: any = {
      commit: (fn: any, opts: any) => {
        commits.push({ fn: typeof fn === 'function' ? fn(80) : fn, opts });
      },
    };

    const handler = createAgentEventHandler({
      engine,
      streamingView: view,
      logError: () => {},
      getSessionId: () => 'test-session',
      state,
    });

    // Step has 2 tool calls
    handler({
      type: 'tool-call',
      toolCall: { id: 'call-1', name: 'read_file', args: { path: 'a.txt' } },
    });
    handler({
      type: 'tool-call',
      toolCall: { id: 'call-2', name: 'read_file', args: { path: 'b.txt' } },
    });

    // Tool 1 finishes, but Tool 2 is still pending
    handler({
      type: 'tool-result',
      toolResult: { id: 'call-1', name: 'read_file', args: { path: 'a.txt' }, result: 'content a' },
    });

    // Thinking indicator should NOT be active yet because Tool 2 is still running
    expect(view.state.isThinking).toBe(false);

    // Tool 2 finishes (activeToolStartTimes now 0)
    handler({
      type: 'tool-result',
      toolResult: { id: 'call-2', name: 'read_file', args: { path: 'b.txt' }, result: 'content b' },
    });

    // Now thinking indicator should be activated for next model reasoning step
    expect(view.state.isThinking).toBe(true);

    view.reset();
  });
});
