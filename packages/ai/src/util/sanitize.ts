/**
 * @steward/ai - Unicode sanitization utilities
 *
 * Removes unpaired Unicode surrogate characters from strings to prevent
 * JSON serialization and remote API tokenizer errors.
 * Note: surrogates are deleted (not replaced with U+FFFD).
 */
export function sanitizeSurrogates(text: unknown): string {
  if (typeof text !== 'string') {
    if (text === null || text === undefined) return '';
    return sanitizeSurrogates(typeof text === 'object' ? JSON.stringify(text) : String(text));
  }
  return text.replace(
    /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g,
    '',
  );
}
