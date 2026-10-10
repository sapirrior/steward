import crypto from 'node:crypto';

export interface GenerateThreadIdSeed {
  cwd?: string;
  createdAt?: string;
  salt?: string;
}

/**
 * Generates a collision-resistant, deterministic-length thread ID.
 * Follows the format: `th_<16hex>` computed from a SHA-256 hash.
 */
export function generateThreadId(seed?: GenerateThreadIdSeed): string {
  const hash = crypto.createHash('sha256');

  const timestamp = seed?.createdAt ?? new Date().toISOString();
  const cwd = seed?.cwd ?? '';
  const salt = seed?.salt ?? crypto.randomBytes(16).toString('hex');

  hash.update(`${timestamp}:${cwd}:${salt}`);

  const digest = hash.digest('hex');
  return `th_${digest.slice(0, 16)}`;
}
