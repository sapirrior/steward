import type { LanguageModel } from 'ai';
import type { ModelRef } from '@steward/models';

export interface ResolveModelOptions {
  apiKey?: string;
  baseURL?: string;
  signal?: AbortSignal;
}

export interface ModelProvider {
  readonly id: string;
  readonly displayName: string;
  canHandle(ref: ModelRef): boolean;
  resolveModel(ref: ModelRef, options?: ResolveModelOptions): Promise<LanguageModel>;
}
