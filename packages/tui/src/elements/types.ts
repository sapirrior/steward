import type { ColorLevel } from '../terminal/color.js';

export const Fragment = Symbol.for('stitchable.fragment');

export type ColorValue = string | ((str: string) => string);

export interface TextStyleProps {
  color?: ColorValue;
  backgroundColor?: ColorValue;
  dimColor?: boolean;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  inverse?: boolean;
}

export type TextWrapMode =
  | 'wrap'
  | 'hard'
  | 'truncate'
  | 'truncate-start'
  | 'truncate-middle'
  | 'truncate-end';

export interface TextProps extends TextStyleProps {
  wrap?: TextWrapMode;
  hangingIndent?: number | string;
  children?: any;
}

export type FlexDirection = 'row' | 'column' | 'row-reverse' | 'column-reverse';
export type JustifyContent =
  | 'flex-start'
  | 'flex-end'
  | 'center'
  | 'space-between'
  | 'space-around'
  | 'space-evenly';
export type AlignItems = 'flex-start' | 'center' | 'flex-end' | 'stretch';
export type AlignSelf = 'auto' | 'flex-start' | 'center' | 'flex-end' | 'stretch';

export type BorderStyleName =
  | 'single'
  | 'double'
  | 'round'
  | 'bold'
  | 'singleDouble'
  | 'doubleSingle'
  | 'classic';

export interface BorderGlyphs {
  topLeft: string;
  topRight: string;
  bottomLeft: string;
  bottomRight: string;
  horizontal: string;
  vertical: string;
}

export type BorderStyle = BorderStyleName | BorderGlyphs;

export interface BoxProps {
  // Sizing
  width?: number | string;
  height?: number | string;
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;

  // Spacing: Margin
  margin?: number;
  marginX?: number;
  marginY?: number;
  marginTop?: number;
  marginBottom?: number;
  marginLeft?: number;
  marginRight?: number;

  // Spacing: Padding
  padding?: number;
  paddingX?: number;
  paddingY?: number;
  paddingTop?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  paddingRight?: number;

  // Flex
  flexDirection?: FlexDirection;
  flexGrow?: number;
  flexShrink?: number;
  flexBasis?: number | string;
  justifyContent?: JustifyContent;
  alignItems?: AlignItems;
  alignSelf?: AlignSelf;
  gap?: number;
  columnGap?: number;
  rowGap?: number;

  // Borders
  borderStyle?: BorderStyle;
  borderColor?: ColorValue;
  borderTopColor?: ColorValue;
  borderBottomColor?: ColorValue;
  borderLeftColor?: ColorValue;
  borderRightColor?: ColorValue;
  borderDimColor?: boolean;
  borderTop?: boolean;
  borderBottom?: boolean;
  borderLeft?: boolean;
  borderRight?: boolean;

  // Styling & Display
  backgroundColor?: ColorValue;
  overflow?: 'visible' | 'hidden';
  overflowX?: 'visible' | 'hidden';
  overflowY?: 'visible' | 'hidden';
  display?: 'flex' | 'none';

  children?: any;
}

export interface TransformProps {
  transform: (line: string, index: number) => string;
  children?: any;
}

export interface NewlineProps {
  count?: number;
}

export interface SpacerProps {}

export interface Block {
  lines: string[];
  width: number;
}

export interface RenderContext {
  width: number;
  height?: number;
  colorLevel: ColorLevel;
  inheritedBg?: ColorValue;
  isNaturalMeasuring?: boolean;
}

export interface StitchableElement<P = any> {
  type: any;
  props: P;
  children: any[];
  render?: (width: number) => string[];
}
