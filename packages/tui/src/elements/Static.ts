import { useState } from '../hooks/useState.js';
import { useMemo } from '../hooks/useMemo.js';
import { useLayoutEffect } from '../hooks/useLayoutEffect.js';
import { useCommitHistory } from '../hooks/useCommitHistory.js';
import { Box } from './Box.js';
import type { BoxProps, StitchableElement } from './types.js';
import type { ElementChild } from '../types.js';

export interface StaticProps<T> {
  readonly items: T[];
  readonly style?: BoxProps;
  readonly children: (item: T, index: number) => ElementChild;
}

/**
 * `<Static>` component permanently commits its items to the terminal scrollback history.
 *
 * It is optimal for completed turns, logs, or static records that don't change
 * once rendered, providing 100% familiar Ink-style syntax with Stitchable's zero-flicker
 * scrollback engine.
 *
 * @example
 * ```tsx
 * <Static items={logs}>
 *   {(log, index) => (
 *     <Box key={log.id}>
 *       <Text color="cyan">{log.message}</Text>
 *     </Box>
 *   )}
 * </Static>
 * ```
 */
export function Static<T>(props: StaticProps<T>): StitchableElement<BoxProps> | null {
  const { items, children: renderItem, style: customStyle } = props;
  const [lastCommittedIndex, setLastCommittedIndex] = useState(0);

  const newItems = useMemo(() => items.slice(lastCommittedIndex), [items, lastCommittedIndex]);

  const staticChildren = useMemo(() => {
    return newItems.map((item, idx) => renderItem(item, lastCommittedIndex + idx));
  }, [newItems, renderItem, lastCommittedIndex]);

  const staticContent = useMemo(() => {
    if (staticChildren.length === 0) return null;
    return Box(
      {
        flexDirection: 'column',
        ...customStyle,
      },
      staticChildren,
    );
  }, [staticChildren, customStyle]);

  useCommitHistory(staticContent, [items.length], {
    enabled: newItems.length > 0,
  });

  useLayoutEffect(() => {
    if (items.length !== lastCommittedIndex) {
      setLastCommittedIndex(items.length);
    }
  }, [items.length]);

  return null;
}

export default Static;
