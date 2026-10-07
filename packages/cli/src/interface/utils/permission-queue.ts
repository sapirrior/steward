import type {
  BashPermissionRequest,
  BashPermissionResponse,
  FilePermissionRequest,
  FilePermissionResponse,
} from '../../tools/types.js';

export type QueuedPermissionItem =
  | {
      id: string;
      kind: 'bash';
      request: BashPermissionRequest;
      resolve: (res: BashPermissionResponse) => void;
      signal?: AbortSignal;
      abortListener?: () => void;
    }
  | {
      id: string;
      kind: 'file';
      request: FilePermissionRequest;
      resolve: (res: FilePermissionResponse) => void;
      signal?: AbortSignal;
      abortListener?: () => void;
    };

export type PermissionQueueItem = QueuedPermissionItem;

export interface PermissionQueueOptions {
  onShow: (item: QueuedPermissionItem) => void;
  onHide: () => void;
}

export class PermissionQueue {
  private queue: QueuedPermissionItem[] = [];
  private activeItem: QueuedPermissionItem | null = null;
  private onShow: (item: QueuedPermissionItem) => void;
  private onHide: () => void;
  private counter = 0;

  constructor(options: PermissionQueueOptions) {
    this.onShow = options.onShow;
    this.onHide = options.onHide;
  }

  public get active(): QueuedPermissionItem | null {
    return this.activeItem;
  }

  public get pendingCount(): number {
    return this.queue.length;
  }

  public get isPending(): boolean {
    return this.activeItem !== null || this.queue.length > 0;
  }

  public enqueueBash(
    request: BashPermissionRequest,
    signal?: AbortSignal,
  ): Promise<BashPermissionResponse> {
    const id = `bash-${++this.counter}`;
    return new Promise((resolve) => {
      if (signal?.aborted) {
        resolve({ allowed: false });
        return;
      }

      const item: QueuedPermissionItem = {
        id,
        kind: 'bash',
        request,
        resolve,
        signal,
      };

      this.setupAbortListener(item);
      this.queue.push(item);
      this.processQueue();
    });
  }

  public enqueueFile(
    request: FilePermissionRequest,
    signal?: AbortSignal,
  ): Promise<FilePermissionResponse> {
    const id = `file-${++this.counter}`;
    return new Promise((resolve) => {
      if (signal?.aborted) {
        resolve({ allowed: false });
        return;
      }

      const item: QueuedPermissionItem = {
        id,
        kind: 'file',
        request,
        resolve,
        signal,
      };

      this.setupAbortListener(item);
      this.queue.push(item);
      this.processQueue();
    });
  }

  private setupAbortListener(item: QueuedPermissionItem): void {
    if (!item.signal) return;
    const onAbort = () => {
      if (this.activeItem === item) {
        this.cleanupItem(item);
        this.activeItem = null;
        this.onHide();
        item.resolve({ allowed: false });
        this.processQueue();
      } else {
        const idx = this.queue.indexOf(item);
        if (idx !== -1) {
          this.queue.splice(idx, 1);
          this.cleanupItem(item);
          item.resolve({ allowed: false });
        }
      }
    };
    item.abortListener = onAbort;
    item.signal.addEventListener('abort', onAbort, { once: true });
  }

  private cleanupItem(item: QueuedPermissionItem): void {
    if (item.signal && item.abortListener) {
      item.signal.removeEventListener('abort', item.abortListener);
    }
  }

  public resolveActive(allowed: boolean): void {
    if (!this.activeItem) return;
    const item = this.activeItem;
    this.cleanupItem(item);
    this.activeItem = null;
    this.onHide();
    item.resolve({ allowed });
    this.processQueue();
  }

  public clear(): void {
    const queued = [...this.queue];
    this.queue = [];
    for (const item of queued) {
      this.cleanupItem(item);
      item.resolve({ allowed: false });
    }
    if (this.activeItem) {
      const item = this.activeItem;
      this.cleanupItem(item);
      this.activeItem = null;
      item.resolve({ allowed: false });
    }
    this.onHide();
  }

  private processQueue(): void {
    if (this.activeItem) return;

    if (this.queue.length === 0) {
      return;
    }

    this.activeItem = this.queue.shift()!;
    this.onShow(this.activeItem);
  }
}
