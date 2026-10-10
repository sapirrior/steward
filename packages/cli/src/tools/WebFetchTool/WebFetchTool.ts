/**
 * @file WebFetchTool.ts
 * @description Fetches web page content over HTTP/HTTPS, strips non-essential tags,
 * converts HTML to clean readable Markdown, enforces chunking/truncation caps,
 * and handles redirects and timeouts gracefully.
 */

import { z } from 'zod';
import { Tool, type ToolContext, type ToolExecutionResult } from '../Tool.js';
import { TOOL_GLYPHS } from '../../constants/index.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_FETCH_TIMEOUT_MS = 15000;
const MAX_CONTENT_LENGTH = 100_000; // 100KB character limit for LLM context

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 (Steward/CLI)';

// ─── Schemas ──────────────────────────────────────────────────────────────────

export const WebFetchSchema = z.object({
  url: z.string().url().describe('The HTTP or HTTPS URL to fetch content from.'),
  tagline: z.string().describe("A concise 2-5 word present-tense summary of what this specific tool call is doing, e.g. 'Running test suite', 'Fetching API documentation'. Used for status logging."),
  prompt: z
    .string()
    .optional()
    .describe('Optional query or prompt describing what specific information to extract from the page.'),
  raw: z
    .boolean()
    .optional()
    .describe('Whether to return raw HTML without markdown conversion. Defaults to false.'),
});

export type WebFetchInput = z.infer<typeof WebFetchSchema>;

export interface WebFetchData {
  url: string;
  finalUrl: string;
  statusCode: number;
  statusText: string;
  contentType: string;
  content: string;
  bytes: number;
  durationMs: number;
  isTruncated: boolean;
}

// ─── HTML to Clean Markdown Helper ────────────────────────────────────────────

export function htmlToCleanMarkdown(html: string): string {
  // Strip non-content blocks: scripts, styles, noscript, iframes, SVGs, forms, head metadata
  let text = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gis, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gis, '')
    .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gis, '')
    .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gis, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gis, '')
    .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gis, '')
    .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gis, '')
    .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gis, '');

  // Extract page title
  const titleMatch = text.match(/<title[^>]*>(.*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : '';

  // Extract main or article content if available to prioritize primary text
  const mainMatch = text.match(/<main[^>]*>(.*?)<\/main>/is) || text.match(/<article[^>]*>(.*?)<\/article>/is);
  if (mainMatch) {
    text = mainMatch[1];
  }

  // Convert headings
  text = text.replace(/<h1[^>]*>(.*?)<\/h1>/gis, '\n# $1\n');
  text = text.replace(/<h2[^>]*>(.*?)<\/h2>/gis, '\n## $1\n');
  text = text.replace(/<h3[^>]*>(.*?)<\/h3>/gis, '\n### $1\n');
  text = text.replace(/<h4[^>]*>(.*?)<\/h4>/gis, '\n#### $1\n');

  // Convert code blocks and inline code
  text = text.replace(/<pre[^>]*><code[^>]*>(.*?)<\/code><\/pre>/gis, '\n```\n$1\n```\n');
  text = text.replace(/<code[^>]*>(.*?)<\/code>/gis, '`$1`');

  // Convert tables
  text = text.replace(/<th[^>]*>(.*?)<\/th>/gis, ' | $1 ');
  text = text.replace(/<td[^>]*>(.*?)<\/td>/gis, ' | $1 ');
  text = text.replace(/<tr[^>]*>(.*?)<\/tr>/gis, '\n$1|\n');

  // Convert lists
  text = text.replace(/<li[^>]*>(.*?)<\/li>/gis, '\n- $1');

  // Convert links
  text = text.replace(/<a\b[^>]*href=["']([^"']*)["'][^>]*>(.*?)<\/a>/gis, '[$2]($1)');

  // Convert paragraphs & line breaks
  text = text.replace(/<p[^>]*>(.*?)<\/p>/gis, '\n$1\n');
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<hr\s*\/?>/gi, '\n---\n');

  // Strip all remaining HTML tags
  text = text.replace(/<[^>]+>/g, '');

  // Decode common HTML entities
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–');

  // Clean up excess whitespace and blank lines
  text = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line, idx, arr) => line.length > 0 || (idx > 0 && arr[idx - 1].length > 0))
    .join('\n');

  if (title) {
    return `# ${title}\n\n${text}`.trim();
  }
  return text.trim();
}

// ─── WebFetchTool Implementation ──────────────────────────────────────────────

export class WebFetchTool extends Tool<WebFetchInput, WebFetchData> {
  readonly name = 'webfetch';
  readonly glyph = TOOL_GLYPHS.webfetch;
  readonly description =
    'Fetch content from a web URL (HTTP/HTTPS) and convert it into clean Markdown text for LLM comprehension.';
  readonly schema = WebFetchSchema;
  override readonly isDangerous = false;

  async execute(params: WebFetchInput, context: ToolContext): Promise<ToolExecutionResult<WebFetchData>> {
    const startTime = Date.now();

    try {
      const urlObj = new URL(params.url);
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        return this.error(`Unsupported URL protocol: '${urlObj.protocol}'. Only http: and https: are allowed.`);
      }
    } catch {
      return this.error(`Invalid URL provided: '${params.url}'`);
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), DEFAULT_FETCH_TIMEOUT_MS);

      if (context.signal) {
        context.signal.addEventListener('abort', () => controller.abort(), { once: true });
      }

      const response = await fetch(params.url, {
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.5',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        redirect: 'follow',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const contentType = response.headers.get('content-type') || 'text/plain';
      const durationMs = Date.now() - startTime;

      if (!response.ok) {
        return this.error(
          `HTTP fetch failed with status ${response.status} ${response.statusText} for '${params.url}'`,
          undefined,
          { statusCode: response.status, url: params.url }
        );
      }

      const rawText = await response.text();
      const bytes = Buffer.byteLength(rawText);

      let processedContent: string;
      if (params.raw || !contentType.includes('text/html')) {
        processedContent = rawText;
      } else {
        processedContent = htmlToCleanMarkdown(rawText);
      }

      const isTruncated = processedContent.length > MAX_CONTENT_LENGTH;
      if (isTruncated) {
        processedContent =
          processedContent.slice(0, MAX_CONTENT_LENGTH) +
          `\n\n[Content truncated at ${MAX_CONTENT_LENGTH} characters out of ${processedContent.length} total]`;
      }

      return this.success(
        processedContent,
        {
          url: params.url,
          finalUrl: response.url || params.url,
          statusCode: response.status,
          statusText: response.statusText,
          contentType,
          content: processedContent,
          bytes,
          durationMs,
          isTruncated,
        },
        {
          statusCode: response.status,
          contentType,
          bytes,
          durationMs,
        }
      );
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        return this.error(`Request to '${params.url}' timed out after ${DEFAULT_FETCH_TIMEOUT_MS}ms.`);
      }
      return this.error(`Failed to fetch web content from '${params.url}'`, err);
    }
  }
}
