export type PermissionDecision = 'allow' | 'deny' | 'ask';

export interface PermissionRule {
  pattern: RegExp | string;
  decision: PermissionDecision;
}

export type FilePermissionKind = 'create' | 'overwrite' | 'edit';

export interface FilePermissionRequest {
  kind: FilePermissionKind;
  filePath: string;
  before: string | null;
  after: string;
}

export interface FilePermissionResponse {
  allowed: boolean;
}

export interface BashPermissionRequest {
  command: string;
  explanation: string;
}

export interface BashPermissionResponse {
  allowed: boolean;
}

export interface BashPermissionEvaluation {
  allowed: boolean;
  reason?: string;
}
