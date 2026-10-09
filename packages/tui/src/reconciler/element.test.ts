import { describe, expect, it } from 'bun:test';
import { jsx, jsxs, jsxDEV, Fragment, isElement } from './element.js';
import { ELEMENT_TYPE_SYMBOL } from '../types.js';
import { renderElement } from '../elements/index.js';
import { Component } from '../engine/Component.js';

describe('Reconciler Element Descriptors (Phase 1)', () => {
  it('creates an immutable ElementNode without executing function components', () => {
    let executed = false;
    const MyComponent = (props: { label: string }) => {
      executed = true;
      return props.label;
    };

    const node = jsx(MyComponent, { label: 'hello' });

    expect(executed).toBe(false);
    expect(isElement(node)).toBe(true);
    expect(node.$$typeof).toBe(ELEMENT_TYPE_SYMBOL);
    expect(node.type).toBe(MyComponent);
    expect(node.props.label).toBe('hello');
    expect(node.key).toBeNull();
  });

  it('separates key from props and handles explicit key override', () => {
    const nodeFromProps = jsx('box', { key: 'prop-key', width: 20 });
    expect(nodeFromProps.key).toBe('prop-key');
    expect(nodeFromProps.props.key).toBeUndefined();
    expect(nodeFromProps.props.width).toBe(20);

    const nodeFromOverride = jsx('text', { key: 'prop-key' }, 'override-key');
    expect(nodeFromOverride.key).toBe('override-key');
  });

  it('normalizes children properly (null, boolean, nested arrays)', () => {
    const node = jsx('box', {
      children: ['First', null, false, ['Second', undefined, true, ['Third']]],
    });

    expect(node.children).toEqual(['First', 'Second', 'Third']);
  });

  it('creates Fragment descriptors without losing structure', () => {
    const frag = jsx(Fragment, { children: ['A', 'B'] });
    expect(frag.type).toBe(Fragment);
    expect(frag.children).toEqual(['A', 'B']);
  });

  it('renders function components and class components through renderElement', () => {
    const FuncComp = (props: { text: string }) => jsx('text', { children: props.text });

    class ClassComp extends Component<{ text: string }> {
      render() {
        return [this.props.text];
      }
    }

    const linesFunc = renderElement(jsx(FuncComp, { text: 'Hello Function' }), { width: 40 });
    expect(linesFunc).toEqual(['Hello Function']);

    const linesClass = renderElement(jsx(ClassComp, { text: 'Hello Class' }), { width: 40 });
    expect(linesClass).toEqual(['Hello Class']);
  });

  it('throws an informative error for unknown intrinsic elements', () => {
    const invalidNode = jsx('button' as any, { children: 'Click me' });
    expect(() => {
      renderElement(invalidNode, { width: 40 });
    }).toThrow('Unknown intrinsic element: <button>');
  });
});
