import { describe, expect, it } from 'bun:test';
import { jsx } from './element.js';
import { reconcileRoot } from './reconcile.js';
import { createContext, useContext } from './context.js';

describe('Context API (Phase 4)', () => {
  it('reads default value when no Provider is present', () => {
    const ThemeContext = createContext<'light' | 'dark'>('light');
    let capturedTheme: string = '';

    const Consumer = () => {
      capturedTheme = useContext(ThemeContext);
      return jsx('text', { children: capturedTheme });
    };

    reconcileRoot(null, jsx(Consumer, {}));
    expect(capturedTheme).toBe('light');
  });

  it('propagates value from Context.Provider down the tree', () => {
    const ThemeContext = createContext<string>('default');
    let capturedTheme: string = '';

    const Child = () => {
      capturedTheme = useContext(ThemeContext);
      return jsx('text', { children: capturedTheme });
    };

    const App = () => {
      return jsx(ThemeContext.Provider, {
        value: 'custom-dark',
        children: jsx('box', {
          children: jsx(Child, {}),
        }),
      });
    };

    reconcileRoot(null, jsx(App, {}));
    expect(capturedTheme).toBe('custom-dark');
  });

  it('handles nested providers with scoped overrides', () => {
    const CountContext = createContext<number>(0);
    const captured: number[] = [];

    const Reader = (props: { id: string }) => {
      const val = useContext(CountContext);
      captured.push(val);
      return jsx('text', { children: `${props.id}:${val}` });
    };

    const NestedApp = () => {
      return jsx(CountContext.Provider, {
        value: 10,
        children: jsx('box', {
          children: [
            jsx(Reader, { id: 'outer' }),
            jsx(CountContext.Provider, {
              value: 20,
              children: jsx(Reader, { id: 'inner' }),
            }),
          ],
        }),
      });
    };

    reconcileRoot(null, jsx(NestedApp, {}));
    expect(captured).toEqual([10, 20]);
  });
});
