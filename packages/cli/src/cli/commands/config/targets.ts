import type { CliIO, CliExitCode } from '../../types.js';
import { loadSettings } from '../../../settings/store.js';
import {
  getSavedMode,
  saveModeSelection,
  MODE_NAMES,
  type ChatMode,
} from '../../../settings/mode.js';

export interface ConfigTarget {
  readonly name: string;
  show(io: CliIO): void;
  get(io: CliIO): void;
  set(value: string, io: CliIO): CliExitCode;
}

export const modeTarget: ConfigTarget = {
  name: 'mode',
  show(io: CliIO) {
    const settings = loadSettings();
    io.log(`  Mode: ${settings.mode ?? 'normal (default)'}`);
  },
  get(io: CliIO) {
    io.log(`Current default mode: ${getSavedMode() ?? 'normal'}`);
    io.log(`Available modes: ${MODE_NAMES.join(', ')}`);
  },
  set(value: string, io: CliIO): CliExitCode {
    if (MODE_NAMES.includes(value as ChatMode)) {
      saveModeSelection(value as ChatMode);
      io.log(`Default mode set to: ${value}`);
      return 0;
    }
    io.error(`Unknown mode "${value}". Available: ${MODE_NAMES.join(', ')}`);
    return 1;
  },
};

export const configTargets: readonly ConfigTarget[] = [modeTarget];
