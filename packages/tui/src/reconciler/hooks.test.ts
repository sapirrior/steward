import { describe, expect, it } from 'bun:test';
import { jsx } from './element.js';
import { reconcileRoot, unmountTree } from './reconcile.js';
import {
  useState,
  useReducer,
  useRef,
  useMemo,
  useCallback,
  useEffect,
  useLayoutEffect,
} from './hooks.js';
import { AppScheduler } from '../runtime/AppScheduler.js';
import { TerminalEngine } from '../engine/TerminalEngine.js';
import { memoryIO } from '../terminal/io.js';

describe('Fundamental Hooks (Phase 3)', () => {
  it('handles useState with initial value, lazy init, and functional updates', () => {
    let capturedState: number = 0;
    let setStateFn: any;

    const Counter = () => {
      const [count, setCount] = useState(() => 10);
      capturedState = count;
      setStateFn = setCount;
      return jsx('text', { children: `Count: ${count}` });
    };

    let tree = reconcileRoot(null, jsx(Counter, {}));
    expect(capturedState).toBe(10);

    setStateFn(20);
    tree = reconcileRoot(tree, jsx(Counter, {}));
    expect(capturedState).toBe(20);

    setStateFn((prev: number) => prev + 5);
    tree = reconcileRoot(tree, jsx(Counter, {}));
    expect(capturedState).toBe(25);
  });

  it('handles useReducer with actions and dispatch', () => {
    type Action = { type: 'inc' } | { type: 'dec' };
    let capturedCount = 0;
    let dispatchFn: any;

    const ReducerComponent = () => {
      const [count, dispatch] = useReducer((state: number, action: Action) => {
        switch (action.type) {
          case 'inc':
            return state + 1;
          case 'dec':
            return state - 1;
        }
      }, 0);
      capturedCount = count;
      dispatchFn = dispatch;
      return jsx('text', { children: `Count: ${count}` });
    };

    let tree = reconcileRoot(null, jsx(ReducerComponent, {}));
    expect(capturedCount).toBe(0);

    dispatchFn({ type: 'inc' });
    tree = reconcileRoot(tree, jsx(ReducerComponent, {}));
    expect(capturedCount).toBe(1);

    dispatchFn({ type: 'dec' });
    tree = reconcileRoot(tree, jsx(ReducerComponent, {}));
    expect(capturedCount).toBe(0);
  });

  it('preserves mutable useRef object across rerenders', () => {
    let refFirst: any;
    let refSecond: any;

    const RefComponent = (props: { val: string }) => {
      const myRef = useRef('initial');
      if (!refFirst) {
        refFirst = myRef;
      } else {
        refSecond = myRef;
      }
      return jsx('text', { children: `${props.val}:${myRef.current}` });
    };

    let tree = reconcileRoot(null, jsx(RefComponent, { val: 'a' }));
    refFirst.current = 'updated';

    tree = reconcileRoot(tree, jsx(RefComponent, { val: 'b' }));
    expect(refFirst).toBe(refSecond);
    expect(refSecond.current).toBe('updated');
  });

  it('memoizes values with useMemo and callbacks with useCallback', () => {
    let computations = 0;
    let capturedCallback: any;

    const MemoComponent = (props: { a: number; b: number }) => {
      const computed = useMemo(() => {
        computations++;
        return props.a * 2;
      }, [props.a]);

      capturedCallback = useCallback(() => props.b, [props.b]);
      return jsx('text', { children: `${computed}` });
    };

    let tree = reconcileRoot(null, jsx(MemoComponent, { a: 5, b: 1 }));
    expect(computations).toBe(1);
    const cb1 = capturedCallback;

    // Same a, changed b
    tree = reconcileRoot(tree, jsx(MemoComponent, { a: 5, b: 2 }));
    expect(computations).toBe(1); // useMemo did not recompute
    expect(capturedCallback).not.toBe(cb1); // useCallback returned new fn

    // Changed a, same b
    const cb2 = capturedCallback;
    tree = reconcileRoot(tree, jsx(MemoComponent, { a: 10, b: 2 }));
    expect(computations).toBe(2);
    expect(capturedCallback).toBe(cb2);
  });

  it('executes effects and effect cleanups correctly', async () => {
    const logs: string[] = [];
    const io = memoryIO({ columns: 80, rows: 24 });
    const engine = new TerminalEngine({ io });
    const scheduler = new AppScheduler(engine, () => {});

    const EffectComponent = (props: { id: string }) => {
      useLayoutEffect(() => {
        logs.push(`layout-create:${props.id}`);
        return () => {
          logs.push(`layout-destroy:${props.id}`);
        };
      }, [props.id]);

      useEffect(() => {
        logs.push(`passive-create:${props.id}`);
        return () => {
          logs.push(`passive-destroy:${props.id}`);
        };
      }, [props.id]);

      return jsx('text', { children: props.id });
    };

    let tree = reconcileRoot(null, jsx(EffectComponent, { id: 'v1' }));
    scheduler.flushEffects();
    // Allow passive microtask
    await new Promise((r) => queueMicrotask(r));

    expect(logs).toEqual(['layout-create:v1', 'passive-create:v1']);

    // Update with new id
    tree = reconcileRoot(tree, jsx(EffectComponent, { id: 'v2' }));
    scheduler.flushEffects();
    await new Promise((r) => queueMicrotask(r));

    expect(logs).toEqual([
      'layout-create:v1',
      'passive-create:v1',
      'layout-destroy:v1',
      'layout-create:v2',
      'passive-destroy:v1',
      'passive-create:v2',
    ]);

    // Unmount
    unmountTree(tree);
    expect(logs).toEqual([
      'layout-create:v1',
      'passive-create:v1',
      'layout-destroy:v1',
      'layout-create:v2',
      'passive-destroy:v1',
      'passive-create:v2',
      'layout-destroy:v2',
      'passive-destroy:v2',
    ]);
  });

  it('enforces rules of hooks and prevents state mutation during render', () => {
    expect(() => {
      useState(0);
    }).toThrow(
      'Invalid hook call. Hooks can only be called inside the body of a function component.',
    );

    const InvalidRenderComponent = () => {
      const [_, setCount] = useState(0);
      setCount(1); // Set state during render
      return jsx('text', { children: 'invalid' });
    };

    expect(() => {
      reconcileRoot(null, jsx(InvalidRenderComponent, {}));
    }).toThrow('Cannot update component state while rendering.');
  });
});
