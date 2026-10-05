# Steward

<p align="center">
  <strong>The minimal, high-precision AI engineering assistant for your terminal.</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/steward-cli"><img src="https://img.shields.io/npm/v/steward-cli?color=E5533D&label=steward&style=flat-square" alt="npm" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-7A88CF?style=flat-square" alt="license" /></a>
  <a href="#quick-start"><img src="https://img.shields.io/badge/runtime-Bun%20%7C%20Node-30B08F?style=flat-square" alt="runtime" /></a>
  <a href="#supported-providers"><img src="https://img.shields.io/badge/providers-11%20native-blue?style=flat-square" alt="providers" /></a>
</p>

---

**Steward** is a plug-and-play terminal pair programmer built with a focused philosophy: **maximum engineering leverage with zero bloat.** 

Instead of heavy framework abstractions or sprawling plugin layers, Steward delivers a clean, cohesive tool from day one—giving you the speed of a lightweight coding agent with the safety, resilience, and depth required for serious software development.

```
┌─────────────────────────────────────────────────────────────┐
│ ✦ Fast, zero-lag Alternate-Screen TUI (Synchronized Mode 2026)│
│ ✦ Zero-dependency native AI engine with automatic retry     │
│ ✦ Ultra-lean system prompt (~450 tokens) & lazy skill loading│
│ ✦ 16 native tools: search, read, edit, bash, tasks, fetch   │
│ ✦ Content-addressed checkpoints & atomic rewind undo        │
│ ✦ 11 providers: Anthropic, OpenAI, Gemini, OpenRouter, etc. │
│ ✦ Plug-and-play: browser OAuth or standard environment keys │
└─────────────────────────────────────────────────────────────┘
```

---

## Quick Start

Install Steward globally with your favorite package manager or one-line installer:

### One-Line Install

```bash
# macOS, Linux & Termux
curl -fsSL https://raw.githubusercontent.com/sapirrior/steward/main/installer/install.sh | bash
```

```powershell
# Windows (PowerShell)
irm https://raw.githubusercontent.com/sapirrior/steward/main/installer/install.ps1 | iex
```

### Via Package Managers

```bash
npm install -g steward-cli
# or
bun add -g steward-cli
```

### Launch

Navigate to any codebase and launch:

```bash
steward
```

Connect your provider in seconds using `/login` (Anthropic, OpenRouter, GitHub Copilot) or by setting standard environment keys (`OPENAI_API_KEY`, `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, etc.).

---

## Why Steward?

### 🎯 Pure & Focused from Day One
Steward is engineered to be clean and immediately productive without setup friction. You don't need to configure complex plugin trees, manage external SDK wrappers, or debug fragile hook pipelines. Everything you need to inspect, edit, test, and ship code is built directly into the core runtime.

### 🪶 Ultra-Lean System Prompt & Smart Lazy Loading
Rather than burning thousands of tokens on monolithic boilerplate prompts or dumping entire skill libraries into upfront context, Steward uses a razor-sharp base system prompt (~450 tokens). Context rules and domain capabilities are discovered and loaded on demand through native catalog tools (`skill_list`, `skill_read`), preserving maximum model attention and context window budget for your code.

### 🛡️ Safe by Default, Fearless by Design
- **Permission Gated:** Destructive file modifications and shell commands always ask for your explicit approval with line-by-line diff previews.
- **Atomic Rewind Checkpoints:** Every file edit automatically snapshots a pre-mutation image. Made a mistake or want to revert an approach? Use `/rewind` to cleanly roll back your workspace to any previous turn.

### ⚡ Zero-Dependency AI Core
Steward doesn't rely on third-party AI frameworks. All LLM streaming, SSE decoders, error parsers, and cross-protocol translations are maintained natively in `@steward/ai` for blistering startup times, reliable rate-limit recovery (with 10-attempt backoff), and robust offline resilience.

### 🎨 Native Terminal UI (`stitchable`)
Built on a custom line-differential rendering engine with Mode 2026 synchronized output. Enjoy flicker-free markdown streaming, real-time tool badges, fuzzy file searching (`@`), and interactive slash palettes (`/`).

---

## Supported Providers

Steward works with any model you prefer—frontier cloud models, unified gateways, or local offline servers:

| Provider | Authentication | Setup |
| :--- | :--- | :--- |
| **Anthropic** | Browser OAuth / API Key | `/login anthropic` or `export ANTHROPIC_API_KEY=...` |
| **OpenAI** | API Key | `export OPENAI_API_KEY=sk-...` |
| **Google Gemini** | API Key | `export GEMINI_API_KEY=...` |
| **OpenRouter** | Browser OAuth / API Key | `/login openrouter` or `export OPENROUTER_API_KEY=...` |
| **GitHub Copilot** | Device Code OAuth | `/login github-copilot` |
| **Ollama (Local)** | None (Local server) | Auto-detects `http://localhost:11434` |
| **xAI (Grok)** | API Key | `export XAI_API_KEY=...` |
| **DeepSeek** | API Key | `export DEEPSEEK_API_KEY=...` |
| **Mistral AI** | API Key | `export MISTRAL_API_KEY=...` |
| **Groq** | API Key | `export GROQ_API_KEY=...` |
| **Custom / Self-Hosted** | Base URL + Model + API Key | `CUSTOM_API_URL`, `CUSTOM_MODEL_NAME`, and `CUSTOM_API_KEY` |

---

## Keyboard Shortcuts & Slash Commands

| Key / Command | Action |
| :--- | :--- |
| `/model` | Open the interactive model picker dock |
| `/login` | Authenticate with OAuth AI providers |
| `/mode` or `Ctrl+B` | Cycle chat modes (`normal`, `chat`, `review`, `build`) |
| `/effort` | Adjust reasoning effort (`none`, `low`, `medium`, `high`, `xhigh`) |
| `/rewind` | Revert file changes to previous session turns |
| `/sessions` | Browse, resume, or export saved session transcripts |
| `/clear` | Clear active context and start a fresh turn |
| `@filename` | Fuzzy find and mention workspace files into context |
| `Escape` / `Ctrl+C` | Abort current generation or close open modal dock |

---

## Contributing

We welcome contributions! Check out [CONTRIBUTING.md](CONTRIBUTING.md) for architecture guidelines, development setup, and testing instructions.

---

## License

MIT © [sapirrior](https://github.com/sapirrior)
