import { describe, expect, it } from 'bun:test';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

function getFilesRecursively(dir: string): string[] {
  const results: string[] = [];
  const list = readdirSync(dir);
  for (const file of list) {
    const filePath = join(dir, file);
    const stat = statSync(filePath);
    if (stat.isDirectory()) {
      if (
        file !== 'node_modules' &&
        file !== '.git' &&
        file !== 'dist' &&
        file !== '.agents' &&
        file !== '.tmp'
      ) {
        results.push(...getFilesRecursively(filePath));
      }
    } else if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js')) {
      if (!filePath.endsWith('no-ai-sdk.test.ts')) {
        results.push(filePath);
      }
    }
  }
  return results;
}

describe('Architecture Boundary: No AI SDK Imports Gate', () => {
  it('ensures zero imports from "ai" or "@ai-sdk/*" anywhere in src/ and tests/', () => {
    const srcFiles = getFilesRecursively('src');
    const testFiles = getFilesRecursively('tests');
    const allFiles = [...srcFiles, ...testFiles];

    const forbiddenPatterns = [
      /from\s+['"]ai['"]/,
      /from\s+['"]@ai-sdk\//,
      /require\(['"]ai['"]\)/,
      /require\(['"]@ai-sdk\//,
    ];

    const violations: { file: string; line: number; text: string }[] = [];

    for (const filePath of allFiles) {
      const content = readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');
      lines.forEach((line, index) => {
        for (const pattern of forbiddenPatterns) {
          if (pattern.test(line)) {
            violations.push({
              file: filePath,
              line: index + 1,
              text: line.trim(),
            });
          }
        }
      });
    }

    expect(violations).toEqual([]);
  });

  it('ensures package.json has no "ai" or "@ai-sdk/*" dependencies', () => {
    const pkgRaw = readFileSync('package.json', 'utf-8');
    const pkg = JSON.parse(pkgRaw);
    const deps = Object.keys(pkg.dependencies || {});
    const devDeps = Object.keys(pkg.devDependencies || {});
    const allDeps = [...deps, ...devDeps];

    const forbidden = allDeps.filter((d) => d === 'ai' || d.startsWith('@ai-sdk/'));
    expect(forbidden).toEqual([]);
  });
});
