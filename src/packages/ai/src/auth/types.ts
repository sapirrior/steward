/**
 * @steward/ai - Auth Domain Types
 *
 * All auth types are pure interfaces — no node:* imports, no side effects.
 * The library never decides where credentials are stored; the caller provides
 * a CredentialStore implementation.
 */

import type { ProviderId } from '../types.js';

// ─── Credentials ──────────────────────────────────────────────────────────────

export interface ApiKeyCredential {
  type: 'api-key';
  key: string;
}

export interface OAuthCredential {
  type: 'oauth';
  accessToken: string;
  refreshToken?: string;
  /** Unix ms. Absent = never expires. Never store Infinity. */
  expiresAt?: number;
}

export type Credential = ApiKeyCredential | OAuthCredential;

// ─── Credential store ─────────────────────────────────────────────────────────

export interface CredentialInfo {
  provider: ProviderId;
  type: 'api-key' | 'oauth';
  expiresAt?: number;
}

export interface CredentialStore {
  read(provider: ProviderId): Promise<Credential | undefined>;
  list(): Promise<readonly CredentialInfo[]>;
  /**
   * Serialized read-modify-write per provider id.
   * fn returning undefined = leave credential UNCHANGED (not deleted).
   * Use delete() for removal.
   */
  modify(
    provider: ProviderId,
    fn: (current: Credential | undefined) => Promise<Credential | undefined>,
  ): Promise<Credential | undefined>;
  delete(provider: ProviderId): Promise<void>;
}

// ─── Auth context (injected — no process.env in core) ─────────────────────────

export interface AuthContext {
  /** Read an environment variable. Returns undefined when absent/empty. */
  env(name: string): string | undefined;
  /** Check whether a file path exists. */
  fileExists(path: string): boolean;
}

// ─── Provider auth shape ──────────────────────────────────────────────────────

export interface ResolvedAuth {
  /** The bearer token / api key to use for requests. */
  apiKey?: string;
  /** Extra headers to merge into every request. */
  headers?: Record<string, string>;
  /** Provider-specific base URL override (e.g. Copilot's per-token proxy). */
  baseUrl?: string;
  /** Human-readable source label for status UI. */
  source: string;
}

export interface ApiKeyAuth {
  /** Environment variable names to check, in order. */
  envVars: readonly string[];
  /** Resolve the api key from a raw credential. */
  resolve(credential: Credential): ResolvedAuth | undefined;
}

export interface OAuthAuth {
  name: string;
  login(interaction: AuthInteraction): Promise<Credential>;
  refresh(credential: OAuthCredential, signal?: AbortSignal): Promise<OAuthCredential>;
  toAuth(credential: OAuthCredential): ResolvedAuth;
}

export interface ProviderAuth {
  apiKey?: ApiKeyAuth;
  oauth?: OAuthAuth;
}

// ─── Auth interaction (provided by the app / TUI) ────────────────────────────

export type AuthPrompt =
  | {
      type: 'select';
      message: string;
      options: readonly { id: string; label: string; description?: string }[];
      signal?: AbortSignal;
    }
  | {
      type: 'manual-code';
      message: string;
      placeholder?: string;
      signal?: AbortSignal;
    }
  | {
      type: 'secret';
      message: string;
      placeholder?: string;
      signal?: AbortSignal;
    };

export type AuthEvent =
  | { type: 'auth-url'; url: string; instructions?: string }
  | { type: 'device-code'; userCode: string; verificationUri: string; expiresInSeconds?: number }
  | { type: 'info'; message: string; links?: readonly { url: string; label?: string }[] }
  | { type: 'progress'; message: string };

export interface AuthInteraction {
  signal?: AbortSignal;
  prompt(prompt: AuthPrompt): Promise<string>;
  notify(event: AuthEvent): void;
}

// ─── Auth status ──────────────────────────────────────────────────────────────

export interface AuthStatus {
  provider: ProviderId;
  configured: boolean;
  source?: 'oauth' | 'api-key' | 'env';
  expiresAt?: number;
}
