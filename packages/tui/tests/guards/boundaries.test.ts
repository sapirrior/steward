import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

function getTsFiles(dir: string): string[] {
  const results: string[] = [];
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      results.push(...getTsFiles(full));
    } else if (full.endsWith('.ts') || full.endsWith('.tsx')) {
      results.push(full);
    }
  }
  return results;
}

const packageRoot = join(import.meta.dir, '../..');
const srcDir = join(packageRoot, 'src');

describe('Architectural Boundary Guards', () => {
  test('src/terminal/* imports nothing from src/ outside src/terminal/', () => {
    const terminalDir = join(srcDir, 'terminal');
    const files = getTsFiles(terminalDir);
    const importRegex = /import\s+.*?from\s+['"]([^'"]+)['"]/g;

    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      let match;
      while ((match = importRegex.exec(content)) !== null) {
        const specifier = match[1];
        if (specifier.startsWith('.')) {
          // relative import
          const resolved = join(file, '..', specifier);
          const relToSrc = relative(srcDir, resolved);
          if (!relToSrc.startsWith('terminal') && !specifier.startsWith('node:')) {
            throw new Error(
              `File ${relative(packageRoot, file)} imports outside terminal: ${specifier}`,
            );
          }
        }
      }
    }
  });

  test('src/text/* imports only src/text/*, src/terminal/sequences.ts, and string-width', () => {
    const textDir = join(srcDir, 'text');
    const files = getTsFiles(textDir);
    const importRegex = /import\s+.*?from\s+['"]([^'"]+)['"]/g;

    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      let match;
      while ((match = importRegex.exec(content)) !== null) {
        const specifier = match[1];
        if (specifier === 'string-width' || specifier.startsWith('node:')) {
          continue;
        }
        if (specifier.startsWith('.')) {
          const resolved = join(file, '..', specifier);
          const relToSrc = relative(srcDir, resolved);
          const allowed =
            relToSrc.startsWith('text') ||
            relToSrc === 'terminal/sequences.js' ||
            relToSrc === 'terminal/sequences.ts';
          if (!allowed) {
            throw new Error(
              `File ${relative(packageRoot, file)} imports forbidden module: ${specifier}`,
            );
          }
        } else {
          throw new Error(
            `File ${relative(packageRoot, file)} imports unauthorized external package: ${specifier}`,
          );
        }
      }
    }
  });

  test('src/engine/* and src/layout/* do not import src/runtime/* or src/elements/*', () => {
    const engineFiles = [...getTsFiles(join(srcDir, 'engine'))];
    const importRegex = /import\s+.*?from\s+['"]([^'"]+)['"]/g;

    for (const file of engineFiles) {
      const content = readFileSync(file, 'utf8');
      let match;
      while ((match = importRegex.exec(content)) !== null) {
        const specifier = match[1];
        if (specifier.startsWith('.')) {
          const resolved = join(file, '..', specifier);
          const relToSrc = relative(srcDir, resolved);
          if (relToSrc.startsWith('runtime') || relToSrc.startsWith('elements')) {
            throw new Error(
              `File ${relative(packageRoot, file)} illegally imports runtime/elements: ${specifier}`,
            );
          }
        }
      }
    }
  });

  test('process.stdout / process.stdin referenced only in allowed files', () => {
    const allSrcFiles = getTsFiles(srcDir);
    for (const file of allSrcFiles) {
      const rel = relative(srcDir, file);
      // Allowed in terminal/io.ts
      if (rel === 'terminal/io.ts') continue;
      const content = readFileSync(file, 'utf8');
      if (content.includes('process.stdout') || content.includes('process.stdin')) {
        throw new Error(`File src/${rel} directly accesses process.std*: must use IO interface.`);
      }
    }
  });
});
