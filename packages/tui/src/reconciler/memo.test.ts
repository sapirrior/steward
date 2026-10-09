import { describe, expect, it } from 'bun:test';
import { jsx } from './element.js';
import { reconcileRoot } from './reconcile.js';
import { memo, shallowEqual } from './memo.js';
import { renderBoxElement, getCachedBlock } from '../elements/Box.js';

describe('Subtree Memoization & Block Layout Caching (Phase 4)', () => {
  it('shallowEqual accurately compares scalar and object properties', () => {
    expect(shallowEqual({ a: 1, b: 'test' }, { a: 1, b: 'test' })).toBe(true);
    expect(shallowEqual({ a: 1 }, { a: 2 })).toBe(false);
    expect(shallowEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    expect(shallowEqual(null, null)).toBe(true);
    expect(shallowEqual(null, {})).toBe(false);
  });

  it('skips memoized component re-rendering when props are shallowly equal', () => {
    let renderCount = 0;

    const ExpensiveChild = memo((props: { label: string; count: number }) => {
      renderCount++;
      return jsx('text', { children: `${props.label}:${props.count}` });
    });

    const Parent = (props: { parentState: number; childCount: number }) => {
      return jsx('box', {
        children: [
          jsx('text', { children: `Parent: ${props.parentState}` }),
          jsx(ExpensiveChild, { label: 'Fixed', count: props.childCount }),
        ],
      });
    };

    let tree = reconcileRoot(null, jsx(Parent, { parentState: 1, childCount: 100 }));
    expect(renderCount).toBe(1);

    // Update parent state with unchanged child props
    tree = reconcileRoot(tree, jsx(Parent, { parentState: 2, childCount: 100 }));
    expect(renderCount).toBe(1); // Child did NOT re-render!

    // Update child props
    tree = reconcileRoot(tree, jsx(Parent, { parentState: 3, childCount: 200 }));
    expect(renderCount).toBe(2); // Child re-rendered
  });

  it('caches rendered layout Block in WeakMap and recomputes on width change', () => {
    const el = jsx('box', { width: 30, children: 'Content' });
    const ctx1 = { width: 80, colorLevel: 3 as const };
    const ctx2 = { width: 40, colorLevel: 3 as const };

    const block1 = renderBoxElement(el as any, ctx1);
    const cached1 = getCachedBlock(el, ctx1);
    expect(cached1).toBe(block1);

    // Same context returns cached block instance
    const block1Second = renderBoxElement(el as any, ctx1);
    expect(block1Second).toBe(block1);

    // Different width produces new block calculation
    const block2 = renderBoxElement(el as any, ctx2);
    expect(block2).not.toBe(block1);
  });
});
