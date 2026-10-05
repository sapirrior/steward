import { describe, it, expect } from 'bun:test';
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

function getAllTsFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
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

describe('Monorepo Package Boundary Rules', () => {
  const rootDir = join(import.meta.dir, '../../..');
  const tuiRoot = join(rootDir, 'packages/tui/src');
  const tuiPackageRoot = join(rootDir, 'packages/tui');
  const uiRoot = join(rootDir, 'packages/cli/src/interface');

  const allTuiFiles = getAllTsFiles(tuiRoot);
  const allUiFiles = getAllTsFiles(uiRoot);

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
          imp.source.includes('/ui/') ||
          imp.source.includes('@steward/cli')
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

  it('Rule 4: Rules.txt must be present and non-empty in packages/tui/', () => {
    const rulesPath = join(tuiPackageRoot, 'Rules.txt');
    const content = readFileSync(rulesPath, 'utf-8');
    expect(content.length).toBeGreaterThan(100);
    expect(content).toContain('STEWARD TUI — MASTER RULES');
  });

  it('Rule 5: Generic sibling isolation — {ai, agent, oauth, tui} must not import each other or cli', () => {
    const packages: Array<{ name: string; dirName: string; selfNames: string[] }> = [
      { name: '@steward/ai', dirName: 'ai', selfNames: ['@steward/ai'] },
      { name: '@steward/agent', dirName: 'agent', selfNames: ['@steward/agent'] },
      { name: '@steward/oauth', dirName: 'oauth', selfNames: ['@steward/oauth'] },
      { name: 'stitchable', dirName: 'tui', selfNames: ['stitchable', '@steward/tui'] },
    ];

    const allPkgIdentities = [
      '@steward/ai',
      '@steward/agent',
      '@steward/oauth',
      '@steward/cli',
      '@steward/tui',
      'stitchable',
    ];
    const violations: string[] = [];

    for (const pkg of packages) {
      const pkgSrc = join(rootDir, 'packages', pkg.dirName, 'src');
      const files = getAllTsFiles(pkgSrc);

      for (const file of files) {
        const rel = relative(pkgSrc, file);
        const imports = extractImports(file);

        for (const imp of imports) {
          for (const ident of allPkgIdentities) {
            if (pkg.selfNames.includes(ident)) continue;
            if (imp.source === ident || imp.source.startsWith(`${ident}/`)) {
              violations.push(
                `${pkg.dirName}/src/${rel}:${imp.line} imports forbidden sibling '${imp.source}'`,
              );
            }
          }
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('Rule 6: Package manifest dependencies — {ai, agent, oauth, tui} must have no sibling dependencies in package.json', () => {
    const packages = [
      { dirName: 'ai', selfNames: ['@steward/ai'] },
      { dirName: 'agent', selfNames: ['@steward/agent'] },
      { dirName: 'oauth', selfNames: ['@steward/oauth'] },
      { dirName: 'tui', selfNames: ['stitchable', '@steward/tui'] },
    ];

    const allPkgIdentities = [
      '@steward/ai',
      '@steward/agent',
      '@steward/oauth',
      '@steward/cli',
      '@steward/tui',
      'stitchable',
    ];
    const violations: string[] = [];

    for (const pkg of packages) {
      const manifestPath = join(rootDir, 'packages', pkg.dirName, 'package.json');
      if (!existsSync(manifestPath)) continue;

      const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
      const deps = Object.keys(manifest.dependencies ?? {});

      for (const dep of deps) {
        if (allPkgIdentities.includes(dep) && !pkg.selfNames.includes(dep)) {
          violations.push(`${pkg.dirName}/package.json lists sibling dependency '${dep}'`);
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
