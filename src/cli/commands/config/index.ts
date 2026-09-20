import {
  getSettingsPath,
  getVoiceLanguage,
  saveVoiceLanguage,
  getSavedModel,
  getSavedTheme,
  saveThemeSelection,
  getSavedMode,
  saveModeSelection,
} from '../../../config/settings.js';
import { listThemes, findTheme } from '../../../theme/index.js';
import { findMode, listModes } from '../../../engine/mode.js';
import type { CliConfigArgs } from '../../types.js';
import { resolveVoiceLanguage, getLanguageDisplayName } from './utils/lang.js';

export function handleConfigCommand(configArgs: CliConfigArgs): void {
  if (configArgs.target === 'all') {
    const settingsPath = getSettingsPath();
    const voiceLang = getVoiceLanguage();
    const voiceDisplay = voiceLang
      ? `${getLanguageDisplayName(voiceLang)} (${voiceLang})`
      : 'auto-detect (default)';

    const savedModel = getSavedModel();
    const modelDisplay = savedModel
      ? `${savedModel.provider}:${savedModel.modelId} (effort: ${savedModel.effort ?? 'provider-default'})`
      : 'not configured (using environment priority)';

    const savedTheme = getSavedTheme() ?? 'dark (default)';
    const savedMode = getSavedMode() ?? 'normal (default)';

    console.log(`Steward Configuration (${settingsPath}):`);
    console.log(`  UI Theme:       ${savedTheme}`);
    console.log(`  Voice Language: ${voiceDisplay}`);
    console.log(`  Saved Model:    ${modelDisplay}`);
    console.log(`  Chat Mode:      ${savedMode}`);
    process.exit(0);
  }

  if (configArgs.target === 'voice') {
    const rawLang = configArgs.value?.trim();
    if (!rawLang) {
      const current = getVoiceLanguage();
      if (current) {
        const name = getLanguageDisplayName(current);
        console.log(`Current voice language: ${name} (${current})`);
      } else {
        console.log('Current voice language: auto-detect (default)');
      }
      process.exit(0);
    }

    const resolved = resolveVoiceLanguage(rawLang);
    if (!resolved) {
      console.error(
        `Error: Unknown voice language "${rawLang}".\n` +
          `Examples of valid options:\n` +
          `  steward --config voice en       (English / US)\n` +
          `  steward --config voice es       (Spanish)\n` +
          `  steward --config voice ja       (Japanese)\n` +
          `  steward --config voice fr       (French)\n` +
          `  steward --config voice de       (German)\n` +
          `  steward --config voice zh       (Chinese)\n` +
          `  steward --config voice en-GB    (British English)\n` +
          `  steward --config voice es-MX    (Mexican Spanish)`,
      );
      process.exit(1);
    }

    saveVoiceLanguage(resolved.tag);
    console.log(`✓ Voice language configured: ${resolved.name} (${resolved.tag})`);
    process.exit(0);
  }

  if (configArgs.target === 'mode') {
    const rawMode = configArgs.value?.trim();
    const allModes = listModes();

    if (!rawMode) {
      const current = getSavedMode() ?? 'normal';
      const currentMeta = findMode(current);
      console.log(`Current chat mode: ${currentMeta?.label ?? current} (${current})`);
      process.exit(0);
    }

    const matched = findMode(rawMode);

    if (!matched) {
      console.error(
        `Error: Unknown mode "${rawMode}".\n` +
          `Available modes:\n` +
          allModes
            .map((m) => `  steward --config mode ${m.name.padEnd(10)} (${m.label})`)
            .join('\n'),
      );
      process.exit(1);
    }

    saveModeSelection(matched.name);
    console.log(`✓ Chat mode configured: ${matched.label} (${matched.name})`);
    process.exit(0);
  }

  if (configArgs.target === 'theme') {
    const rawTheme = configArgs.value?.trim();
    const allThemes = listThemes();

    if (!rawTheme) {
      const current = getSavedTheme() ?? 'dark';
      const currentMeta = findTheme(current);
      console.log(`Current UI theme: ${currentMeta?.label ?? current} (${current})`);
      process.exit(0);
    }

    const matched = findTheme(rawTheme);

    if (!matched) {
      console.error(
        `Error: Unknown theme "${rawTheme}".\n` +
          `Available themes:\n` +
          allThemes
            .map((t) => `  steward --config theme ${t.name.padEnd(18)} (${t.label})`)
            .join('\n'),
      );
      process.exit(1);
    }

    saveThemeSelection(matched.name);
    console.log(`✓ UI theme configured: ${matched.label} (${matched.name})`);
    process.exit(0);
  }
}
