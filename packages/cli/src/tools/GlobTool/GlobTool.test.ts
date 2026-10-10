import { describe, expect, it, beforeEach, afterEach } from 'bun:test';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { GlobTool } from './GlobTool.js';

describe('GlobTool', () => {
  let tempDir: string;
  let tool: GlobTool;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'steward-glob-test-'));
    tool = new GlobTool();

    // Create a mock directory structure
    await fs.mkdir(path.join(tempDir, 'src/nested'), { recursive: true });
    await fs.mkdir(path.join(tempDir, 'node_modules/pkg'), { recursive: true });
    await fs.writeFile(path.join(tempDir, 'src/index.ts'), 'export const a = 1;');
    await fs.writeFile(path.join(tempDir, 'src/nested/util.ts'), 'export const b = 2;');
    await fs.writeFile(path.join(tempDir, 'src/nested/util.js'), 'export const c = 3;');
    await fs.writeFile(path.join(tempDir, 'node_modules/pkg/index.js'), 'module.exports = {};');
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('finds files matching glob pattern', async () => {
    const res = await tool.execute(
      { tagline: 'Finding ts files', pattern: '**/*.ts' },
      { cwd: tempDir },
    );
    expect(res.success).toBe(true);
    expect(res.data?.files).toContain('src/index.ts');
    expect(res.data?.files).toContain('src/nested/util.ts');
    expect(res.data?.files).not.toContain('src/nested/util.js');
    expect(res.data?.totalMatches).toBe(2);
  });

  it('filters out node_modules by default', async () => {
    const res = await tool.execute(
      { tagline: 'Finding js files', pattern: '**/*.js' },
      { cwd: tempDir },
    );
    expect(res.success).toBe(true);
    expect(res.data?.files).toContain('src/nested/util.js');
    expect(res.data?.files).not.toContain('node_modules/pkg/index.js');
  });

  it('respects result limit', async () => {
    const res = await tool.execute(
      { tagline: 'Finding ts with limit', pattern: '**/*.ts', limit: 1 },
      { cwd: tempDir },
    );
    expect(res.success).toBe(true);
    expect(res.data?.files.length).toBe(1);
    expect(res.data?.isTruncated).toBe(true);
    expect(res.output).toContain('(Showing 1 of 2 matches');
  });

  it('handles non-existent search directory', async () => {
    const res = await tool.execute(
      { tagline: 'Finding non-existent dir', pattern: '*.ts', path: 'non-existent' },
      { cwd: tempDir },
    );
    expect(res.success).toBe(false);
    expect(res.output).toContain('does not exist');
  });

  it('handles search in specific subdirectory', async () => {
    const res = await tool.execute(
      { tagline: 'Finding in nested dir', pattern: '*.ts', path: 'src/nested' },
      { cwd: tempDir },
    );
    expect(res.success).toBe(true);
    expect(res.data?.files).toEqual(['util.ts']);
  });

  it('requires tagline parameter in schema validation', () => {
    expect(() => tool.validateInput({ pattern: '**/*.ts' })).toThrow(/tagline/);
    const valid = tool.validateInput({ tagline: 'Scanning files', pattern: '**/*.ts' });
    expect(valid.tagline).toBe('Scanning files');
  });
});
