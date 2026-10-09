import { describe, expect, it, mock, spyOn } from 'bun:test';
import { WebFetchTool } from './WebFetchTool.js';

describe('WebFetchTool', () => {
  const tool = new WebFetchTool();

  it('rejects non-http/https URLs', async () => {
    const res = await tool.execute({ url: 'file:///etc/passwd' }, { cwd: process.cwd() });
    expect(res.success).toBe(false);
    expect(res.output).toContain('Unsupported URL protocol');
  });

  it('converts HTML content to clean markdown', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(async () => {
      return new Response(
        '<!DOCTYPE html><html><head><title>Test Page</title></head><body><h1>Hello World</h1><p>This is a <a href="https://example.com">link</a>.</p><ul><li>Item 1</li><li>Item 2</li></ul><pre><code>const x = 10;</code></pre></body></html>',
        {
          status: 200,
          statusText: 'OK',
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        }
      );
    });

    try {
      const res = await tool.execute({ url: 'https://example.com/test' }, { cwd: process.cwd() });
      expect(res.success).toBe(true);
      expect(res.output).toContain('# Test Page');
      expect(res.output).toContain('# Hello World');
      expect(res.output).toContain('[link](https://example.com)');
      expect(res.output).toContain('- Item 1');
      expect(res.output).toContain('const x = 10;');
      expect(res.data?.statusCode).toBe(200);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('handles HTTP error statuses gracefully', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(async () => {
      return new Response('Not Found', {
        status: 404,
        statusText: 'Not Found',
        headers: { 'Content-Type': 'text/plain' },
      });
    });

    try {
      const res = await tool.execute({ url: 'https://example.com/missing' }, { cwd: process.cwd() });
      expect(res.success).toBe(false);
      expect(res.output).toContain('HTTP fetch failed with status 404');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
