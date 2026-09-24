# Steward

[![Version](https://img.shields.io/badge/version-v0.22.0-D77757.svg)](https://github.com/sapirrior/steward/releases)
[![npm](https://img.shields.io/npm/v/steward-cli.svg?color=373737)](https://www.npmjs.com/package/steward-cli)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Runtime](https://img.shields.io/badge/runtime-Bun-fbf0df.svg?logo=bun)](https://bun.sh)
[![Platforms](https://img.shields.io/badge/platform-Linux%20%7C%20macOS%20%7C%20Termux%20%7C%20Windows-lightgrey.svg)](#get-started)

Steward is an interactive AI engineering assistant that lives in your terminal, understands your codebase, and pairs with you to build, refactor, and debug software through natural language.

---

## Get Started

### Quick Install

**macOS, Linux & Termux:**
```bash
curl -fsSL https://raw.githubusercontent.com/sapirrior/steward/main/installer/install.sh | bash
```

**Windows (PowerShell):**
```powershell
irm https://raw.githubusercontent.com/sapirrior/steward/main/installer/install.ps1 | iex
```

**Package Managers:**
```bash
# npm
npm install -g steward-cli

# Bun
bun add -g steward-cli
```

### Usage

Navigate to any project directory and run:

```bash
steward
```

Authenticate with your provider of choice using `/login` (Anthropic, OpenRouter, GitHub Copilot) or standard API keys.

---

## Supported Providers & Models

Steward natively connects to frontier APIs, gateways, and local offline inference servers:

| Provider | Authentication | Default Model | Key / Config |
| :--- | :--- | :--- | :--- |
| **Anthropic** | Browser OAuth / API Key | `claude-3-7-sonnet-20250219` | `/login anthropic` or `ANTHROPIC_API_KEY` |
| **OpenAI** | API Key | `gpt-4o-mini` | `OPENAI_API_KEY` |
| **Google Gemini** | API Key | `gemini-2.5-flash` | `GEMINI_API_KEY` |
| **OpenRouter** | Browser OAuth / API Key | `meta-llama/llama-3.3-70b-instruct:free` | `/login openrouter` or `OPENROUTER_API_KEY` |
| **GitHub Copilot** | Device Code OAuth | `gpt-4o` | `/login github-copilot` |
| **Ollama (Local)** | None | `qwen2.5-coder:latest` | `OLLAMA_BASE_URL` (default `http://localhost:11434/v1`) |
| **DeepSeek** | API Key | `deepseek-chat` | `DEEPSEEK_API_KEY` |
| **Groq** | API Key | `llama-3.3-70b-versatile` | `GROQ_API_KEY` |
| **xAI / Grok** | API Key | `grok-2-1212` | `XAI_API_KEY` |
| **Mistral AI** | API Key | `codestral-latest` | `MISTRAL_API_KEY` |
| **Custom** | Optional API Key | `default` | `CUSTOM_API_URL` & `CUSTOM_API_KEY` |

---

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and guidelines.

## License

MIT License © 2026 [sapirrior](https://github.com/sapirrior)

