import { describe, it, expect } from 'bun:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

function getAllTsFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      files.push(...getAllTsFiles(fullPath));
    } else if (entry.endsWith('.ts') || entry.endsWith('.tsx')) {
      files.push(fullPath);
    }
  }
  return files;
}

interface ImportStatement {
  raw: string;
  source: string;
  line: number;
}

function extractImports(filePath: string): ImportStatement[] {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const imports: ImportStatement[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    // Match import ... from '...' or import '...'
    const match = line.match(/^\s*import\s+(?:.+?\s+from\s+)?['"]([^'"]+)['"]/);
    if (match) {
      imports.push({
        raw: line.trim(),
        source: match[1]!,
        line: i + 1,
      });
    }
  }

  return imports;
}

describe('TUI Architecture Boundary Rules (Rules.txt)', () => {
  const tuiRoot = join(import.meta.dir, '../../src/packages/tui/src');
  const tuiPackageRoot = join(import.meta.dir, '../../src/packages/tui');
  const uiRoot = join(import.meta.dir, '../../src/app/ui');
  const appRoot = join(import.meta.dir, '../../src/app');

  const allTuiFiles = getAllTsFiles(tuiRoot);
  const allUiFiles = getAllTsFiles(uiRoot);
  const allAppFiles = getAllTsFiles(appRoot);

  it('Rule 1: Layer 0 (engine, layout) and Layer 1 (primitives) must never import Layer 2 (components)', () => {
    const violations: string[] = [];

    for (const file of allTuiFiles) {
      const rel = relative(tuiRoot, file);
      const isLayer0Or1 =
        rel.startsWith('engine/') || rel.startsWith('layout/') || rel.startsWith('primitives/');

      if (!isLayer0Or1) continue;

      const imports = extractImports(file);
      for (const imp of imports) {
        if (
          imp.source.includes('/components/') ||
          imp.source.endsWith('/components') ||
          imp.source.includes('/app/ui') ||
          imp.source.endsWith('app.js') ||
          imp.source.endsWith('app.ts')
        ) {
          violations.push(`${rel}:${imp.line} -> ${imp.source}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('Rule 2: Layer 0 (engine, layout) must never import Layer 1 (primitives)', () => {
    const violations: string[] = [];

    for (const file of allTuiFiles) {
      const rel = relative(tuiRoot, file);
      const isLayer0 = rel.startsWith('engine/') || rel.startsWith('layout/');
      if (!isLayer0) continue;

      const imports = extractImports(file);
      for (const imp of imports) {
        if (
          imp.source.includes('/primitives/') ||
          imp.source.endsWith('/primitives') ||
          imp.source.includes('primitives/index')
        ) {
          violations.push(`${rel}:${imp.line} -> ${imp.source}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('Rule 3: Layer 2 components must never import string-width or strip-ansi for layout math directly', () => {
    const violations: string[] = [];

    for (const file of allUiFiles) {
      const rel = relative(uiRoot, file);
      const isLayer2 = rel.startsWith('components/');
      if (!isLayer2) continue;
      const imports = extractImports(file);
      for (const imp of imports) {
        if (imp.source === 'string-width' || imp.source === 'strip-ansi') {
          violations.push(`${rel}:${imp.line} -> ${imp.source}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('Rule 4: Rules.txt must be present and non-empty in src/packages/tui/', () => {
    const rulesPath = join(tuiPackageRoot, 'Rules.txt');
    const content = readFileSync(rulesPath, 'utf-8');
    expect(content.length).toBeGreaterThan(100);
    expect(content).toContain('STEWARD TUI — MASTER RULES');
  });

  it('Rule 5: Cross-package architecture - services must never import from agents or app', () => {
    const servicesRoot = join(import.meta.dir, '../../src/packages/services/src');
    const allServicesFiles = getAllTsFiles(servicesRoot);
    const violations: string[] = [];

    for (const file of allServicesFiles) {
      const rel = relative(servicesRoot, file);
      const imports = extractImports(file);
      for (const imp of imports) {
        if (
          imp.source.includes('@steward/agents') ||
          imp.source.includes('/agents/') ||
          imp.source.includes('@steward/app') ||
          imp.source.includes('/app/')
        ) {
          violations.push(`${rel}:${imp.line} -> ${imp.source}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('Rule 6: Cross-package architecture - agents must never import from app', () => {
    const agentsRoot = join(import.meta.dir, '../../src/packages/agents/src');
    const allAgentsFiles = getAllTsFiles(agentsRoot);
    const violations: string[] = [];

    for (const file of allAgentsFiles) {
      const rel = relative(agentsRoot, file);
      const imports = extractImports(file);
      for (const imp of imports) {
        if (
          imp.source.includes('@steward/app') ||
          imp.source.includes('/app/')
        ) {
          violations.push(`${rel}:${imp.line} -> ${imp.source}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
