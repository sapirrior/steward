/** @jsxImportSource stitchable */
import { BashCard } from '../components/messages/BashCard.js';
import type { ToolRendererProps } from './registry.js';

export function BashToolRenderer({ toolCall, theme, isExpanded }: ToolRendererProps) {
  const cmd = String(toolCall.args?.command || '');
  const out =
    typeof toolCall.result === 'string'
      ? toolCall.result
      : (toolCall.result as any)?.output || '';

  return (
    <BashCard
      command={cmd}
      output={out}
      theme={theme}
      isExpanded={Boolean(isExpanded)}
    />
  );
}
