import { useRef, useEffect } from './hooks.js';
import { renderElement } from '../elements/index.js';

export interface StaticProps<T = any> {
  items: T[];
  children: (item: T, index: number) => any;
}

/**
 * <Static items={...}>
 * Commits each new item once to the history scrollback so it reflows on resize.
 * Matches Ink's Static component semantics.
 */
export function Static<T = any>(props: StaticProps<T>): any {
  const lastIndexRef = useRef(0);
  const items = props.items || [];

  // Static items are rendered and committed to scrollback
  return {
    type: 'Static',
    props,
    items,
    lastIndex: lastIndexRef.current,
  };
}

export default Static;
