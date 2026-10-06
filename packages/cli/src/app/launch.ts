import { AgentSession, logError } from '@steward/agent';
import { setupAuth } from '@steward/oauth';
import { getSavedModel } from '../settings/index.js';
import { createRuntime } from './runtime.js';
import { TUIApp } from './tui-app.js';

export interface LaunchInteractiveOptions {
  version: string;
}

export async function launchInteractive(opts: LaunchInteractiveOptions): Promise<void> {
  try {
    await setupAuth();
    const runtime = createRuntime();
    const savedModel = getSavedModel();
    const session = new AgentSession(
      savedModel
        ? {
            provider: savedModel.provider,
            modelId: savedModel.modelId,
            reasoningEffort: savedModel.effort,
          }
        : undefined,
      undefined,
      { ai: runtime.modelPort },
    );
    const app = new TUIApp({
      version: opts.version,
      ai: runtime.ai,
      initialSession: session,
      cwd: process.cwd(),
      onExit: () => process.exit(0),
    });
    await app.start();
  } catch (err) {
    logError(err, { phase: 'initialization' });
    console.error(
      'Failed to initialize steward:',
      err instanceof Error ? err.message : String(err),
    );
    process.exit(1);
  }
}
