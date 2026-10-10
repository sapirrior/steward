import { describe, expect, it, beforeEach, afterEach } from 'bun:test';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { FileReadTool } from './FileReadTool.js';

describe('FileReadTool', () => {
  let tempDir: string;
  let tool: FileReadTool;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'steward-read-test-'));
    tool = new FileReadTool();
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('reads a regular file with 1-based line numbers', async () => {
    const testFile = path.join(tempDir, 'test.txt');
    await fs.writeFile(testFile, 'line 1\nline 2\nline 3');

    const res = await tool.execute({ tagline: 'Reading test.txt', path: testFile }, { cwd: tempDir });
    expect(res.success).toBe(true);
    expect(res.output).toContain('1 | line 1');
    expect(res.output).toContain('2 | line 2');
    expect(res.output).toContain('3 | line 3');
    expect(res.data?.totalLines).toBe(3);
    expect(res.data?.isTruncated).toBe(false);
  });

  it('slices lines with offset and limit', async () => {
    const testFile = path.join(tempDir, 'numbered.txt');
    const content = Array.from({ length: 20 }, (_, i) => `row ${i + 1}`).join('\n');
    await fs.writeFile(testFile, content);

    const res = await tool.execute(
      { tagline: 'Reading rows 5 to 7', path: testFile, offset: 5, limit: 3 },
      { cwd: tempDir }
    );
    expect(res.success).toBe(true);
    expect(res.output).toContain('5 | row 5');
    expect(res.output).toContain('6 | row 6');
    expect(res.output).toContain('7 | row 7');
    expect(res.output).not.toContain('4 | row 4');
    expect(res.output).not.toContain('8 | row 8');
    expect(res.data?.startLine).toBe(5);
    expect(res.data?.endLine).toBe(7);
    expect(res.data?.totalLines).toBe(20);
    expect(res.data?.isTruncated).toBe(true);
  });

  it('errors gracefully when file does not exist', async () => {
    const res = await tool.execute(
      { tagline: 'Reading non-existent file', path: 'non-existent.txt' },
      { cwd: tempDir }
    );
    expect(res.success).toBe(false);
    expect(res.output).toContain("File not found: 'non-existent.txt'");
  });

  it('errors when path is a directory', async () => {
    const res = await tool.execute({ tagline: 'Reading dir', path: tempDir }, { cwd: tempDir });
    expect(res.success).toBe(false);
    expect(res.output).toContain('is a directory');
  });

  it('blocks reading binary extensions', async () => {
    const binFile = path.join(tempDir, 'test.png');
    await fs.writeFile(binFile, 'binary-bytes');

    const res = await tool.execute({ tagline: 'Reading png', path: binFile }, { cwd: tempDir });
    expect(res.success).toBe(false);
    expect(res.output).toContain('appears to be a binary file');
  });

  it('blocks reading special device paths', async () => {
    const res = await tool.execute({ tagline: 'Reading device', path: '/dev/zero' }, { cwd: tempDir });
    expect(res.success).toBe(false);
    expect(res.output).toContain('special device file');
  });

  it('handles offset out of bounds', async () => {
    const testFile = path.join(tempDir, 'short.txt');
    await fs.writeFile(testFile, 'a\nb');

    const res = await tool.execute(
      { tagline: 'Reading past EOF', path: testFile, offset: 10 },
      { cwd: tempDir }
    );
    expect(res.success).toBe(false);
    expect(res.output).toContain('Offset 10 is beyond the total line count');
  });

  it('requires tagline parameter in schema validation', () => {
    expect(() => tool.validateInput({ path: 'test.txt' })).toThrow(/tagline/);
    const valid = tool.validateInput({ tagline: 'Reading file', path: 'test.txt' });
    expect(valid.tagline).toBe('Reading file');
  });
});
