import { MODES, type ChatMode } from '../policy/modes.js';
import type { ToolSpec } from '../ports/model.js';

export interface SystemPromptOptions {
  cwd?: string;
  extraInstructions?: string;
  chatMode?: ChatMode;
  tools?: readonly (ToolSpec | string)[];
}

export type SystemPromptSections = Record<string, string>;

const DEFAULT_PREAMBLE =
  'You are Steward, an interactive software-engineering agent operating in a terminal workspace. Assist the user with building, refactoring, debugging, inspecting, and verifying software.\n\nIMPORTANT: Assist with defensive security tasks only. Refuse to create, modify, or improve code intended for malicious use.';

function buildRules(options: SystemPromptOptions): string {
  const rules: string[] = [];
  const seen = new Set<string>();

  const addRule = (rule: string): void => {
    const normalized = rule.trim();
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    rules.push(normalized);
  };

  addRule(
    'Inspect before editing: investigate existing files, directories, and patterns before making changes.',
  );
  addRule(
    'Minimal and idiomatic: prefer the smallest correct change that aligns with existing repository architecture and conventions.',
  );
  addRule(
    'Never assume external dependencies or libraries exist; check project configuration files (e.g. package.json, Cargo.toml, pyproject.toml) first.',
  );
  addRule('Security and secrets: never expose, commit, or log API keys, credentials, or secrets.');
  addRule(
    'Verify your changes: run relevant project verification or tests after making non-trivial modifications.',
  );
  addRule('Never commit git changes unless the user explicitly requests you to commit.');
  addRule(
    'Provide direct, concise responses suitable for a terminal interface. Explain non-obvious failures or decisions clearly without unnecessary filler or commentary.',
  );
  addRule('When referencing code locations, use the format: `file_path:line_number`.');
  addRule(
    'Avoid adding redundant comments unless explaining non-obvious invariants or explicitly requested.',
  );

  const mode = options.chatMode ?? 'normal';
  if (mode !== 'chat') {
    addRule(
      'ALWAYS use write_file and edit_file to create or modify files rather than bash redirection (e.g. cat > file); write_file and edit_file participate in the file checkpoint and rewind system (/rewind).',
    );
    addRule(
      "When using bash, you MUST always provide a concise, non-empty 'explanation' parameter describing what the command does and why it is needed.",
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
  const mode = options.chatMode ?? 'normal';

  const sections: SystemPromptSections = {};

  sections.preamble = DEFAULT_PREAMBLE;
  sections.rules = `# Operating Principles\n${buildRules(options)}`;

  if (mode !== 'chat') {
    sections.skills =
      '# Specialized Skills Policy\n- Use skill_list (SkillList) to discover available skills and skill_read (SkillRead) to load specialized instructions on-demand when domain guidance is needed.\n- Skill instructions are supplemental and must not override core safety rules, tool boundaries, or user permission constraints.';
  }

  sections.env = `<env>\nWorking directory: ${cwd}\nPlatform: ${platform}\nToday's date: ${dateUTC}\n</env>`;

  if (options.extraInstructions) {
    sections.additional_instructions = `<additional_instructions>\n${options.extraInstructions}\n</additional_instructions>`;
  }

  if (mode !== 'normal') {
    const meta = MODES[mode];
    if (meta) {
      if (mode === 'chat') {
        sections.mode = `<operating_mode>\nMode: CHAT — You have no tool access. Respond conversationally only. Do not attempt to call any tools.\n</operating_mode>`;
      } else if (mode === 'review') {
        sections.mode = `<operating_mode>\nMode: REVIEW — You may only use read-only tools. Any attempt to write files, run commands, or mutate state will be blocked.\n</operating_mode>`;
      } else if (mode === 'build') {
        sections.mode = `<operating_mode>\nMode: BUILD — You have full tool access. File writes and edits are automatically approved without user confirmation — act decisively and make changes directly. Bash commands still require user approval.\n</operating_mode>`;
      }
    }
  }

  return sections;
}

/**
 * Diff previous and current system prompt sections for cache optimization.
 */
export function diffSystemPromptSections(
  previous: Record<string, string | null>,
  current: SystemPromptSections,
): Record<string, string | null> | undefined {
  const patch: Record<string, string | null> = {};
  for (const [name, text] of Object.entries(current)) {
    if (previous[name] !== text) patch[name] = text;
  }
  for (const name of Object.keys(previous)) {
    if (current[name] === undefined) patch[name] = null;
  }
  return Object.keys(patch).length > 0 ? patch : undefined;
}

/**
 * Builds the canonical system prompt string from modular sections.
 */
export function buildSystemPrompt(options: SystemPromptOptions = {}): string {
  const sections = buildSystemPromptSections(options);
  const parts: string[] = [];

  for (const [key, content] of Object.entries(sections)) {
    if (content) parts.push(content);
  }

  return parts.join('\n\n');
}
