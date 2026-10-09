import type { BoxProps, Block, RenderContext, StitchableElement, BorderGlyphs } from './types.js';
import { visibleWidth } from '../text/width.js';
import { resolveBorderStyle } from './border.js';
import { colorToSgr, styleText } from '../terminal/color.js';
import { RESET_SGR } from '../terminal/sequences.js';
import { distributeFlexSpace, computeJustifyGaps, alignBlockInRow, type FlexItem } from './flex.js';
import { renderTextElement, Text } from './Text.js';
import { renderNewlineElement, Newline } from './Newline.js';
import { renderSpacerElement, Spacer } from './Spacer.js';
import { renderTransformElement, Transform } from './Transform.js';

export function parseDimension(
  dim: number | string | undefined,
  parentSize: number,
): number | undefined {
  if (dim === undefined) return undefined;
  if (typeof dim === 'number') return Math.max(0, dim);
  if (typeof dim === 'string' && dim.endsWith('%')) {
    const pct = parseFloat(dim) / 100;
    if (!isNaN(pct)) {
      return Math.max(0, Math.floor(parentSize * pct));
    }
  }
  const parsed = parseInt(dim, 10);
  return isNaN(parsed) ? undefined : Math.max(0, parsed);
}

import Component from '../engine/Component.js';
import { Fragment } from './types.js';

export function renderAnyElement(node: any, context: RenderContext): Block {
  if (node === null || node === undefined || typeof node === 'boolean') {
    return { lines: [], width: 0 };
  }

  if (typeof node === 'string' || typeof node === 'number') {
    return renderTextElement(
      {
        type: 'Text',
        props: { children: [String(node)] },
        children: [String(node)],
      },
      context,
    );
  }

  if (Array.isArray(node)) {
    const blocks = node.map((child) => renderAnyElement(child, context));
    const lines: string[] = [];
    let maxWidth = 0;
    for (const b of blocks) {
      for (const l of b.lines) {
        lines.push(l);
      }
      maxWidth = Math.max(maxWidth, b.width);
    }
    return { lines, width: maxWidth };
  }

  if (typeof node === 'object') {
    // Handle Fragment
    if (node.type === Fragment || node.type === Symbol.for('stitchable.fragment')) {
      return renderAnyElement(node.children ?? node.props?.children, context);
    }

    // Direct object with render(width) method
    if (typeof node.render === 'function') {
      const lines = node.render(context.width);
      return {
        lines,
        width: lines.reduce((max: number, l: string) => Math.max(max, visibleWidth(l)), 0),
      };
    }

    if (typeof node.type === 'function') {
      const typeName = node.type.name;
      if (node.type === Text || typeName === 'Text') {
        return renderTextElement(node, context);
      }
      if (node.type === Newline || typeName === 'Newline') {
        return renderNewlineElement(node, context);
      }
      if (node.type === Spacer || typeName === 'Spacer') {
        return renderSpacerElement(node, context);
      }
      if (node.type === Transform || typeName === 'Transform') {
        return renderTransformElement(node, context, renderAnyElement);
      }
      if (node.type === Box || typeName === 'Box') {
        return renderBoxElement(node, context);
      }

      // Check if it's a class component
      if (
        node.type.prototype &&
        ('render' in node.type.prototype || node.type.prototype instanceof Component)
      ) {
        const instance = new node.type(node.props || {});
        const rendered = instance.render(context.width);
        return renderAnyElement(rendered, context);
      }

      const rendered = node.type({
        ...(node.props || {}),
        children: node.children ?? node.props?.children,
      });
      return renderAnyElement(rendered, context);
    }

    if (typeof node.type === 'string') {
      const typeLower = node.type.toLowerCase();
      if (typeLower === 'text') {
        return renderTextElement(node, context);
      }
      if (typeLower === 'box') {
        return renderBoxElement(node, context);
      }
      throw new Error(`Unknown intrinsic element: <${node.type}>`);
    }

    return renderBoxElement(node, context);
  }

  return { lines: [String(node)], width: visibleWidth(String(node)) };
}

const blockCache = new WeakMap<object, Map<string, Block>>();

export function getCachedBlock(element: object, context: RenderContext): Block | undefined {
  const map = blockCache.get(element);
  if (!map) return undefined;
  const key = `${context.width}:${context.height ?? 0}:${context.colorLevel}:${context.inheritedBg ?? ''}:${context.isNaturalMeasuring ? 1 : 0}`;
  return map.get(key);
}

export function setCachedBlock(element: object, context: RenderContext, block: Block): void {
  let map = blockCache.get(element);
  if (!map) {
    map = new Map<string, Block>();
    blockCache.set(element, map);
  }
  const key = `${context.width}:${context.height ?? 0}:${context.colorLevel}:${context.inheritedBg ?? ''}:${context.isNaturalMeasuring ? 1 : 0}`;
  map.set(key, block);
}

export function renderBoxElement(
  element: StitchableElement<BoxProps>,
  context: RenderContext,
): Block {
  if (element && typeof element === 'object') {
    const cached = getCachedBlock(element, context);
    if (cached) return cached;
  }
  const props = element.props || {};
  if (props.display === 'none') {
    return { lines: [], width: 0 };
  }

  const parentWidth = Math.max(1, context.width);
  const parentHeight = context.height ?? 24;

  // 1. Spacing extraction
  const marginLeft = props.marginLeft ?? props.marginX ?? props.margin ?? 0;
  const marginRight = props.marginRight ?? props.marginX ?? props.margin ?? 0;
  const marginTop = props.marginTop ?? props.marginY ?? props.margin ?? 0;
  const marginBottom = props.marginBottom ?? props.marginY ?? props.margin ?? 0;

  const paddingLeft = props.paddingLeft ?? props.paddingX ?? props.padding ?? 0;
  const paddingRight = props.paddingRight ?? props.paddingX ?? props.padding ?? 0;
  const paddingTop = props.paddingTop ?? props.paddingY ?? props.padding ?? 0;
  const paddingBottom = props.paddingBottom ?? props.paddingY ?? props.padding ?? 0;

  const borderGlyphs: BorderGlyphs | null = resolveBorderStyle(props.borderStyle);
  const hasBorderTop = borderGlyphs ? (props.borderTop ?? true) : false;
  const hasBorderBottom = borderGlyphs ? (props.borderBottom ?? true) : false;
  const hasBorderLeft = borderGlyphs ? (props.borderLeft ?? true) : false;
  const hasBorderRight = borderGlyphs ? (props.borderRight ?? true) : false;

  const borderX = (hasBorderLeft ? 1 : 0) + (hasBorderRight ? 1 : 0);
  const borderY = (hasBorderTop ? 1 : 0) + (hasBorderBottom ? 1 : 0);

  const totalHorizontalOverhead = marginLeft + marginRight + paddingLeft + paddingRight + borderX;
  const totalVerticalOverhead = marginTop + marginBottom + paddingTop + paddingBottom + borderY;

  // 2. Resolve target dimensions
  let explicitWidth = parseDimension(props.width, parentWidth);
  if (explicitWidth !== undefined) {
    if (props.minWidth !== undefined) explicitWidth = Math.max(explicitWidth, props.minWidth);
    if (props.maxWidth !== undefined) explicitWidth = Math.min(explicitWidth, props.maxWidth);
  }

  let explicitHeight = parseDimension(props.height, parentHeight);
  if (explicitHeight !== undefined) {
    if (props.minHeight !== undefined) explicitHeight = Math.max(explicitHeight, props.minHeight);
    if (props.maxHeight !== undefined) explicitHeight = Math.min(explicitHeight, props.maxHeight);
  }

  const availableInnerWidth = Math.max(
    0,
    (explicitWidth !== undefined ? explicitWidth : parentWidth) -
      (paddingLeft + paddingRight + borderX + marginLeft + marginRight),
  );

  const childContext: RenderContext = {
    width: availableInnerWidth,
    height:
      explicitHeight !== undefined
        ? Math.max(0, explicitHeight - totalVerticalOverhead)
        : undefined,
    colorLevel: context.colorLevel,
    inheritedBg: props.backgroundColor ?? context.inheritedBg,
  };

  // 3. Child extraction & Flex layout
  let rawChildren = props.children ?? element.children ?? [];
  if (!Array.isArray(rawChildren)) {
    rawChildren = [rawChildren];
  }
  const childrenList: any[] = [];
  for (const c of rawChildren) {
    if (Array.isArray(c)) {
      childrenList.push(...c);
    } else if (c !== null && c !== undefined && typeof c !== 'boolean') {
      childrenList.push(c);
    }
  }

  const direction = props.flexDirection ?? 'row';
  const isRow = direction === 'row' || direction === 'row-reverse';
  const isReverse = direction === 'row-reverse' || direction === 'column-reverse';
  const itemsList = isReverse ? [...childrenList].reverse() : childrenList;

  const gap = props.gap ?? (isRow ? (props.columnGap ?? 0) : (props.rowGap ?? 0));
  const justifyContent = props.justifyContent ?? 'flex-start';
  const alignItems = props.alignItems ?? 'stretch';

  let innerLines: string[] = [];
  let contentWidth = 0;

  if (itemsList.length === 0) {
    innerLines = [];
    contentWidth = 0;
  } else if (!isRow) {
    // Column layout: stack child blocks vertically
    const childBlocks: Block[] = [];
    for (let i = 0; i < itemsList.length; i++) {
      const child = itemsList[i];
      const block = renderAnyElement(child, childContext);
      childBlocks.push(block);
    }

    const rowGap = gap;
    for (let i = 0; i < childBlocks.length; i++) {
      const block = childBlocks[i]!;
      for (const line of block.lines) {
        innerLines.push(line);
        contentWidth = Math.max(contentWidth, visibleWidth(line));
      }
      if (i < childBlocks.length - 1 && rowGap > 0) {
        for (let g = 0; g < rowGap; g++) {
          innerLines.push('');
        }
      }
    }
  } else {
    // Row layout: horizontal flex distribution
    const childFlexItems: FlexItem[] = [];

    for (const child of itemsList) {
      const isSpacer =
        typeof child === 'object' && (child?.type?.name === 'Spacer' || child?.type === Spacer);
      const flexGrow = isSpacer
        ? 1
        : typeof child === 'object' && child?.props?.flexGrow
          ? child.props.flexGrow
          : 0;
      const flexShrink =
        typeof child === 'object' && child?.props?.flexShrink !== undefined
          ? child.props.flexShrink
          : 1;
      const childWidthProp =
        typeof child === 'object' && child?.props?.width !== undefined
          ? parseDimension(child.props.width, availableInnerWidth)
          : undefined;
      const flexBasisProp =
        typeof child === 'object' && child?.props?.flexBasis !== undefined
          ? parseDimension(child.props.flexBasis, availableInnerWidth)
          : undefined;

      let naturalWidth = 0;
      if (isSpacer) {
        naturalWidth = 0;
      } else if (childWidthProp !== undefined) {
        naturalWidth = childWidthProp;
      } else if (flexBasisProp !== undefined) {
        naturalWidth = flexBasisProp;
      } else {
        const preview = renderAnyElement(child, {
          ...childContext,
          width: availableInnerWidth,
          isNaturalMeasuring: true,
        });
        naturalWidth = Math.max(0, ...preview.lines.map(visibleWidth));
      }

      childFlexItems.push({
        basis: naturalWidth,
        flexGrow,
        flexShrink,
        alignSelf: typeof child === 'object' ? child?.props?.alignSelf : undefined,
      });
    }

    const targetWidths = distributeFlexSpace(childFlexItems, availableInnerWidth, gap);

    // Render children with allocated widths
    const renderedBlocks: Block[] = [];
    for (let i = 0; i < itemsList.length; i++) {
      const child = itemsList[i];
      const allocatedW = targetWidths[i] ?? 0;
      const block = renderAnyElement(child, {
        ...childContext,
        width: Math.max(0, allocatedW),
        isNaturalMeasuring: false,
      });
      renderedBlocks.push(block);
    }

    // Join horizontally
    const tallest = Math.max(1, ...renderedBlocks.map((b) => b.lines.length));
    const alignedBlocks = renderedBlocks.map((b, idx) =>
      alignBlockInRow(
        b,
        tallest,
        targetWidths[idx] ?? b.width,
        alignItems,
        childFlexItems[idx]?.alignSelf,
      ),
    );

    const { leadingSpace, gaps } = computeJustifyGaps(
      justifyContent,
      availableInnerWidth,
      targetWidths,
      gap,
    );

    for (let row = 0; row < tallest; row++) {
      let rowText = ' '.repeat(leadingSpace);
      for (let i = 0; i < alignedBlocks.length; i++) {
        const block = alignedBlocks[i]!;
        rowText += block.lines[row] ?? ' '.repeat(targetWidths[i] ?? block.width);
        if (i < alignedBlocks.length - 1) {
          const currentGap = gaps[i] ?? gap;
          rowText += ' '.repeat(currentGap);
        }
      }
      innerLines.push(rowText);
      contentWidth = Math.max(contentWidth, visibleWidth(rowText));
    }
  }

  // 4. Fill padding and compute inner box bounds
  const innerWidth =
    explicitWidth !== undefined
      ? Math.max(0, explicitWidth - (marginLeft + marginRight + borderX))
      : props.flexGrow && context.width > 0 && !context.isNaturalMeasuring
        ? Math.max(contentWidth + paddingLeft + paddingRight, context.width)
        : contentWidth + paddingLeft + paddingRight;

  const paddedLines: string[] = [];
  const emptyPaddedRow = ' '.repeat(innerWidth);

  for (let i = 0; i < paddingTop; i++) {
    paddedLines.push(emptyPaddedRow);
  }

  for (const line of innerLines) {
    const lineW = visibleWidth(line);
    const leftPad = ' '.repeat(paddingLeft);
    const rightPad = ' '.repeat(Math.max(0, innerWidth - paddingLeft - lineW));
    paddedLines.push(leftPad + line + rightPad);
  }

  for (let i = 0; i < paddingBottom; i++) {
    paddedLines.push(emptyPaddedRow);
  }

  // 5. Apply Height & Overflow Clipping
  if (explicitHeight !== undefined) {
    const targetPaddedHeight = Math.max(0, explicitHeight - (marginTop + marginBottom + borderY));
    while (paddedLines.length < targetPaddedHeight) {
      paddedLines.push(emptyPaddedRow);
    }
    if (props.overflow === 'hidden' || props.overflowY === 'hidden') {
      paddedLines.splice(targetPaddedHeight);
    }
  }

  // 6. Borders
  const finalBoxLines: string[] = [];
  const boxWidth = innerWidth + borderX;

  if (borderGlyphs) {
    const borderColor = props.borderColor;
    const colorizeBorder = (glyph: string, sideColor?: any) => {
      const col = sideColor ?? borderColor;
      if (!col && !props.borderDimColor) return glyph;
      return styleText(glyph, {
        color: col,
        dim: props.borderDimColor,
        colorLevel: context.colorLevel,
      });
    };

    if (hasBorderTop) {
      const tl = colorizeBorder(
        borderGlyphs.topLeft,
        props.borderTopColor ?? props.borderLeftColor,
      );
      const tr = colorizeBorder(
        borderGlyphs.topRight,
        props.borderTopColor ?? props.borderRightColor,
      );
      const horiz = colorizeBorder(
        borderGlyphs.horizontal.repeat(innerWidth),
        props.borderTopColor,
      );
      finalBoxLines.push(`${tl}${horiz}${tr}`);
    }

    for (const rowLine of paddedLines) {
      const left = hasBorderLeft
        ? colorizeBorder(borderGlyphs.vertical, props.borderLeftColor)
        : '';
      const right = hasBorderRight
        ? colorizeBorder(borderGlyphs.vertical, props.borderRightColor)
        : '';
      finalBoxLines.push(`${left}${rowLine}${right}`);
    }

    if (hasBorderBottom) {
      const bl = colorizeBorder(
        borderGlyphs.bottomLeft,
        props.borderBottomColor ?? props.borderLeftColor,
      );
      const br = colorizeBorder(
        borderGlyphs.bottomRight,
        props.borderBottomColor ?? props.borderRightColor,
      );
      const horiz = colorizeBorder(
        borderGlyphs.horizontal.repeat(innerWidth),
        props.borderBottomColor,
      );
      finalBoxLines.push(`${bl}${horiz}${br}`);
    }
  } else {
    for (const rowLine of paddedLines) {
      finalBoxLines.push(rowLine);
    }
  }

  // 7. Background color fill
  if (props.backgroundColor) {
    const bgSgr = colorToSgr(props.backgroundColor, true, context.colorLevel);
    if (bgSgr) {
      for (let i = 0; i < finalBoxLines.length; i++) {
        finalBoxLines[i] = `${bgSgr}${finalBoxLines[i]}${RESET_SGR}`;
      }
    }
  }

  // 8. Margins
  const resultWithMargin: string[] = [];
  const emptyMarginRow = ' '.repeat(boxWidth + marginLeft + marginRight);

  for (let i = 0; i < marginTop; i++) {
    resultWithMargin.push(emptyMarginRow);
  }

  for (const line of finalBoxLines) {
    const leftM = ' '.repeat(marginLeft);
    const rightM = ' '.repeat(marginRight);
    resultWithMargin.push(`${leftM}${line}${rightM}`);
  }

  for (let i = 0; i < marginBottom; i++) {
    resultWithMargin.push(emptyMarginRow);
  }

  const finalTotalWidth = boxWidth + marginLeft + marginRight;

  const blockResult: Block = {
    lines: resultWithMargin,
    width: finalTotalWidth,
  };

  if (element && typeof element === 'object') {
    setCachedBlock(element, context, blockResult);
  }

  return blockResult;
}

export function Box(
  propsOrChildren?: BoxProps | any,
  ...restChildren: any[]
): StitchableElement<BoxProps> {
  let props: BoxProps = {};
  let children: any[] = [];

  if (
    typeof propsOrChildren === 'object' &&
    propsOrChildren !== null &&
    !Array.isArray(propsOrChildren) &&
    !('type' in propsOrChildren)
  ) {
    props = { ...propsOrChildren };
    children =
      props.children !== undefined
        ? Array.isArray(props.children)
          ? props.children
          : [props.children]
        : restChildren;
  } else if (propsOrChildren !== undefined) {
    children = [propsOrChildren, ...restChildren];
    props.children = children;
  }

  const el: StitchableElement<BoxProps> = {
    type: Box,
    props,
    children,
    render(width: number): string[] {
      const block = renderBoxElement(el, {
        width,
        colorLevel: 3,
      });
      return block.lines;
    },
  };

  return el;
}

export default Box;
