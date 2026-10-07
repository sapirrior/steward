/**
 * @steward/models - Model Reference Formatting & Parsing
 */

export interface ModelRef {
  provider: string;
  modelId: string;
}

/**
 * Parses a provider/modelId string into a structured ModelRef.
 *
 * Rules:
 * - Splits on the FIRST `/` only.
 * - Trims whitespace around input and components.
 * - Returns undefined if there is no `/`, or if provider or modelId is empty.
 * - Preserves exact casing for modelId.
 */
export function parseModelRef(input: string): ModelRef | undefined {
  if (!input) return undefined;
  const trimmed = input.trim();
  const firstSlashIndex = trimmed.indexOf('/');
  if (firstSlashIndex <= 0) return undefined;

  const provider = trimmed.slice(0, firstSlashIndex).trim();
  const modelId = trimmed.slice(firstSlashIndex + 1).trim();

  if (!provider || !modelId) return undefined;

  return {
    provider,
    modelId,
  };
}

/**
 * Formats a ModelRef into canonical `provider/modelId` string.
 */
export function formatModelRef(ref: ModelRef): string {
  return `${ref.provider}/${ref.modelId}`;
}
