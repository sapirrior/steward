import type { CliCommandRegistry, CliIO } from './types.js';
import type { CliDeps } from './types.js';
import { DefaultCliCommandRegistry } from './registry.js';
import { builtInCliCommands } from './commands/index.js';
import { VERSION } from './meta.js';
import { launchInteractive } from '../app/launch.js';

export interface RunOptions {
  registry?: CliCommandRegistry;
  io?: CliIO;
  exit?: (code: number) => void;
  launch?: (opts: { version: string }) => Promise<void>;
}

export function createDefaultCliRegistry(): CliCommandRegistry {
  const reg = new DefaultCliCommandRegistry();
  for (const cmd of builtInCliCommands) {
    reg.register(cmd);
  }
  return reg;
}

export async function run(
  argv: readonly string[] = process.argv.slice(2),
  opts: RunOptions = {},
): Promise<void> {
  const io: CliIO = opts.io ?? console;
  const exit = opts.exit ?? ((code: number) => process.exit(code));
  const launch = opts.launch ?? launchInteractive;
  const registry = opts.registry ?? createDefaultCliRegistry();

  const first = argv[0];

  if (first) {
    const cmd = registry.resolve(first);
    if (cmd) {
      const code = await cmd.run(argv.slice(1), { io, registry });
      if (typeof code === 'number' && code !== 0) {
        exit(code);
      }
      return;
    }

    if (first.startsWith('-')) {
      io.error(`Unknown option "${first}". Run "steward help" for usage.`);
      exit(1);
      return;
    }

    io.error(`Unknown argument "${first}". Run "steward help" for usage.`);
    exit(1);
    return;
  }

  await launch({ version: VERSION });
}
