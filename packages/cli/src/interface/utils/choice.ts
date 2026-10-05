import type { InputEvent } from 'stitchable';
import { figures, c, bold } from '../../theme/index.js';

export type ChoiceAction =
  { type: 'move'; index: number } | { type: 'confirm'; index: number } | { type: 'cancel' };

/**
 * Handles keyboard navigation for fixed-choice approval dialogs and gates.
 * Explicitly ignores bracketed paste events (ev.isPaste).
 *
 * Supported keys:
 * - Up / Down / Left / Right / Tab / Shift-Tab: cycle through options
 * - 1..9: directly select 0-indexed choice (1 -> 0, 2 -> 1, etc.)
 * - Return: confirm current selection
 * - Escape: cancel / reject
 */
export function handleChoiceKey(
  ev: InputEvent,
  currentIndex: number,
  count: number,
): ChoiceAction | null {
  if (ev.isPaste || count <= 0) {
    return null;
  }

  // Escape cancels
  if (ev.key.escape) {
    return { type: 'cancel' };
  }

  // Return confirms
  if (ev.key.return) {
    return { type: 'confirm', index: currentIndex };
  }

  // Arrow / Tab navigation
  if (ev.key.upArrow || ev.key.leftArrow || (ev.key.tab && ev.key.shift)) {
    const nextIndex = currentIndex > 0 ? currentIndex - 1 : count - 1;
    return { type: 'move', index: nextIndex };
  }

  if (ev.key.downArrow || ev.key.rightArrow || ev.key.tab) {
    const nextIndex = currentIndex < count - 1 ? currentIndex + 1 : 0;
    return { type: 'move', index: nextIndex };
  }

  // Direct number selection '1', '2', ..., '9'
  if (ev.input && ev.input.length === 1 && ev.input >= '1' && ev.input <= '9') {
    const target = parseInt(ev.input, 10) - 1;
    if (target >= 0 && target < count) {
      return { type: 'move', index: target };
    }
  }

  return null;
}

/**
 * Renders a standard selectable choice option line with pointer glyph.
 */
export function renderChoiceOption(
  label: string,
  selected: boolean,
  colorFn = c.permission,
): string {
  const pointer = figures.pointer ?? '>';
  return selected ? `${colorFn(pointer)} ${bold(colorFn(label))}` : `  ${c.text(label)}`;
}
