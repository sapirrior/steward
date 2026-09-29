import type {
  TextProps,
  Block,
  RenderContext,
  StitchableElement,
} from './types.js';
import { visibleWidth } from '../text/width.js';
import { truncate } from '../text/truncate.js';
import { wrapVisualLine } from '../text/wrap.js';
import { applyStyleFrame, mergeStyles } from './style.js';
import { colorToSgr } from '../terminal/color.js';
import { RESET_SGR } from '../terminal/sequences.js';

export function hardWrapLine(text: string, width: number): string[] {
  if (width <= 0) return [''];
  const lines: string[] = [];
  let current = '';
  let currentWidth = 0;

  // Walk text preserving SGR codes
  const sgrRegex = /\x1b\[[0-9;]*m/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  const chunks: Array<{ text: string; isSgr: boolean }> = [];
  while ((match = sgrRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      chunks.push({ text: text.slice(lastIndex, match.index), isSgr: false });
    }
    chunks.push({ text: match[0], isSgr: true });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    chunks.push({ text: text.slice(lastIndex), isSgr: false });
  }

  for (const chunk of chunks) {
    if (chunk.isSgr) {
      current += chunk.text;
      continue;
    }

    const segmenter =
      typeof Intl !== 'undefined' && Intl.Segmenter
        ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
        : null;

    const graphemes = segmenter
      ? Array.from(segmenter.segment(chunk.text), (s) => s.segment)
      : Array.from(chunk.text);

    for (const g of graphemes) {
      const gWidth = visibleWidth(g);
      if (currentWidth + gWidth > width && currentWidth > 0) {
        lines.push(current);
        current = g;
        currentWidth = gWidth;
      } else {
        current += g;
        currentWidth += gWidth;
      }
    }
  }

  if (current.length > 0 || lines.length === 0) {
    lines.push(current);
  }

  return lines;
}

/**
 * Flattens nested children into a styled string.
 */
export function flattenStyledChildren(
  node: any,
  parentStyle: TextProps | null,
  context: RenderContext,
): string {
  if (node === null || node === undefined || typeof node === 'boolean') {
    return '';
  }

  if (typeof node === 'string' || typeof node === 'number') {
    const raw = String(node);
    if (!parentStyle) return raw;
    return applyStyleFrame(raw, parentStyle, null, context.colorLevel);
  }

  if (Array.isArray(node)) {
    return node
      .map((child) => flattenStyledChildren(child, parentStyle, context))
      .join('');
  }

  if (typeof node === 'object' && node.type) {
    const childProps = node.props || {};
    const merged = mergeStyles(parentStyle, childProps);
    const inner = flattenStyledChildren(childProps.children ?? node.children, merged, context);
    return inner;
  }

  return String(node);
}

export function renderTextElement(
  element: StitchableElement<TextProps>,
  context: RenderContext,
): Block {
  const props = element.props || {};
  const width = Math.max(1, context.width);
  const wrapMode = props.wrap ?? 'wrap';
  const hangingIndent =
    typeof props.hangingIndent === 'number'
      ? props.hangingIndent
      : typeof props.hangingIndent === 'string'
        ? visibleWidth(props.hangingIndent)
        : 0;

  const styledContent = flattenStyledChildren(
    props.children ?? element.children,
    props,
    context,
  );

  const rawLines = styledContent.split('\n');
  const resultLines: string[] = [];

  for (const rawLine of rawLines) {
    if (wrapMode === 'hard') {
      const wrapped = hardWrapLine(rawLine, width);
      for (const w of wrapped) {
        resultLines.push(w);
      }
    } else if (
      wrapMode === 'truncate' ||
      wrapMode === 'truncate-end' ||
      wrapMode === 'truncate-middle' ||
      wrapMode === 'truncate-start'
    ) {
      const mode =
        wrapMode === 'truncate-start'
          ? 'start'
          : wrapMode === 'truncate-middle'
            ? 'middle'
            : 'end';
      const truncated = truncate(rawLine, width, { mode, ellipsis: '…' });
      resultLines.push(truncated);
    } else {
      // Default: word wrap
      const wrapped = wrapVisualLine(rawLine, width, hangingIndent);
      for (const w of wrapped) {
        resultLines.push(w);
      }
    }
  }

  return {
    lines: resultLines,
    width: Math.min(width, Math.max(...resultLines.map(visibleWidth), 0)),
  };
}

export function Text(
  arg1?: any,
  ...restArgs: any[]
): StitchableElement<TextProps> {
  let props: TextProps = {};
  let children: any[] = [];

  const isPropsObject = (obj: any) =>
    typeof obj === 'object' &&
    obj !== null &&
    !Array.isArray(obj) &&
    !('type' in obj);

  if (isPropsObject(arg1)) {
    props = { ...arg1 };
    if (restArgs.length > 0) {
      children = restArgs.length === 1 && Array.isArray(restArgs[0]) ? restArgs[0] : restArgs;
    } else if (props.children !== undefined) {
      children = Array.isArray(props.children) ? props.children : [props.children];
    }
  } else if (restArgs.length > 0 && isPropsObject(restArgs[0])) {
    props = { ...restArgs[0] };
    children = arg1 !== undefined ? (Array.isArray(arg1) ? arg1 : [arg1]) : [];
  } else {
    children = arg1 !== undefined ? (Array.isArray(arg1) ? arg1 : [arg1, ...restArgs]) : restArgs;
  }

  props.children = children;

  const el: StitchableElement<TextProps> = {
    type: Text,
    props,
    children,
    render(width: number): string[] {
      const block = renderTextElement(el, {
        width,
        colorLevel: 3,
      });
      return block.lines;
    },
  };

  return el;
}

export default Text;
