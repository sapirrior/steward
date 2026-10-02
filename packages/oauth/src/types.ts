export type OAuthProviderId = 'anthropic' | 'openrouter' | 'github-copilot' | (string & {});

export interface DeviceCodePrompt {
  userCode: string;
  verificationUri: string;
  expiresIn: number;
  interval: number;
}

export interface LoginOptions {
  onAuthUrl?: (url: string) => void;
  onDeviceCode?: (info: DeviceCodePrompt) => void;
  signal?: AbortSignal;
}

export interface LoginResult {
  provider: string;
  success: boolean;
  account?: string;
  error?: string;
}

export interface ProviderAuthStatus {
  loggedIn: boolean;
  type?: 'oauth' | 'api-key';
  expiresAt?: number;
  account?: string;
}

export type AuthStatus = Record<string, ProviderAuthStatus>;

export interface TokenRecord {
  type: 'oauth' | 'api-key';
  access: string;
  refresh?: string;
  expires?: number;
  account?: string;
  enterpriseUrl?: string;
}

export type AuthStoreData = Record<string, TokenRecord>;
