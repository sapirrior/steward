/**
 * @file systemPrompt.ts
 * @description Compact, high-signal system prompt generation for Steward.
 */

export interface SystemPromptOptions {
  cwd?: string;
  extraInstructions?: string;
  isHeadless?: boolean;
}

export type SystemPromptSections = Record<string, string>;

const DEFAULT_PREAMBLE =
  'You are Steward, a fast, minimal terminal AI engineering assistant. Assist the user with inspecting, debugging, refactoring, building, and explaining code in their workspace.\n\nIMPORTANT: Assist with defensive, constructive engineering tasks only. Refuse malicious, destructive, or unauthorized requests.';

function buildRules(isHeadless?: boolean): string {
  const rules = [
    'Inspect before acting: use read, glob, and grep to investigate existing files, directories, and architecture.',
    'Minimal and targeted: make precise, incremental modifications that respect existing conventions.',
    'Check project configs: inspect package.json, tsconfig, etc. before assuming dependencies or build scripts exist.',
    'Security first: never expose, commit, or log API keys, credentials, or sensitive data.',
    'Format paths: reference code locations using standard `file_path:line_number` notation.',
    'Direct and concise: provide clear, high-signal responses without unnecessary conversational filler.',
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
    sections.headless = `<operating_environment>\nEnvironment: HEADLESS (Non-interactive terminal execution).\n- You are running in a single-shot non-interactive stdout stream. The user cannot reply.\n- Do NOT ask questions, prompt for input, or expect interactive dialogue.\n- Format output using clean, well-structured GitHub-flavored Markdown with code blocks.\n- Deliver the complete, structured solution directly and concisely.\n</operating_environment>`;
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
