# A Friendly Guide to Steward Chat Modes

Welcome! In this guide, you will learn about **Chat Modes** in Steward — what they are, how they protect your codebase, and how to switch between them to match your current task.

---

## What is a Chat Mode? (The Big Idea)

When working on software, your mindset changes depending on what you're doing:

* Sometimes you just want to **brainstorm ideas or ask high-level questions** without the AI touching any files.
* Sometimes you want to **review code or investigate bugs** safely with read-only access.
* Sometimes you want **full human confirmation** before any file is edited or command is run.
* Sometimes you want to **build fast** and let the AI write files freely without prompting you on every single edit.

**Chat Modes** let you set boundaries on what Steward is allowed to do. Think of modes as the permission dial for your AI assistant.

---

## The 4 Built-In Modes

Steward comes with 4 specialized modes:

| Mode | Shortcut Badge | Allowed Permissions | File Edits | Shell Commands | Best For |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Normal** | `Normal` | Read, Write, Execute | Asks for approval | Asks for approval | Everyday pair programming with full safety |
| **Chat** | `Chat` | None (No tools) | Blocked | Blocked | Pure brainstorming, architecture discussions, Q&A |
| **Review** | `Review` | Read-only | Blocked | Blocked | Code audits, exploring codebases, bug triage |
| **Build** | `Build` | Read, Write, Execute | Auto-approved | Asks for approval | High-speed feature development & scaffolding |

---

## Deep-Dive into Each Mode

### 1. Normal Mode (`normal`) — *Balanced & Safe*
* **How it works:** Steward has access to all tools (reading files, writing code, running bash commands, searching the web), but it will **always ask for your approval** before writing a file or executing a shell command.
* **When to use it:** This is Steward's default mode. Use it for standard day-to-day coding where you want to review diffs before they land on disk.

---

### 2. Chat Mode (`chat`) — *Pure Brainstorming*
* **How it works:** Completely disconnects all tools. Steward behaves as a pure conversational LLM.
* **When to use it:** 
  - Brainstorming software architecture.
  - Asking general programming questions ("How do WebSockets work in Node?").
  - Discussing trade-offs without the AI executing searches or looking at files.

---

### 3. Review Mode (`review`) — *Safe Exploration & Audit*
* **How it works:** Enables read-only tools (`read_file`, `grep`, `glob`, `list_dir`, `web_search`), but strictly blocks any file modifications or bash executions.
* **When to use it:**
  - Asking Steward to explain how an unfamiliar repository works.
  - Investigating a production bug without any risk of accidentally modifying files.
  - Reviewing a pull request or auditing security.

---

### 4. Build Mode (`build`) — *Fast-Track Development*
* **How it works:** File creations and edits are **automatically applied** without stopping for confirmation. Shell commands (`bash`) still pause to prompt for permission.
* **When to use it:**
  - Scaffolding a new project or large feature.
  - Performing wide refactors across dozens of files.
  - Rapid prototyping where you trust the AI to write files quickly.

---

## How to Switch Modes

You can switch modes at any moment during your session:

### Method 1: Keyboard Shortcut (Fastest)
Press **`Ctrl+B`** anywhere in the prompt to cycle through the modes:
$$\text{Normal} \longrightarrow \text{Chat} \longrightarrow \text{Review} \longrightarrow \text{Build} \longrightarrow \text{Normal}$$

### Method 2: Slash Command
Use the `/mode` slash command:
* `/mode` — Opens the interactive mode switcher.
* `/mode build` — Switches directly to Build mode.
* `/mode review` — Switches directly to Review mode.
* `/mode chat` — Switches directly to Chat mode.
* `/mode normal` — Switches directly to Normal mode.

---

## Where is the Active Mode Displayed?

Steward displays your active mode in two places:
1. **Bottom Status Bar:** A color-coded badge shows the current mode (e.g. `Build`, `Review`, `Chat`).

---

## Mode Policy Matrix (Technical Reference)

For developers building custom tools or plugins, here is how tool access maps to modes:

```text
Tool Access Level -> Allowed in Modes:
 * 'read'   (read_file, glob, grep, list_dir, web_search, skills) -> Normal, Review, Build
 * 'write'  (write_file, edit_file)                               -> Normal (prompts), Build (auto-approved)
 * 'exec'   (bash, task_read, task_kill)                          -> Normal (prompts), Build (prompts)
```

---

*Tip: If you ever want to quickly inspect a large codebase without worrying about accidental changes, just press `Ctrl+B` until you see `Review`, and explore with complete peace of mind!*
