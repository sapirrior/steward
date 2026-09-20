import chalk from 'chalk';
import { extname, basename } from 'node:path';
import {
  highlight as cliHighlight,
  supportsLanguage,
  type Theme as HighlightTheme,
} from 'cli-highlight';
import { getActiveThemeName } from '../theme/index.js';

/**
 * GitHub Dark Syntax Highlighting Theme (TrueColor & 256-color)
 */
export const githubDarkHighlightTheme: HighlightTheme = {
  keyword: chalk.hex('#ff7b72'),
  built_in: chalk.hex('#ffa657'),
  type: chalk.hex('#ffa657'),
  literal: chalk.hex('#79c0ff'),
  number: chalk.hex('#79c0ff'),
  regexp: chalk.hex('#7ee787'),
  string: chalk.hex('#a5d6ff'),
  subst: chalk.hex('#c9d1d9'),
  symbol: chalk.hex('#7ee787'),
  class: chalk.hex('#ffa657'),
  function: chalk.hex('#d2a8ff'),
  title: chalk.hex('#d2a8ff'),
  params: chalk.hex('#c9d1d9'),
  comment: (str) => chalk.hex('#8b949e')(chalk.italic(str)),
  doctag: chalk.hex('#ff7b72'),
  meta: chalk.hex('#79c0ff'),
  'meta-keyword': chalk.hex('#ff7b72'),
  'meta-string': chalk.hex('#a5d6ff'),
  section: chalk.hex('#79c0ff').bold,
  tag: chalk.hex('#7ee787'),
  name: chalk.hex('#7ee787'),
  'builtin-name': chalk.hex('#ffa657'),
  attr: chalk.hex('#79c0ff'),
  attribute: chalk.hex('#79c0ff'),
  variable: chalk.hex('#ffa657'),
  bullet: chalk.hex('#ffa657'),
  code: chalk.hex('#c9d1d9'),
  emphasis: (str) => chalk.italic(str),
  strong: (str) => chalk.bold(str),
  formula: chalk.hex('#7ee787'),
  link: chalk.hex('#a5d6ff').underline,
  quote: chalk.hex('#8b949e'),
  'selector-tag': chalk.hex('#7ee787'),
  'selector-id': chalk.hex('#79c0ff').bold,
  'selector-class': chalk.hex('#79c0ff'),
  'selector-attr': chalk.hex('#79c0ff'),
  'selector-pseudo': chalk.hex('#79c0ff'),
  'template-tag': chalk.hex('#7ee787'),
  'template-variable': chalk.hex('#ffa657'),
  addition: chalk.hex('#7ee787'),
  deletion: chalk.hex('#ffa198'),
  default: chalk.hex('#c9d1d9'),
};

/**
 * ANSI 16-Color Syntax Highlighting Theme for basic terminals and ANSI themes
 */
export const ansiHighlightTheme: HighlightTheme = {
  keyword: chalk.red,
  built_in: chalk.yellow,
  type: chalk.yellow,
  literal: chalk.cyan,
  number: chalk.cyan,
  regexp: chalk.green,
  string: chalk.cyan,
  subst: chalk.white,
  symbol: chalk.green,
  class: chalk.yellow,
  function: chalk.magenta,
  title: chalk.magenta,
  params: chalk.white,
  comment: (str) => chalk.gray(chalk.italic(str)),
  doctag: chalk.red,
  meta: chalk.blue,
  'meta-keyword': chalk.red,
  'meta-string': chalk.cyan,
  section: chalk.blue.bold,
  tag: chalk.green,
  name: chalk.green,
  'builtin-name': chalk.yellow,
  attr: chalk.cyan,
  attribute: chalk.cyan,
  variable: chalk.yellow,
  bullet: chalk.yellow,
  code: chalk.white,
  emphasis: (str) => chalk.italic(str),
  strong: (str) => chalk.bold(str),
  formula: chalk.green,
  link: chalk.cyan.underline,
  quote: chalk.gray,
  'selector-tag': chalk.green,
  'selector-id': chalk.blue.bold,
  'selector-class': chalk.cyan,
  'selector-attr': chalk.cyan,
  'selector-pseudo': chalk.cyan,
  'template-tag': chalk.green,
  'template-variable': chalk.yellow,
  addition: chalk.green,
  deletion: chalk.red,
  default: chalk.white,
};

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

/**
 * Dynamically resolves the best highlight theme based on active theme and terminal color capabilities.
 */
export function getHighlightTheme(): HighlightTheme {
  if (chalk.level === 0) {
    return {
      default: (str) => str,
    };
  }

  const activeTheme = getActiveThemeName();
  if (activeTheme.includes('ansi') || chalk.level === 1) {
    return ansiHighlightTheme;
  }

  return githubDarkHighlightTheme;
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
  if (chalk.level === 0) return code;

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
