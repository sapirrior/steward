import type { FlexDirection, JustifyContent, AlignItems, AlignSelf, Block } from './types.js';
import { visibleWidth } from '../text/width.js';

export interface FlexItem {
  basis: number;
  flexGrow: number;
  flexShrink: number;
  minWidth?: number;
  maxWidth?: number;
  alignSelf?: AlignSelf;
}

/**
 * Distributes available integer space across items using the largest-remainder method.
 */
export function distributeFlexSpace(items: FlexItem[], availableWidth: number, gap = 0): number[] {
  const n = items.length;
  if (n === 0) return [];
  if (n === 1) {
    const item = items[0]!;
    if (item.flexGrow > 0) {
      return [Math.max(item.basis, availableWidth)];
    }
    return [Math.min(item.basis, availableWidth)];
  }

  const totalGaps = gap * (n - 1);
  const totalBasis = items.reduce((sum, it) => sum + it.basis, 0);
  const freeSpace = availableWidth - totalBasis - totalGaps;

  const resultSizes = items.map((it) => it.basis);

  if (freeSpace > 0) {
    const totalGrow = items.reduce((sum, it) => sum + it.flexGrow, 0);
    if (totalGrow > 0) {
      const floatAllocations = items.map((it) => (it.flexGrow / totalGrow) * freeSpace);
      const integerAllocations = floatAllocations.map(Math.floor);
      let allocatedTotal = integerAllocations.reduce((sum, v) => sum + v, 0);
      let remainder = freeSpace - allocatedTotal;

      // Largest remainder method with ties going to earlier child
      const remainders = floatAllocations
        .map((f, idx) => ({ remainder: f - integerAllocations[idx]!, idx }))
        .sort((a, b) => b.remainder - a.remainder || a.idx - b.idx);

      for (let i = 0; i < remainder; i++) {
        const itemIdx = remainders[i % remainders.length]!.idx;
        integerAllocations[itemIdx]! += 1;
      }

      for (let i = 0; i < n; i++) {
        resultSizes[i]! += integerAllocations[i]!;
      }
    }
  } else if (freeSpace < 0) {
    const deficit = -freeSpace;
    const totalShrinkCapacity = items.reduce((sum, it) => sum + it.flexShrink * it.basis, 0);

    if (totalShrinkCapacity > 0) {
      const floatShrinks = items.map(
        (it) => ((it.flexShrink * it.basis) / totalShrinkCapacity) * deficit,
      );
      const integerShrinks = floatShrinks.map(Math.floor);
      let shrinkTotal = integerShrinks.reduce((sum, v) => sum + v, 0);
      let remainder = deficit - shrinkTotal;

      const remainders = floatShrinks
        .map((f, idx) => ({ remainder: f - integerShrinks[idx]!, idx }))
        .sort((a, b) => b.remainder - a.remainder || a.idx - b.idx);

      for (let i = 0; i < remainder; i++) {
        const itemIdx = remainders[i % remainders.length]!.idx;
        integerShrinks[itemIdx]! += 1;
      }

      for (let i = 0; i < n; i++) {
        resultSizes[i] = Math.max(0, resultSizes[i]! - integerShrinks[i]!);
      }
    }
  }

  // Apply minWidth / maxWidth constraints
  for (let i = 0; i < n; i++) {
    const item = items[i]!;
    if (item.minWidth !== undefined) {
      resultSizes[i] = Math.max(resultSizes[i]!, item.minWidth);
    }
    if (item.maxWidth !== undefined) {
      resultSizes[i] = Math.min(resultSizes[i]!, item.maxWidth);
    }
  }

  return resultSizes;
}

/**
 * Calculates gap positions and extra spacing according to justifyContent.
 */
export function computeJustifyGaps(
  justify: JustifyContent,
  totalAvailable: number,
  itemWidths: number[],
  baseGap = 0,
): { leadingSpace: number; gaps: number[] } {
  const n = itemWidths.length;
  if (n === 0) return { leadingSpace: 0, gaps: [] };

  const totalContent = itemWidths.reduce((sum, w) => sum + w, 0);
  const baseGapsTotal = baseGap * Math.max(0, n - 1);
  const freeSpace = Math.max(0, totalAvailable - totalContent - baseGapsTotal);

  if (freeSpace <= 0 || n === 1) {
    if (justify === 'center') {
      const leading = Math.floor(freeSpace / 2);
      return { leadingSpace: leading, gaps: [] };
    }
    if (justify === 'flex-end') {
      return { leadingSpace: freeSpace, gaps: [] };
    }
    return { leadingSpace: 0, gaps: [] };
  }

  const gaps: number[] = new Array(n - 1).fill(baseGap);
  let leadingSpace = 0;

  switch (justify) {
    case 'flex-start':
      leadingSpace = 0;
      break;

    case 'flex-end':
      leadingSpace = freeSpace;
      break;

    case 'center':
      leadingSpace = Math.floor(freeSpace / 2);
      break;

    case 'space-between': {
      if (n > 1) {
        const extraPerGap = Math.floor(freeSpace / (n - 1));
        const rem = freeSpace % (n - 1);
        for (let i = 0; i < n - 1; i++) {
          gaps[i] = baseGap + extraPerGap + (i === n - 2 ? rem : 0);
        }
      }
      break;
    }

    case 'space-around': {
      const slot = freeSpace / n;
      const halfSlot = Math.floor(slot / 2);
      leadingSpace = halfSlot;
      const midSlot = Math.floor(slot);
      for (let i = 0; i < n - 1; i++) {
        gaps[i] = baseGap + midSlot;
      }
      break;
    }

    case 'space-evenly': {
      const slot = Math.floor(freeSpace / (n + 1));
      const rem = freeSpace % (n + 1);
      leadingSpace = slot;
      for (let i = 0; i < n - 1; i++) {
        gaps[i] = baseGap + slot + (i === n - 2 ? rem : 0);
      }
      break;
    }
  }

  return { leadingSpace, gaps };
}

/**
 * Aligns a child block vertically within a row of height `targetHeight`.
 */
export function alignBlockInRow(
  block: Block,
  targetHeight: number,
  targetWidth: number,
  align: AlignItems,
  alignSelf?: AlignSelf,
): Block {
  const actualAlign = alignSelf && alignSelf !== 'auto' ? alignSelf : align;
  const currentHeight = block.lines.length;
  const heightDiff = Math.max(0, targetHeight - currentHeight);

  let padTop = 0;
  let padBottom = 0;

  if (actualAlign === 'center') {
    padTop = Math.floor(heightDiff / 2);
    padBottom = heightDiff - padTop;
  } else if (actualAlign === 'flex-end') {
    padTop = heightDiff;
    padBottom = 0;
  } else {
    // flex-start or stretch
    padTop = 0;
    padBottom = heightDiff;
  }

  const paddedLines: string[] = [];
  const emptyRow = ' '.repeat(targetWidth);

  for (let i = 0; i < padTop; i++) {
    paddedLines.push(emptyRow);
  }

  for (const line of block.lines) {
    const lineW = visibleWidth(line);
    const rightPad = Math.max(0, targetWidth - lineW);
    paddedLines.push(line + ' '.repeat(rightPad));
  }

  for (let i = 0; i < padBottom; i++) {
    paddedLines.push(emptyRow);
  }

  return {
    lines: paddedLines,
    width: targetWidth,
  };
}
