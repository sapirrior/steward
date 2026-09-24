# Steward

[![Version](https://img.shields.io/badge/version-v0.22.0-D77757.svg)](https://github.com/sapirrior/steward/releases)
[![npm](https://img.shields.io/npm/v/steward-cli.svg?color=373737)](https://www.npmjs.com/package/steward-cli)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Runtime](https://img.shields.io/badge/runtime-Bun-fbf0df.svg?logo=bun)](https://bun.sh)
[![Platforms](https://img.shields.io/badge/platform-Linux%20%7C%20macOS%20%7C%20Termux%20%7C%20Windows-lightgrey.svg)](#get-started)

Steward is an interactive AI engineering assistant for the terminal. Built with a lightweight native runtime, Steward pairs with you to explore codebases, refactor architectures, run commands, and implement features with full human-in-the-loop control across local and frontier models.

---

## Get Started

### Installation

Install Steward globally using npm or Bun:

```bash
# npm (Recommended)
npm install -g steward-cli

# Bun
bun add -g steward-cli
```

Or execute directly with npx:

```bash
npx steward-cli
```

#### Standalone Scripts

**macOS, Linux & Termux:**
```bash
curl -fsSL https://raw.githubusercontent.com/sapirrior/steward/main/installer/install.sh | bash
```

**Windows (PowerShell):**
```powershell
irm https://raw.githubusercontent.com/sapirrior/steward/main/installer/install.ps1 | iex
```

**Build from Source:**
```bash
git clone https://github.com/sapirrior/steward.git
cd steward
bun install
bun run start
```

---

## Core Capabilities

- **Human-in-the-Loop Engineering:** Steward keeps you in control with explicit permission gates for filesystem mutations and bash commands.
- **First-Class Local Model Support:** Optimized for local model execution (Ollama, LM Studio, vLLM, Qwen, DeepSeek) as well as cloud frontier APIs.
- **Lightweight Native Architecture:** Handcrafted zero-overhead runtime with sub-millisecond startup and minimal system resource usage.
- **Synchronized Terminal UI:** Built with Mode 2026 synchronized output, flicker-free differential rendering, and intra-line word diffs.
- **Lossless Rewind Checkpoints:** Every file mutation is automatically tracked with Content-Addressed Storage (CAS) hashes, allowing one-click turn rollbacks.

---

## Privacy & Data Security

Steward operates on a strictly local-first architecture:

- **Zero Telemetry:** Steward collects no analytics, tracking data, or diagnostic logs.
- **Local Persistence:** All session history, configuration, and state are stored locally on your machine.
- **Direct Inference:** Network requests are made directly to your configured provider or local server endpoint via your own API credentials, governed entirely by your provider's terms.

---

## Provider Setup & Configuration

Steward supports 11 local and cloud providers with native streaming, dynamic model discovery, and multi-turn tool calling. Configure via environment variables, `.env` file, or OAuth `/login`:

### OAuth & Device Code Login

Authenticate directly from the terminal without manual API key management:

```bash
# Authenticate with GitHub Copilot (Device Code flow)
/login github-copilot

# Authenticate with Anthropic or OpenRouter (Browser OAuth flow)
/login anthropic
/login openrouter

# View or logout from authenticated providers
/logout
```

### Local Models (Ollama, LM Studio, vLLM)

```bash
# Ollama
export OLLAMA_BASE_URL="http://localhost:11434"
export OLLAMA_MODEL="qwen2.5-coder:32b"

# Generic OpenAI-Compatible Endpoint (LM Studio, vLLM, LocalAI)
export CUSTOM_API_URL="http://localhost:1234/v1"
export CUSTOM_API_MODEL_NAME="qwen2.5-coder-32b-instruct"
export CUSTOM_API_KEY="optional-api-key"
```

### Cloud Providers

```bash
# Anthropic
export ANTHROPIC_API_KEY="sk-ant-..."

# Google Gemini
export GEMINI_API_KEY="AIzaSy..."

# OpenAI
export OPENAI_API_KEY="sk-..."

# DeepSeek
export DEEPSEEK_API_KEY="sk-..."

# Groq
export GROQ_API_KEY="gsk_..."

# xAI
export XAI_API_KEY="xai-..."

# Mistral AI
export MISTRAL_API_KEY="your-mistral-api-key"

# OpenRouter
export OPENROUTER_API_KEY="sk-or-v1-..."
```

---

## Slash Commands

| Command | Description |
| :--- | :--- |
| `/login` | Authenticate with cloud providers (`anthropic`, `openrouter`, `github-copilot`) |
| `/logout` | Log out from authenticated providers and clear stored credentials |
| `/model` | Switch active model or discover available models across providers |
| `/mode` | Cycle through or set active chat mode (`normal`, `chat`, `review`, `build`) |
| `/theme` | Change terminal color theme (`dark`, `light`, `dracula`, `dark-ansi`, `light-ansi`) |
| `/effort` | Adjust model reasoning effort level (`none`, `low`, `medium`, `high`) |
| `/rewind` | Revert workspace modifications and conversation state to any prior turn |
| `/sessions` | Browse, resume, or delete saved session transcripts |
| `/clear` | Clear the current conversation and start a new session |
| `/help` | View help manual and keyboard shortcuts |
| `/exit` | Exit Steward (`Ctrl+C Ctrl+C`) |

---

## License

MIT License © 2026 [sapirrior](https://github.com/sapirrior)
