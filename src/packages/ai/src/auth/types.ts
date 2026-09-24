/**
 * @steward/ai - Auth Domain Types
 */

import type { ProviderId } from '../types.js';

export interface OAuthCredential {
  type: 'oauth';
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
}

export interface ResolvedAuth {
  type: 'api-key' | 'oauth';
  token: string;
  headers?: Record<string, string>;
  extra?: Record<string, any>;
  source: string;
}

export type AuthPrompt =
  | {
      type: 'select';
      message: string;
      options: readonly {
        id: string;
        label: string;
        description?: string;
      }[];
      signal?: AbortSignal;
    }
  | {
      type: 'manual-code';
      message: string;
      placeholder?: string;
      signal?: AbortSignal;
    };

export type AuthEvent =
  | {
      type: 'auth-url';
      url: string;
      instructions?: string;
    }
  | {
      type: 'device-code';
      userCode: string;
      verificationUri: string;
      expiresInSeconds?: number;
    }
  | {
      type: 'info';
      message: string;
      links?: readonly { url: string; label?: string }[];
    }
  | {
      type: 'progress';
      message: string;
    };

export interface AuthInteraction {
  signal?: AbortSignal;
  prompt(prompt: AuthPrompt): Promise<string>;
  notify(event: AuthEvent): void;
}

export interface CredentialInfo {
  provider: ProviderId;
  type: 'oauth';
  expiresAt?: number;
}

export interface CredentialStore {
  read(provider: ProviderId): Promise<OAuthCredential | undefined>;
  list(): Promise<readonly CredentialInfo[]>;
  modify(
    provider: ProviderId,
    fn: (current: OAuthCredential | undefined) => Promise<OAuthCredential | undefined>,
  ): Promise<OAuthCredential | undefined>;
  delete(provider: ProviderId): Promise<void>;
}

export interface AuthStatus {
  provider: ProviderId;
  configured: boolean;
  source?: 'oauth' | 'api-key' | 'custom';
  expiresAt?: number;
}
