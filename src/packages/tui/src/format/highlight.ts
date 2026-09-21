import { extname, basename } from 'node:path';
import { highlight as cliHighlight, supportsLanguage } from 'cli-highlight';
import { getHighlightTheme } from '../theme/index.js';

const EXTENSION_MAP: Record<string, string> = {
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.json': 'json',
  '.py': 'python',
  '.rb': 'ruby',
  '.go': 'go',
  '.rs': 'rust',
  '.sh': 'bash',
  '.bash': 'bash',
  '.zsh': 'bash',
  '.html': 'html',
  '.htm': 'html',
  '.css': 'css',
  '.scss': 'scss',
  '.less': 'less',
  '.md': 'markdown',
  '.markdown': 'markdown',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.toml': 'ini',
  '.sql': 'sql',
  '.c': 'c',
  '.h': 'c',
  '.cpp': 'cpp',
  '.hpp': 'cpp',
  '.cc': 'cpp',
  '.java': 'java',
  '.php': 'php',
  '.xml': 'xml',
  '.svg': 'xml',
};

const FILENAME_MAP: Record<string, string> = {
  dockerfile: 'dockerfile',
  makefile: 'makefile',
  cmakelists: 'cmake',
};

/**
 * Detects programming language identifier from file path or extension.
 */
export function detectLanguageFromPath(filePath?: string): string | undefined {
  if (!filePath) return undefined;
  const name = basename(filePath).toLowerCase();
  if (FILENAME_MAP[name]) return FILENAME_MAP[name];

  const ext = extname(filePath).toLowerCase();
  if (ext && EXTENSION_MAP[ext]) {
    return EXTENSION_MAP[ext];
  }

  if (ext && supportsLanguage(ext.slice(1))) {
    return ext.slice(1);
  }

  return undefined;
}

export interface HighlightCodeOptions {
  language?: string;
  filePath?: string;
}

/**
 * Highlights a block or line of code with dynamic theme selection and language resolution.
 */
export function highlightCode(code: string, options?: HighlightCodeOptions): string {
  if (!code) return '';

  const lang = options?.language ?? detectLanguageFromPath(options?.filePath);

  try {
    if (lang && supportsLanguage(lang)) {
      return cliHighlight(code, {
        language: lang,
        ignoreIllegals: true,
        theme: getHighlightTheme(),
      });
    }

    return cliHighlight(code, {
      ignoreIllegals: true,
      theme: getHighlightTheme(),
    });
  } catch {
    return code;
  }
}
