import type { CommandSegment } from './types.js';

/**
 * Splits a full shell command string into discrete compound/pipeline segments,
 * respecting single quotes, double quotes, and subshell groupings.
 */
export function splitCompoundCommands(input: string): string[] {
  const segments: string[] = [];
  let current = '';
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let parenDepth = 0;

  for (let i = 0; i < input.length; i++) {
    const char = input[i]!;
    const nextChar = input[i + 1];

    if (char === '\\' && !inSingleQuote) {
      current += char + (nextChar || '');
      i++;
      continue;
    }

    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      current += char;
      continue;
    }

    if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      current += char;
      continue;
    }

    if (!inSingleQuote && !inDoubleQuote) {
      if (char === '(') {
        parenDepth++;
        current += char;
        continue;
      }
      if (char === ')') {
        parenDepth = Math.max(0, parenDepth - 1);
        current += char;
        continue;
      }

      if (parenDepth === 0) {
        // Delimiters: &&, ||, |, ;, \n, &
        if (
          (char === '&' && nextChar === '&') ||
          (char === '|' && nextChar === '|')
        ) {
          if (current.trim()) segments.push(current.trim());
          current = '';
          i++; // Skip second character
          continue;
        }

        if (char === ';' || char === '\n' || char === '|') {
          if (current.trim()) segments.push(current.trim());
          current = '';
          continue;
        }
      }
    }

    current += char;
  }

  if (current.trim()) {
    segments.push(current.trim());
  }

  return segments;
}

/**
 * Tokenizes a single command segment into individual argument words,
 * extracting unquoted redirections and subshells.
 */
export function parseCommandSegment(segmentStr: string): CommandSegment {
  const words: string[] = [];
  const redirections: string[] = [];
  const subcommands: string[] = [];
  let currentWord = '';
  let inSingleQuote = false;
  let inDoubleQuote = false;

  const raw = segmentStr.trim();

  // 1. Scan for $(...) subshells and `...` backticks
  const subshellParenRegex = /\$\(([^)]+)\)/g;
  let match: RegExpExecArray | null;
  while ((match = subshellParenRegex.exec(raw)) !== null) {
    if (match[1]) subcommands.push(match[1].trim());
  }

  const backtickRegex = /`([^`]+)`/g;
  while ((match = backtickRegex.exec(raw)) !== null) {
    if (match[1]) subcommands.push(match[1].trim());
  }

  // 2. Tokenize words and extract unquoted redirections
  for (let i = 0; i < raw.length; i++) {
    const char = raw[i]!;
    const nextChar = raw[i + 1];

    if (char === '\\' && !inSingleQuote) {
      currentWord += nextChar || '';
      i++;
      continue;
    }

    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      continue;
    }

    if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      continue;
    }

    if (!inSingleQuote && !inDoubleQuote) {
      // Redirections: >>, >, 1>, 2>, &>, >|, 1>>, 2>>, &>>
      if (char === '>' || char === '<') {
        let redir = char;
        if (nextChar === '>' || nextChar === '|' || nextChar === '&') {
          redir += nextChar;
          i++;
        }
        redirections.push(redir);
        if (currentWord.trim()) {
          // Check if currentWord ended with a stream descriptor like '1', '2', or '&'
          if (/^[12&]$/.test(currentWord.trim())) {
            // Already absorbed as part of redirection
          } else {
            words.push(currentWord.trim());
          }
          currentWord = '';
        }
        continue;
      }

      if (/\s/.test(char)) {
        if (currentWord.trim()) {
          words.push(currentWord.trim());
          currentWord = '';
        }
        continue;
      }
    }

    currentWord += char;
  }

  if (currentWord.trim()) {
    words.push(currentWord.trim());
  }

  const command = words[0] || '';
  const args = words.slice(1);

  return {
    raw,
    command,
    args,
    redirections,
    hasSubshell: subcommands.length > 0,
    subcommands,
  };
}

/**
 * Parses full command into structured segments.
 */
export function parseFullCommand(fullCommand: string): CommandSegment[] {
  const parts = splitCompoundCommands(fullCommand);
  return parts.map(parseCommandSegment);
}
