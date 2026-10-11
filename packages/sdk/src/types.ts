export type ReasoningEffort = 'none' | 'low' | 'medium' | 'high' | 'xhigh';

export interface ProviderKeyMetadata {
  apiKey?: string;
  baseURL?: string;
  headers?: Record<string, string>;
}

export type StewardSDKErrorKind =
  'auth' | 'rate-limit' | 'context-length' | 'network' | 'provider' | 'abort' | 'invalid-input';

export interface SDKErrorDetails {
  kind: StewardSDKErrorKind;
  message: string;
  retryable: boolean;
  statusCode?: number;
  retryAfterMs?: number;
  provider?: string;
  modelId?: string;
}

export interface ParsedModelIdentifier {
  provider: string;
  modelId: string;
}
