import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { z } from 'zod';
import pkg from '../../../../../../package.json' with { type: 'json' };
import type { ToolDefinition } from '../types.js';

const VERSION: string = pkg.version || '0.0.0';
const MAX_FETCH_BYTES = 2 * 1024 * 1024; // 2MB hard cap
const MAX_REDIRECTS = 3;

/**
 * Checks if an IPv4 address is in a private, loopback, link-local, broadcast, or reserved range.
 */
function isPrivateOrReservedIPv4(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    return true; // invalid -> reject safely
  }
  const [b0, b1] = parts;
  if (b0 === 0) return true; // 0.0.0.0/8
  if (b0 === 10) return true; // 10.0.0.0/8 (RFC 1918)
  if (b0 === 127) return true; // 127.0.0.0/8 (Loopback)
  if (b0 === 169 && b1 === 254) return true; // 169.254.0.0/16 (Link-local / AWS metadata)
  if (b0 === 172 && b1 !== undefined && b1 >= 16 && b1 <= 31) return true; // 172.16.0.0/12 (RFC 1918)
  if (b0 === 192 && b1 === 168) return true; // 192.168.0.0/16 (RFC 1918)
  if (b0 === 192 && b1 === 0) return true; // 192.0.0.0/24 (IETF protocol assignments)
  if (b0 === 198 && (b1 === 18 || b1 === 19)) return true; // 198.18.0.0/15 (Benchmarking)
  if (b0 === 100 && b1 !== undefined && b1 >= 64 && b1 <= 127) return true; // 100.64.0.0/10 (Carrier-grade NAT)
  if (b0 !== undefined && b0 >= 224) return true; // 224.0.0.0/4 Multicast & 240.0.0.0/4 Reserved
  return false;
}

/**
 * Checks if an IPv6 address is in a private, loopback, link-local, or unique-local range.
 */
function isPrivateOrReservedIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  if (normalized === '::' || normalized === '::1') return true; // Unspecified / loopback
  if (normalized.startsWith('::ffff:')) {
    // IPv4-mapped IPv6
    const ipv4 = normalized.slice(7);
    return isPrivateOrReservedIPv4(ipv4);
  }
  if (
    normalized.startsWith('fe80:') ||
    normalized.startsWith('fe8') ||
    normalized.startsWith('fe9') ||
    normalized.startsWith('fea') ||
    normalized.startsWith('feb')
  ) {
    return true; // fe80::/10 (Link-local)
  }
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) {
    return true; // fc00::/7 (Unique local)
  }
  if (normalized.startsWith('ff')) {
    return true; // ff00::/8 (Multicast)
  }
  return false;
}

/**
 * Validates whether a target IP is safe and not resolving to private/reserved infrastructure.
 */
export function isPrivateIP(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) {
    return isPrivateOrReservedIPv4(ip);
  }
  if (version === 6) {
    return isPrivateOrReservedIPv6(ip);
  }
  return true; // Unknown format, reject
}

/**
 * Validates a target URL against SSRF vulnerabilities (forbidden private hosts, non-http schemes).
 */
export async function validateSafeUrl(urlStr: string): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(urlStr);
  } catch {
    throw new Error(`Invalid URL format: "${urlStr}"`);
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Forbidden protocol: "${parsed.protocol}". Only HTTP and HTTPS are allowed.`);
  }

  const hostname = parsed.hostname;
  if (
    !hostname ||
    hostname === 'localhost' ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal')
  ) {
    throw new Error(`Access to local or private host "${hostname}" is blocked for security.`);
  }

  // If host is an IP literal
  if (isIP(hostname)) {
    if (isPrivateIP(hostname)) {
      throw new Error(`Access to private/local IP address "${hostname}" is blocked for security.`);
    }
    return parsed;
  }

  // Resolve hostname via DNS
  try {
    const addresses = await lookup(hostname, { all: true });
    if (!addresses || addresses.length === 0) {
      throw new Error(`Could not resolve hostname "${hostname}".`);
    }
    for (const addr of addresses) {
      if (isPrivateIP(addr.address)) {
        throw new Error(
          `Access to host "${hostname}" is blocked because it resolves to private IP (${addr.address}).`,
        );
      }
    }
  } catch (err: any) {
    if (err.message && err.message.includes('blocked because it resolves')) {
      throw err;
    }
    throw new Error(`DNS resolution failed for "${hostname}": ${err.message || String(err)}`);
  }

  return parsed;
}

export const webFetchInputSchema = z.object({
  url: z.string().url().describe('The HTTP or HTTPS URL to fetch content from.'),
  maxCharacters: z
    .number()
    .int()
    .min(500)
    .max(50000)
    .optional()
    .describe('Maximum number of characters to extract from the content. Defaults to 12000.'),
});

export type WebFetchInput = z.infer<typeof webFetchInputSchema>;

export interface WebFetchOutput {
  url: string;
  status: number;
  contentType: string;
  content: string;
  isTruncated: boolean;
}

/**
 * Basic HTML to clean text converter that strips non-content tags and reduces whitespace.
 */
function cleanHtmlContent(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, '')
    .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, '')
    .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .trim();
}

/**
 * Fetches content from a URL with manual redirect checking and SSRF validation per hop.
 */
async function fetchWithSsrfProtection(
  initialUrl: string,
  signal: AbortSignal,
): Promise<{ response: Response; finalUrl: string }> {
  let currentUrl = initialUrl;
  let redirects = 0;

  while (redirects <= MAX_REDIRECTS) {
    const validatedUrl = await validateSafeUrl(currentUrl);

    const response = await fetch(validatedUrl.toString(), {
      method: 'GET',
      headers: {
        'User-Agent': `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 (steward-agent/${VERSION}; +https://github.com/sapirrior/steward)`,
        Accept: 'text/html,application/xhtml+xml,application/json,text/plain;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'manual',
      signal,
    });

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location) {
        throw new Error(`Redirect response (${response.status}) missing Location header.`);
      }
      const nextUrl = new URL(location, validatedUrl).toString();
      currentUrl = nextUrl;
      redirects++;
      continue;
    }

    return { response, finalUrl: currentUrl };
  }

  throw new Error(`Too many redirects (exceeded limit of ${MAX_REDIRECTS}).`);
}

export const webFetchTool: ToolDefinition<typeof webFetchInputSchema, WebFetchOutput> = {
  name: 'web_fetch',
  displayName: 'Web',
  access: 'read',
  description:
    'Fetches text and documentation content from a public web URL. Automatically cleans HTML markup into readable text.',
  parameters: webFetchInputSchema,
  confirmationPolicy: 'never',

  summarize: (args, result) => {
    if (!result) return `Fetching ${args?.url ?? ''}`;
    const chars = result?.content?.length ?? 0;
    const truncated = result?.isTruncated ? ' (truncated)' : '';
    const type = result?.contentType?.split(';')[0]?.trim() ?? 'text';
    const label = type.includes('html')
      ? 'HTML'
      : type.includes('json')
        ? 'JSON'
        : type.includes('markdown') || type.includes('text/plain')
          ? 'text'
          : (type.split('/').pop() ?? 'content');
    let host = args?.url ?? '';
    try {
      if (args?.url) host = new URL(args.url).hostname;
    } catch {}
    return `Fetched ${chars.toLocaleString()} chars of ${label} from ${host}${truncated}`;
  },

  execute: async (args, context) => {
    const maxChars = args.maxCharacters ?? 12000;
    const timeoutSignal = AbortSignal.timeout(15000);

    const signal = context.abortSignal
      ? AbortSignal.any([context.abortSignal, timeoutSignal])
      : timeoutSignal;

    const { response, finalUrl } = await fetchWithSsrfProtection(args.url, signal);

    if (!response.ok) {
      throw new Error(`HTTP fetch failed with status ${response.status} (${response.statusText})`);
    }

    const contentType = response.headers.get('content-type') || 'text/plain';

    // Stream and cap response body to MAX_FETCH_BYTES
    let rawText: string;
    if (response.body) {
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let totalBytes = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          totalBytes += value.byteLength;
          if (totalBytes > MAX_FETCH_BYTES) {
            chunks.push(value.slice(0, value.byteLength - (totalBytes - MAX_FETCH_BYTES)));
            await reader.cancel();
            break;
          }
          chunks.push(value);
        }
      }

      const decoder = new TextDecoder('utf-8');
      rawText = chunks.map((c) => decoder.decode(c, { stream: true })).join('') + decoder.decode();
    } else {
      rawText = await response.text();
    }

    let cleanText: string;
    if (contentType.includes('text/html') || rawText.includes('<html')) {
      cleanText = cleanHtmlContent(rawText);
    } else {
      cleanText = rawText.trim();
    }

    const isTruncated = cleanText.length > maxChars;
    const content = isTruncated
      ? cleanText.slice(0, maxChars) + '\n\n[...content truncated]'
      : cleanText;

    return {
      url: finalUrl,
      status: response.status,
      contentType,
      content,
      isTruncated,
    };
  },
};
