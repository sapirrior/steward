import { describe, expect, it, beforeEach, afterEach } from 'bun:test';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { GrepTool } from './GrepTool.js';

describe('GrepTool', () => {
  let tempDir: string;
  let tool: GrepTool;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'steward-grep-test-'));
    tool = new GrepTool();

    await fs.mkdir(path.join(tempDir, 'src'), { recursive: true });
    await fs.writeFile(
      path.join(tempDir, 'src/server.ts'),
      '// Server configuration\nconst port = 8080;\nexport function start() {\n  console.log("Listening on port", port);\n}\n'
    );
    await fs.writeFile(
      path.join(tempDir, 'src/client.ts'),
      '// Client logic\nconst port = 8080;\nexport function connect() {}\n'
    );
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('searches for regex patterns across files', async () => {
    const res = await tool.execute({ pattern: 'const port = \\d+' }, { cwd: tempDir });
    expect(res.success).toBe(true);
    expect(res.data?.totalMatches).toBe(2);
    expect(res.data?.matchedFilesCount).toBe(2);
    expect(res.output).toContain('const port = 8080;');
  });

  it('supports case-insensitive search', async () => {
    const res = await tool.execute({ pattern: 'LISTENING', caseInsensitive: true }, { cwd: tempDir });
    expect(res.success).toBe(true);
    expect(res.data?.totalMatches).toBe(1);
    expect(res.output).toContain('Listening on port');
  });

  it('includes context lines when requested', async () => {
    const res = await tool.execute({ pattern: 'Listening on port', context: 1 }, { cwd: tempDir });
    expect(res.success).toBe(true);
    expect(res.output).toContain('export function start()');
  });

  it('respects limit and indicates truncation', async () => {
    const res = await tool.execute({ pattern: 'port', limit: 1 }, { cwd: tempDir });
    expect(res.success).toBe(true);
    expect(res.data?.matches.length).toBe(1);
    expect(res.data?.isTruncated).toBe(true);
    expect(res.output).toContain('(Showing 1 of');
  });

  it('filters with glob parameter', async () => {
    const res = await tool.execute({ pattern: 'port', glob: '**/client.ts' }, { cwd: tempDir });
    expect(res.success).toBe(true);
    expect(res.data?.matchedFilesCount).toBe(1);
    expect(res.data?.matches[0].file).toContain('client.ts');
  });
});
