/** @jsxImportSource stitchable */
import { ToolCallItem } from '../components/messages/ToolCallItem.js';
import type { ToolRendererProps } from './registry.js';

export function DefaultToolRenderer({ toolCall, theme }: ToolRendererProps) {
  return <ToolCallItem toolCall={toolCall} theme={theme} />;
}
