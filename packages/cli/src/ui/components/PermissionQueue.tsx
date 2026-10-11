/**
 * @file PermissionQueue.tsx
 * @description Permission request queue manager coordinating sequential approvals.
 */

import { Box, Text } from 'stitchable';
import { themeManager } from '../../themes/index.js';
import { BashPermissionDialog } from './BashPermissionDialog.js';

export interface PendingPermissionRequest {
  id: string;
  type: 'bash';
  command: string;
  description?: string;
  onAllow: () => void;
  onDeny: () => void;
}

export interface PermissionQueueProps {
  queue: PendingPermissionRequest[];
}

export function PermissionQueue({ queue }: PermissionQueueProps) {
  if (queue.length === 0) return null;

  const current = queue[0];
  const pendingCount = queue.length - 1;
  const inactiveColor = themeManager.getColor('inactive');

  return (
    <Box flexDirection="column" width="100%">
      {pendingCount > 0 && (
        <Box marginBottom={1}>
          <Text color={inactiveColor} italic wrap="nowrap">
            ({pendingCount} additional permission {pendingCount === 1 ? 'request' : 'requests'} waiting in queue)
          </Text>
        </Box>
      )}

      {current && current.type === 'bash' && (
        <BashPermissionDialog
          command={current.command}
          description={current.description}
          onAllow={current.onAllow}
          onDeny={current.onDeny}
        />
      )}
    </Box>
  );
}
