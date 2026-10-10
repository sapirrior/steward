/**
 * Generates a clean, concise thread title from an initial prompt.
 * Truncates at natural word boundaries up to 48 characters.
 */
export function generateThreadTitle(prompt: string): string {
  const cleaned = prompt.replace(/\s+/g, ' ').trim();
  if (!cleaned) {
    return 'New Thread';
  }

  if (cleaned.length <= 48) {
    return cleaned;
  }

  const truncated = cleaned.slice(0, 48);
  const lastSpace = truncated.lastIndexOf(' ');

  if (lastSpace > 24) {
    return `${truncated.slice(0, lastSpace)}...`;
  }

  return `${truncated}...`;
}
