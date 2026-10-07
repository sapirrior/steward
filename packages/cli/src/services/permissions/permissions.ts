import type {
  BashPermissionEvaluation,
  BashPermissionRequest,
  BashPermissionResponse,
} from './types.js';
import { classifyCommand } from './shellRules.js';

export type { BashPermissionEvaluation };

export interface PermissionToolContext {
  cwd: string;
  requestBashPermission?: (req: BashPermissionRequest) => Promise<BashPermissionResponse>;
}

/**
 * Checks command safety with the command policy and requests user approval if not strictly read-only.
 */
export async function evaluateBashPermission(
  req: BashPermissionRequest,
  context: PermissionToolContext,
): Promise<BashPermissionEvaluation> {
  const policy = classifyCommand(req.command, context.cwd);

  if (policy === 'SAFE_READ_ONLY') {
    return { allowed: true };
  }

  // Not auto-approved: must request user confirmation via permission dock callback
  if (!context.requestBashPermission) {
    // In headless / non-interactive context with no permission callback, default deny
    return {
      allowed: false,
      reason:
        'Command requires user confirmation, but no interactive permission handler was provided.',
    };
  }

  const response = await context.requestBashPermission(req);
  if (!response.allowed) {
    return {
      allowed: false,
      reason: 'User denied permission to execute the bash command.',
    };
  }

  return { allowed: true };
}
