import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect } from 'bun:test';
import {
  TerminalEngine,
  StateRenderer,
  memoryIO,
  type MemoryIO,
  type DocumentTree,
  type DocumentFrame,
  type Component,
} from 'stitchable';
import { TUIApp, type TUIAppOptions } from '../../src/app.js';

export interface TestEngineOptions {
  columns?: number;
  rows?: number;
  mouse?: boolean;
  scrollKeys?: boolean;
}

export function makeEngine(opts: TestEngineOptions = {}): {
  engine: TerminalEngine;
  io: MemoryIO;
} {
  const io = memoryIO({
    columns: opts.columns ?? 80,
    rows: opts.rows ?? 24,
  });

  const engine = new TerminalEngine({
    io,
    exitHook: false,
    mouse: opts.mouse ?? true,
    scrollKeys: opts.scrollKeys ?? true,
  });

  return { engine, io };
}

export function makeApp(opts: TUIAppOptions & { columns?: number; rows?: number } = {}): {
  app: TUIApp;
  engine: TerminalEngine;
  io: MemoryIO;
} {
  const io = memoryIO({
    columns: opts.columns ?? 80,
    rows: opts.rows ?? 24,
  });

  const app = new TUIApp({
    ...opts,
    io,
  });

  return { app, engine: app.engine, io };
}

export interface HeadlessRenderResult {
  rawAnsi: string;
  frame: DocumentFrame;
  screenRows: string[];
}

export interface RenderOptions {
  cols?: number;
  rows?: number;
  scrollOffset?: number;
  forceFull?: boolean;
}

const GOLDENS_DIR = join(import.meta.dir, '../tui/goldens');

/**
 * Runs a render callback headlessly using memoryIO without touching process.stdout.
 */
export function captureHeadlessRender(
  renderFn: (renderer: StateRenderer, io: MemoryIO) => DocumentFrame,
  options: RenderOptions = {},
  existingRenderer?: StateRenderer,
): HeadlessRenderResult {
  const cols = options.cols ?? 80;
  const rows = options.rows ?? 24;
  const io = memoryIO({ columns: cols, rows });
  const renderer = existingRenderer ?? new StateRenderer();
  (renderer as any).defaultIO = io;

  const frame = renderFn(renderer, io);

  return {
    rawAnsi: io.written,
    frame,
    screenRows: frame.lines,
  };
}

/**
 * Renders a DocumentTree headlessly using memoryIO.
 */
export function renderTreeHeadless(
  tree: DocumentTree,
  options: RenderOptions = {},
  existingRenderer?: StateRenderer,
): HeadlessRenderResult {
  return captureHeadlessRender(
    (renderer, io) => {
      return renderer.render(
        tree,
        options.scrollOffset ?? 0,
        options.forceFull ?? false,
        new Map(),
        io,
      );
    },
    options,
    existingRenderer,
  );
}

/**
 * Asserts the captured output matches the golden file on disk.
 * Strictly throws if the golden file does not exist, unless UPDATE_GOLDENS=1 is explicitly passed.
 */
export function assertGoldenMatch(goldenName: string, actualOutput: string): void {
  if (!existsSync(GOLDENS_DIR)) {
    mkdirSync(GOLDENS_DIR, { recursive: true });
  }

  const filePath = join(GOLDENS_DIR, `${goldenName}.txt`);
  const shouldUpdate = process.env.UPDATE_GOLDENS === '1' || process.env.UPDATE_GOLDENS === 'true';

  if (!existsSync(filePath)) {
    if (shouldUpdate) {
      writeFileSync(filePath, actualOutput, 'utf-8');
      return;
    }
    throw new Error(
      `Golden file does not exist: ${filePath}. Run with UPDATE_GOLDENS=1 to record.`,
    );
  }

  if (shouldUpdate) {
    writeFileSync(filePath, actualOutput, 'utf-8');
  } else {
    const expected = readFileSync(filePath, 'utf-8');
    expect(actualOutput).toBe(expected);
  }
}

/**
 * Renders a component at the specified width and returns its output lines.
 */
export function screen(component: Component, width = 80): string[] {
  return component.getLines(width);
}
