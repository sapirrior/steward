/**
 * @steward/models - Types & Slim Metadata Contracts
 */

export interface ModelPricing {
  input?: number;
  output?: number;
  cacheRead?: number;
  cacheWrite?: number;
}

export interface ModelMetadata {
  provider: string;
  id: string;
  name: string;
  reasoning?: boolean;
  toolCall?: boolean;
  inputModalities: readonly string[];
  outputModalities: readonly string[];
  contextWindow?: number;
  maxInputTokens?: number;
  maxOutputTokens?: number;
  pricing?: ModelPricing;
}

export type ModelsErrorKind = 'network' | 'http' | 'malformed';

export class ModelsError extends Error {
  readonly kind: ModelsErrorKind;
  readonly status?: number;

  constructor(
    kind: ModelsErrorKind,
    message: string,
    options?: { cause?: unknown; status?: number },
  ) {
    super(message, { cause: options?.cause });
    this.name = 'ModelsError';
    this.kind = kind;
    this.status = options?.status;
  }
}

export interface ListModelsOptions {
  provider?: string;
  textCapable?: boolean;
}

export interface Models {
  list(opts?: ListModelsOptions): Promise<readonly ModelMetadata[]>;
  get(provider: string, modelId: string): Promise<ModelMetadata | undefined>;
  refresh(): Promise<void>;
}

export interface CreateModelsOptions {
  fetch?: typeof fetch;
  url?: string;
}
