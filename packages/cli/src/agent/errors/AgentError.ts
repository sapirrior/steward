import type { AgentErrorCode } from '../types.js';

export class AgentError extends Error {
  readonly code: AgentErrorCode;
  readonly provider?: string;
  readonly modelId?: string;
  readonly status?: number;
  readonly retryable: boolean;
  readonly retryAfterMs?: number;
  readonly rawCause?: unknown;

  constructor(options: {
    code: AgentErrorCode;
    message: string;
    provider?: string;
    modelId?: string;
    status?: number;
    retryable?: boolean;
    retryAfterMs?: number;
    rawCause?: unknown;
  }) {
    super(options.message);
    this.name = 'AgentError';
    this.code = options.code;
    this.provider = options.provider;
    this.modelId = options.modelId;
    this.status = options.status;
    this.retryable = options.retryable ?? false;
    this.retryAfterMs = options.retryAfterMs;
    this.rawCause = options.rawCause;
  }
}
