export interface Instance {
  rerender(tree: any): void;
  unmount(error?: Error | null): void;
  waitUntilExit(): Promise<void>;
  waitUntilRenderFlush(): Promise<void>;
  clear(): void;
  cleanup(): void;
}
