import { describe, it, expect } from 'bun:test';
import { memoryIO } from '../terminal/io.js';
import { TerminalEngine } from '../engine/TerminalEngine.js';
import { AppRoot } from './AppRoot.js';
import { useState, useCommitHistory } from '../hooks/index.js';
import { renderStatic } from '../reconciler/static-render.js';
import { jsx } from '../reconciler/element.js';
import Component from '../engine/Component.js';

describe('Phase 6 — Static, Responsive History and useCommitHistory', () => {
  describe('renderStatic', () => {
    it('renders primitive elements and pure function components to lines', () => {
      function PureBadge(props: { label: string }) {
        return jsx('box', {
          children: [jsx('text', { children: props.label })],
        });
      }

      const element = jsx(PureBadge, { label: 'SUCCESS' });
      const lines = renderStatic(element, { width: 80, colorLevel: 0 });
      expect(lines.join('\n')).toContain('SUCCESS');
    });

    it('reflows content when rendered at different widths', () => {
      const longText = 'The quick brown fox jumps over the lazy dog and runs across the field.';
      const element = jsx('text', { children: longText, wrap: 'wrap' });

      const linesWide = renderStatic(element, { width: 80, colorLevel: 0 });
      const linesNarrow = renderStatic(element, { width: 20, colorLevel: 0 });

      expect(linesWide.length).toBe(1);
      expect(linesNarrow.length).toBeGreaterThan(1);
      expect(linesNarrow.join(' ')).toContain('quick');
    });

    it('throws when a static component attempts to call hooks', () => {
      function StatefulComponent() {
        useState(0);
        return jsx('text', { children: 'test' });
      }

      const element = jsx(StatefulComponent, {});

      expect(() => {
        renderStatic(element, { width: 80 });
      }).toThrow('Invalid hook call');
    });

    it('throws when attempting to render a class component in static history', () => {
      class TestClassComponent extends Component {
        render() {
          return ['Class output'];
        }
      }

      const element = jsx(TestClassComponent as any, {});

      expect(() => {
        renderStatic(element, { width: 80 });
      }).toThrow('Class components cannot be rendered in static history');
    });
  });

  describe('useCommitHistory', () => {
    it('throws if dependencies array is not provided', () => {
      function BadComponent() {
        // @ts-expect-error test missing deps
        useCommitHistory(jsx('text', { children: 'x' }));
        return jsx('text', { children: 'ok' });
      }

      const io = memoryIO({ columns: 80, rows: 24 });
      const engine = new TerminalEngine({ io, exitHook: false });

      expect(() => {
        new AppRoot(jsx(BadComponent, {}), { engine });
      }).toThrow('useCommitHistory requires a dependency array');

      engine.dispose();
    });

    it('does not commit when enabled is false', async () => {
      function ChatMessage(props: { text: string; done: boolean }) {
        const { committed } = useCommitHistory(
          jsx('text', { children: props.text }),
          [props.text],
          { enabled: props.done },
        );
        return jsx('text', {
          children: committed ? 'COMMITTED' : `STREAMING: ${props.text}`,
        });
      }

      const io = memoryIO({ columns: 80, rows: 24 });
      const engine = new TerminalEngine({ io, exitHook: false });
      const root = new AppRoot(jsx(ChatMessage, { text: 'chunk 1', done: false }), { engine });

      await engine.flush();
      expect(engine.history.getEntries().length).toBe(0);

      root.unmount();
      engine.dispose();
    });

    it('commits to engine history when enabled is true and marks committed', async () => {
      let latestCommittedState = false;

      function ChatMessage(props: { text: string; done: boolean }) {
        const { committed } = useCommitHistory(
          jsx('text', { children: props.text }),
          [props.text],
          { enabled: props.done },
        );
        latestCommittedState = committed;
        return jsx('text', {
          children: committed ? 'COMMITTED' : `STREAMING: ${props.text}`,
        });
      }

      const io = memoryIO({ columns: 80, rows: 24 });
      const engine = new TerminalEngine({ io, exitHook: false });

      // Render streaming
      const root = new AppRoot(jsx(ChatMessage, { text: 'Hello AI', done: false }), { engine });
      await engine.flush();
      expect(engine.history.getEntries().length).toBe(0);
      expect(latestCommittedState).toBe(false);

      // Complete stream
      root.render(jsx(ChatMessage, { text: 'Hello AI', done: true }));
      await engine.flush();

      expect(engine.history.getEntries().length).toBe(1);
      expect(latestCommittedState).toBe(true);

      // Re-render with same props -> no duplicate commit
      root.render(jsx(ChatMessage, { text: 'Hello AI', done: true }));
      await engine.flush();

      expect(engine.history.getEntries().length).toBe(1);

      root.unmount();
      engine.dispose();
    });

    it('appends a new history entry when dependencies change', async () => {
      function MessageLogger(props: { msg: string }) {
        useCommitHistory(jsx('text', { children: props.msg }), [props.msg]);
        return jsx('text', { children: 'Live Log' });
      }

      const io = memoryIO({ columns: 80, rows: 24 });
      const engine = new TerminalEngine({ io, exitHook: false });
      const root = new AppRoot(jsx(MessageLogger, { msg: 'Log 1' }), { engine });

      await engine.flush();
      expect(engine.history.getEntries().length).toBe(1);

      // Re-render with new message
      root.render(jsx(MessageLogger, { msg: 'Log 2' }));
      await engine.flush();

      expect(engine.history.getEntries().length).toBe(2);

      root.unmount();
      engine.dispose();
    });

    it('reflows committed history entries when terminal width changes', async () => {
      const longMessage = 'This is a very long log line that wraps on narrower terminal screens.';
      function Logger() {
        useCommitHistory(
          jsx('text', { children: longMessage, wrap: 'wrap' }),
          ['fixed'],
        );
        return jsx('text', { children: 'Done' });
      }

      const io = memoryIO({ columns: 80, rows: 24 });
      const engine = new TerminalEngine({ io, exitHook: false });
      const root = new AppRoot(jsx(Logger, {}), { engine });

      await engine.flush();
      expect(engine.history.getEntries().length).toBe(1);

      // Check history row count at 80 cols
      const wideCount = engine.tree.getHistoryRowCount(80);
      expect(wideCount).toBe(1);

      // Check history row count at 20 cols
      const narrowCount = engine.tree.getHistoryRowCount(20);
      expect(narrowCount).toBeGreaterThan(1);

      root.unmount();
      engine.dispose();
    });
  });
});
