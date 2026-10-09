import { describe, expect, it } from 'bun:test';
import { jsx, Fragment } from './element.js';
import { reconcileRoot, unmountTree } from './reconcile.js';
import { Component } from '../engine/Component.js';

describe('Synchronous Keyed Reconciler & Class Lifecycle (Phase 2)', () => {
  it('preserves function component instance across renders', () => {
    let callCount = 0;
    const MyComp = (props: { count: number }) => {
      callCount++;
      return jsx('text', { children: `Count: ${props.count}` });
    };

    const tree1 = reconcileRoot(null, jsx(MyComp, { count: 1 }));
    expect(callCount).toBe(1);
    expect(tree1?.tag).toBe('function');

    const tree2 = reconcileRoot(tree1, jsx(MyComp, { count: 2 }));
    expect(callCount).toBe(2);
    expect(tree2).toBe(tree1); // Reused identical instance record
  });

  it('matches keyed siblings during reorder and unmounts deleted ones', () => {
    const unmounted: string[] = [];

    class Item extends Component<{ id: string }> {
      componentWillUnmount() {
        unmounted.push(this.props.id);
      }
      render() {
        return jsx('text', { children: this.props.id });
      }
    }

    const list1 = jsx('box', {
      children: [
        jsx(Item, { key: 'a', id: 'a' }),
        jsx(Item, { key: 'b', id: 'b' }),
        jsx(Item, { key: 'c', id: 'c' }),
      ],
    });

    const root1 = reconcileRoot(null, list1);
    expect(root1?.children.length).toBe(3);
    const instA = root1?.children[0];
    const instB = root1?.children[1];
    const instC = root1?.children[2];

    // Reorder: ['c', 'a'] (b removed)
    const list2 = jsx('box', {
      children: [jsx(Item, { key: 'c', id: 'c' }), jsx(Item, { key: 'a', id: 'a' })],
    });

    const root2 = reconcileRoot(root1, list2);
    expect(root2?.children.length).toBe(2);
    expect(root2?.children[0]).toBe(instC);
    expect(root2?.children[1]).toBe(instA);
    expect(unmounted).toEqual(['b']);
  });

  it('executes class lifecycle methods componentDidMount, componentDidUpdate, componentWillUnmount', () => {
    const events: string[] = [];

    class LifecycleComponent extends Component<{ text: string }> {
      componentDidMount() {
        events.push(`mount:${this.props.text}`);
      }
      componentDidUpdate(prevProps: { text: string }) {
        events.push(`update:${prevProps.text}->${this.props.text}`);
      }
      componentWillUnmount() {
        events.push(`unmount:${this.props.text}`);
      }
      render() {
        return jsx('text', { children: this.props.text });
      }
    }

    const root1 = reconcileRoot(null, jsx(LifecycleComponent, { text: 'v1' }));
    expect(events).toEqual(['mount:v1']);

    const root2 = reconcileRoot(root1, jsx(LifecycleComponent, { text: 'v2' }));
    expect(events).toEqual(['mount:v1', 'update:v1->v2']);

    unmountTree(root2);
    expect(events).toEqual(['mount:v1', 'update:v1->v2', 'unmount:v2']);
  });

  it('catches descendant errors via ErrorBoundary and renders fallback', () => {
    const caughtErrors: string[] = [];

    class ErrorBoundary extends Component<{ children?: any }, { hasError: boolean }> {
      state = { hasError: false };

      static getDerivedStateFromError(_error: Error) {
        return { hasError: true };
      }

      componentDidCatch(error: Error) {
        caughtErrors.push(error.message);
      }

      render() {
        if (this.state.hasError) {
          return jsx('text', { children: 'Fallback UI' });
        }
        return this.props.children;
      }
    }

    const FaultyComponent = (props: { shouldThrow: boolean }) => {
      if (props.shouldThrow) {
        throw new Error('Component crashed!');
      }
      return jsx('text', { children: 'Normal UI' });
    };

    const tree1 = reconcileRoot(
      null,
      jsx(ErrorBoundary, {
        children: jsx(FaultyComponent, { shouldThrow: false }),
      }),
    );
    expect(tree1?.classInstance?.state.hasError).toBe(false);

    const tree2 = reconcileRoot(
      tree1,
      jsx(ErrorBoundary, {
        children: jsx(FaultyComponent, { shouldThrow: true }),
      }),
    );
    expect(caughtErrors).toEqual(['Component crashed!']);
    expect(tree2?.classInstance?.state.hasError).toBe(true);
    expect(tree2?.renderedChild?.props.children).toBe('Fallback UI');
  });
});
