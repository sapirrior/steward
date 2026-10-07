import { isPathInsideWorkspace } from '../../utils/fs/boundingPath.js';

export function isPathAccessible(targetPath: string, workspaceRoot: string): boolean {
  return isPathInsideWorkspace(targetPath, workspaceRoot);
}
