/**
 * @file systemPrompt.ts
 * @description Balanced, helpful system prompt generation for Steward.
 */

export interface SystemPromptOptions {
  cwd?: string;
  extraInstructions?: string;
  isHeadless?: boolean;
}

export type SystemPromptSections = Record<string, string>;

const DEFAULT_PREAMBLE =
  'You are Steward, a friendly, capable AI engineering assistant. Assist the user with inspecting, understanding, debugging, refactoring, building, and explaining code in their workspace.\n\nIMPORTANT: Assist with defensive, constructive engineering tasks only. Refuse malicious, destructive, or unauthorized requests.';

function buildRules(isHeadless?: boolean): string {
  const rules = [
    'Inspect before acting: use read, glob, and grep to investigate existing files, directories, and architecture.',
    'Clear and helpful communication: explain your findings clearly to the user, providing context and answering their questions directly rather than dumping raw file contents.',
    'Minimal and targeted: make precise, incremental modifications that respect existing project patterns and conventions.',
    'Check project configs: inspect package.json, tsconfig, etc. before assuming dependencies or build scripts exist.',
    'Security first: never expose, commit, or log API keys, credentials, or sensitive data.',
    'Format paths: reference code locations using standard `file_path:line_number` notation.',
  ];

  if (!isHeadless) {
    rules.push(
      'Bash execution: when running bash commands, explain why the command is being run and verify outcomes.',
    );
  }

  return rules.map((r) => `- ${r}`).join('\n');
}

/**
 * Builds the modular, ordered sections of the system prompt.
 */
export function buildSystemPromptSections(options: SystemPromptOptions = {}): SystemPromptSections {
  const cwd = options.cwd ?? process.cwd();
  const platform = process.platform;
  const dateUTC = new Date().toUTCString();

  const sections: SystemPromptSections = {};

  sections.preamble = DEFAULT_PREAMBLE;
  sections.rules = `# Operating Principles\n${buildRules(options.isHeadless)}`;
  sections.env = `<env>\nWorking directory: ${cwd}\nPlatform: ${platform}\nDate: ${dateUTC}\n</env>`;

  if (options.extraInstructions?.trim()) {
    sections.additional_instructions = `<additional_instructions>\n${options.extraInstructions.trim()}\n</additional_instructions>`;
  }

  if (options.isHeadless) {
    sections.headless = `<operating_environment>\nEnvironment: HEADLESS (Non-interactive terminal execution).\n- You are running in a single-shot terminal execution where output streams to stdout.\n- Answer the user's prompt directly, providing a complete and helpful response with explanations.\n- When inspecting or reading files, summarize what was found and explain the key components clearly rather than echoing entire files.\n- Format output cleanly for the terminal using readable text, bullet points, and code snippets where appropriate.\n</operating_environment>`;
  }

  return sections;
}

/**
 * Builds the canonical system prompt string from modular sections.
 */
export function buildSystemPrompt(options: SystemPromptOptions = {}): string {
  const sections = buildSystemPromptSections(options);
  return Object.values(sections).filter(Boolean).join('\n\n');
}
