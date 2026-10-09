export interface ErrorInfo {
  componentStack?: string;
}

export function isErrorBoundaryClass(type: unknown): boolean {
  if (typeof type !== 'function') return false;
  const proto = type.prototype;
  if (!proto) return false;
  return (
    typeof (type as any).getDerivedStateFromError === 'function' ||
    typeof proto.componentDidCatch === 'function'
  );
}

export class ComponentRenderError extends Error {
  readonly componentName: string;
  readonly originalError: unknown;

  constructor(componentName: string, originalError: unknown) {
    const message = originalError instanceof Error ? originalError.message : String(originalError);
    super(`Error rendering <${componentName}>: ${message}`);
    this.name = 'ComponentRenderError';
    this.componentName = componentName;
    this.originalError = originalError;
    if (originalError instanceof Error && originalError.stack) {
      this.stack = originalError.stack;
    }
  }
}
