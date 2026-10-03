/**
 * @steward/ai — Provider Common Types
 */

export type FetchFn = typeof fetch;

export interface ResolvedAuth {
  apiKey?: string;
  headers?: Record<string, string>;
}
