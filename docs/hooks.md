# A Friendly Guide to Steward Lifecycle Hooks

Welcome! In this guide, you will learn how **Lifecycle Hooks** work in Steward, why they are useful, and how you can use them to automate tasks, enforce team safety rules, and teach Steward about your project.

---

## What is a Hook? (The Big Idea)

Imagine you are pairing with a junior developer. Before they touch the codebase or run a command, you might want to give them some rules:

> *"Before you edit a file, make sure the test runner is ready."*  
> *"Before you run a shell command, make sure you never delete the database."*  
> *"Whenever you finish writing code, automatically run the formatter."*

**Hooks** are simply custom shell scripts or commands that Steward runs automatically at specific moments during a conversation.

If you have ever used **Git Hooks** (like `pre-commit`), Steward hooks work the exact same way — but for your AI engineering assistant.

---

## Where Do Hooks Live?

You can define hooks in two places:

| Location | Path | Scope |
| :--- | :--- | :--- |
| **Project-Level** | `.steward/hooks.json` | Applies only to the current repository. Checked into Git so your entire team shares the same rules. |
| **User-Level** | `~/.steward/hooks.json` | Applies to **all** projects you open on your personal computer. |

---

## The 6 Lifecycle Events

Steward provides **6 exact moments** (events) where you can attach your scripts:

```text
 1. Session Starts  ──► [ SessionStart ]
                             │
 2. You type a prompt ─► [ UserPromptSubmit ]
                             │
 3. AI calls a tool ──► [ BeforeToolUse ]  ──(Blocked?)──► Stop tool
                             │
                        (Executes Tool)
                             │
                        [ AfterToolUse ]  OR  [ ToolUseFailure ]
                             │
 4. AI finishes turn ─► [ AgentStop ]
```

### 1. `SessionStart`
* **When it fires:** When Steward starts up, resumes an old session, or resets.
* **Best used for:** Loading environment variables, printing welcome reminders, or checking if required tools (like Docker or Node) are installed.

### 2. `UserPromptSubmit`
* **When it fires:** The moment you press `Enter` to submit a message, before the AI begins thinking.
* **Best used for:** Adding extra project context to your prompt, or blocking restricted words/operations.

### 3. `BeforeToolUse`
* **When it fires:** Right before Steward executes any tool (like running `bash`, editing a file, or reading a directory).
* **Best used for:** Guard rails! For example, blocking dangerous bash commands (`rm -rf`, `DROP TABLE`) or requiring checks before mutating code.

### 4. `AfterToolUse`
* **When it fires:** Right after a tool executes successfully.
* **Best used for:** Auto-formatting code with Prettier/Black, auto-linting, or tracking file changes.

### 5. `ToolUseFailure`
* **When it fires:** If a tool fails (e.g. A bash command exits with an error code).
* **Best used for:** Logging errors or feeding extra diagnostic tips back to the AI.

### 6. `AgentStop`
* **When it fires:** When the AI finishes its entire multi-step response.
* **Best used for:** Running the test suite to verify the AI's work, and asking it to keep working if tests fail.

---

## Writing Your First `hooks.json`

Here is what a complete `.steward/hooks.json` looks like:

```json
{
  "version": 1,
  "hooks": {
    "SessionStart": [
      {
        "name": "check-node-env",
        "command": "node -v",
        "description": "Verifies Node is available when session starts"
      }
    ],
    "BeforeToolUse": [
      {
        "name": "guard-deployments",
        "command": ".steward/hooks/guard-commands.sh",
        "matcher": "bash",
        "description": "Prevents accidental production deployment commands"
      }
    ],
    "AfterToolUse": [
      {
        "name": "format-code",
        "command": "npx prettier --write .",
        "matcher": "write_file|edit_file",
        "description": "Auto-formats code after file mutations"
      }
    ]
  }
}
```

---

## How Matchers Work

Notice the `"matcher"` field above? Matchers let you choose **which tools** trigger your hook so it doesn't run unnecessarily.

* `matcher: "bash"` $\to$ Runs only for shell commands.
* `matcher: "write_file|edit_file"` $\to$ Runs whenever files are written or edited.
* `matcher: "*"` (or omitting `matcher`) $\to$ Runs for **all** tools.

---

## How Hooks Talk to Steward (Input & Output)

Your hook scripts communicate with Steward using standard input (`stdin`) and standard output (`stdout`).

### 1. What Steward Sends to Your Script (JSON on `stdin`)
When Steward triggers a hook, it passes event information as JSON into your script's standard input:

```json
{
  "hook_event_name": "BeforeToolUse",
  "session_id": "84f1a20b-...",
  "tool_name": "bash",
  "tool_input": {
    "command": "npm test"
  },
  "project_dir": "/home/user/my-project",
  "cwd": "/home/user/my-project"
}
```

### 2. What Your Script Can Do in Return (JSON on `stdout`)

Your script can either:
1. **Do background work quietly:** Just exit with code `0`.
2. **Inject context into the AI's mind:** Output JSON with `additionalContext`.
3. **Block the action:** Output JSON with `"decision": "block"`.

#### Example: Blocking a dangerous command
Here is a simple bash script (`.steward/hooks/guard-commands.sh`):

```bash
#!/usr/bin/env bash

# Read JSON stdin
INPUT=$(cat)

# Check if the command tries to push to production
if echo "$INPUT" | grep -q "deploy:prod"; then
  # Tell Steward to block the tool call!
  echo '{"decision": "block", "reason": "Deployments to production are forbidden in AI turns."}'
  exit 0
fi

# Allow everything else
echo '{"decision": "allow"}'
```

#### Example: Injecting extra instructions into the AI
```bash
#!/usr/bin/env bash

# Give the AI helpful context
echo '{"additionalContext": "Remember: All database schema migrations must use TypeScript."}'
```

---

## Built-In Safety Rules

Steward includes strict built-in protections for hooks:

1. **Secret Isolation:** Provider API keys (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, etc.) are **automatically stripped** from the hook's execution environment so child scripts can never leak your tokens.
2. **Workspace Trust:** Hooks only run in folders where you have confirmed workspace trust via the `TrustGate`.
3. **Execution Timeouts:** Each hook has a safety timeout (default 5,000ms / 5 seconds) so broken scripts can never freeze your terminal.
4. **Fast-Path Zero Overhead:** If you have no hooks registered for an event, Steward skips execution instantly with zero performance penalty.

---

## Summary Cheat Sheet

| Event Name | Common Purpose | Matcher Examples |
| :--- | :--- | :--- |
| `SessionStart` | Environment verification & system reminders | `startup`, `resume`, `reset` |
| `UserPromptSubmit` | Prompt augmentation & safety checks | (none) |
| `BeforeToolUse` | Command guards & pre-mutation checks | `bash`, `write_file`, `edit_file` |
| `AfterToolUse` | Auto-formatters & linters | `write_file\|edit_file` |
| `ToolUseFailure` | Diagnostic hints on tool failure | `bash`, `read_file` |
| `AgentStop` | Final verification & test suite execution | (none) |

---

*Happy hacking! If you ever want to scaffold a starter `hooks.json` file in any repository, simply run `/init` in your Steward prompt.*
