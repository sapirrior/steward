import stringWidth from 'string-width';
import { stripAnsi } from '../text/ansi.js';
import { styleText, type ColorValue } from '../terminal/color.js';
import { truncate } from '../text/truncate.js';
import { wrapVisualLine } from '../text/wrap.js';

export interface TextProps {
  // Styling
  color?: ColorValue;
  backgroundColor?: ColorValue;
  bold?: boolean;
  dim?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  inverse?: boolean;

  // Layout & Alignment
  align?: 'left' | 'center' | 'right';
  wrap?: boolean;
  clip?: boolean;
  ellipsis?: boolean;
  maxWidth?: number;
  hangingIndent?: number;
}

export class TextElement {
  constructor(
    public content: string,
    public props: TextProps = {},
  ) {}

  render(availableWidth: number): string[] {
    const rawContent = this.content ?? '';
    const maxW = this.props.maxWidth
      ? Math.min(availableWidth, this.props.maxWidth)
      : availableWidth;
    const effWidth = Math.max(1, maxW);

    // Apply text styling using terminal/color
    const styled = styleText(rawContent, {
      color: this.props.color,
      backgroundColor: this.props.backgroundColor,
      bold: this.props.bold,
      dim: this.props.dim,
      italic: this.props.italic,
      underline: this.props.underline,
      strikethrough: this.props.strikethrough,
      inverse: this.props.inverse,
    });

    const isWrappable = this.props.wrap ?? true;
    const isClipped = this.props.clip ?? false;

    let lines: string[];
    if (isWrappable) {
      const vLines = styled.split('\n');
      lines = vLines.flatMap((vl) =>
        vl ? wrapVisualLine(vl, effWidth, this.props.hangingIndent ?? 0) : [''],
      );
    } else {
      const vLines = styled.split('\n');
      if (isClipped) {
        lines = vLines.map((vl) => truncateToWidth(vl, effWidth));
      } else {
        lines = vLines;
      }
    }

    // Apply horizontal alignment
    if (this.props.align && this.props.align !== 'left') {
      lines = lines.map((line) => {
        const visWidth = stringWidth(stripAnsi(line));
        const rem = Math.max(0, effWidth - visWidth);
        if (rem === 0) return line;

        if (this.props.align === 'right') {
          return ' '.repeat(rem) + line;
        }
        if (this.props.align === 'center') {
          const left = Math.floor(rem / 2);
          const right = rem - left;
          return ' '.repeat(left) + line + ' '.repeat(right);
        }
        return line;
      });
    }

    return lines;
  }
}

export function Text(content: string, props?: TextProps): TextElement {
  return new TextElement(content, props);
}

export default Text;
