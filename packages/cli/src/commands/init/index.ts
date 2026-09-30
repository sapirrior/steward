import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import type { CommandContext, CommandResult, SlashCommand } from '../types.js';

/**
 * Generates starter AGENTS.md content tailored to the detected project structure.
 */
function generateAgentsMd(cwd: string): string {
  const projectName = basename(cwd);
  let stack = 'General';
  let commandsSection = '- `make test`: Run test suite';

  if (existsSync(join(cwd, 'package.json'))) {
    try {
      const pkg = JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf-8'));
      const scripts = pkg.scripts ? Object.keys(pkg.scripts) : [];
      stack = 'Node.js / TypeScript';
      if (scripts.length > 0) {
        commandsSection = scripts.map((s) => `- \`npm run ${s}\` (or \`bun run ${s}\`)`).join('\n');
      }
    } catch {
      stack = 'Node.js';
    }
  } else if (existsSync(join(cwd, 'Cargo.toml'))) {
    stack = 'Rust';
    commandsSection = '- `cargo build`: Build project\n- `cargo test`: Run tests';
  } else if (existsSync(join(cwd, 'pyproject.toml')) || existsSync(join(cwd, 'requirements.txt'))) {
    stack = 'Python';
    commandsSection = '- `pytest`: Run tests\n- `python main.py`: Run application';
  } else if (existsSync(join(cwd, 'go.mod'))) {
    stack = 'Go';
    commandsSection = '- `go build ./...`: Build packages\n- `go test ./...`: Run test suite';
  }

  return `# AGENTS.md

Operational guidelines and architectural context for AI engineering assistants working in \`${projectName}\`.

## 1. Project Overview & Tech Stack

- **Project:** \`${projectName}\`
- **Primary Stack:** ${stack}

## 2. Common Commands

${commandsSection}

## 3. Architecture & Guidelines

- **Code Style:** Follow established project formatting and idioms.
- **Verification:** Run relevant tests before finalizing changes.
- **Safety:** Verify file paths and permissions before applying destructive edits.
`;
}

/**
 * Valid dummy hooks.json template complying with @steward/plugins schema.
 */
const DUMMY_HOOKS_JSON = JSON.stringify(
  {
    version: 1,
    hooks: {
      SessionStart: [
        {
          name: 'sample-session-start',
          command: 'echo "Steward session started"',
          enabled: false,
          description: 'Runs when a session starts or resumes',
        },
      ],
      BeforeToolUse: [
        {
          name: 'sample-tool-guard',
          command: 'echo "Checking tool call"',
          matcher: 'bash',
          enabled: false,
          description: 'Runs before specific tool executions',
        },
      ],
    },
  },
  null,
  2,
);

/**
 * /init slash command: scaffolds AGENTS.md, .steward/hooks.json, and .agents/skills/ in the workspace.
 */
export const initCommand: SlashCommand = {
  name: 'init',
  description: 'Initializes project with AGENTS.md, .steward/hooks.json, and .agents/ directory',
  usage: '/init',

  async execute(_args: string[], context: CommandContext): Promise<CommandResult> {
    const cwd = context.cwd || process.cwd();
    const created: string[] = [];
    const skipped: string[] = [];

    try {
      // 1. AGENTS.md
      const agentsMdPath = join(cwd, 'AGENTS.md');
      if (!existsSync(agentsMdPath)) {
        writeFileSync(agentsMdPath, generateAgentsMd(cwd), 'utf-8');
        created.push('AGENTS.md');
      } else {
        skipped.push('AGENTS.md (already exists)');
      }

      // 2. .steward/hooks.json
      const stewardDir = join(cwd, '.steward');
      if (!existsSync(stewardDir)) {
        mkdirSync(stewardDir, { recursive: true });
      }
      const hooksPath = join(stewardDir, 'hooks.json');
      if (!existsSync(hooksPath)) {
        writeFileSync(hooksPath, DUMMY_HOOKS_JSON, 'utf-8');
        created.push('.steward/hooks.json');
      } else {
        skipped.push('.steward/hooks.json (already exists)');
      }

      // 3. .agents/skills/ directory
      const skillsDir = join(cwd, '.agents', 'skills');
      if (!existsSync(skillsDir)) {
        mkdirSync(skillsDir, { recursive: true });
        created.push('.agents/skills/');
      } else {
        skipped.push('.agents/skills/ (already exists)');
      }

      const summaryParts: string[] = [];
      if (created.length > 0) {
        summaryParts.push(`Created: ${created.join(', ')}`);
      }
      if (skipped.length > 0) {
        summaryParts.push(`Preserved: ${skipped.join(', ')}`);
      }

      return {
        handled: true,
        message: `Project initialized successfully!\n${summaryParts.join('\n')}`,
      };
    } catch (err) {
      return {
        handled: true,
        message: `Failed to initialize project: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  },
};
