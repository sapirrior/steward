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

  it('Rule 7: Required layers must exist and interface/components must contain components', () => {
    const cliSrc = join(rootDir, 'packages/cli/src');
    const requiredLayers = [
      'cli',
      'app',
      'interface',
      'slash',
      'settings',
      'theme',
      'errors',
      'utils',
    ];

    for (const layer of requiredLayers) {
      const layerPath = join(cliSrc, layer);
      expect(existsSync(layerPath)).toBe(true);
    }

    const componentsPath = join(cliSrc, 'interface/components');
    const componentFiles = getAllTsFiles(componentsPath);
    expect(componentFiles.length).toBeGreaterThan(0);
  });

  it('Rule 8: Intra-package layering in packages/cli/src must follow allowed dependency flow', () => {
    const cliSrc = join(rootDir, 'packages/cli/src');
    const allCliFiles = getAllTsFiles(cliSrc);

    // Allowed target layers per source layer
    const allowedTargets: Record<string, string[]> = {
      main: ['cli'],
      cli: ['app', 'settings'],
      app: ['interface', 'slash', 'settings', 'theme', 'utils', 'errors'],
      interface: ['slash', 'settings', 'theme', 'errors', 'utils'],
      slash: ['settings', 'utils'],
      settings: [],
      theme: [],
      errors: [],
      utils: [],
    };

    const violations: string[] = [];

    for (const file of allCliFiles) {
      const relPath = relative(cliSrc, file);
      const parts = relPath.split('/');
      const sourceLayer = parts.length === 1 ? 'main' : parts[0]!;

      const content = readFileSync(file, 'utf-8');
      // Match all import/export from relative specifiers
      const importMatches = content.matchAll(
        /(?:import|export)\s+(?:type\s+)?(?:[\s\S]*?from\s+)?['"](\.[^'"]+)['"]/g,
      );

      for (const match of importMatches) {
        const fullStatement = match[0];
        const specifier = match[1]!;
        // Resolve absolute path of imported module
        const resolvedPath = join(file, '..', specifier);
        const resolvedRel = relative(cliSrc, resolvedPath);

        if (resolvedRel.startsWith('..')) {
          continue; // outside packages/cli/src (e.g. package.json)
        }

        const resolvedParts = resolvedRel.split('/');
        const targetLayer = resolvedParts.length === 1 ? 'main' : resolvedParts[0]!;

        if (sourceLayer === targetLayer) {
          continue; // same layer is always allowed
        }

        // slash -> interface is allowed for type-only imports (enforced by Rule 9)
        if (
          sourceLayer === 'slash' &&
          targetLayer === 'interface' &&
          /^(?:import|export)\s+type\s+/.test(fullStatement)
        ) {
          continue;
        }

        const allowed = allowedTargets[sourceLayer] ?? [];
        if (!allowed.includes(targetLayer)) {
          violations.push(
            `${relPath} (layer: ${sourceLayer}) -> ${specifier} (layer: ${targetLayer})`,
          );
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('Rule 9: slash to interface imports must be type-only', () => {
    const cliSrc = join(rootDir, 'packages/cli/src');
    const slashFiles = getAllTsFiles(join(cliSrc, 'slash'));
    const violations: string[] = [];

    for (const file of slashFiles) {
      const rel = relative(cliSrc, file);
      const content = readFileSync(file, 'utf-8');
      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;
        if (line.includes('../interface') || line.includes('../../interface')) {
          const isTypeOnly = /^\s*import\s+type\s+/.test(line);
          if (!isTypeOnly) {
            violations.push(`${rel}:${i + 1} -> non-type import from interface: ${line.trim()}`);
          }
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('Rule 10: slash registry must remain command-agnostic (CommandRegistry class)', () => {
    const cliSrc = join(rootDir, 'packages/cli/src');
    const registryFile = join(cliSrc, 'slash/registry.ts');
    const content = readFileSync(registryFile, 'utf-8');
    expect(content).toContain('class CommandRegistry');
  });
});
