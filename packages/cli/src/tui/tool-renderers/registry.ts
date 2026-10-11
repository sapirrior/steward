/** @jsxImportSource stitchable */
import type { Theme } from '../../themes/themeTypes.js';
import type { ActiveToolCallState } from '../types.js';

export interface ToolRendererProps {
  toolCall: ActiveToolCallState;
  theme: Theme;
  isExpanded?: boolean;
}

export interface ToolRendererEntry {
  toolName: string;
  component: (props: ToolRendererProps) => any;
}

export class ToolRendererRegistry {
  private readonly renderers = new Map<string, (props: ToolRendererProps) => any>();
  private defaultRenderer: ((props: ToolRendererProps) => any) | null = null;

  register(toolName: string, component: (props: ToolRendererProps) => any): void {
    this.renderers.set(toolName, component);
  }

  setDefaultRenderer(component: (props: ToolRendererProps) => any): void {
    this.defaultRenderer = component;
  }

  getRenderer(toolName: string): (props: ToolRendererProps) => any {
    return this.renderers.get(toolName) ?? this.defaultRenderer!;
  }
}

import { DefaultToolRenderer } from './DefaultToolRenderer.js';
import { BashToolRenderer } from './BashToolRenderer.js';

export const toolRendererRegistry = new ToolRendererRegistry();
toolRendererRegistry.setDefaultRenderer(DefaultToolRenderer);
toolRendererRegistry.register('bash', BashToolRenderer);
