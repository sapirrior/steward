import { describe, expect, it, mock } from 'bun:test';
import { WebSearchTool } from './WebSearchTool.js';

const MOCK_DDG_HTML = `
<!DOCTYPE html>
<html>
<body>
  <div class="result results_links">
    <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fbun.sh%2F">Bun &mdash; Fast JavaScript Runtime</a>
    <span class="result__snippet">Bundle, install, and run <b>JavaScript</b> &amp; TypeScript.</span>
  </div>
  <div class="result results_links badge--ad">
    <a class="result__a" href="https://ad.com">Sponsored Ad</a>
  </div>
  <div class="result results_links">
    <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fgithub.com%2Foven-sh%2Fbun">GitHub - oven-sh/bun</a>
    <span class="result__snippet">Incredibly fast JavaScript runtime and toolkit.</span>
  </div>
</body>
</html>
`;

describe('WebSearchTool', () => {
  const tool = new WebSearchTool();

  it('searches and extracts structured search hits with entity decoding', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(async () => {
      return new Response(MOCK_DDG_HTML, {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      });
    }) as any;

    try {
      const res = await tool.execute(
        { query: 'bun runtime', limit: 5, tagline: 'Searching bun runtime' },
        { cwd: process.cwd() },
      );
      expect(res.success).toBe(true);
      expect(res.data?.results.length).toBe(2);
      expect(res.data?.results[0].title).toBe('Bun — Fast JavaScript Runtime');
      expect(res.data?.results[0].url).toBe('https://bun.sh/');
      expect(res.data?.results[0].snippet).toContain('JavaScript & TypeScript.');
      expect(res.data?.results[1].url).toBe('https://github.com/oven-sh/bun');
      expect(res.output).toContain('[Bun — Fast JavaScript Runtime](https://bun.sh/)');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('filters results by allowedDomains', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(async () => {
      return new Response(MOCK_DDG_HTML, {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      });
    }) as any;

    try {
      const res = await tool.execute(
        {
          query: 'bun runtime',
          allowedDomains: ['github.com'],
          tagline: 'Searching with domain filter',
        },
        { cwd: process.cwd() },
      );
      expect(res.success).toBe(true);
      expect(res.data?.results.length).toBe(1);
      expect(res.data?.results[0].domain).toBe('github.com');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('filters out results from blockedDomains', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(async () => {
      return new Response(MOCK_DDG_HTML, {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      });
    }) as any;

    try {
      const res = await tool.execute(
        {
          query: 'bun runtime',
          blockedDomains: ['github.com'],
          tagline: 'Searching with blocked domains',
        },
        { cwd: process.cwd() },
      );
      expect(res.success).toBe(true);
      expect(res.data?.results.length).toBe(1);
      expect(res.data?.results[0].domain).toBe('bun.sh');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('handles rate limits or security checks gracefully', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(async () => {
      return new Response('<html><body>Please complete the security check captcha</body></html>', {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      });
    }) as any;

    try {
      const res = await tool.execute(
        { query: 'test', tagline: 'Searching test query' },
        { cwd: process.cwd() },
      );
      expect(res.success).toBe(false);
      expect(res.output).toContain('Search rate limited');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('requires tagline in schema validation', () => {
    expect(() => tool.validateInput({ query: 'bun' } as any)).toThrow(
      "Invalid arguments for tool 'websearch'",
    );
    const parsed = tool.validateInput({ query: 'bun', tagline: 'Searching bun' });
    expect(parsed.tagline).toBe('Searching bun');
  });
});
