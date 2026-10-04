import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect } from 'bun:test';

export function verifyOrSaveGolden(name: string, actual: string) {
  const goldenPath = join(import.meta.dir, '../goldens', `${name}.txt`);
  const updateGoldens = process.env.UPDATE_GOLDENS === '1' || process.env.UPDATE_GOLDENS === 'true';

  if (!existsSync(goldenPath)) {
    if (updateGoldens) {
      writeFileSync(goldenPath, actual, 'utf8');
    } else {
      throw new Error(`Golden file does not exist: ${goldenPath}. Run with UPDATE_GOLDENS=1 to create/update.`);
    }
  }

  if (updateGoldens) {
    writeFileSync(goldenPath, actual, 'utf8');
  }

  const expected = readFileSync(goldenPath, 'utf8');
  expect(actual).toBe(expected);
}
