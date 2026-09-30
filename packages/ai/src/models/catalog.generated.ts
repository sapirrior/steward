/**
 * @steward/ai - Generated Static Model Catalog
 *
 * Generated automatically from https://models.dev/api.json.
 * DO NOT EDIT MANUALLY. Run `bun run catalog:update` to refresh.
 */

import type { Model } from '../types.js';

export interface ProviderPreset {
  id: string;
  name: string;
  baseUrl: string;
  envVars: readonly string[];
  keyless?: boolean;
}

export const PROVIDER_PRESETS: readonly ProviderPreset[] = [
  {
    "id": "deepseek",
    "name": "DeepSeek",
    "baseUrl": "https://api.deepseek.com",
    "envVars": [
      "DEEPSEEK_API_KEY"
    ]
  },
  {
    "id": "lmstudio",
    "name": "LM Studio",
    "baseUrl": "http://localhost:1234/v1",
    "envVars": [],
    "keyless": true
  },
  {
    "id": "ollama",
    "name": "Ollama",
    "baseUrl": "http://localhost:11434/v1",
    "envVars": [],
    "keyless": true
  }
] as const;

export const MODELS: readonly Model[] = [
  {
    "id": "claude-fable-5",
    "name": "Claude Fable 5",
    "provider": "anthropic",
    "protocol": "anthropic-messages",
    "baseUrl": "https://api.anthropic.com",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": "xhigh"
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1000000,
    "maxOutputTokens": 128000,
    "temperature": false,
    "releaseDate": "2026-06-07",
    "cost": {
      "input": 10,
      "output": 50,
      "cacheRead": 1,
      "cacheWrite": 12.5
    }
  },
  {
    "id": "claude-fable-5-1",
    "name": "Claude Fable 5.1",
    "provider": "anthropic",
    "protocol": "anthropic-messages",
    "baseUrl": "https://api.anthropic.com",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": "xhigh"
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1000000,
    "maxOutputTokens": 128000,
    "temperature": false,
    "releaseDate": "2026-09-01",
    "cost": {
      "input": 10,
      "output": 50,
      "cacheRead": 0.25,
      "cacheWrite": 12.5
    }
  },
  {
    "id": "claude-haiku-4-5",
    "name": "Claude Haiku 4.5 (latest)",
    "provider": "anthropic",
    "protocol": "anthropic-messages",
    "baseUrl": "https://api.anthropic.com",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": "none",
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": "xhigh"
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 200000,
    "maxOutputTokens": 64000,
    "temperature": true,
    "releaseDate": "2025-10-15",
    "cost": {
      "input": 1,
      "output": 5,
      "cacheRead": 0.1,
      "cacheWrite": 1.25
    }
  },
  {
    "id": "claude-haiku-4-5-20251001",
    "name": "Claude Haiku 4.5",
    "provider": "anthropic",
    "protocol": "anthropic-messages",
    "baseUrl": "https://api.anthropic.com",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": "none",
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": "xhigh"
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 200000,
    "maxOutputTokens": 64000,
    "temperature": true,
    "releaseDate": "2025-10-15",
    "cost": {
      "input": 1,
      "output": 5,
      "cacheRead": 0.1,
      "cacheWrite": 1.25
    }
  },
  {
    "id": "claude-opus-4-5",
    "name": "Claude Opus 4.5 (latest)",
    "provider": "anthropic",
    "protocol": "anthropic-messages",
    "baseUrl": "https://api.anthropic.com",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": null
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 200000,
    "maxOutputTokens": 64000,
    "temperature": true,
    "releaseDate": "2025-11-24",
    "cost": {
      "input": 5,
      "output": 25,
      "cacheRead": 0.5,
      "cacheWrite": 6.25
    }
  },
  {
    "id": "claude-opus-4-5-20251101",
    "name": "Claude Opus 4.5",
    "provider": "anthropic",
    "protocol": "anthropic-messages",
    "baseUrl": "https://api.anthropic.com",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": null
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 200000,
    "maxOutputTokens": 64000,
    "temperature": true,
    "releaseDate": "2025-11-24",
    "cost": {
      "input": 5,
      "output": 25,
      "cacheRead": 0.5,
      "cacheWrite": 6.25
    }
  },
  {
    "id": "claude-opus-4-6",
    "name": "Claude Opus 4.6",
    "provider": "anthropic",
    "protocol": "anthropic-messages",
    "baseUrl": "https://api.anthropic.com",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": null
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1000000,
    "maxOutputTokens": 128000,
    "temperature": true,
    "releaseDate": "2026-02-04",
    "cost": {
      "input": 5,
      "output": 25,
      "cacheRead": 0.5,
      "cacheWrite": 6.25
    }
  },
  {
    "id": "claude-opus-4-7",
    "name": "Claude Opus 4.7",
    "provider": "anthropic",
    "protocol": "anthropic-messages",
    "baseUrl": "https://api.anthropic.com",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": "xhigh"
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1000000,
    "maxOutputTokens": 128000,
    "temperature": false,
    "releaseDate": "2026-04-14",
    "cost": {
      "input": 5,
      "output": 25,
      "cacheRead": 0.5,
      "cacheWrite": 6.25
    }
  },
  {
    "id": "claude-opus-4-8",
    "name": "Claude Opus 4.8",
    "provider": "anthropic",
    "protocol": "anthropic-messages",
    "baseUrl": "https://api.anthropic.com",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": "xhigh"
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1000000,
    "maxOutputTokens": 128000,
    "temperature": false,
    "releaseDate": "2026-05-28",
    "cost": {
      "input": 5,
      "output": 25,
      "cacheRead": 0.5,
      "cacheWrite": 6.25
    }
  },
  {
    "id": "claude-opus-5",
    "name": "Claude Opus 5",
    "provider": "anthropic",
    "protocol": "anthropic-messages",
    "baseUrl": "https://api.anthropic.com",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": "xhigh"
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1000000,
    "maxOutputTokens": 128000,
    "temperature": false,
    "releaseDate": "2026-07-24",
    "cost": {
      "input": 5,
      "output": 25,
      "cacheRead": 0.5,
      "cacheWrite": 6.25
    }
  },
  {
    "id": "claude-opus-5-5",
    "name": "Claude Opus 5.5",
    "provider": "anthropic",
    "protocol": "anthropic-messages",
    "baseUrl": "https://api.anthropic.com",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": "xhigh"
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1000000,
    "maxOutputTokens": 128000,
    "temperature": false,
    "releaseDate": "2026-09-22",
    "cost": {
      "input": 4,
      "output": 20,
      "cacheRead": 0.2,
      "cacheWrite": 5
    }
  },
  {
    "id": "claude-sonnet-4-5",
    "name": "Claude Sonnet 4.5 (latest)",
    "provider": "anthropic",
    "protocol": "anthropic-messages",
    "baseUrl": "https://api.anthropic.com",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": "none",
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": "xhigh"
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1000000,
    "maxOutputTokens": 64000,
    "temperature": true,
    "releaseDate": "2025-09-29",
    "cost": {
      "input": 3,
      "output": 15,
      "cacheRead": 0.3,
      "cacheWrite": 3.75
    }
  },
  {
    "id": "claude-sonnet-4-5-20250929",
    "name": "Claude Sonnet 4.5",
    "provider": "anthropic",
    "protocol": "anthropic-messages",
    "baseUrl": "https://api.anthropic.com",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": "none",
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": "xhigh"
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1000000,
    "maxOutputTokens": 64000,
    "temperature": true,
    "releaseDate": "2025-09-29",
    "cost": {
      "input": 3,
      "output": 15,
      "cacheRead": 0.3,
      "cacheWrite": 3.75
    }
  },
  {
    "id": "claude-sonnet-4-6",
    "name": "Claude Sonnet 4.6",
    "provider": "anthropic",
    "protocol": "anthropic-messages",
    "baseUrl": "https://api.anthropic.com",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": null
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1000000,
    "maxOutputTokens": 128000,
    "temperature": true,
    "releaseDate": "2026-02-17",
    "cost": {
      "input": 3,
      "output": 15,
      "cacheRead": 0.3,
      "cacheWrite": 3.75
    }
  },
  {
    "id": "claude-sonnet-5",
    "name": "Claude Sonnet 5",
    "provider": "anthropic",
    "protocol": "anthropic-messages",
    "baseUrl": "https://api.anthropic.com",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": "xhigh"
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1000000,
    "maxOutputTokens": 128000,
    "temperature": false,
    "releaseDate": "2026-06-29",
    "cost": {
      "input": 2,
      "output": 10,
      "cacheRead": 0.2,
      "cacheWrite": 2.5
    }
  },
  {
    "id": "claude-sonnet-5-5",
    "name": "Claude Sonnet 5.5",
    "provider": "anthropic",
    "protocol": "anthropic-messages",
    "baseUrl": "https://api.anthropic.com",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": "xhigh"
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1000000,
    "maxOutputTokens": 128000,
    "temperature": false,
    "releaseDate": "2026-09-28",
    "cost": {
      "input": 2,
      "output": 10,
      "cacheRead": 0.2,
      "cacheWrite": 2.5
    }
  },
  {
    "id": "gpt-oss-120b",
    "name": "GPT OSS 120B",
    "provider": "cerebras",
    "protocol": "openai-completions",
    "baseUrl": "https://api.openai.com/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": null
    },
    "input": [
      "text"
    ],
    "contextWindow": 131072,
    "maxOutputTokens": 40960,
    "temperature": true,
    "releaseDate": "2025-08-05",
    "cost": {
      "input": 0.35,
      "output": 0.75
    }
  },
  {
    "id": "qwen-3.8-27b",
    "name": "Qwen3.8 27B",
    "provider": "cerebras",
    "protocol": "openai-completions",
    "baseUrl": "https://api.openai.com/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": "none",
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": null
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 131072,
    "maxOutputTokens": 40960,
    "temperature": true,
    "releaseDate": "2026-08-14",
    "cost": {
      "input": 0.99,
      "output": 1.49,
      "cacheRead": 0.99
    }
  },
  {
    "id": "deepseek-flash",
    "name": "DeepSeek V4.1 Flash",
    "provider": "deepseek",
    "protocol": "openai-completions",
    "baseUrl": "https://api.deepseek.com",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": "low",
      "medium": null,
      "high": "high",
      "xhigh": null
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1000000,
    "maxOutputTokens": 393216,
    "temperature": true,
    "interleavedReasoningField": "reasoning_content",
    "releaseDate": "2026-09-10",
    "cost": {
      "input": 0.15,
      "output": 0.6,
      "cacheRead": 0.003
    }
  },
  {
    "id": "deepseek-v4-pro",
    "name": "DeepSeek V4 Pro",
    "provider": "deepseek",
    "protocol": "openai-completions",
    "baseUrl": "https://api.deepseek.com",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": "low",
      "medium": null,
      "high": "high",
      "xhigh": null
    },
    "input": [
      "text"
    ],
    "contextWindow": 1000000,
    "maxOutputTokens": 393216,
    "temperature": true,
    "interleavedReasoningField": "reasoning_content",
    "releaseDate": "2026-08-12",
    "cost": {
      "input": 0.435,
      "output": 0.87,
      "cacheRead": 0.003625
    }
  },
  {
    "id": "deep-research-max-preview-04-2026",
    "name": "Deep Research Max Preview (Apr-21-2026)",
    "provider": "google",
    "protocol": "google-generative-ai",
    "baseUrl": "https://generativelanguage.googleapis.com",
    "reasoning": true,
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 131072,
    "maxOutputTokens": 65536,
    "temperature": true,
    "releaseDate": "2026-04-21",
    "cost": {
      "input": 2,
      "output": 12,
      "cacheRead": 0.2
    }
  },
  {
    "id": "deep-research-preview-04-2026",
    "name": "Deep Research Preview (Apr-21-2026)",
    "provider": "google",
    "protocol": "google-generative-ai",
    "baseUrl": "https://generativelanguage.googleapis.com",
    "reasoning": true,
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 131072,
    "maxOutputTokens": 65536,
    "temperature": true,
    "releaseDate": "2026-04-21",
    "cost": {
      "input": 2,
      "output": 12,
      "cacheRead": 0.2
    }
  },
  {
    "id": "gemini-2.5-computer-use-preview-10-2025",
    "name": "Gemini 2.5 Computer Use Preview 10-2025",
    "provider": "google",
    "protocol": "google-generative-ai",
    "baseUrl": "https://generativelanguage.googleapis.com",
    "reasoning": true,
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 128000,
    "maxOutputTokens": 64000,
    "temperature": true,
    "releaseDate": "2025-10-07",
    "cost": {
      "input": 1.25,
      "output": 10
    }
  },
  {
    "id": "gemini-2.5-flash",
    "name": "Gemini 2.5 Flash",
    "provider": "google",
    "protocol": "google-generative-ai",
    "baseUrl": "https://generativelanguage.googleapis.com",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": "none",
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": "xhigh"
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1048576,
    "maxOutputTokens": 65536,
    "temperature": true,
    "releaseDate": "2025-06-17",
    "cost": {
      "input": 0.3,
      "output": 2.5,
      "cacheRead": 0.03
    }
  },
  {
    "id": "gemini-2.5-flash-lite",
    "name": "Gemini 2.5 Flash-Lite",
    "provider": "google",
    "protocol": "google-generative-ai",
    "baseUrl": "https://generativelanguage.googleapis.com",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": "none",
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": "xhigh"
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1048576,
    "maxOutputTokens": 65536,
    "temperature": true,
    "releaseDate": "2025-06-17",
    "cost": {
      "input": 0.1,
      "output": 0.4,
      "cacheRead": 0.01
    }
  },
  {
    "id": "gemini-2.5-pro",
    "name": "Gemini 2.5 Pro",
    "provider": "google",
    "protocol": "google-generative-ai",
    "baseUrl": "https://generativelanguage.googleapis.com",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": "none",
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": "xhigh"
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1048576,
    "maxOutputTokens": 65536,
    "temperature": true,
    "releaseDate": "2025-06-17",
    "cost": {
      "input": 1.25,
      "output": 10,
      "cacheRead": 0.125
    }
  },
  {
    "id": "gemini-3-flash-preview",
    "name": "Gemini 3 Flash Preview",
    "provider": "google",
    "protocol": "google-generative-ai",
    "baseUrl": "https://generativelanguage.googleapis.com",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": null
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1048576,
    "maxOutputTokens": 65536,
    "temperature": true,
    "releaseDate": "2025-12-17",
    "cost": {
      "input": 0.5,
      "output": 3,
      "cacheRead": 0.05
    }
  },
  {
    "id": "gemini-3.1-flash-lite",
    "name": "Gemini 3.1 Flash Lite",
    "provider": "google",
    "protocol": "google-generative-ai",
    "baseUrl": "https://generativelanguage.googleapis.com",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": null
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1048576,
    "maxOutputTokens": 65536,
    "temperature": true,
    "releaseDate": "2026-05-07",
    "cost": {
      "input": 0.25,
      "output": 1.5,
      "cacheRead": 0.025
    }
  },
  {
    "id": "gemini-3.1-flash-lite-image",
    "name": "Nano Banana 2 Lite",
    "provider": "google",
    "protocol": "google-generative-ai",
    "baseUrl": "https://generativelanguage.googleapis.com",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": null,
      "medium": null,
      "high": "high",
      "xhigh": null
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 65536,
    "maxOutputTokens": 4096,
    "temperature": true,
    "releaseDate": "2026-06-30",
    "cost": {
      "input": 0.25,
      "output": 30
    }
  },
  {
    "id": "gemini-3.1-flash-live-preview",
    "name": "Gemini 3.1 Flash Live Preview",
    "provider": "google",
    "protocol": "google-generative-ai",
    "baseUrl": "https://generativelanguage.googleapis.com",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": null
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 131072,
    "maxOutputTokens": 65536,
    "temperature": true,
    "releaseDate": "2026-03-26",
    "cost": {
      "input": 0.75,
      "output": 4.5
    }
  },
  {
    "id": "gemini-3.1-pro-preview",
    "name": "Gemini 3.1 Pro Preview",
    "provider": "google",
    "protocol": "google-generative-ai",
    "baseUrl": "https://generativelanguage.googleapis.com",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": null
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1048576,
    "maxOutputTokens": 65536,
    "temperature": true,
    "releaseDate": "2026-02-19",
    "cost": {
      "input": 2,
      "output": 12,
      "cacheRead": 0.2
    }
  },
  {
    "id": "gemini-3.1-pro-preview-customtools",
    "name": "Gemini 3.1 Pro Preview Custom Tools",
    "provider": "google",
    "protocol": "google-generative-ai",
    "baseUrl": "https://generativelanguage.googleapis.com",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": null
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1048576,
    "maxOutputTokens": 65536,
    "temperature": true,
    "releaseDate": "2026-02-19",
    "cost": {
      "input": 2,
      "output": 12,
      "cacheRead": 0.2
    }
  },
  {
    "id": "gemini-3.5-flash",
    "name": "Gemini 3.5 Flash",
    "provider": "google",
    "protocol": "google-generative-ai",
    "baseUrl": "https://generativelanguage.googleapis.com",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": null
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1048576,
    "maxOutputTokens": 65536,
    "temperature": true,
    "releaseDate": "2026-05-19",
    "cost": {
      "input": 1.5,
      "output": 9,
      "cacheRead": 0.15
    }
  },
  {
    "id": "gemini-3.5-flash-lite",
    "name": "Gemini 3.5 Flash Lite",
    "provider": "google",
    "protocol": "google-generative-ai",
    "baseUrl": "https://generativelanguage.googleapis.com",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": null
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1048576,
    "maxOutputTokens": 65536,
    "temperature": true,
    "releaseDate": "2026-07-21",
    "cost": {
      "input": 0.3,
      "output": 2.5,
      "cacheRead": 0.03
    }
  },
  {
    "id": "gemini-3.6-flash",
    "name": "Gemini 3.6 Flash",
    "provider": "google",
    "protocol": "google-generative-ai",
    "baseUrl": "https://generativelanguage.googleapis.com",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": null
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1048576,
    "maxOutputTokens": 65536,
    "temperature": true,
    "releaseDate": "2026-07-21",
    "cost": {
      "input": 0.75,
      "output": 3.75,
      "cacheRead": 0.075
    }
  },
  {
    "id": "gemini-3.7-flash",
    "name": "Gemini 3.7 Flash",
    "provider": "google",
    "protocol": "google-generative-ai",
    "baseUrl": "https://generativelanguage.googleapis.com",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": null
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1048576,
    "maxOutputTokens": 65536,
    "temperature": true,
    "releaseDate": "2026-08-13",
    "cost": {
      "input": 0.75,
      "output": 3.75,
      "cacheRead": 0.075
    }
  },
  {
    "id": "gemini-3.8-flash",
    "name": "Gemini 3.8 Flash",
    "provider": "google",
    "protocol": "google-generative-ai",
    "baseUrl": "https://generativelanguage.googleapis.com",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": null
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1048576,
    "maxOutputTokens": 65536,
    "temperature": true,
    "releaseDate": "2026-09-02",
    "cost": {
      "input": 0.75,
      "output": 3.75,
      "cacheRead": 0.075
    }
  },
  {
    "id": "gemini-flash-latest",
    "name": "Gemini Flash Latest",
    "provider": "google",
    "protocol": "google-generative-ai",
    "baseUrl": "https://generativelanguage.googleapis.com",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": null
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1048576,
    "maxOutputTokens": 65536,
    "temperature": true,
    "releaseDate": "2026-08-13",
    "cost": {
      "input": 0.75,
      "output": 3.75,
      "cacheRead": 0.075
    }
  },
  {
    "id": "gemini-flash-lite-latest",
    "name": "Gemini Flash-Lite Latest",
    "provider": "google",
    "protocol": "google-generative-ai",
    "baseUrl": "https://generativelanguage.googleapis.com",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": null
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1048576,
    "maxOutputTokens": 65536,
    "temperature": true,
    "releaseDate": "2026-07-21",
    "cost": {
      "input": 0.3,
      "output": 2.5,
      "cacheRead": 0.03
    }
  },
  {
    "id": "gemma-4-26b-a4b-it",
    "name": "Gemma 4 26B A4B IT",
    "provider": "google",
    "protocol": "google-generative-ai",
    "baseUrl": "https://generativelanguage.googleapis.com",
    "reasoning": true,
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 262144,
    "maxOutputTokens": 32768,
    "temperature": true,
    "releaseDate": "2026-04-02"
  },
  {
    "id": "gemma-4-31b-it",
    "name": "Gemma 4 31B IT",
    "provider": "google",
    "protocol": "google-generative-ai",
    "baseUrl": "https://generativelanguage.googleapis.com",
    "reasoning": true,
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 262144,
    "maxOutputTokens": 32768,
    "temperature": true,
    "releaseDate": "2026-04-02"
  },
  {
    "id": "llama-3.1-8b-instant",
    "name": "Llama 3.1 8B",
    "provider": "groq",
    "protocol": "openai-completions",
    "baseUrl": "https://api.openai.com/v1",
    "reasoning": false,
    "input": [
      "text"
    ],
    "contextWindow": 131072,
    "maxOutputTokens": 131072,
    "temperature": true,
    "releaseDate": "2024-07-23",
    "cost": {
      "input": 0.05,
      "output": 0.08
    }
  },
  {
    "id": "llama-3.3-70b-versatile",
    "name": "Llama 3.3 70B",
    "provider": "groq",
    "protocol": "openai-completions",
    "baseUrl": "https://api.openai.com/v1",
    "reasoning": false,
    "input": [
      "text"
    ],
    "contextWindow": 131072,
    "maxOutputTokens": 32768,
    "temperature": true,
    "releaseDate": "2024-12-06",
    "cost": {
      "input": 0.59,
      "output": 0.79
    }
  },
  {
    "id": "openai/gpt-oss-120b",
    "name": "GPT OSS 120B",
    "provider": "groq",
    "protocol": "openai-completions",
    "baseUrl": "https://api.openai.com/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": null
    },
    "input": [
      "text"
    ],
    "contextWindow": 131072,
    "maxOutputTokens": 65536,
    "temperature": true,
    "releaseDate": "2025-08-05",
    "cost": {
      "input": 0.15,
      "output": 0.6,
      "cacheRead": 0.075
    }
  },
  {
    "id": "openai/gpt-oss-20b",
    "name": "GPT OSS 20B",
    "provider": "groq",
    "protocol": "openai-completions",
    "baseUrl": "https://api.openai.com/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": null
    },
    "input": [
      "text"
    ],
    "contextWindow": 131072,
    "maxOutputTokens": 65536,
    "temperature": true,
    "releaseDate": "2025-08-05",
    "cost": {
      "input": 0.075,
      "output": 0.3,
      "cacheRead": 0.0375
    }
  },
  {
    "id": "openai/gpt-oss-safeguard-20b",
    "name": "Safety GPT OSS 20B",
    "provider": "groq",
    "protocol": "openai-completions",
    "baseUrl": "https://api.openai.com/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": null
    },
    "input": [
      "text"
    ],
    "contextWindow": 131072,
    "maxOutputTokens": 65536,
    "temperature": true,
    "status": "beta",
    "releaseDate": "2025-10-29",
    "cost": {
      "input": 0.075,
      "output": 0.3
    }
  },
  {
    "id": "qwen/qwen3.6-27b",
    "name": "Qwen3.6 27B",
    "provider": "groq",
    "protocol": "openai-completions",
    "baseUrl": "https://api.openai.com/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": "none",
      "low": null,
      "medium": null,
      "high": null,
      "xhigh": null
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 131072,
    "maxOutputTokens": 16384,
    "temperature": true,
    "releaseDate": "2026-04-22",
    "cost": {
      "input": 0.6,
      "output": 3,
      "cacheRead": 0.3
    }
  },
  {
    "id": "qwen/qwen3.8-27b",
    "name": "Qwen3.8 27B",
    "provider": "groq",
    "protocol": "openai-completions",
    "baseUrl": "https://api.openai.com/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": "none",
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": null
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 131042,
    "maxOutputTokens": 16384,
    "temperature": true,
    "releaseDate": "2026-08-14",
    "cost": {
      "input": 0.8,
      "output": 4
    }
  },
  {
    "id": "codestral-latest",
    "name": "Codestral (latest)",
    "provider": "mistral",
    "protocol": "openai-completions",
    "baseUrl": "https://api.openai.com/v1",
    "reasoning": false,
    "input": [
      "text"
    ],
    "contextWindow": 256000,
    "maxOutputTokens": 4096,
    "temperature": true,
    "releaseDate": "2024-05-29",
    "cost": {
      "input": 0.3,
      "output": 0.9,
      "cacheRead": 0.03
    }
  },
  {
    "id": "magistral-medium-latest",
    "name": "Magistral Medium (latest)",
    "provider": "mistral",
    "protocol": "openai-completions",
    "baseUrl": "https://api.openai.com/v1",
    "reasoning": true,
    "input": [
      "text"
    ],
    "contextWindow": 128000,
    "maxOutputTokens": 16384,
    "temperature": true,
    "releaseDate": "2025-03-17",
    "cost": {
      "input": 2,
      "output": 5
    }
  },
  {
    "id": "ministral-3b-latest",
    "name": "Ministral 3B (latest)",
    "provider": "mistral",
    "protocol": "openai-completions",
    "baseUrl": "https://api.openai.com/v1",
    "reasoning": false,
    "input": [
      "text"
    ],
    "contextWindow": 128000,
    "maxOutputTokens": 128000,
    "temperature": true,
    "releaseDate": "2024-10-01",
    "cost": {
      "input": 0.04,
      "output": 0.04
    }
  },
  {
    "id": "ministral-8b-latest",
    "name": "Ministral 8B (latest)",
    "provider": "mistral",
    "protocol": "openai-completions",
    "baseUrl": "https://api.openai.com/v1",
    "reasoning": false,
    "input": [
      "text"
    ],
    "contextWindow": 128000,
    "maxOutputTokens": 128000,
    "temperature": true,
    "releaseDate": "2024-10-01",
    "cost": {
      "input": 0.1,
      "output": 0.1
    }
  },
  {
    "id": "mistral-large-2411",
    "name": "Mistral Large 2.1",
    "provider": "mistral",
    "protocol": "openai-completions",
    "baseUrl": "https://api.openai.com/v1",
    "reasoning": false,
    "input": [
      "text"
    ],
    "contextWindow": 131072,
    "maxOutputTokens": 16384,
    "temperature": true,
    "releaseDate": "2024-11-18",
    "cost": {
      "input": 2,
      "output": 6
    }
  },
  {
    "id": "mistral-large-2512",
    "name": "Mistral Large 3",
    "provider": "mistral",
    "protocol": "openai-completions",
    "baseUrl": "https://api.openai.com/v1",
    "reasoning": false,
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 262144,
    "maxOutputTokens": 262144,
    "temperature": true,
    "releaseDate": "2024-11-01",
    "cost": {
      "input": 0.5,
      "output": 1.5,
      "cacheRead": 0.05
    }
  },
  {
    "id": "mistral-large-latest",
    "name": "Mistral Large (latest)",
    "provider": "mistral",
    "protocol": "openai-completions",
    "baseUrl": "https://api.openai.com/v1",
    "reasoning": false,
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 262144,
    "maxOutputTokens": 262144,
    "temperature": true,
    "releaseDate": "2024-11-01",
    "cost": {
      "input": 0.5,
      "output": 1.5,
      "cacheRead": 0.05
    }
  },
  {
    "id": "mistral-medium-2505",
    "name": "Mistral Medium 3",
    "provider": "mistral",
    "protocol": "openai-completions",
    "baseUrl": "https://api.openai.com/v1",
    "reasoning": false,
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 131072,
    "maxOutputTokens": 131072,
    "temperature": true,
    "releaseDate": "2025-05-07",
    "cost": {
      "input": 0.4,
      "output": 2
    }
  },
  {
    "id": "mistral-medium-2508",
    "name": "Mistral Medium 3.1",
    "provider": "mistral",
    "protocol": "openai-completions",
    "baseUrl": "https://api.openai.com/v1",
    "reasoning": false,
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 262144,
    "maxOutputTokens": 262144,
    "temperature": true,
    "releaseDate": "2025-08-12",
    "cost": {
      "input": 0.4,
      "output": 2
    }
  },
  {
    "id": "mistral-medium-2604",
    "name": "Mistral Medium 3.5",
    "provider": "mistral",
    "protocol": "openai-completions",
    "baseUrl": "https://api.openai.com/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": "none",
      "low": null,
      "medium": null,
      "high": "high",
      "xhigh": null
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 262144,
    "maxOutputTokens": 262144,
    "temperature": true,
    "releaseDate": "2026-04-29",
    "cost": {
      "input": 1.5,
      "output": 7.5,
      "cacheRead": 0.15
    }
  },
  {
    "id": "mistral-medium-latest",
    "name": "Mistral Medium (latest)",
    "provider": "mistral",
    "protocol": "openai-completions",
    "baseUrl": "https://api.openai.com/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": "none",
      "low": null,
      "medium": null,
      "high": "high",
      "xhigh": null
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 262144,
    "maxOutputTokens": 262144,
    "temperature": true,
    "releaseDate": "2026-04-29",
    "cost": {
      "input": 1.5,
      "output": 7.5,
      "cacheRead": 0.15
    }
  },
  {
    "id": "mistral-nemo",
    "name": "Mistral Nemo",
    "provider": "mistral",
    "protocol": "openai-completions",
    "baseUrl": "https://api.openai.com/v1",
    "reasoning": false,
    "input": [
      "text"
    ],
    "contextWindow": 128000,
    "maxOutputTokens": 128000,
    "temperature": true,
    "releaseDate": "2024-07-01",
    "cost": {
      "input": 0.15,
      "output": 0.15
    }
  },
  {
    "id": "mistral-small-2506",
    "name": "Mistral Small 3.2",
    "provider": "mistral",
    "protocol": "openai-completions",
    "baseUrl": "https://api.openai.com/v1",
    "reasoning": false,
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 128000,
    "maxOutputTokens": 16384,
    "temperature": true,
    "releaseDate": "2025-06-20",
    "cost": {
      "input": 0.1,
      "output": 0.3
    }
  },
  {
    "id": "mistral-small-2603",
    "name": "Mistral Small 4",
    "provider": "mistral",
    "protocol": "openai-completions",
    "baseUrl": "https://api.openai.com/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": "none",
      "low": null,
      "medium": null,
      "high": "high",
      "xhigh": null
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 256000,
    "maxOutputTokens": 256000,
    "temperature": true,
    "releaseDate": "2026-03-16",
    "cost": {
      "input": 0.15,
      "output": 0.6,
      "cacheRead": 0.015
    }
  },
  {
    "id": "mistral-small-latest",
    "name": "Mistral Small (latest)",
    "provider": "mistral",
    "protocol": "openai-completions",
    "baseUrl": "https://api.openai.com/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": "none",
      "low": null,
      "medium": null,
      "high": "high",
      "xhigh": null
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 256000,
    "maxOutputTokens": 256000,
    "temperature": true,
    "releaseDate": "2026-03-16",
    "cost": {
      "input": 0.15,
      "output": 0.6,
      "cacheRead": 0.015
    }
  },
  {
    "id": "open-mistral-7b",
    "name": "Mistral 7B",
    "provider": "mistral",
    "protocol": "openai-completions",
    "baseUrl": "https://api.openai.com/v1",
    "reasoning": false,
    "input": [
      "text"
    ],
    "contextWindow": 8000,
    "maxOutputTokens": 8000,
    "temperature": true,
    "releaseDate": "2023-09-27",
    "cost": {
      "input": 0.25,
      "output": 0.25
    }
  },
  {
    "id": "open-mixtral-8x22b",
    "name": "Mixtral 8x22B",
    "provider": "mistral",
    "protocol": "openai-completions",
    "baseUrl": "https://api.openai.com/v1",
    "reasoning": false,
    "input": [
      "text"
    ],
    "contextWindow": 64000,
    "maxOutputTokens": 64000,
    "temperature": true,
    "releaseDate": "2024-04-17",
    "cost": {
      "input": 2,
      "output": 6
    }
  },
  {
    "id": "open-mixtral-8x7b",
    "name": "Mixtral 8x7B",
    "provider": "mistral",
    "protocol": "openai-completions",
    "baseUrl": "https://api.openai.com/v1",
    "reasoning": false,
    "input": [
      "text"
    ],
    "contextWindow": 32000,
    "maxOutputTokens": 32000,
    "temperature": true,
    "releaseDate": "2023-12-11",
    "cost": {
      "input": 0.7,
      "output": 0.7
    }
  },
  {
    "id": "pixtral-12b",
    "name": "Pixtral 12B",
    "provider": "mistral",
    "protocol": "openai-completions",
    "baseUrl": "https://api.openai.com/v1",
    "reasoning": false,
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 128000,
    "maxOutputTokens": 128000,
    "temperature": true,
    "releaseDate": "2024-09-01",
    "cost": {
      "input": 0.15,
      "output": 0.15
    }
  },
  {
    "id": "pixtral-large-latest",
    "name": "Pixtral Large (latest)",
    "provider": "mistral",
    "protocol": "openai-completions",
    "baseUrl": "https://api.openai.com/v1",
    "reasoning": false,
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 128000,
    "maxOutputTokens": 128000,
    "temperature": true,
    "releaseDate": "2024-11-01",
    "cost": {
      "input": 2,
      "output": 6
    }
  },
  {
    "id": "voxtral-small-latest",
    "name": "Voxtral Small (latest)",
    "provider": "mistral",
    "protocol": "openai-completions",
    "baseUrl": "https://api.openai.com/v1",
    "reasoning": false,
    "input": [
      "text"
    ],
    "contextWindow": 32000,
    "maxOutputTokens": 32000,
    "temperature": true,
    "releaseDate": "2025-07-15",
    "cost": {
      "input": 0.1,
      "output": 0.3
    }
  },
  {
    "id": "zai-glm-5-2",
    "name": "GLM-5.2",
    "provider": "mistral",
    "protocol": "openai-completions",
    "baseUrl": "https://api.openai.com/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": "none",
      "low": null,
      "medium": null,
      "high": "high",
      "xhigh": null
    },
    "input": [
      "text"
    ],
    "contextWindow": 1000000,
    "maxOutputTokens": 131072,
    "temperature": true,
    "status": "beta",
    "releaseDate": "2026-06-13",
    "cost": {
      "input": 1.4,
      "output": 4.4,
      "cacheRead": 0.14
    }
  },
  {
    "id": "zai-glm-5-3",
    "name": "GLM-5.3",
    "provider": "mistral",
    "protocol": "openai-completions",
    "baseUrl": "https://api.openai.com/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": "low",
      "medium": null,
      "high": "high",
      "xhigh": null
    },
    "input": [
      "text"
    ],
    "contextWindow": 1000000,
    "maxOutputTokens": 131072,
    "temperature": true,
    "releaseDate": "2026-08-14",
    "cost": {
      "input": 1.4,
      "output": 4.4,
      "cacheRead": 0.14
    }
  },
  {
    "id": "gpt-4.1",
    "name": "GPT-4.1",
    "provider": "openai",
    "protocol": "openai-responses",
    "baseUrl": "https://api.openai.com/v1",
    "reasoning": false,
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1047576,
    "maxOutputTokens": 32768,
    "temperature": true,
    "releaseDate": "2025-04-14",
    "cost": {
      "input": 2,
      "output": 8,
      "cacheRead": 0.5
    },
    "compat": {
      "maxTokensField": "max_tokens",
      "supportsDeveloperRole": true
    }
  },
  {
    "id": "gpt-4.1-mini",
    "name": "GPT-4.1 mini",
    "provider": "openai",
    "protocol": "openai-responses",
    "baseUrl": "https://api.openai.com/v1",
    "reasoning": false,
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1047576,
    "maxOutputTokens": 32768,
    "temperature": true,
    "releaseDate": "2025-04-14",
    "cost": {
      "input": 0.4,
      "output": 1.6,
      "cacheRead": 0.1
    },
    "compat": {
      "maxTokensField": "max_tokens",
      "supportsDeveloperRole": true
    }
  },
  {
    "id": "gpt-4o",
    "name": "GPT-4o",
    "provider": "openai",
    "protocol": "openai-responses",
    "baseUrl": "https://api.openai.com/v1",
    "reasoning": false,
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 128000,
    "maxOutputTokens": 16384,
    "temperature": true,
    "releaseDate": "2024-05-13",
    "cost": {
      "input": 2.5,
      "output": 10,
      "cacheRead": 1.25
    },
    "compat": {
      "maxTokensField": "max_tokens",
      "supportsDeveloperRole": true
    }
  },
  {
    "id": "gpt-4o-2024-08-06",
    "name": "GPT-4o (2024-08-06)",
    "provider": "openai",
    "protocol": "openai-responses",
    "baseUrl": "https://api.openai.com/v1",
    "reasoning": false,
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 128000,
    "maxOutputTokens": 16384,
    "temperature": true,
    "releaseDate": "2024-08-06",
    "cost": {
      "input": 2.5,
      "output": 10,
      "cacheRead": 1.25
    },
    "compat": {
      "maxTokensField": "max_tokens",
      "supportsDeveloperRole": true
    }
  },
  {
    "id": "gpt-4o-2024-11-20",
    "name": "GPT-4o (2024-11-20)",
    "provider": "openai",
    "protocol": "openai-responses",
    "baseUrl": "https://api.openai.com/v1",
    "reasoning": false,
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 128000,
    "maxOutputTokens": 16384,
    "temperature": true,
    "releaseDate": "2024-11-20",
    "cost": {
      "input": 2.5,
      "output": 10,
      "cacheRead": 1.25
    },
    "compat": {
      "maxTokensField": "max_tokens",
      "supportsDeveloperRole": true
    }
  },
  {
    "id": "gpt-4o-mini",
    "name": "GPT-4o mini",
    "provider": "openai",
    "protocol": "openai-responses",
    "baseUrl": "https://api.openai.com/v1",
    "reasoning": false,
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 128000,
    "maxOutputTokens": 16384,
    "temperature": true,
    "releaseDate": "2024-07-18",
    "cost": {
      "input": 0.15,
      "output": 0.6,
      "cacheRead": 0.075
    },
    "compat": {
      "maxTokensField": "max_tokens",
      "supportsDeveloperRole": true
    }
  },
  {
    "id": "gpt-5",
    "name": "GPT-5",
    "provider": "openai",
    "protocol": "openai-responses",
    "baseUrl": "https://api.openai.com/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": null
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 400000,
    "maxInputTokens": 272000,
    "maxOutputTokens": 128000,
    "temperature": false,
    "releaseDate": "2025-08-07",
    "cost": {
      "input": 1.25,
      "output": 10,
      "cacheRead": 0.125
    },
    "compat": {
      "maxTokensField": "max_completion_tokens",
      "supportsDeveloperRole": true,
      "supportsReasoningEffort": true
    }
  },
  {
    "id": "gpt-5-mini",
    "name": "GPT-5 Mini",
    "provider": "openai",
    "protocol": "openai-responses",
    "baseUrl": "https://api.openai.com/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": null
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 400000,
    "maxInputTokens": 272000,
    "maxOutputTokens": 128000,
    "temperature": false,
    "releaseDate": "2025-08-07",
    "cost": {
      "input": 0.25,
      "output": 2,
      "cacheRead": 0.025
    },
    "compat": {
      "maxTokensField": "max_completion_tokens",
      "supportsDeveloperRole": true,
      "supportsReasoningEffort": true
    }
  },
  {
    "id": "gpt-5-nano",
    "name": "GPT-5 Nano",
    "provider": "openai",
    "protocol": "openai-responses",
    "baseUrl": "https://api.openai.com/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": null
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 400000,
    "maxInputTokens": 272000,
    "maxOutputTokens": 128000,
    "temperature": false,
    "releaseDate": "2025-08-07",
    "cost": {
      "input": 0.05,
      "output": 0.4,
      "cacheRead": 0.005
    },
    "compat": {
      "maxTokensField": "max_completion_tokens",
      "supportsDeveloperRole": true,
      "supportsReasoningEffort": true
    }
  },
  {
    "id": "gpt-5-pro",
    "name": "GPT-5 Pro",
    "provider": "openai",
    "protocol": "openai-responses",
    "baseUrl": "https://api.openai.com/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": null,
      "medium": null,
      "high": "high",
      "xhigh": null
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 400000,
    "maxInputTokens": 272000,
    "maxOutputTokens": 272000,
    "temperature": false,
    "releaseDate": "2025-10-06",
    "cost": {
      "input": 15,
      "output": 120
    },
    "compat": {
      "maxTokensField": "max_completion_tokens",
      "supportsDeveloperRole": true,
      "supportsReasoningEffort": true
    }
  },
  {
    "id": "gpt-5.1",
    "name": "GPT-5.1",
    "provider": "openai",
    "protocol": "openai-responses",
    "baseUrl": "https://api.openai.com/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": "none",
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": null
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 400000,
    "maxInputTokens": 272000,
    "maxOutputTokens": 128000,
    "temperature": true,
    "releaseDate": "2025-11-13",
    "cost": {
      "input": 1.25,
      "output": 10,
      "cacheRead": 0.125
    },
    "compat": {
      "maxTokensField": "max_completion_tokens",
      "supportsDeveloperRole": true,
      "supportsReasoningEffort": true
    }
  },
  {
    "id": "gpt-5.2",
    "name": "GPT-5.2",
    "provider": "openai",
    "protocol": "openai-responses",
    "baseUrl": "https://api.openai.com/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": "none",
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": "xhigh"
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 400000,
    "maxInputTokens": 272000,
    "maxOutputTokens": 128000,
    "temperature": true,
    "releaseDate": "2025-12-11",
    "cost": {
      "input": 1.75,
      "output": 14,
      "cacheRead": 0.175
    },
    "compat": {
      "maxTokensField": "max_completion_tokens",
      "supportsDeveloperRole": true,
      "supportsReasoningEffort": true
    }
  },
  {
    "id": "gpt-5.2-pro",
    "name": "GPT-5.2 Pro",
    "provider": "openai",
    "protocol": "openai-responses",
    "baseUrl": "https://api.openai.com/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": null,
      "medium": "medium",
      "high": "high",
      "xhigh": "xhigh"
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 400000,
    "maxInputTokens": 272000,
    "maxOutputTokens": 128000,
    "temperature": false,
    "releaseDate": "2025-12-11",
    "cost": {
      "input": 21,
      "output": 168
    },
    "compat": {
      "maxTokensField": "max_completion_tokens",
      "supportsDeveloperRole": true,
      "supportsReasoningEffort": true
    }
  },
  {
    "id": "gpt-5.3-codex",
    "name": "GPT-5.3 Codex",
    "provider": "openai",
    "protocol": "openai-responses",
    "baseUrl": "https://api.openai.com/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": "none",
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": "xhigh"
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 400000,
    "maxInputTokens": 272000,
    "maxOutputTokens": 128000,
    "temperature": true,
    "releaseDate": "2026-02-05",
    "cost": {
      "input": 1.75,
      "output": 14,
      "cacheRead": 0.175
    },
    "compat": {
      "maxTokensField": "max_completion_tokens",
      "supportsDeveloperRole": true,
      "supportsReasoningEffort": true
    }
  },
  {
    "id": "gpt-5.3-codex-spark",
    "name": "GPT-5.3 Codex Spark",
    "provider": "openai",
    "protocol": "openai-responses",
    "baseUrl": "https://api.openai.com/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": "none",
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": "xhigh"
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 128000,
    "maxInputTokens": 100000,
    "maxOutputTokens": 32000,
    "temperature": false,
    "releaseDate": "2026-02-05",
    "cost": {
      "input": 1.75,
      "output": 14,
      "cacheRead": 0.175
    },
    "compat": {
      "maxTokensField": "max_completion_tokens",
      "supportsDeveloperRole": true,
      "supportsReasoningEffort": true
    }
  },
  {
    "id": "gpt-5.4",
    "name": "GPT-5.4",
    "provider": "openai",
    "protocol": "openai-responses",
    "baseUrl": "https://api.openai.com/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": "none",
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": "xhigh"
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1050000,
    "maxInputTokens": 922000,
    "maxOutputTokens": 128000,
    "temperature": true,
    "releaseDate": "2026-03-05",
    "cost": {
      "input": 2.5,
      "output": 15,
      "cacheRead": 0.25
    },
    "compat": {
      "maxTokensField": "max_completion_tokens",
      "supportsDeveloperRole": true,
      "supportsReasoningEffort": true
    }
  },
  {
    "id": "gpt-5.4-mini",
    "name": "GPT-5.4 mini",
    "provider": "openai",
    "protocol": "openai-responses",
    "baseUrl": "https://api.openai.com/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": "none",
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": "xhigh"
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 400000,
    "maxInputTokens": 272000,
    "maxOutputTokens": 128000,
    "temperature": true,
    "releaseDate": "2026-03-17",
    "cost": {
      "input": 0.75,
      "output": 4.5,
      "cacheRead": 0.075
    },
    "compat": {
      "maxTokensField": "max_completion_tokens",
      "supportsDeveloperRole": true,
      "supportsReasoningEffort": true
    }
  },
  {
    "id": "gpt-5.4-nano",
    "name": "GPT-5.4 nano",
    "provider": "openai",
    "protocol": "openai-responses",
    "baseUrl": "https://api.openai.com/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": "none",
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": "xhigh"
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 400000,
    "maxInputTokens": 272000,
    "maxOutputTokens": 128000,
    "temperature": true,
    "releaseDate": "2026-03-17",
    "cost": {
      "input": 0.2,
      "output": 1.25,
      "cacheRead": 0.02
    },
    "compat": {
      "maxTokensField": "max_completion_tokens",
      "supportsDeveloperRole": true,
      "supportsReasoningEffort": true
    }
  },
  {
    "id": "gpt-5.4-pro",
    "name": "GPT-5.4 Pro",
    "provider": "openai",
    "protocol": "openai-responses",
    "baseUrl": "https://api.openai.com/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": null,
      "medium": "medium",
      "high": "high",
      "xhigh": "xhigh"
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1050000,
    "maxInputTokens": 922000,
    "maxOutputTokens": 128000,
    "temperature": false,
    "releaseDate": "2026-03-05",
    "cost": {
      "input": 30,
      "output": 180
    },
    "compat": {
      "maxTokensField": "max_completion_tokens",
      "supportsDeveloperRole": true,
      "supportsReasoningEffort": true
    }
  },
  {
    "id": "gpt-5.5",
    "name": "GPT-5.5",
    "provider": "openai",
    "protocol": "openai-responses",
    "baseUrl": "https://api.openai.com/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": "none",
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": "xhigh"
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1050000,
    "maxInputTokens": 922000,
    "maxOutputTokens": 128000,
    "temperature": false,
    "releaseDate": "2026-04-23",
    "cost": {
      "input": 5,
      "output": 30,
      "cacheRead": 0.5
    },
    "compat": {
      "maxTokensField": "max_completion_tokens",
      "supportsDeveloperRole": true,
      "supportsReasoningEffort": true
    }
  },
  {
    "id": "gpt-5.5-pro",
    "name": "GPT-5.5 Pro",
    "provider": "openai",
    "protocol": "openai-responses",
    "baseUrl": "https://api.openai.com/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": null,
      "medium": "medium",
      "high": "high",
      "xhigh": "xhigh"
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1050000,
    "maxInputTokens": 922000,
    "maxOutputTokens": 128000,
    "temperature": false,
    "releaseDate": "2026-04-23",
    "cost": {
      "input": 30,
      "output": 180
    },
    "compat": {
      "maxTokensField": "max_completion_tokens",
      "supportsDeveloperRole": true,
      "supportsReasoningEffort": true
    }
  },
  {
    "id": "gpt-5.6",
    "name": "GPT-5.6",
    "provider": "openai",
    "protocol": "openai-responses",
    "baseUrl": "https://api.openai.com/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": "none",
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": "xhigh"
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1050000,
    "maxInputTokens": 922000,
    "maxOutputTokens": 128000,
    "temperature": false,
    "releaseDate": "2026-07-09",
    "cost": {
      "input": 4,
      "output": 20,
      "cacheRead": 0.4,
      "cacheWrite": 5
    },
    "compat": {
      "maxTokensField": "max_completion_tokens",
      "supportsDeveloperRole": true,
      "supportsReasoningEffort": true
    }
  },
  {
    "id": "gpt-5.6-luna",
    "name": "GPT-5.6 Luna",
    "provider": "openai",
    "protocol": "openai-responses",
    "baseUrl": "https://api.openai.com/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": "none",
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": "xhigh"
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1050000,
    "maxInputTokens": 922000,
    "maxOutputTokens": 128000,
    "temperature": false,
    "releaseDate": "2026-07-09",
    "cost": {
      "input": 0.2,
      "output": 1.2,
      "cacheRead": 0.02,
      "cacheWrite": 0.25
    },
    "compat": {
      "maxTokensField": "max_completion_tokens",
      "supportsDeveloperRole": true,
      "supportsReasoningEffort": true
    }
  },
  {
    "id": "gpt-5.6-sol",
    "name": "GPT-5.6 Sol",
    "provider": "openai",
    "protocol": "openai-responses",
    "baseUrl": "https://api.openai.com/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": "none",
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": "xhigh"
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1050000,
    "maxInputTokens": 922000,
    "maxOutputTokens": 128000,
    "temperature": false,
    "releaseDate": "2026-07-09",
    "cost": {
      "input": 4,
      "output": 20,
      "cacheRead": 0.4,
      "cacheWrite": 5
    },
    "compat": {
      "maxTokensField": "max_completion_tokens",
      "supportsDeveloperRole": true,
      "supportsReasoningEffort": true
    }
  },
  {
    "id": "gpt-5.6-terra",
    "name": "GPT-5.6 Terra",
    "provider": "openai",
    "protocol": "openai-responses",
    "baseUrl": "https://api.openai.com/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": "none",
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": "xhigh"
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1050000,
    "maxInputTokens": 922000,
    "maxOutputTokens": 128000,
    "temperature": false,
    "releaseDate": "2026-07-09",
    "cost": {
      "input": 2,
      "output": 12,
      "cacheRead": 0.2,
      "cacheWrite": 2.5
    },
    "compat": {
      "maxTokensField": "max_completion_tokens",
      "supportsDeveloperRole": true,
      "supportsReasoningEffort": true
    }
  },
  {
    "id": "gpt-6-astra",
    "name": "GPT-6 Astra",
    "provider": "openai",
    "protocol": "openai-responses",
    "baseUrl": "https://api.openai.com/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": "xhigh"
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1050000,
    "maxInputTokens": 922000,
    "maxOutputTokens": 128000,
    "temperature": false,
    "releaseDate": "2026-09-04",
    "cost": {
      "input": 10,
      "output": 50,
      "cacheRead": 1,
      "cacheWrite": 12.5
    },
    "compat": {
      "maxTokensField": "max_tokens",
      "supportsDeveloperRole": true
    }
  },
  {
    "id": "gpt-6-luna",
    "name": "GPT-6 Luna",
    "provider": "openai",
    "protocol": "openai-responses",
    "baseUrl": "https://api.openai.com/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": "none",
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": "xhigh"
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1050000,
    "maxInputTokens": 922000,
    "maxOutputTokens": 128000,
    "temperature": false,
    "releaseDate": "2026-09-22",
    "cost": {
      "input": 0.1,
      "output": 0.5,
      "cacheRead": 0.01,
      "cacheWrite": 0.125
    },
    "compat": {
      "maxTokensField": "max_tokens",
      "supportsDeveloperRole": true
    }
  },
  {
    "id": "gpt-6-sol",
    "name": "GPT-6 Sol",
    "provider": "openai",
    "protocol": "openai-responses",
    "baseUrl": "https://api.openai.com/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": "none",
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": "xhigh"
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1050000,
    "maxInputTokens": 922000,
    "maxOutputTokens": 128000,
    "temperature": false,
    "releaseDate": "2026-09-22",
    "cost": {
      "input": 2,
      "output": 10,
      "cacheRead": 0.2,
      "cacheWrite": 2.5
    },
    "compat": {
      "maxTokensField": "max_tokens",
      "supportsDeveloperRole": true
    }
  },
  {
    "id": "gpt-6.1-sol",
    "name": "GPT-6.1 Sol",
    "provider": "openai",
    "protocol": "openai-responses",
    "baseUrl": "https://api.openai.com/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": "xhigh"
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1050000,
    "maxInputTokens": 922000,
    "maxOutputTokens": 128000,
    "temperature": false,
    "releaseDate": "2026-09-29",
    "cost": {
      "input": 2,
      "output": 10,
      "cacheRead": 0.1,
      "cacheWrite": 2.5
    },
    "compat": {
      "maxTokensField": "max_tokens",
      "supportsDeveloperRole": true
    }
  },
  {
    "id": "gpt-daybreak-blue-latest",
    "name": "Daybreak Blue",
    "provider": "openai",
    "protocol": "openai-responses",
    "baseUrl": "https://api.openai.com/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": "none",
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": "xhigh"
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1050000,
    "maxInputTokens": 922000,
    "maxOutputTokens": 128000,
    "temperature": false,
    "releaseDate": "2026-08-07",
    "cost": {
      "input": 4,
      "output": 20,
      "cacheRead": 0.4,
      "cacheWrite": 5
    },
    "compat": {
      "maxTokensField": "max_tokens",
      "supportsDeveloperRole": true
    }
  },
  {
    "id": "gpt-daybreak-red-latest",
    "name": "Daybreak Red",
    "provider": "openai",
    "protocol": "openai-responses",
    "baseUrl": "https://api.openai.com/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": "none",
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": "xhigh"
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 400000,
    "maxInputTokens": 272000,
    "maxOutputTokens": 128000,
    "temperature": false,
    "releaseDate": "2026-08-07",
    "cost": {
      "input": 12.5,
      "output": 75,
      "cacheRead": 1.25,
      "cacheWrite": 15.625
    },
    "compat": {
      "maxTokensField": "max_tokens",
      "supportsDeveloperRole": true
    }
  },
  {
    "id": "gpt-realtime-2.1",
    "name": "GPT-Realtime-2.1",
    "provider": "openai",
    "protocol": "openai-responses",
    "baseUrl": "https://api.openai.com/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": "xhigh"
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 128000,
    "maxInputTokens": 96000,
    "maxOutputTokens": 32000,
    "temperature": false,
    "releaseDate": "2026-07-06",
    "cost": {
      "input": 4,
      "output": 24,
      "cacheRead": 0.4
    },
    "compat": {
      "maxTokensField": "max_tokens",
      "supportsDeveloperRole": true
    }
  },
  {
    "id": "o3",
    "name": "o3",
    "provider": "openai",
    "protocol": "openai-responses",
    "baseUrl": "https://api.openai.com/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": null
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 200000,
    "maxOutputTokens": 100000,
    "temperature": false,
    "releaseDate": "2025-04-16",
    "cost": {
      "input": 2,
      "output": 8,
      "cacheRead": 0.5
    },
    "compat": {
      "maxTokensField": "max_completion_tokens",
      "supportsDeveloperRole": true,
      "supportsReasoningEffort": true
    }
  },
  {
    "id": "o3-pro",
    "name": "o3-pro",
    "provider": "openai",
    "protocol": "openai-responses",
    "baseUrl": "https://api.openai.com/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": null
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 200000,
    "maxOutputTokens": 100000,
    "temperature": false,
    "releaseDate": "2025-06-10",
    "cost": {
      "input": 20,
      "output": 80
    },
    "compat": {
      "maxTokensField": "max_completion_tokens",
      "supportsDeveloperRole": true,
      "supportsReasoningEffort": true
    }
  },
  {
    "id": "~anthropic/claude-fable-latest",
    "name": "Claude Fable Latest",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": "xhigh"
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1000000,
    "maxOutputTokens": 128000,
    "temperature": false,
    "releaseDate": "2026-06-09",
    "cost": {
      "input": 10,
      "output": 50,
      "cacheRead": 0.25,
      "cacheWrite": 12.5
    }
  },
  {
    "id": "~anthropic/claude-haiku-latest",
    "name": "Claude Haiku Latest",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 200000,
    "maxOutputTokens": 64000,
    "temperature": true,
    "releaseDate": "2026-04-27",
    "cost": {
      "input": 1,
      "output": 5,
      "cacheRead": 0.1,
      "cacheWrite": 1.25
    }
  },
  {
    "id": "~anthropic/claude-opus-latest",
    "name": "Claude Opus Latest",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": "xhigh"
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1000000,
    "maxOutputTokens": 128000,
    "temperature": true,
    "releaseDate": "2026-04-21",
    "cost": {
      "input": 4,
      "output": 20,
      "cacheRead": 0.2,
      "cacheWrite": 5
    }
  },
  {
    "id": "~anthropic/claude-sonnet-latest",
    "name": "Claude Sonnet Latest",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": "xhigh"
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1000000,
    "maxOutputTokens": 128000,
    "temperature": true,
    "releaseDate": "2026-04-27",
    "cost": {
      "input": 2,
      "output": 10,
      "cacheRead": 0.2,
      "cacheWrite": 2.5
    }
  },
  {
    "id": "~deepseek/deepseek-flash-latest",
    "name": "DeepSeek Flash Latest",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": "low",
      "medium": null,
      "high": "high",
      "xhigh": null
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1048576,
    "maxOutputTokens": 943718,
    "temperature": true,
    "releaseDate": "2026-09-14",
    "cost": {
      "input": 0.0198,
      "output": 0.396,
      "cacheRead": 0.00291
    }
  },
  {
    "id": "~deepseek/deepseek-pro-latest",
    "name": "DeepSeek Pro Latest",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": "low",
      "medium": null,
      "high": "high",
      "xhigh": null
    },
    "input": [
      "text"
    ],
    "contextWindow": 1048576,
    "maxOutputTokens": 393216,
    "temperature": true,
    "releaseDate": "2026-09-14",
    "cost": {
      "input": 0.134,
      "output": 3.5,
      "cacheRead": 0.134
    }
  },
  {
    "id": "~deepseek/deepseek-v4-flash-latest",
    "name": "DeepSeek V4 Flash Latest",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": "low",
      "medium": null,
      "high": "high",
      "xhigh": null
    },
    "input": [
      "text"
    ],
    "contextWindow": 1048576,
    "maxOutputTokens": 943718,
    "temperature": true,
    "releaseDate": "2026-08-01",
    "cost": {
      "input": 0.0099,
      "output": 0.13068,
      "cacheRead": 0.001386
    }
  },
  {
    "id": "~google/gemini-flash-latest",
    "name": "Gemini Flash Latest",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": null
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1048576,
    "maxOutputTokens": 65536,
    "temperature": true,
    "releaseDate": "2026-04-27",
    "cost": {
      "input": 0.75,
      "output": 3.75,
      "cacheRead": 0.075,
      "cacheWrite": 0.041667
    }
  },
  {
    "id": "~google/gemini-pro-latest",
    "name": "Gemini Pro Latest",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": null
    },
    "input": [
      "image",
      "text"
    ],
    "contextWindow": 1048576,
    "maxOutputTokens": 65536,
    "temperature": true,
    "releaseDate": "2026-04-27",
    "cost": {
      "input": 2,
      "output": 12,
      "cacheRead": 0.2,
      "cacheWrite": 0.375
    }
  },
  {
    "id": "~moonshotai/kimi-latest",
    "name": "Kimi Latest",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": "low",
      "medium": null,
      "high": "high",
      "xhigh": null
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1048576,
    "maxOutputTokens": 943718,
    "temperature": true,
    "releaseDate": "2026-04-27",
    "cost": {
      "input": 0.3654,
      "output": 9.1343,
      "cacheRead": 0.4
    }
  },
  {
    "id": "~openai/gpt-astra-latest",
    "name": "GPT Astra Latest",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": "xhigh"
    },
    "input": [
      "image",
      "text"
    ],
    "contextWindow": 1050000,
    "maxOutputTokens": 128000,
    "temperature": false,
    "releaseDate": "2026-09-11",
    "cost": {
      "input": 10,
      "output": 50,
      "cacheRead": 1,
      "cacheWrite": 12.5
    }
  },
  {
    "id": "~openai/gpt-luna-latest",
    "name": "GPT Luna Latest",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": "none",
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": "xhigh"
    },
    "input": [
      "image",
      "text"
    ],
    "contextWindow": 1050000,
    "maxOutputTokens": 128000,
    "temperature": false,
    "releaseDate": "2026-09-11",
    "cost": {
      "input": 0.1,
      "output": 0.5,
      "cacheRead": 0.01,
      "cacheWrite": 0.125
    }
  },
  {
    "id": "~openai/gpt-mini-latest",
    "name": "GPT Mini Latest",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": "none",
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": "xhigh"
    },
    "input": [
      "image",
      "text"
    ],
    "contextWindow": 400000,
    "maxOutputTokens": 128000,
    "temperature": false,
    "releaseDate": "2026-04-27",
    "cost": {
      "input": 0.75,
      "output": 4.5,
      "cacheRead": 0.075
    }
  },
  {
    "id": "~openai/gpt-sol-latest",
    "name": "GPT Sol Latest",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": "xhigh"
    },
    "input": [
      "image",
      "text"
    ],
    "contextWindow": 1050000,
    "maxOutputTokens": 128000,
    "temperature": false,
    "releaseDate": "2026-09-11",
    "cost": {
      "input": 2,
      "output": 10,
      "cacheRead": 0.1,
      "cacheWrite": 2.5
    }
  },
  {
    "id": "~openai/gpt-terra-latest",
    "name": "GPT Terra Latest",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": "none",
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": "xhigh"
    },
    "input": [
      "image",
      "text"
    ],
    "contextWindow": 1050000,
    "maxOutputTokens": 128000,
    "temperature": false,
    "releaseDate": "2026-09-11",
    "cost": {
      "input": 2,
      "output": 12,
      "cacheRead": 0.2,
      "cacheWrite": 2.5
    }
  },
  {
    "id": "~x-ai/grok-latest",
    "name": "Grok Latest",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": "xhigh"
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 500000,
    "maxOutputTokens": 450000,
    "temperature": true,
    "releaseDate": "2026-07-08",
    "cost": {
      "input": 2,
      "output": 6,
      "cacheRead": 0.5
    }
  },
  {
    "id": "~z-ai/glm-flash-latest",
    "name": "GLM Flash Latest",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": "low",
      "medium": null,
      "high": "high",
      "xhigh": null
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1048576,
    "maxOutputTokens": 943718,
    "temperature": true,
    "releaseDate": "2026-08-27",
    "cost": {
      "input": 0.02,
      "output": 0.2475,
      "cacheRead": 0.01
    }
  },
  {
    "id": "~z-ai/glm-latest",
    "name": "GLM Latest",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": "low",
      "medium": null,
      "high": "high",
      "xhigh": null
    },
    "input": [
      "text"
    ],
    "contextWindow": 1048576,
    "maxOutputTokens": 131072,
    "temperature": true,
    "releaseDate": "2026-08-19",
    "cost": {
      "input": 0.13,
      "output": 4,
      "cacheRead": 0.13
    }
  },
  {
    "id": "aion-labs/aion-2.0",
    "name": "Aion-2.0",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "input": [
      "text"
    ],
    "contextWindow": 131072,
    "maxOutputTokens": 32768,
    "temperature": true,
    "releaseDate": "2026-02-23",
    "cost": {
      "input": 0.8,
      "output": 1.6,
      "cacheRead": 0.2
    }
  },
  {
    "id": "aion-labs/aion-3.0",
    "name": "Aion-3.0",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "input": [
      "text"
    ],
    "contextWindow": 131072,
    "maxOutputTokens": 32768,
    "temperature": true,
    "releaseDate": "2026-07-07",
    "cost": {
      "input": 3,
      "output": 6,
      "cacheRead": 0.75
    }
  },
  {
    "id": "aion-labs/aion-3.0-mini",
    "name": "Aion-3.0-Mini",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "input": [
      "text"
    ],
    "contextWindow": 131072,
    "maxOutputTokens": 32768,
    "temperature": true,
    "releaseDate": "2026-07-07",
    "cost": {
      "input": 0.7,
      "output": 1.4,
      "cacheRead": 0.18
    }
  },
  {
    "id": "aion-labs/aion-3.5",
    "name": "Aion 3.5",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": "low",
      "medium": null,
      "high": "high",
      "xhigh": null
    },
    "input": [
      "text"
    ],
    "contextWindow": 262144,
    "maxOutputTokens": 32768,
    "temperature": true,
    "releaseDate": "2026-09-23",
    "cost": {
      "input": 3,
      "output": 6,
      "cacheRead": 0.75
    }
  },
  {
    "id": "aion-labs/aion-3.5-mini",
    "name": "Aion 3.5 Mini",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": "low",
      "medium": null,
      "high": "high",
      "xhigh": null
    },
    "input": [
      "text"
    ],
    "contextWindow": 262144,
    "maxOutputTokens": 32768,
    "temperature": true,
    "releaseDate": "2026-09-23",
    "cost": {
      "input": 0.7,
      "output": 1.4,
      "cacheRead": 0.18
    }
  },
  {
    "id": "amazon/nova-2-lite-v1",
    "name": "Nova 2 Lite",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1000000,
    "maxOutputTokens": 65535,
    "temperature": true,
    "releaseDate": "2025-12-02",
    "cost": {
      "input": 0.3,
      "output": 2.5
    }
  },
  {
    "id": "amazon/nova-lite-v1",
    "name": "Nova Lite 1.0",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": false,
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 300000,
    "maxOutputTokens": 5120,
    "temperature": true,
    "releaseDate": "2024-12-05",
    "cost": {
      "input": 0.06,
      "output": 0.24
    }
  },
  {
    "id": "amazon/nova-micro-v1",
    "name": "Nova Micro 1.0",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": false,
    "input": [
      "text"
    ],
    "contextWindow": 128000,
    "maxOutputTokens": 5120,
    "temperature": true,
    "releaseDate": "2024-12-05",
    "cost": {
      "input": 0.035,
      "output": 0.14
    }
  },
  {
    "id": "amazon/nova-premier-v1",
    "name": "Nova Premier 1.0",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": false,
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1000000,
    "maxOutputTokens": 32000,
    "temperature": true,
    "releaseDate": "2025-10-31",
    "cost": {
      "input": 2.5,
      "output": 12.5,
      "cacheRead": 0.625
    }
  },
  {
    "id": "amazon/nova-pro-v1",
    "name": "Nova Pro 1.0",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": false,
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 300000,
    "maxOutputTokens": 5120,
    "temperature": true,
    "releaseDate": "2024-12-05",
    "cost": {
      "input": 0.8,
      "output": 3.2
    }
  },
  {
    "id": "anthropic/claude-fable-5",
    "name": "Claude Fable 5",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": "xhigh"
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1000000,
    "maxOutputTokens": 128000,
    "temperature": false,
    "releaseDate": "2026-06-09",
    "cost": {
      "input": 10,
      "output": 50,
      "cacheRead": 1,
      "cacheWrite": 12.5
    }
  },
  {
    "id": "anthropic/claude-fable-5.1",
    "name": "Claude Fable 5.1",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": "xhigh"
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1000000,
    "maxOutputTokens": 128000,
    "temperature": false,
    "releaseDate": "2026-09-01",
    "cost": {
      "input": 10,
      "output": 50,
      "cacheRead": 0.25,
      "cacheWrite": 12.5
    }
  },
  {
    "id": "anthropic/claude-haiku-4.5",
    "name": "Claude Haiku 4.5 (latest)",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 200000,
    "maxOutputTokens": 64000,
    "temperature": true,
    "releaseDate": "2025-10-15",
    "cost": {
      "input": 1,
      "output": 5,
      "cacheRead": 0.1,
      "cacheWrite": 1.25
    }
  },
  {
    "id": "anthropic/claude-opus-4.1",
    "name": "Claude Opus 4.1 (latest)",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 200000,
    "maxOutputTokens": 32000,
    "temperature": true,
    "releaseDate": "2025-08-05",
    "cost": {
      "input": 15,
      "output": 75,
      "cacheRead": 1.5,
      "cacheWrite": 18.75
    }
  },
  {
    "id": "anthropic/claude-opus-4.5",
    "name": "Claude Opus 4.5 (latest)",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 200000,
    "maxOutputTokens": 64000,
    "temperature": true,
    "releaseDate": "2025-11-24",
    "cost": {
      "input": 5,
      "output": 25,
      "cacheRead": 0.5,
      "cacheWrite": 6.25
    }
  },
  {
    "id": "anthropic/claude-opus-4.6",
    "name": "Claude Opus 4.6",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": null
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1000000,
    "maxOutputTokens": 128000,
    "temperature": true,
    "releaseDate": "2026-02-05",
    "cost": {
      "input": 5,
      "output": 25,
      "cacheRead": 0.5,
      "cacheWrite": 6.25
    }
  },
  {
    "id": "anthropic/claude-opus-4.7",
    "name": "Claude Opus 4.7",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": "xhigh"
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1000000,
    "maxOutputTokens": 128000,
    "temperature": false,
    "releaseDate": "2026-04-16",
    "cost": {
      "input": 5,
      "output": 25,
      "cacheRead": 0.5,
      "cacheWrite": 6.25
    }
  },
  {
    "id": "anthropic/claude-opus-4.8",
    "name": "Claude Opus 4.8",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": "xhigh"
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1000000,
    "maxOutputTokens": 128000,
    "temperature": true,
    "releaseDate": "2026-05-28",
    "cost": {
      "input": 5,
      "output": 25,
      "cacheRead": 0.5,
      "cacheWrite": 6.25
    }
  },
  {
    "id": "anthropic/claude-opus-5",
    "name": "Claude Opus 5",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": "xhigh"
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1000000,
    "maxOutputTokens": 128000,
    "temperature": true,
    "releaseDate": "2026-07-24",
    "cost": {
      "input": 5,
      "output": 25,
      "cacheRead": 0.5,
      "cacheWrite": 6.25
    }
  },
  {
    "id": "anthropic/claude-opus-5.5",
    "name": "Claude Opus 5.5",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": "xhigh"
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1000000,
    "maxOutputTokens": 128000,
    "temperature": true,
    "releaseDate": "2026-09-22",
    "cost": {
      "input": 4,
      "output": 20,
      "cacheRead": 0.2,
      "cacheWrite": 5
    }
  },
  {
    "id": "anthropic/claude-sonnet-4",
    "name": "Claude Sonnet 4",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "input": [
      "image",
      "text"
    ],
    "contextWindow": 200000,
    "maxOutputTokens": 64000,
    "temperature": true,
    "releaseDate": "2025-05-22",
    "cost": {
      "input": 3,
      "output": 15,
      "cacheRead": 0.3,
      "cacheWrite": 3.75
    }
  },
  {
    "id": "anthropic/claude-sonnet-4.5",
    "name": "Claude Sonnet 4.5 (latest)",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1000000,
    "maxOutputTokens": 64000,
    "temperature": true,
    "releaseDate": "2025-09-29",
    "cost": {
      "input": 3,
      "output": 15,
      "cacheRead": 0.3,
      "cacheWrite": 3.75
    }
  },
  {
    "id": "anthropic/claude-sonnet-4.6",
    "name": "Claude Sonnet 4.6",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": null
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1000000,
    "maxOutputTokens": 128000,
    "temperature": true,
    "releaseDate": "2026-02-17",
    "cost": {
      "input": 3,
      "output": 15,
      "cacheRead": 0.3,
      "cacheWrite": 3.75
    }
  },
  {
    "id": "anthropic/claude-sonnet-5",
    "name": "Claude Sonnet 5",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": "xhigh"
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1000000,
    "maxOutputTokens": 128000,
    "temperature": false,
    "releaseDate": "2026-06-30",
    "cost": {
      "input": 2,
      "output": 10,
      "cacheRead": 0.2,
      "cacheWrite": 2.5
    }
  },
  {
    "id": "anthropic/claude-sonnet-5.5",
    "name": "Claude Sonnet 5.5",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": "xhigh"
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1000000,
    "maxOutputTokens": 128000,
    "temperature": true,
    "releaseDate": "2026-09-28",
    "cost": {
      "input": 2,
      "output": 10,
      "cacheRead": 0.2,
      "cacheWrite": 2.5
    }
  },
  {
    "id": "arcee-ai/trinity-large-thinking",
    "name": "Trinity Large Thinking",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "input": [
      "text"
    ],
    "contextWindow": 262144,
    "maxOutputTokens": 80000,
    "temperature": true,
    "releaseDate": "2026-04-01",
    "cost": {
      "input": 0.25,
      "output": 0.8,
      "cacheRead": 0.06
    }
  },
  {
    "id": "bytedance-seed/seed-1.6",
    "name": "Seed 1.6",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "input": [
      "image",
      "text"
    ],
    "contextWindow": 262144,
    "maxOutputTokens": 32768,
    "temperature": true,
    "releaseDate": "2025-12-23",
    "cost": {
      "input": 0.25,
      "output": 2
    }
  },
  {
    "id": "bytedance-seed/seed-1.6-flash",
    "name": "Seed 1.6 Flash",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "input": [
      "image",
      "text"
    ],
    "contextWindow": 262144,
    "maxOutputTokens": 32768,
    "temperature": true,
    "releaseDate": "2025-12-23",
    "cost": {
      "input": 0.075,
      "output": 0.3
    }
  },
  {
    "id": "bytedance-seed/seed-2-1-turbo",
    "name": "Seed 2.1 Turbo",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 262144,
    "maxOutputTokens": 235929,
    "temperature": true,
    "releaseDate": "2026-08-12",
    "cost": {
      "input": 0.5,
      "output": 2.5
    }
  },
  {
    "id": "bytedance-seed/seed-2.0-code",
    "name": "Seed 2.0 Code",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": null
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 262144,
    "maxOutputTokens": 131072,
    "temperature": true,
    "releaseDate": "2026-02-14",
    "cost": {
      "input": 0.5,
      "output": 3
    }
  },
  {
    "id": "bytedance-seed/seed-2.0-lite",
    "name": "Seed 2.0 Lite",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": null
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 262144,
    "maxOutputTokens": 131072,
    "temperature": true,
    "releaseDate": "2026-02-14",
    "cost": {
      "input": 0.25,
      "output": 2
    }
  },
  {
    "id": "bytedance-seed/seed-2.0-mini",
    "name": "Seed 2.0 Mini",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": null
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 262144,
    "maxOutputTokens": 131072,
    "temperature": true,
    "releaseDate": "2026-02-14",
    "cost": {
      "input": 0.1,
      "output": 0.4
    }
  },
  {
    "id": "cohere/command-a-plus",
    "name": "Command A+",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 192000,
    "maxOutputTokens": 64000,
    "temperature": true,
    "releaseDate": "2026-09-22",
    "cost": {
      "input": 0.3,
      "output": 1.5,
      "cacheRead": 0.15
    }
  },
  {
    "id": "cohere/command-r-08-2024",
    "name": "Command R",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": false,
    "input": [
      "text"
    ],
    "contextWindow": 128000,
    "maxOutputTokens": 4000,
    "temperature": true,
    "releaseDate": "2024-08-30",
    "cost": {
      "input": 0.15,
      "output": 0.6
    }
  },
  {
    "id": "cohere/command-r-plus-08-2024",
    "name": "Command R+",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": false,
    "input": [
      "text"
    ],
    "contextWindow": 128000,
    "maxOutputTokens": 4000,
    "temperature": true,
    "releaseDate": "2024-08-30",
    "cost": {
      "input": 2.5,
      "output": 10
    }
  },
  {
    "id": "cohere/north-mini-code:free",
    "name": "North Mini Code (free)",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "input": [
      "text"
    ],
    "contextWindow": 256000,
    "maxOutputTokens": 64000,
    "temperature": true,
    "releaseDate": "2026-06-17",
    "cost": {
      "input": 0,
      "output": 0
    }
  },
  {
    "id": "deepseek/deepseek-chat",
    "name": "DeepSeek Chat",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": false,
    "input": [
      "text"
    ],
    "contextWindow": 163840,
    "maxOutputTokens": 16000,
    "temperature": true,
    "releaseDate": "2025-12-01",
    "cost": {
      "input": 0.2574,
      "output": 1.0287
    }
  },
  {
    "id": "deepseek/deepseek-chat-v3-0324",
    "name": "DeepSeek V3 0324",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": false,
    "input": [
      "text"
    ],
    "contextWindow": 163840,
    "maxOutputTokens": 147456,
    "temperature": true,
    "releaseDate": "2025-03-24",
    "cost": {
      "input": 0.29,
      "output": 1.14,
      "cacheRead": 0.11
    }
  },
  {
    "id": "deepseek/deepseek-chat-v3.1",
    "name": "DeepSeek V3.1",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "input": [
      "text"
    ],
    "contextWindow": 163840,
    "maxOutputTokens": 32768,
    "temperature": true,
    "releaseDate": "2025-08-21",
    "cost": {
      "input": 0.25,
      "output": 0.95,
      "cacheRead": 0.13
    }
  },
  {
    "id": "deepseek/deepseek-r1",
    "name": "DeepSeek-R1",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "input": [
      "text"
    ],
    "contextWindow": 64000,
    "maxOutputTokens": 16000,
    "temperature": true,
    "releaseDate": "2025-01-20",
    "cost": {
      "input": 0.7,
      "output": 2.5
    }
  },
  {
    "id": "deepseek/deepseek-r1-0528",
    "name": "R1 0528",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "input": [
      "text"
    ],
    "contextWindow": 163840,
    "maxOutputTokens": 32768,
    "temperature": true,
    "releaseDate": "2025-05-28",
    "cost": {
      "input": 0.5,
      "output": 2.15,
      "cacheRead": 0.35
    }
  },
  {
    "id": "deepseek/deepseek-v3.1-terminus",
    "name": "DeepSeek V3.1 Terminus",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "input": [
      "text"
    ],
    "contextWindow": 163840,
    "maxOutputTokens": 65536,
    "temperature": true,
    "releaseDate": "2025-09-22",
    "cost": {
      "input": 0.3,
      "output": 1,
      "cacheRead": 0.135
    }
  },
  {
    "id": "deepseek/deepseek-v3.2",
    "name": "DeepSeek V3.2",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "input": [
      "text"
    ],
    "contextWindow": 163840,
    "maxOutputTokens": 65536,
    "temperature": true,
    "releaseDate": "2025-12-01",
    "cost": {
      "input": 0.28,
      "output": 0.42,
      "cacheRead": 0.028
    }
  },
  {
    "id": "deepseek/deepseek-v3.2-exp",
    "name": "DeepSeek V3.2 Exp",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "input": [
      "text"
    ],
    "contextWindow": 163840,
    "maxOutputTokens": 147456,
    "temperature": true,
    "releaseDate": "2025-09-29",
    "cost": {
      "input": 0.27,
      "output": 0.41
    }
  },
  {
    "id": "deepseek/deepseek-v4-flash",
    "name": "DeepSeek V4 Flash",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": null,
      "medium": null,
      "high": "high",
      "xhigh": "xhigh"
    },
    "input": [
      "text"
    ],
    "contextWindow": 1048576,
    "maxOutputTokens": 131072,
    "temperature": true,
    "interleavedReasoningField": "reasoning_content",
    "releaseDate": "2026-04-24",
    "cost": {
      "input": 0.14,
      "output": 0.28,
      "cacheRead": 0.028
    }
  },
  {
    "id": "deepseek/deepseek-v4-flash-0731",
    "name": "DeepSeek V4 Flash 0731",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": "low",
      "medium": null,
      "high": "high",
      "xhigh": null
    },
    "input": [
      "text"
    ],
    "contextWindow": 1048576,
    "maxOutputTokens": 943718,
    "temperature": true,
    "releaseDate": "2026-07-31",
    "cost": {
      "input": 0.01,
      "output": 1.28,
      "cacheRead": 0.01
    }
  },
  {
    "id": "deepseek/deepseek-v4-flash-vision-exp",
    "name": "DeepSeek V4 Flash Vision Exp",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": "low",
      "medium": null,
      "high": "high",
      "xhigh": null
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1048576,
    "maxOutputTokens": 262144,
    "temperature": true,
    "releaseDate": "2026-08-21",
    "cost": {
      "input": 0.2156,
      "output": 0.6468,
      "cacheRead": 0.00686
    }
  },
  {
    "id": "deepseek/deepseek-v4-pro",
    "name": "DeepSeek V4 Pro",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": null,
      "medium": null,
      "high": "high",
      "xhigh": "xhigh"
    },
    "input": [
      "text"
    ],
    "contextWindow": 1048576,
    "maxOutputTokens": 384000,
    "temperature": true,
    "interleavedReasoningField": "reasoning_content",
    "releaseDate": "2026-04-24",
    "cost": {
      "input": 0.95526,
      "output": 1.91052,
      "cacheRead": 0.079605
    }
  },
  {
    "id": "deepseek/deepseek-v4-pro-0813",
    "name": "DeepSeek V4 Pro 0813",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": "low",
      "medium": null,
      "high": "high",
      "xhigh": null
    },
    "input": [
      "text"
    ],
    "contextWindow": 1048576,
    "maxOutputTokens": 393216,
    "temperature": true,
    "releaseDate": "2026-08-12",
    "cost": {
      "input": 0.66,
      "output": 1.98,
      "cacheRead": 0.022
    }
  },
  {
    "id": "deepseek/deepseek-v4.1-flash",
    "name": "DeepSeek V4.1 Flash",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": "low",
      "medium": null,
      "high": "high",
      "xhigh": null
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1048576,
    "maxOutputTokens": 943718,
    "temperature": true,
    "releaseDate": "2026-09-10",
    "cost": {
      "input": 0.0198,
      "output": 0.396,
      "cacheRead": 0.00291
    }
  },
  {
    "id": "dots-studio/dots-3-note-preview:free",
    "name": "Dots3-Note Preview (free)",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 512000,
    "maxOutputTokens": 460800,
    "temperature": true,
    "releaseDate": "2026-08-14",
    "cost": {
      "input": 0,
      "output": 0
    }
  },
  {
    "id": "fireworks/ember-1",
    "name": "Ember-1",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": "low",
      "medium": null,
      "high": "high",
      "xhigh": null
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1048576,
    "maxOutputTokens": 943718,
    "temperature": true,
    "releaseDate": "2026-09-24",
    "cost": {
      "input": 3,
      "output": 15,
      "cacheRead": 0.3
    }
  },
  {
    "id": "google/gemini-2.5-flash",
    "name": "Gemini 2.5 Flash",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1048576,
    "maxOutputTokens": 65535,
    "temperature": true,
    "releaseDate": "2025-06-17",
    "cost": {
      "input": 0.3,
      "output": 2.5,
      "cacheRead": 0.03,
      "cacheWrite": 0.083333
    }
  },
  {
    "id": "google/gemini-2.5-flash-lite",
    "name": "Gemini 2.5 Flash-Lite",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1048576,
    "maxOutputTokens": 65535,
    "temperature": true,
    "releaseDate": "2025-06-17",
    "cost": {
      "input": 0.1,
      "output": 0.4,
      "cacheRead": 0.01,
      "cacheWrite": 0.083333
    }
  },
  {
    "id": "google/gemini-2.5-pro",
    "name": "Gemini 2.5 Pro",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": "none",
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": "xhigh"
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1048576,
    "maxOutputTokens": 65536,
    "temperature": true,
    "releaseDate": "2025-06-17",
    "cost": {
      "input": 1.25,
      "output": 10,
      "cacheRead": 0.125,
      "cacheWrite": 0.375
    }
  },
  {
    "id": "google/gemini-2.5-pro-preview",
    "name": "Gemini 2.5 Pro Preview 06-05",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": "none",
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": "xhigh"
    },
    "input": [
      "image",
      "text"
    ],
    "contextWindow": 1048576,
    "maxOutputTokens": 65536,
    "temperature": true,
    "releaseDate": "2025-06-05",
    "cost": {
      "input": 1.25,
      "output": 10,
      "cacheRead": 0.125,
      "cacheWrite": 0.375
    }
  },
  {
    "id": "google/gemini-3-flash-preview",
    "name": "Gemini 3 Flash Preview",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": null
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1048576,
    "maxOutputTokens": 65536,
    "temperature": true,
    "interleavedReasoningField": "reasoning_details",
    "releaseDate": "2025-12-17",
    "cost": {
      "input": 0.5,
      "output": 3,
      "cacheRead": 0.05,
      "cacheWrite": 0.083333
    }
  },
  {
    "id": "google/gemini-3-pro-image",
    "name": "Nano Banana Pro",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 131072,
    "maxOutputTokens": 32768,
    "temperature": true,
    "releaseDate": "2026-05-28",
    "cost": {
      "input": 2,
      "output": 12,
      "cacheRead": 0.2,
      "cacheWrite": 0.375
    }
  },
  {
    "id": "google/gemini-3.1-flash-lite",
    "name": "Gemini 3.1 Flash Lite",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": null
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1048576,
    "maxOutputTokens": 65536,
    "temperature": true,
    "releaseDate": "2026-05-07",
    "cost": {
      "input": 0.25,
      "output": 1.5,
      "cacheRead": 0.025,
      "cacheWrite": 0.083333
    }
  },
  {
    "id": "google/gemini-3.1-flash-lite-preview",
    "name": "Gemini 3.1 Flash Lite Preview",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": null
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1048576,
    "maxOutputTokens": 65536,
    "temperature": true,
    "releaseDate": "2026-03-03",
    "cost": {
      "input": 0.25,
      "output": 1.5,
      "cacheRead": 0.025,
      "cacheWrite": 0.083333
    }
  },
  {
    "id": "google/gemini-3.1-pro-preview",
    "name": "Gemini 3.1 Pro Preview",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": null
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1048576,
    "maxOutputTokens": 65536,
    "temperature": true,
    "interleavedReasoningField": "reasoning_details",
    "releaseDate": "2026-02-19",
    "cost": {
      "input": 2,
      "output": 12,
      "cacheRead": 0.2,
      "cacheWrite": 0.375
    }
  },
  {
    "id": "google/gemini-3.1-pro-preview-customtools",
    "name": "Gemini 3.1 Pro Preview Custom Tools",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": null
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1048576,
    "maxOutputTokens": 65536,
    "temperature": true,
    "interleavedReasoningField": "reasoning_details",
    "releaseDate": "2026-02-19",
    "cost": {
      "input": 2,
      "output": 12,
      "cacheRead": 0.2,
      "cacheWrite": 0.375
    }
  },
  {
    "id": "google/gemini-3.5-flash",
    "name": "Gemini 3.5 Flash",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": null
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1048576,
    "maxOutputTokens": 65536,
    "temperature": true,
    "releaseDate": "2026-05-19",
    "cost": {
      "input": 1.5,
      "output": 9,
      "cacheRead": 0.15,
      "cacheWrite": 0.083333
    }
  },
  {
    "id": "google/gemini-3.5-flash-lite",
    "name": "Gemini 3.5 Flash Lite",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": null
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1048576,
    "maxOutputTokens": 65536,
    "temperature": true,
    "releaseDate": "2026-07-21",
    "cost": {
      "input": 0.3,
      "output": 2.5,
      "cacheRead": 0.03,
      "cacheWrite": 0.083333
    }
  },
  {
    "id": "google/gemini-3.6-flash",
    "name": "Gemini 3.6 Flash",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": null
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1048576,
    "maxOutputTokens": 65536,
    "temperature": true,
    "releaseDate": "2026-07-21",
    "cost": {
      "input": 0.75,
      "output": 3.75,
      "cacheRead": 0.075,
      "cacheWrite": 0.041667
    }
  },
  {
    "id": "google/gemini-3.7-flash",
    "name": "Gemini 3.7 Flash",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": null
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1048576,
    "maxOutputTokens": 65536,
    "temperature": true,
    "releaseDate": "2026-08-13",
    "cost": {
      "input": 0.75,
      "output": 3.75,
      "cacheRead": 0.075,
      "cacheWrite": 0.041667
    }
  },
  {
    "id": "google/gemini-3.8-flash",
    "name": "Gemini 3.8 Flash",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": null
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1048576,
    "maxOutputTokens": 65536,
    "temperature": true,
    "releaseDate": "2026-09-02",
    "cost": {
      "input": 0.75,
      "output": 3.75,
      "cacheRead": 0.075,
      "cacheWrite": 0.041667
    }
  },
  {
    "id": "google/gemma-3-12b-it",
    "name": "Gemma 3 12B IT",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": false,
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 131072,
    "maxOutputTokens": 16384,
    "temperature": true,
    "releaseDate": "2025-03-12",
    "cost": {
      "input": 0.05,
      "output": 0.15
    }
  },
  {
    "id": "google/gemma-3-27b-it",
    "name": "Gemma 3 27B IT",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": false,
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 131072,
    "maxOutputTokens": 117964,
    "temperature": true,
    "releaseDate": "2025-03-12",
    "cost": {
      "input": 0.08,
      "output": 0.45,
      "cacheRead": 0.04
    }
  },
  {
    "id": "google/gemma-4-26b-a4b-it",
    "name": "Gemma 4 26B A4B IT",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "input": [
      "image",
      "text"
    ],
    "contextWindow": 262144,
    "maxOutputTokens": 235929,
    "temperature": true,
    "releaseDate": "2026-04-02",
    "cost": {
      "input": 0.09,
      "output": 0.3,
      "cacheRead": 0.05
    }
  },
  {
    "id": "google/gemma-4-26b-a4b-it:free",
    "name": "Gemma 4 26B A4B  (free)",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "input": [
      "image",
      "text"
    ],
    "contextWindow": 262144,
    "maxOutputTokens": 32768,
    "temperature": true,
    "releaseDate": "2026-04-02",
    "cost": {
      "input": 0,
      "output": 0
    }
  },
  {
    "id": "google/gemma-4-31b-it",
    "name": "Gemma 4 31B IT",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "input": [
      "image",
      "text"
    ],
    "contextWindow": 262144,
    "maxOutputTokens": 16384,
    "temperature": true,
    "releaseDate": "2026-04-02",
    "cost": {
      "input": 0.09,
      "output": 0.34,
      "cacheRead": 0.05
    }
  },
  {
    "id": "google/gemma-4-31b-it:free",
    "name": "Gemma 4 31B (free)",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "input": [
      "image",
      "text"
    ],
    "contextWindow": 262144,
    "maxOutputTokens": 32768,
    "temperature": true,
    "releaseDate": "2026-04-02",
    "cost": {
      "input": 0,
      "output": 0
    }
  },
  {
    "id": "ibm-granite/granite-4.2-8b",
    "name": "Granite 4.2 8B",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": "none",
      "low": "low",
      "medium": null,
      "high": "high",
      "xhigh": null
    },
    "input": [
      "text"
    ],
    "contextWindow": 131072,
    "maxOutputTokens": 117964,
    "temperature": true,
    "releaseDate": "2026-08-31",
    "cost": {
      "input": 0.06,
      "output": 0.25,
      "cacheRead": 0.015
    }
  },
  {
    "id": "inception/mercury-2",
    "name": "Mercury 2",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": "none",
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": null
    },
    "input": [
      "text"
    ],
    "contextWindow": 128000,
    "maxOutputTokens": 50000,
    "temperature": true,
    "releaseDate": "2026-03-04",
    "cost": {
      "input": 0.25,
      "output": 0.75,
      "cacheRead": 0.025
    }
  },
  {
    "id": "inception/mercury-2.5",
    "name": "Mercury 2.5",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": "none",
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": null
    },
    "input": [
      "text"
    ],
    "contextWindow": 260000,
    "maxOutputTokens": 65536,
    "temperature": true,
    "releaseDate": "2026-09-08",
    "cost": {
      "input": 0.04,
      "output": 0.15,
      "cacheRead": 0.004
    }
  },
  {
    "id": "inclusionai/ling-3.0-flash",
    "name": "Ling 3.0 Flash",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "input": [
      "text"
    ],
    "contextWindow": 262144,
    "maxOutputTokens": 32768,
    "temperature": true,
    "releaseDate": "2026-07-23",
    "cost": {
      "input": 0.021,
      "output": 0.063,
      "cacheRead": 0.0042
    }
  },
  {
    "id": "inclusionai/ling-3.0-flash-fin",
    "name": "Ling 3.0 Flash Fin",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "input": [
      "text"
    ],
    "contextWindow": 262144,
    "maxOutputTokens": 235929,
    "temperature": true,
    "releaseDate": "2026-08-27",
    "cost": {
      "input": 0.06,
      "output": 0.18,
      "cacheRead": 0.012
    }
  },
  {
    "id": "inclusionai/ling-3.0-flash-sante:free",
    "name": "Ling 3.0 Flash Sante (free)",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "input": [
      "text"
    ],
    "contextWindow": 262144,
    "maxOutputTokens": 32768,
    "temperature": true,
    "releaseDate": "2026-09-04",
    "cost": {
      "input": 0,
      "output": 0
    }
  },
  {
    "id": "inclusionai/ling-3.0-flash-vl",
    "name": "Ling 3.0 Flash VL",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 262144,
    "maxOutputTokens": 32768,
    "temperature": true,
    "releaseDate": "2026-09-10",
    "cost": {
      "input": 0.021,
      "output": 0.0616,
      "cacheRead": 0.0042
    }
  },
  {
    "id": "kwaipilot/kat-coder-pro-v2.5",
    "name": "KAT-Coder-Pro V2.5",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": false,
    "input": [
      "text"
    ],
    "contextWindow": 262144,
    "maxOutputTokens": 235929,
    "temperature": true,
    "releaseDate": "2026-07-10",
    "cost": {
      "input": 0.74,
      "output": 2.96,
      "cacheRead": 0.15
    }
  },
  {
    "id": "liquid/lfm-2.5-2.6b:free",
    "name": "LFM2.5-2.6B (free)",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "input": [
      "text"
    ],
    "contextWindow": 65536,
    "maxOutputTokens": 8192,
    "temperature": true,
    "releaseDate": "2026-08-11",
    "cost": {
      "input": 0,
      "output": 0
    }
  },
  {
    "id": "meituan/longcat-2.0",
    "name": "LongCat 2.0",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": "none",
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": "xhigh"
    },
    "input": [
      "text"
    ],
    "contextWindow": 1048756,
    "maxOutputTokens": 262144,
    "temperature": true,
    "releaseDate": "2026-07-20",
    "cost": {
      "input": 0.3,
      "output": 1.2,
      "cacheRead": 0.006
    }
  },
  {
    "id": "meta-llama/llama-3.1-70b-instruct",
    "name": "Llama-3.1-70B-Instruct",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": false,
    "input": [
      "text"
    ],
    "contextWindow": 131072,
    "maxOutputTokens": 16384,
    "temperature": true,
    "releaseDate": "2024-07-23",
    "cost": {
      "input": 0.4,
      "output": 0.4
    }
  },
  {
    "id": "meta-llama/llama-3.1-8b-instruct",
    "name": "Llama-3.1-8B-Instruct",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": false,
    "input": [
      "text"
    ],
    "contextWindow": 131072,
    "maxOutputTokens": 117964,
    "temperature": true,
    "releaseDate": "2024-07-23",
    "cost": {
      "input": 0.05,
      "output": 0.08,
      "cacheRead": 0.025
    }
  },
  {
    "id": "meta-llama/llama-3.3-70b-instruct",
    "name": "Llama-3.3-70B-Instruct",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": false,
    "input": [
      "text"
    ],
    "contextWindow": 131072,
    "maxOutputTokens": 16384,
    "temperature": true,
    "releaseDate": "2024-12-06",
    "cost": {
      "input": 0.1,
      "output": 0.32
    }
  },
  {
    "id": "meta-llama/llama-4-maverick",
    "name": "Llama 4 Maverick",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": false,
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1048576,
    "maxOutputTokens": 16384,
    "temperature": true,
    "releaseDate": "2025-04-05",
    "cost": {
      "input": 0.1875,
      "output": 0.6525
    }
  },
  {
    "id": "meta-llama/llama-4-scout",
    "name": "Llama 4 Scout",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": false,
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1310720,
    "maxOutputTokens": 16384,
    "temperature": true,
    "releaseDate": "2025-04-05",
    "cost": {
      "input": 0.1,
      "output": 0.3
    }
  },
  {
    "id": "meta/muse-glimmer-30b",
    "name": "Muse Glimmer 30B",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": "xhigh"
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 131072,
    "maxOutputTokens": 117964,
    "temperature": true,
    "releaseDate": "2026-08-10",
    "cost": {
      "input": 0.35,
      "output": 1.5,
      "cacheRead": 0.04
    }
  },
  {
    "id": "meta/muse-spark-1.1",
    "name": "Muse Spark 1.1",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": "xhigh"
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1048576,
    "maxOutputTokens": 943718,
    "temperature": true,
    "releaseDate": "2026-04-08",
    "cost": {
      "input": 1.25,
      "output": 4.25,
      "cacheRead": 0.15
    }
  },
  {
    "id": "meta/muse-spark-1.2",
    "name": "Muse Spark 1.2",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": "xhigh"
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1048576,
    "maxOutputTokens": 943718,
    "temperature": true,
    "releaseDate": "2026-08-05",
    "cost": {
      "input": 1.25,
      "output": 4.25,
      "cacheRead": 0.15
    }
  },
  {
    "id": "meta/muse-spark-1.2-contributor",
    "name": "Muse Spark 1.2 Contributor",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": "xhigh"
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1048576,
    "maxOutputTokens": 943718,
    "temperature": true,
    "releaseDate": "2026-08-21",
    "cost": {
      "input": 0.1,
      "output": 0.2,
      "cacheRead": 0.002
    }
  },
  {
    "id": "meta/muse-spark-1.3",
    "name": "Muse Spark 1.3",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": "xhigh"
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1048576,
    "maxOutputTokens": 943718,
    "temperature": true,
    "releaseDate": "2026-09-02",
    "cost": {
      "input": 1.25,
      "output": 4.25,
      "cacheRead": 0.15
    }
  },
  {
    "id": "meta/muse-spark-1.3-contributor",
    "name": "Muse Spark 1.3 Contributor",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": "xhigh"
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1048576,
    "maxOutputTokens": 943718,
    "temperature": true,
    "releaseDate": "2026-09-02",
    "cost": {
      "input": 0.1,
      "output": 0.2,
      "cacheRead": 0.002
    }
  },
  {
    "id": "minimax/minimax-m1",
    "name": "MiniMax M1",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "input": [
      "text"
    ],
    "contextWindow": 1000000,
    "maxOutputTokens": 40000,
    "temperature": true,
    "releaseDate": "2025-06-17",
    "cost": {
      "input": 0.4,
      "output": 2.2
    }
  },
  {
    "id": "minimax/minimax-m2",
    "name": "MiniMax-M2",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "input": [
      "text"
    ],
    "contextWindow": 204800,
    "maxOutputTokens": 176947,
    "temperature": true,
    "interleavedReasoningField": "reasoning_details",
    "releaseDate": "2025-10-27",
    "cost": {
      "input": 0.3,
      "output": 1.2
    }
  },
  {
    "id": "minimax/minimax-m2.1",
    "name": "MiniMax-M2.1",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "input": [
      "text"
    ],
    "contextWindow": 204800,
    "maxOutputTokens": 131072,
    "temperature": true,
    "interleavedReasoningField": "reasoning_details",
    "releaseDate": "2025-12-23",
    "cost": {
      "input": 0.3,
      "output": 1.2,
      "cacheRead": 0.03
    }
  },
  {
    "id": "minimax/minimax-m2.5",
    "name": "MiniMax-M2.5",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "input": [
      "text"
    ],
    "contextWindow": 204800,
    "maxOutputTokens": 128000,
    "temperature": true,
    "interleavedReasoningField": "reasoning_details",
    "releaseDate": "2026-02-12",
    "cost": {
      "input": 0.27,
      "output": 1.08,
      "cacheRead": 0.027
    }
  },
  {
    "id": "minimax/minimax-m2.7",
    "name": "MiniMax-M2.7",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "input": [
      "text"
    ],
    "contextWindow": 204800,
    "maxOutputTokens": 176947,
    "temperature": true,
    "releaseDate": "2026-03-18",
    "cost": {
      "input": 0.21,
      "output": 0.84,
      "cacheRead": 0.042
    }
  },
  {
    "id": "minimax/minimax-m3",
    "name": "MiniMax-M3",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1048576,
    "maxOutputTokens": 512000,
    "temperature": true,
    "releaseDate": "2026-06-01",
    "cost": {
      "input": 0.3,
      "output": 1.2,
      "cacheRead": 0.06
    }
  },
  {
    "id": "mistralai/codestral-2508",
    "name": "Codestral 2508",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": false,
    "input": [
      "text"
    ],
    "contextWindow": 256000,
    "maxOutputTokens": 204800,
    "temperature": true,
    "releaseDate": "2025-08-01",
    "cost": {
      "input": 0.3,
      "output": 0.9,
      "cacheRead": 0.03
    }
  },
  {
    "id": "mistralai/devstral-2512",
    "name": "Devstral 2",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": false,
    "input": [
      "text"
    ],
    "contextWindow": 262144,
    "maxOutputTokens": 209715,
    "temperature": true,
    "releaseDate": "2025-12-09",
    "cost": {
      "input": 0.4,
      "output": 2,
      "cacheRead": 0.04
    }
  },
  {
    "id": "mistralai/ministral-14b-2512",
    "name": "Ministral 3 14B 2512",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": false,
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 262144,
    "maxOutputTokens": 209715,
    "temperature": true,
    "releaseDate": "2025-12-02",
    "cost": {
      "input": 0.2,
      "output": 0.2,
      "cacheRead": 0.02
    }
  },
  {
    "id": "mistralai/ministral-3b-2512",
    "name": "Ministral 3 3B 2512",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": false,
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 131072,
    "maxOutputTokens": 104857,
    "temperature": true,
    "releaseDate": "2025-12-02",
    "cost": {
      "input": 0.1,
      "output": 0.1,
      "cacheRead": 0.01
    }
  },
  {
    "id": "mistralai/ministral-8b-2512",
    "name": "Ministral 3 8B 2512",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": false,
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 262144,
    "maxOutputTokens": 209715,
    "temperature": true,
    "releaseDate": "2025-12-02",
    "cost": {
      "input": 0.15,
      "output": 0.15,
      "cacheRead": 0.015
    }
  },
  {
    "id": "mistralai/mistral-large",
    "name": "Mistral Large",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": false,
    "input": [
      "text"
    ],
    "contextWindow": 128000,
    "maxOutputTokens": 102400,
    "temperature": true,
    "releaseDate": "2024-02-26",
    "cost": {
      "input": 2,
      "output": 6,
      "cacheRead": 0.2
    }
  },
  {
    "id": "mistralai/mistral-large-2407",
    "name": "Mistral Large 2407",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": false,
    "input": [
      "text"
    ],
    "contextWindow": 131072,
    "maxOutputTokens": 104857,
    "temperature": true,
    "releaseDate": "2024-11-19",
    "cost": {
      "input": 2,
      "output": 6,
      "cacheRead": 0.2
    }
  },
  {
    "id": "mistralai/mistral-large-2512",
    "name": "Mistral Large 3",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": false,
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 262144,
    "maxOutputTokens": 209715,
    "temperature": true,
    "releaseDate": "2025-12-02",
    "cost": {
      "input": 0.5,
      "output": 1.5,
      "cacheRead": 0.05
    }
  },
  {
    "id": "mistralai/mistral-medium-3",
    "name": "Mistral Medium 3",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": false,
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 131072,
    "maxOutputTokens": 104857,
    "temperature": true,
    "releaseDate": "2025-05-07",
    "cost": {
      "input": 0.4,
      "output": 2,
      "cacheRead": 0.04
    }
  },
  {
    "id": "mistralai/mistral-medium-3-5",
    "name": "Mistral Medium 3.5",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": "none",
      "low": null,
      "medium": null,
      "high": "high",
      "xhigh": null
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 262144,
    "maxOutputTokens": 209715,
    "temperature": true,
    "releaseDate": "2026-04-30",
    "cost": {
      "input": 1.5,
      "output": 7.5
    }
  },
  {
    "id": "mistralai/mistral-medium-3.1",
    "name": "Mistral Medium 3.1",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": false,
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 131072,
    "maxOutputTokens": 104857,
    "temperature": true,
    "releaseDate": "2025-08-13",
    "cost": {
      "input": 0.4,
      "output": 2,
      "cacheRead": 0.04
    }
  },
  {
    "id": "mistralai/mistral-nemo",
    "name": "Mistral Nemo",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": false,
    "input": [
      "text"
    ],
    "contextWindow": 131072,
    "maxOutputTokens": 16384,
    "temperature": true,
    "releaseDate": "2024-07-01",
    "cost": {
      "input": 0.019,
      "output": 0.03
    }
  },
  {
    "id": "mistralai/mistral-saba",
    "name": "Saba",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": false,
    "input": [
      "text"
    ],
    "contextWindow": 32768,
    "maxOutputTokens": 26214,
    "temperature": true,
    "releaseDate": "2025-02-17",
    "cost": {
      "input": 0.2,
      "output": 0.6,
      "cacheRead": 0.02
    }
  },
  {
    "id": "mistralai/mistral-small-2603",
    "name": "Mistral Small 4",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": "none",
      "low": null,
      "medium": null,
      "high": "high",
      "xhigh": null
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 262144,
    "maxOutputTokens": 209715,
    "temperature": true,
    "releaseDate": "2026-03-16",
    "cost": {
      "input": 0.15,
      "output": 0.6,
      "cacheRead": 0.015
    }
  },
  {
    "id": "mistralai/mistral-small-3.1-24b-instruct",
    "name": "Mistral Small 3.1 24B",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": false,
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 128000,
    "maxOutputTokens": 102400,
    "temperature": true,
    "releaseDate": "2025-03-17",
    "cost": {
      "input": 0.351,
      "output": 0.555
    }
  },
  {
    "id": "mistralai/mistral-small-3.2-24b-instruct",
    "name": "Mistral Small 3.2 24B",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": false,
    "input": [
      "image",
      "text"
    ],
    "contextWindow": 256000,
    "maxOutputTokens": 16384,
    "temperature": true,
    "releaseDate": "2025-06-20",
    "cost": {
      "input": 0.09375,
      "output": 0.25
    }
  },
  {
    "id": "mistralai/mixtral-8x22b-instruct",
    "name": "Mixtral 8x22B Instruct",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": false,
    "input": [
      "text"
    ],
    "contextWindow": 65536,
    "maxOutputTokens": 52428,
    "temperature": true,
    "releaseDate": "2024-04-17",
    "cost": {
      "input": 2,
      "output": 6,
      "cacheRead": 0.2
    }
  },
  {
    "id": "mistralai/voxtral-small-24b-2507",
    "name": "Voxtral Small 24B 2507",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": false,
    "input": [
      "text"
    ],
    "contextWindow": 32768,
    "maxOutputTokens": 26214,
    "temperature": true,
    "releaseDate": "2025-07-15",
    "cost": {
      "input": 0.1,
      "output": 0.3,
      "cacheRead": 0.01
    }
  },
  {
    "id": "moonshotai/kimi-k2",
    "name": "Kimi K2 0711",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": false,
    "input": [
      "text"
    ],
    "contextWindow": 131072,
    "maxOutputTokens": 98304,
    "temperature": true,
    "releaseDate": "2025-07-11",
    "cost": {
      "input": 0.57,
      "output": 2.3
    }
  },
  {
    "id": "moonshotai/kimi-k2-0905",
    "name": "Kimi K2 0905",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": false,
    "input": [
      "text"
    ],
    "contextWindow": 262144,
    "maxOutputTokens": 98304,
    "temperature": true,
    "releaseDate": "2025-09-04",
    "cost": {
      "input": 0.6,
      "output": 2.5
    }
  },
  {
    "id": "moonshotai/kimi-k2-thinking",
    "name": "Kimi K2 Thinking",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "input": [
      "text"
    ],
    "contextWindow": 262144,
    "maxOutputTokens": 98304,
    "temperature": true,
    "interleavedReasoningField": "reasoning_details",
    "releaseDate": "2025-11-06",
    "cost": {
      "input": 0.6,
      "output": 2.5,
      "cacheRead": 0.15
    }
  },
  {
    "id": "moonshotai/kimi-k2.5",
    "name": "Kimi K2.5",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 262144,
    "maxOutputTokens": 235929,
    "temperature": true,
    "interleavedReasoningField": "reasoning_details",
    "releaseDate": "2026-01",
    "cost": {
      "input": 0.45,
      "output": 2.25,
      "cacheRead": 0.07
    }
  },
  {
    "id": "moonshotai/kimi-k2.6",
    "name": "Kimi K2.6",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 262144,
    "maxOutputTokens": 235929,
    "temperature": true,
    "interleavedReasoningField": "reasoning_details",
    "releaseDate": "2026-04-21",
    "cost": {
      "input": 0.65,
      "output": 3.41,
      "cacheRead": 0.15
    }
  },
  {
    "id": "moonshotai/kimi-k2.7-code",
    "name": "Kimi K2.7 Code",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 262144,
    "maxOutputTokens": 235929,
    "temperature": true,
    "releaseDate": "2026-06-12",
    "cost": {
      "input": 0.6712,
      "output": 3.35,
      "cacheRead": 0.18
    }
  },
  {
    "id": "moonshotai/kimi-k3",
    "name": "Kimi K3",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": "low",
      "medium": null,
      "high": "high",
      "xhigh": null
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1048576,
    "maxOutputTokens": 943718,
    "temperature": true,
    "releaseDate": "2026-07-16",
    "cost": {
      "input": 3,
      "output": 15,
      "cacheRead": 0.3
    }
  },
  {
    "id": "nex-agi/nex-n2.5-pro",
    "name": "Nex-N2.5-Pro",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": "none",
      "low": null,
      "medium": "medium",
      "high": "high",
      "xhigh": null
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 262144,
    "maxOutputTokens": 235929,
    "temperature": true,
    "releaseDate": "2026-09-08",
    "cost": {
      "input": 0.075,
      "output": 0.25,
      "cacheRead": 0.015
    }
  },
  {
    "id": "nvidia/nemotron-3-nano-30b-a3b",
    "name": "Nemotron 3 Nano 30B A3B",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "input": [
      "text"
    ],
    "contextWindow": 262144,
    "maxOutputTokens": 235929,
    "temperature": true,
    "releaseDate": "2025-12-15",
    "cost": {
      "input": 0.05,
      "output": 0.2,
      "cacheRead": 0.03
    }
  },
  {
    "id": "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
    "name": "Nemotron 3 Nano Omni (free)",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": "none",
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": "xhigh"
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 256000,
    "maxOutputTokens": 65536,
    "temperature": true,
    "releaseDate": "2026-04-28",
    "cost": {
      "input": 0,
      "output": 0
    }
  },
  {
    "id": "nvidia/nemotron-3-super-120b-a12b",
    "name": "Nemotron 3 Super 120B A12B",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": "low",
      "medium": "medium",
      "high": null,
      "xhigh": null
    },
    "input": [
      "text"
    ],
    "contextWindow": 262144,
    "maxOutputTokens": 235929,
    "temperature": true,
    "releaseDate": "2026-03-11",
    "cost": {
      "input": 0.08,
      "output": 0.45
    }
  },
  {
    "id": "nvidia/nemotron-3-super-120b-a12b:free",
    "name": "Nemotron 3 Super (free)",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": "low",
      "medium": "medium",
      "high": null,
      "xhigh": null
    },
    "input": [
      "text"
    ],
    "contextWindow": 262144,
    "maxOutputTokens": 235929,
    "temperature": true,
    "releaseDate": "2026-03-11",
    "cost": {
      "input": 0,
      "output": 0
    }
  },
  {
    "id": "nvidia/nemotron-3-ultra-550b-a55b",
    "name": "Nemotron 3 Ultra 550B A55B",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": null,
      "medium": "medium",
      "high": "high",
      "xhigh": null
    },
    "input": [
      "text"
    ],
    "contextWindow": 262144,
    "maxOutputTokens": 182520,
    "temperature": true,
    "releaseDate": "2026-06-04",
    "cost": {
      "input": 0.6,
      "output": 2.4,
      "cacheRead": 0.12
    }
  },
  {
    "id": "nvidia/nemotron-3-ultra-550b-a55b:free",
    "name": "Nemotron 3 Ultra (free)",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": null,
      "medium": "medium",
      "high": "high",
      "xhigh": null
    },
    "input": [
      "text"
    ],
    "contextWindow": 1000000,
    "maxOutputTokens": 65536,
    "temperature": true,
    "releaseDate": "2026-06-04",
    "cost": {
      "input": 0,
      "output": 0
    }
  },
  {
    "id": "nvidia/nemotron-3.5-lightning",
    "name": "Nemotron 3.5 Lightning 30B A3B",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "input": [
      "text"
    ],
    "contextWindow": 262144,
    "maxOutputTokens": 32768,
    "temperature": true,
    "releaseDate": "2026-08-11",
    "cost": {
      "input": 0.06,
      "output": 0.16,
      "cacheRead": 0.03
    }
  },
  {
    "id": "nvidia/nemotron-3.5-lightning:free",
    "name": "Nemotron 3.5 Lightning (free)",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "input": [
      "text"
    ],
    "contextWindow": 1000000,
    "maxOutputTokens": 65536,
    "temperature": true,
    "releaseDate": "2026-08-11",
    "cost": {
      "input": 0,
      "output": 0
    }
  },
  {
    "id": "openai/gpt-3.5-turbo",
    "name": "GPT-3.5-turbo",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": false,
    "input": [
      "text"
    ],
    "contextWindow": 16385,
    "maxOutputTokens": 4096,
    "temperature": true,
    "releaseDate": "2023-03-01",
    "cost": {
      "input": 0.5,
      "output": 1.5
    }
  },
  {
    "id": "openai/gpt-3.5-turbo-0613",
    "name": "GPT-3.5 Turbo (older v0613)",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": false,
    "input": [
      "text"
    ],
    "contextWindow": 4095,
    "maxOutputTokens": 3685,
    "temperature": true,
    "releaseDate": "2024-01-25",
    "cost": {
      "input": 1,
      "output": 2
    }
  },
  {
    "id": "openai/gpt-3.5-turbo-16k",
    "name": "GPT-3.5 Turbo 16k",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": false,
    "input": [
      "text"
    ],
    "contextWindow": 16385,
    "maxOutputTokens": 4096,
    "temperature": true,
    "releaseDate": "2023-08-28",
    "cost": {
      "input": 3,
      "output": 4
    }
  },
  {
    "id": "openai/gpt-4",
    "name": "GPT-4",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": false,
    "input": [
      "text"
    ],
    "contextWindow": 8191,
    "maxOutputTokens": 4096,
    "temperature": true,
    "releaseDate": "2023-11-06",
    "cost": {
      "input": 30,
      "output": 60
    }
  },
  {
    "id": "openai/gpt-4-turbo",
    "name": "GPT-4 Turbo",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": false,
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 128000,
    "maxOutputTokens": 4096,
    "temperature": true,
    "releaseDate": "2023-11-06",
    "cost": {
      "input": 10,
      "output": 30
    }
  },
  {
    "id": "openai/gpt-4.1",
    "name": "GPT-4.1",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": false,
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1047576,
    "maxOutputTokens": 32768,
    "temperature": true,
    "releaseDate": "2025-04-14",
    "cost": {
      "input": 2,
      "output": 8,
      "cacheRead": 0.5
    }
  },
  {
    "id": "openai/gpt-4.1-mini",
    "name": "GPT-4.1 mini",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": false,
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1047576,
    "maxOutputTokens": 32768,
    "temperature": true,
    "releaseDate": "2025-04-14",
    "cost": {
      "input": 0.4,
      "output": 1.6,
      "cacheRead": 0.1
    }
  },
  {
    "id": "openai/gpt-4.1-nano",
    "name": "GPT-4.1 nano",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": false,
    "input": [
      "image",
      "text"
    ],
    "contextWindow": 1047576,
    "maxOutputTokens": 32768,
    "temperature": true,
    "releaseDate": "2025-04-14",
    "cost": {
      "input": 0.1,
      "output": 0.4,
      "cacheRead": 0.025
    }
  },
  {
    "id": "openai/gpt-4o",
    "name": "GPT-4o",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": false,
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 128000,
    "maxOutputTokens": 16384,
    "temperature": true,
    "releaseDate": "2024-05-13",
    "cost": {
      "input": 2.5,
      "output": 10,
      "cacheRead": 1.25
    }
  },
  {
    "id": "openai/gpt-4o-2024-05-13",
    "name": "GPT-4o (2024-05-13)",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": false,
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 128000,
    "maxOutputTokens": 4096,
    "temperature": true,
    "releaseDate": "2024-05-13",
    "cost": {
      "input": 5,
      "output": 15
    }
  },
  {
    "id": "openai/gpt-4o-2024-08-06",
    "name": "GPT-4o (2024-08-06)",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": false,
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 128000,
    "maxOutputTokens": 16384,
    "temperature": true,
    "releaseDate": "2024-08-06",
    "cost": {
      "input": 2.5,
      "output": 10,
      "cacheRead": 1.25
    }
  },
  {
    "id": "openai/gpt-4o-2024-11-20",
    "name": "GPT-4o (2024-11-20)",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": false,
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 128000,
    "maxOutputTokens": 16384,
    "temperature": true,
    "releaseDate": "2024-11-20",
    "cost": {
      "input": 2.5,
      "output": 10,
      "cacheRead": 1.25
    }
  },
  {
    "id": "openai/gpt-4o-mini",
    "name": "GPT-4o mini",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": false,
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 128000,
    "maxOutputTokens": 16384,
    "temperature": true,
    "releaseDate": "2024-07-18",
    "cost": {
      "input": 0.15,
      "output": 0.6,
      "cacheRead": 0.075
    }
  },
  {
    "id": "openai/gpt-4o-mini-2024-07-18",
    "name": "GPT-4o-mini (2024-07-18)",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": false,
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 128000,
    "maxOutputTokens": 16384,
    "temperature": true,
    "releaseDate": "2024-07-18",
    "cost": {
      "input": 0.15,
      "output": 0.6,
      "cacheRead": 0.075
    }
  },
  {
    "id": "openai/gpt-5",
    "name": "GPT-5",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": null
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 400000,
    "maxInputTokens": 272000,
    "maxOutputTokens": 128000,
    "temperature": false,
    "releaseDate": "2025-08-07",
    "cost": {
      "input": 1.25,
      "output": 10,
      "cacheRead": 0.125
    }
  },
  {
    "id": "openai/gpt-5-mini",
    "name": "GPT-5 Mini",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": null
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 400000,
    "maxInputTokens": 272000,
    "maxOutputTokens": 128000,
    "temperature": false,
    "releaseDate": "2025-08-07",
    "cost": {
      "input": 0.25,
      "output": 2,
      "cacheRead": 0.025
    }
  },
  {
    "id": "openai/gpt-5-nano",
    "name": "GPT-5 Nano",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": null
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 400000,
    "maxInputTokens": 272000,
    "maxOutputTokens": 128000,
    "temperature": false,
    "releaseDate": "2025-08-07",
    "cost": {
      "input": 0.05,
      "output": 0.4,
      "cacheRead": 0.005
    }
  },
  {
    "id": "openai/gpt-5-pro",
    "name": "GPT-5 Pro",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": null,
      "medium": null,
      "high": "high",
      "xhigh": null
    },
    "input": [
      "image",
      "text"
    ],
    "contextWindow": 400000,
    "maxInputTokens": 272000,
    "maxOutputTokens": 128000,
    "temperature": false,
    "releaseDate": "2025-10-06",
    "cost": {
      "input": 15,
      "output": 120
    }
  },
  {
    "id": "openai/gpt-5.1",
    "name": "GPT-5.1",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": "none",
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": null
    },
    "input": [
      "image",
      "text"
    ],
    "contextWindow": 400000,
    "maxInputTokens": 272000,
    "maxOutputTokens": 128000,
    "temperature": false,
    "releaseDate": "2025-11-13",
    "cost": {
      "input": 1.25,
      "output": 10,
      "cacheRead": 0.125
    }
  },
  {
    "id": "openai/gpt-5.1-codex",
    "name": "GPT-5.1 Codex",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": null
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 400000,
    "maxInputTokens": 272000,
    "maxOutputTokens": 128000,
    "temperature": false,
    "releaseDate": "2025-11-13",
    "cost": {
      "input": 1.25,
      "output": 10,
      "cacheRead": 0.13
    }
  },
  {
    "id": "openai/gpt-5.1-codex-max",
    "name": "GPT-5.1 Codex Max",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": "xhigh"
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 400000,
    "maxInputTokens": 272000,
    "maxOutputTokens": 128000,
    "temperature": false,
    "releaseDate": "2025-11-13",
    "cost": {
      "input": 1.25,
      "output": 10,
      "cacheRead": 0.125
    }
  },
  {
    "id": "openai/gpt-5.1-codex-mini",
    "name": "GPT-5.1 Codex mini",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": null
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 400000,
    "maxInputTokens": 272000,
    "maxOutputTokens": 128000,
    "temperature": false,
    "releaseDate": "2025-11-13",
    "cost": {
      "input": 0.25,
      "output": 2,
      "cacheRead": 0.03
    }
  },
  {
    "id": "openai/gpt-5.2",
    "name": "GPT-5.2",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": "none",
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": "xhigh"
    },
    "input": [
      "image",
      "text"
    ],
    "contextWindow": 400000,
    "maxInputTokens": 272000,
    "maxOutputTokens": 128000,
    "temperature": false,
    "releaseDate": "2025-12-11",
    "cost": {
      "input": 1.75,
      "output": 14,
      "cacheRead": 0.175
    }
  },
  {
    "id": "openai/gpt-5.2-chat",
    "name": "GPT-5.2 Chat",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": false,
    "input": [
      "image",
      "text"
    ],
    "contextWindow": 128000,
    "maxOutputTokens": 32000,
    "temperature": false,
    "releaseDate": "2025-12-10",
    "cost": {
      "input": 1.75,
      "output": 14,
      "cacheRead": 0.175
    }
  },
  {
    "id": "openai/gpt-5.2-codex",
    "name": "GPT-5.2 Codex",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": "xhigh"
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 400000,
    "maxInputTokens": 272000,
    "maxOutputTokens": 128000,
    "temperature": false,
    "releaseDate": "2025-12-11",
    "cost": {
      "input": 1.75,
      "output": 14,
      "cacheRead": 0.175
    }
  },
  {
    "id": "openai/gpt-5.2-pro",
    "name": "GPT-5.2 Pro",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": null,
      "medium": "medium",
      "high": "high",
      "xhigh": "xhigh"
    },
    "input": [
      "image",
      "text"
    ],
    "contextWindow": 400000,
    "maxInputTokens": 272000,
    "maxOutputTokens": 128000,
    "temperature": false,
    "releaseDate": "2025-12-11",
    "cost": {
      "input": 21,
      "output": 168
    }
  },
  {
    "id": "openai/gpt-5.3-codex",
    "name": "GPT-5.3 Codex",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": "none",
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": "xhigh"
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 400000,
    "maxInputTokens": 272000,
    "maxOutputTokens": 128000,
    "temperature": false,
    "releaseDate": "2026-02-05",
    "cost": {
      "input": 1.75,
      "output": 14,
      "cacheRead": 0.175
    }
  },
  {
    "id": "openai/gpt-5.4",
    "name": "GPT-5.4",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": "none",
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": "xhigh"
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1050000,
    "maxInputTokens": 922000,
    "maxOutputTokens": 128000,
    "temperature": false,
    "releaseDate": "2026-03-05",
    "cost": {
      "input": 2.5,
      "output": 15,
      "cacheRead": 0.25
    }
  },
  {
    "id": "openai/gpt-5.4-mini",
    "name": "GPT-5.4 mini",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": "none",
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": "xhigh"
    },
    "input": [
      "image",
      "text"
    ],
    "contextWindow": 400000,
    "maxInputTokens": 272000,
    "maxOutputTokens": 128000,
    "temperature": false,
    "releaseDate": "2026-03-17",
    "cost": {
      "input": 0.75,
      "output": 4.5,
      "cacheRead": 0.075
    }
  },
  {
    "id": "openai/gpt-5.4-nano",
    "name": "GPT-5.4 nano",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": "none",
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": "xhigh"
    },
    "input": [
      "image",
      "text"
    ],
    "contextWindow": 400000,
    "maxInputTokens": 272000,
    "maxOutputTokens": 128000,
    "temperature": false,
    "releaseDate": "2026-03-17",
    "cost": {
      "input": 0.2,
      "output": 1.25,
      "cacheRead": 0.02
    }
  },
  {
    "id": "openai/gpt-5.4-pro",
    "name": "GPT-5.4 Pro",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": null,
      "medium": "medium",
      "high": "high",
      "xhigh": "xhigh"
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1050000,
    "maxInputTokens": 922000,
    "maxOutputTokens": 128000,
    "temperature": false,
    "releaseDate": "2026-03-05",
    "cost": {
      "input": 30,
      "output": 180
    }
  },
  {
    "id": "openai/gpt-5.5",
    "name": "GPT-5.5",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": "none",
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": "xhigh"
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1050000,
    "maxInputTokens": 922000,
    "maxOutputTokens": 128000,
    "temperature": false,
    "releaseDate": "2026-04-23",
    "cost": {
      "input": 5,
      "output": 30,
      "cacheRead": 0.5
    }
  },
  {
    "id": "openai/gpt-5.5-pro",
    "name": "GPT-5.5 Pro",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": null,
      "medium": "medium",
      "high": "high",
      "xhigh": "xhigh"
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1050000,
    "maxInputTokens": 922000,
    "maxOutputTokens": 128000,
    "temperature": false,
    "releaseDate": "2026-04-23",
    "cost": {
      "input": 30,
      "output": 180
    }
  },
  {
    "id": "openai/gpt-5.6-luna",
    "name": "GPT-5.6 Luna",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": "none",
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": "xhigh"
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1050000,
    "maxInputTokens": 922000,
    "maxOutputTokens": 128000,
    "temperature": false,
    "releaseDate": "2026-07-09",
    "cost": {
      "input": 0.2,
      "output": 1.2,
      "cacheRead": 0.02,
      "cacheWrite": 0.25
    }
  },
  {
    "id": "openai/gpt-5.6-luna-pro",
    "name": "GPT-5.6 Luna Pro",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": "none",
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": "xhigh"
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1050000,
    "maxInputTokens": 922000,
    "maxOutputTokens": 128000,
    "temperature": false,
    "releaseDate": "2026-07-09",
    "cost": {
      "input": 0.2,
      "output": 1.2,
      "cacheRead": 0.02,
      "cacheWrite": 0.25
    }
  },
  {
    "id": "openai/gpt-5.6-sol",
    "name": "GPT-5.6 Sol",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": "none",
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": "xhigh"
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1050000,
    "maxInputTokens": 922000,
    "maxOutputTokens": 128000,
    "temperature": false,
    "releaseDate": "2026-07-09",
    "cost": {
      "input": 2,
      "output": 10,
      "cacheRead": 0.2,
      "cacheWrite": 2.5
    }
  },
  {
    "id": "openai/gpt-5.6-sol-pro",
    "name": "GPT-5.6 Sol Pro",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": "none",
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": "xhigh"
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1050000,
    "maxInputTokens": 922000,
    "maxOutputTokens": 128000,
    "temperature": false,
    "releaseDate": "2026-07-09",
    "cost": {
      "input": 4,
      "output": 20,
      "cacheRead": 0.4,
      "cacheWrite": 5
    }
  },
  {
    "id": "openai/gpt-5.6-terra",
    "name": "GPT-5.6 Terra",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": "none",
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": "xhigh"
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1050000,
    "maxInputTokens": 922000,
    "maxOutputTokens": 128000,
    "temperature": false,
    "releaseDate": "2026-07-09",
    "cost": {
      "input": 2,
      "output": 12,
      "cacheRead": 0.2,
      "cacheWrite": 2.5
    }
  },
  {
    "id": "openai/gpt-5.6-terra-pro",
    "name": "GPT-5.6 Terra Pro",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": "none",
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": "xhigh"
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1050000,
    "maxInputTokens": 922000,
    "maxOutputTokens": 128000,
    "temperature": false,
    "releaseDate": "2026-07-09",
    "cost": {
      "input": 2,
      "output": 12,
      "cacheRead": 0.2,
      "cacheWrite": 2.5
    }
  },
  {
    "id": "openai/gpt-6-astra",
    "name": "GPT-6 Astra",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": "xhigh"
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1050000,
    "maxInputTokens": 922000,
    "maxOutputTokens": 128000,
    "temperature": false,
    "releaseDate": "2026-09-04",
    "cost": {
      "input": 10,
      "output": 50,
      "cacheRead": 1,
      "cacheWrite": 12.5
    }
  },
  {
    "id": "openai/gpt-6-astra-pro",
    "name": "GPT-6 Astra Pro",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": "xhigh"
    },
    "input": [
      "image",
      "text"
    ],
    "contextWindow": 1050000,
    "maxOutputTokens": 128000,
    "temperature": false,
    "releaseDate": "2026-09-04",
    "cost": {
      "input": 10,
      "output": 50,
      "cacheRead": 1,
      "cacheWrite": 12.5
    }
  },
  {
    "id": "openai/gpt-6-luna",
    "name": "GPT-6 Luna",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": "none",
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": "xhigh"
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1050000,
    "maxInputTokens": 922000,
    "maxOutputTokens": 128000,
    "temperature": false,
    "releaseDate": "2026-09-22",
    "cost": {
      "input": 0.1,
      "output": 0.5,
      "cacheRead": 0.01,
      "cacheWrite": 0.125
    }
  },
  {
    "id": "openai/gpt-6-luna-pro",
    "name": "GPT-6 Luna Pro",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": "none",
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": "xhigh"
    },
    "input": [
      "image",
      "text"
    ],
    "contextWindow": 1050000,
    "maxOutputTokens": 128000,
    "temperature": false,
    "releaseDate": "2026-09-22",
    "cost": {
      "input": 0.1,
      "output": 0.5,
      "cacheRead": 0.01,
      "cacheWrite": 0.125
    }
  },
  {
    "id": "openai/gpt-6-sol",
    "name": "GPT-6 Sol",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": "none",
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": "xhigh"
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1050000,
    "maxInputTokens": 922000,
    "maxOutputTokens": 128000,
    "temperature": false,
    "releaseDate": "2026-09-22",
    "cost": {
      "input": 2,
      "output": 10,
      "cacheRead": 0.2,
      "cacheWrite": 2.5
    }
  },
  {
    "id": "openai/gpt-6-sol-pro",
    "name": "GPT-6 Sol Pro",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": "none",
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": "xhigh"
    },
    "input": [
      "image",
      "text"
    ],
    "contextWindow": 1050000,
    "maxOutputTokens": 128000,
    "temperature": false,
    "releaseDate": "2026-09-22",
    "cost": {
      "input": 2,
      "output": 10,
      "cacheRead": 0.2,
      "cacheWrite": 2.5
    }
  },
  {
    "id": "openai/gpt-6.1-sol",
    "name": "GPT-6.1 Sol",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": "xhigh"
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1050000,
    "maxInputTokens": 922000,
    "maxOutputTokens": 128000,
    "temperature": false,
    "releaseDate": "2026-09-29",
    "cost": {
      "input": 2,
      "output": 10,
      "cacheRead": 0.1,
      "cacheWrite": 2.5
    }
  },
  {
    "id": "openai/gpt-6.1-sol-pro",
    "name": "GPT-6.1 Sol Pro",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": "xhigh"
    },
    "input": [
      "image",
      "text"
    ],
    "contextWindow": 1050000,
    "maxOutputTokens": 128000,
    "temperature": false,
    "releaseDate": "2026-09-29",
    "cost": {
      "input": 2,
      "output": 10,
      "cacheRead": 0.1,
      "cacheWrite": 2.5
    }
  },
  {
    "id": "openai/gpt-audio",
    "name": "GPT Audio",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": false,
    "input": [
      "text"
    ],
    "contextWindow": 128000,
    "maxOutputTokens": 16384,
    "temperature": true,
    "releaseDate": "2026-01-19",
    "cost": {
      "input": 2.5,
      "output": 10
    }
  },
  {
    "id": "openai/gpt-audio-mini",
    "name": "GPT Audio Mini",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": false,
    "input": [
      "text"
    ],
    "contextWindow": 128000,
    "maxOutputTokens": 16384,
    "temperature": true,
    "releaseDate": "2026-01-19",
    "cost": {
      "input": 0.6,
      "output": 2.4
    }
  },
  {
    "id": "openai/gpt-chat-latest",
    "name": "GPT Chat Latest",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": false,
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 400000,
    "maxOutputTokens": 128000,
    "temperature": false,
    "releaseDate": "2026-05-05",
    "cost": {
      "input": 5,
      "output": 30,
      "cacheRead": 0.5
    }
  },
  {
    "id": "openai/gpt-oss-120b",
    "name": "GPT OSS 120B",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": null
    },
    "input": [
      "text"
    ],
    "contextWindow": 131072,
    "maxOutputTokens": 117964,
    "temperature": true,
    "releaseDate": "2025-08-05",
    "cost": {
      "input": 0.037,
      "output": 0.17
    }
  },
  {
    "id": "openai/gpt-oss-20b",
    "name": "GPT OSS 20B",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": null
    },
    "input": [
      "text"
    ],
    "contextWindow": 131072,
    "maxOutputTokens": 32768,
    "temperature": true,
    "releaseDate": "2025-08-05",
    "cost": {
      "input": 0.018,
      "output": 0.09,
      "cacheRead": 0.009
    }
  },
  {
    "id": "openai/gpt-oss-safeguard-20b",
    "name": "GPT OSS Safeguard 20B",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": null
    },
    "input": [
      "text"
    ],
    "contextWindow": 131072,
    "maxOutputTokens": 65536,
    "temperature": true,
    "releaseDate": "2025-10-29",
    "cost": {
      "input": 0.075,
      "output": 0.3,
      "cacheRead": 0.0375
    }
  },
  {
    "id": "openai/o1",
    "name": "o1",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 200000,
    "maxOutputTokens": 100000,
    "temperature": false,
    "releaseDate": "2024-12-05",
    "cost": {
      "input": 15,
      "output": 60,
      "cacheRead": 7.5
    }
  },
  {
    "id": "openai/o3",
    "name": "o3",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 200000,
    "maxOutputTokens": 100000,
    "temperature": false,
    "releaseDate": "2025-04-16",
    "cost": {
      "input": 2,
      "output": 8,
      "cacheRead": 0.5
    }
  },
  {
    "id": "openai/o3-mini",
    "name": "o3-mini",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "input": [
      "text"
    ],
    "contextWindow": 200000,
    "maxOutputTokens": 100000,
    "temperature": false,
    "releaseDate": "2024-12-20",
    "cost": {
      "input": 1.1,
      "output": 4.4,
      "cacheRead": 0.55
    }
  },
  {
    "id": "openai/o3-mini-high",
    "name": "o3 Mini High",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": null,
      "medium": null,
      "high": "high",
      "xhigh": null
    },
    "input": [
      "text"
    ],
    "contextWindow": 200000,
    "maxOutputTokens": 100000,
    "temperature": false,
    "releaseDate": "2025-02-12",
    "cost": {
      "input": 1.1,
      "output": 4.4,
      "cacheRead": 0.55
    }
  },
  {
    "id": "openai/o3-pro",
    "name": "o3-pro",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 200000,
    "maxOutputTokens": 100000,
    "temperature": false,
    "releaseDate": "2025-06-10",
    "cost": {
      "input": 20,
      "output": 80
    }
  },
  {
    "id": "openai/o4-mini",
    "name": "o4-mini",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "input": [
      "image",
      "text"
    ],
    "contextWindow": 200000,
    "maxOutputTokens": 100000,
    "temperature": false,
    "releaseDate": "2025-04-16",
    "cost": {
      "input": 1.1,
      "output": 4.4,
      "cacheRead": 0.275
    }
  },
  {
    "id": "openai/o4-mini-high",
    "name": "o4 Mini High",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": null,
      "medium": null,
      "high": "high",
      "xhigh": null
    },
    "input": [
      "image",
      "text"
    ],
    "contextWindow": 200000,
    "maxOutputTokens": 100000,
    "temperature": false,
    "releaseDate": "2025-04-16",
    "cost": {
      "input": 1.1,
      "output": 4.4,
      "cacheRead": 0.275
    }
  },
  {
    "id": "openrouter/auto",
    "name": "Auto Router",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 2000000,
    "maxOutputTokens": 2000000,
    "temperature": true,
    "releaseDate": "2023-11-08"
  },
  {
    "id": "openrouter/free",
    "name": "Free Models Router",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 200000,
    "maxInputTokens": 200000,
    "maxOutputTokens": 8000,
    "temperature": true,
    "releaseDate": "2026-02-01",
    "cost": {
      "input": 0,
      "output": 0
    }
  },
  {
    "id": "perceptron/perceptron-mk1.5",
    "name": "Perceptron Mk1.5",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": "none",
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": null
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 36864,
    "maxOutputTokens": 8192,
    "temperature": true,
    "releaseDate": "2026-09-25",
    "cost": {
      "input": 0.15,
      "output": 1.5
    }
  },
  {
    "id": "poolside/laguna-s-2.1",
    "name": "Laguna S 2.1",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "input": [
      "text"
    ],
    "contextWindow": 1048576,
    "maxOutputTokens": 131072,
    "temperature": true,
    "releaseDate": "2026-07-21",
    "cost": {
      "input": 0.09,
      "output": 0.18,
      "cacheRead": 0.009
    }
  },
  {
    "id": "poolside/laguna-s-2.1:free",
    "name": "Laguna S 2.1 (free)",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "input": [
      "text"
    ],
    "contextWindow": 262144,
    "maxOutputTokens": 32768,
    "temperature": true,
    "releaseDate": "2026-07-21",
    "cost": {
      "input": 0,
      "output": 0
    }
  },
  {
    "id": "poolside/laguna-xs-2.1",
    "name": "Laguna XS 2.1",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "input": [
      "text"
    ],
    "contextWindow": 262144,
    "maxOutputTokens": 32768,
    "temperature": true,
    "releaseDate": "2026-07-02",
    "cost": {
      "input": 0.06,
      "output": 0.12,
      "cacheRead": 0.03
    }
  },
  {
    "id": "poolside/laguna-xs-2.1:free",
    "name": "Laguna XS 2.1 (free)",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "input": [
      "text"
    ],
    "contextWindow": 262144,
    "maxOutputTokens": 32768,
    "temperature": true,
    "releaseDate": "2026-07-02",
    "cost": {
      "input": 0,
      "output": 0
    }
  },
  {
    "id": "prism-ml/ternary-bonsai-2-27b",
    "name": "Ternary Bonsai 2 27B",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": null,
      "medium": "medium",
      "high": null,
      "xhigh": "xhigh"
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 262144,
    "maxOutputTokens": 32768,
    "temperature": true,
    "releaseDate": "2026-09-18",
    "cost": {
      "input": 0.075,
      "output": 0.5,
      "cacheRead": 0.0375
    }
  },
  {
    "id": "qwen/qwen-2.5-72b-instruct",
    "name": "Qwen2.5 72B Instruct",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": false,
    "input": [
      "text"
    ],
    "contextWindow": 32768,
    "maxOutputTokens": 16384,
    "temperature": true,
    "releaseDate": "2024-09-19",
    "cost": {
      "input": 0.36,
      "output": 0.4
    }
  },
  {
    "id": "qwen/qwen-2.5-7b-instruct",
    "name": "Qwen2.5 7B Instruct",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": false,
    "input": [
      "text"
    ],
    "contextWindow": 32768,
    "maxOutputTokens": 29491,
    "temperature": true,
    "releaseDate": "2024-10-16",
    "cost": {
      "input": 0.1,
      "output": 0.2
    }
  },
  {
    "id": "qwen/qwen-plus",
    "name": "Qwen Plus",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": false,
    "input": [
      "text"
    ],
    "contextWindow": 1000000,
    "maxOutputTokens": 32768,
    "temperature": true,
    "releaseDate": "2024-01-25",
    "cost": {
      "input": 0.26,
      "output": 0.78,
      "cacheRead": 0.052,
      "cacheWrite": 0.325
    }
  },
  {
    "id": "qwen/qwen-plus-2025-07-28",
    "name": "Qwen Plus 0728",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": false,
    "input": [
      "text"
    ],
    "contextWindow": 1000000,
    "maxOutputTokens": 32768,
    "temperature": true,
    "releaseDate": "2025-09-08",
    "cost": {
      "input": 0.26,
      "output": 0.78
    }
  },
  {
    "id": "qwen/qwen3-14b",
    "name": "Qwen3 14B",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "input": [
      "text"
    ],
    "contextWindow": 131072,
    "maxOutputTokens": 16384,
    "temperature": true,
    "releaseDate": "2025-04-28",
    "cost": {
      "input": 0.12,
      "output": 0.24
    }
  },
  {
    "id": "qwen/qwen3-235b-a22b",
    "name": "Qwen3 235B-A22B",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "input": [
      "text"
    ],
    "contextWindow": 131072,
    "maxOutputTokens": 8192,
    "temperature": true,
    "releaseDate": "2025-04",
    "cost": {
      "input": 0.455,
      "output": 1.82
    }
  },
  {
    "id": "qwen/qwen3-235b-a22b-2507",
    "name": "Qwen3 235B A22B Instruct 2507",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": false,
    "input": [
      "text"
    ],
    "contextWindow": 262144,
    "maxOutputTokens": 235929,
    "temperature": true,
    "releaseDate": "2025-07-21",
    "cost": {
      "input": 0.0875,
      "output": 0.35,
      "cacheRead": 0.0175
    }
  },
  {
    "id": "qwen/qwen3-235b-a22b-thinking-2507",
    "name": "Qwen3 235B A22B Thinking 2507",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "input": [
      "text"
    ],
    "contextWindow": 131072,
    "maxOutputTokens": 117964,
    "temperature": true,
    "releaseDate": "2025-07-25",
    "cost": {
      "input": 0.23,
      "output": 2.3
    }
  },
  {
    "id": "qwen/qwen3-30b-a3b",
    "name": "Qwen3 30B A3B",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "input": [
      "text"
    ],
    "contextWindow": 131072,
    "maxOutputTokens": 8192,
    "temperature": true,
    "releaseDate": "2025-04-28",
    "cost": {
      "input": 0.13,
      "output": 0.52
    }
  },
  {
    "id": "qwen/qwen3-30b-a3b-instruct-2507",
    "name": "Qwen3 30B A3B Instruct 2507",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": false,
    "input": [
      "text"
    ],
    "contextWindow": 262144,
    "maxOutputTokens": 32000,
    "temperature": true,
    "releaseDate": "2025-07-29",
    "cost": {
      "input": 0.04815,
      "output": 0.19305
    }
  },
  {
    "id": "qwen/qwen3-30b-a3b-thinking-2507",
    "name": "Qwen3 30B A3B Thinking 2507",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "input": [
      "text"
    ],
    "contextWindow": 81920,
    "maxOutputTokens": 32768,
    "temperature": true,
    "releaseDate": "2025-08-28",
    "cost": {
      "input": 0.2,
      "output": 2.4
    }
  },
  {
    "id": "qwen/qwen3-32b",
    "name": "Qwen3 32B",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "input": [
      "text"
    ],
    "contextWindow": 131072,
    "maxOutputTokens": 16384,
    "temperature": true,
    "releaseDate": "2025-04",
    "cost": {
      "input": 0.08,
      "output": 0.28
    }
  },
  {
    "id": "qwen/qwen3-8b",
    "name": "Qwen3 8B",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "input": [
      "text"
    ],
    "contextWindow": 131072,
    "maxOutputTokens": 8192,
    "temperature": true,
    "releaseDate": "2025-04-28",
    "cost": {
      "input": 0.117,
      "output": 0.455
    }
  },
  {
    "id": "qwen/qwen3-coder",
    "name": "Qwen3 Coder 480B A35B",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": false,
    "input": [
      "text"
    ],
    "contextWindow": 262144,
    "maxOutputTokens": 65536,
    "temperature": true,
    "releaseDate": "2025-07-23",
    "cost": {
      "input": 0.3,
      "output": 1,
      "cacheRead": 0.1
    }
  },
  {
    "id": "qwen/qwen3-coder-30b-a3b-instruct",
    "name": "Qwen3-Coder 30B-A3B Instruct",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": false,
    "input": [
      "text"
    ],
    "contextWindow": 262144,
    "maxOutputTokens": 235929,
    "temperature": true,
    "releaseDate": "2025-04",
    "cost": {
      "input": 0.07,
      "output": 0.28
    }
  },
  {
    "id": "qwen/qwen3-coder-flash",
    "name": "Qwen3 Coder Flash",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": false,
    "input": [
      "text"
    ],
    "contextWindow": 1000000,
    "maxOutputTokens": 65536,
    "temperature": true,
    "releaseDate": "2025-07-28",
    "cost": {
      "input": 0.195,
      "output": 0.975,
      "cacheRead": 0.039,
      "cacheWrite": 0.24375
    }
  },
  {
    "id": "qwen/qwen3-coder-next",
    "name": "Qwen3 Coder Next",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": false,
    "input": [
      "text"
    ],
    "contextWindow": 262144,
    "maxOutputTokens": 235929,
    "temperature": true,
    "releaseDate": "2026-02-03",
    "cost": {
      "input": 0.12,
      "output": 0.8,
      "cacheRead": 0.07
    }
  },
  {
    "id": "qwen/qwen3-coder-plus",
    "name": "Qwen3 Coder Plus",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": false,
    "input": [
      "text"
    ],
    "contextWindow": 1000000,
    "maxOutputTokens": 65536,
    "temperature": true,
    "releaseDate": "2025-07-23",
    "cost": {
      "input": 0.65,
      "output": 3.25,
      "cacheRead": 0.13,
      "cacheWrite": 0.8125
    }
  },
  {
    "id": "qwen/qwen3-max",
    "name": "Qwen3 Max",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": false,
    "input": [
      "text"
    ],
    "contextWindow": 262144,
    "maxOutputTokens": 65536,
    "temperature": true,
    "releaseDate": "2025-09-23",
    "cost": {
      "input": 0.78,
      "output": 3.9,
      "cacheRead": 0.156,
      "cacheWrite": 0.975
    }
  },
  {
    "id": "qwen/qwen3-max-thinking",
    "name": "Qwen3 Max Thinking",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "input": [
      "text"
    ],
    "contextWindow": 262144,
    "maxOutputTokens": 65536,
    "temperature": true,
    "releaseDate": "2026-02-09",
    "cost": {
      "input": 0.78,
      "output": 3.9
    }
  },
  {
    "id": "qwen/qwen3-next-80b-a3b-instruct",
    "name": "Qwen3-Next 80B-A3B Instruct",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": false,
    "input": [
      "text"
    ],
    "contextWindow": 262144,
    "maxOutputTokens": 235929,
    "temperature": true,
    "releaseDate": "2025-09",
    "cost": {
      "input": 0.1,
      "output": 1.1,
      "cacheRead": 0.07
    }
  },
  {
    "id": "qwen/qwen3-next-80b-a3b-thinking",
    "name": "Qwen3-Next 80B-A3B (Thinking)",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "input": [
      "text"
    ],
    "contextWindow": 262144,
    "maxOutputTokens": 235929,
    "temperature": true,
    "releaseDate": "2025-09",
    "cost": {
      "input": 0.15,
      "output": 1.2
    }
  },
  {
    "id": "qwen/qwen3-vl-235b-a22b-instruct",
    "name": "Qwen3 VL 235B A22B Instruct",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": false,
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 262144,
    "maxOutputTokens": 32768,
    "temperature": true,
    "releaseDate": "2025-09-23",
    "cost": {
      "input": 0.21,
      "output": 1.9,
      "cacheRead": 0.1
    }
  },
  {
    "id": "qwen/qwen3-vl-235b-a22b-thinking",
    "name": "Qwen3 VL 235B A22B Thinking",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 131072,
    "maxOutputTokens": 32768,
    "temperature": true,
    "releaseDate": "2025-09-23",
    "cost": {
      "input": 0.4,
      "output": 4
    }
  },
  {
    "id": "qwen/qwen3-vl-30b-a3b-instruct",
    "name": "Qwen3 VL 30B A3B Instruct",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": false,
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 262144,
    "maxOutputTokens": 16384,
    "temperature": true,
    "releaseDate": "2025-10-06",
    "cost": {
      "input": 0.15,
      "output": 0.6
    }
  },
  {
    "id": "qwen/qwen3-vl-30b-a3b-thinking",
    "name": "Qwen3 VL 30B A3B Thinking",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 262144,
    "maxOutputTokens": 32768,
    "temperature": true,
    "releaseDate": "2025-10-06",
    "cost": {
      "input": 0.2,
      "output": 2.4
    }
  },
  {
    "id": "qwen/qwen3-vl-32b-instruct",
    "name": "Qwen3 VL 32B Instruct",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": false,
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 131072,
    "maxOutputTokens": 32768,
    "temperature": true,
    "releaseDate": "2025-10-23",
    "cost": {
      "input": 0.104,
      "output": 0.416
    }
  },
  {
    "id": "qwen/qwen3-vl-8b-instruct",
    "name": "Qwen3 VL 8B Instruct",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": false,
    "input": [
      "image",
      "text"
    ],
    "contextWindow": 262144,
    "maxOutputTokens": 32768,
    "temperature": true,
    "releaseDate": "2025-10-14",
    "cost": {
      "input": 0.117,
      "output": 0.455
    }
  },
  {
    "id": "qwen/qwen3-vl-8b-thinking",
    "name": "Qwen3 VL 8B Thinking",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "input": [
      "image",
      "text"
    ],
    "contextWindow": 131072,
    "maxOutputTokens": 32768,
    "temperature": true,
    "releaseDate": "2025-10-14",
    "cost": {
      "input": 0.18,
      "output": 2.1
    }
  },
  {
    "id": "qwen/qwen3.5-122b-a10b",
    "name": "Qwen3.5 122B-A10B",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 262144,
    "maxOutputTokens": 65536,
    "temperature": true,
    "releaseDate": "2026-02-23",
    "cost": {
      "input": 0.26,
      "output": 2.08
    }
  },
  {
    "id": "qwen/qwen3.5-27b",
    "name": "Qwen3.5 27B",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 262144,
    "maxOutputTokens": 65536,
    "temperature": true,
    "releaseDate": "2026-02-23",
    "cost": {
      "input": 0.195,
      "output": 1.56
    }
  },
  {
    "id": "qwen/qwen3.5-35b-a3b",
    "name": "Qwen3.5 35B-A3B",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 262144,
    "maxOutputTokens": 65536,
    "temperature": true,
    "releaseDate": "2026-02-23",
    "cost": {
      "input": 0.1625,
      "output": 1.3
    }
  },
  {
    "id": "qwen/qwen3.5-397b-a17b",
    "name": "Qwen3.5 397B-A17B",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 262144,
    "maxOutputTokens": 235929,
    "temperature": true,
    "releaseDate": "2026-02-15",
    "cost": {
      "input": 0.55,
      "output": 3.5,
      "cacheRead": 0.225
    }
  },
  {
    "id": "qwen/qwen3.5-9b",
    "name": "Qwen3.5 9B",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 262144,
    "maxOutputTokens": 32768,
    "temperature": true,
    "releaseDate": "2026-02-23",
    "cost": {
      "input": 0.1,
      "output": 0.15
    }
  },
  {
    "id": "qwen/qwen3.5-flash-02-23",
    "name": "Qwen3.5-Flash",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1000000,
    "maxOutputTokens": 65536,
    "temperature": true,
    "releaseDate": "2026-02-25",
    "cost": {
      "input": 0.065,
      "output": 0.26
    }
  },
  {
    "id": "qwen/qwen3.5-plus-02-15",
    "name": "Qwen3.5 Plus 2026-02-15",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1000000,
    "maxOutputTokens": 65536,
    "temperature": true,
    "releaseDate": "2026-02-16",
    "cost": {
      "input": 0.26,
      "output": 1.56
    }
  },
  {
    "id": "qwen/qwen3.5-plus-20260420",
    "name": "Qwen3.5 Plus 2026-04-20",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1000000,
    "maxOutputTokens": 65536,
    "temperature": true,
    "releaseDate": "2026-04-27",
    "cost": {
      "input": 0.3,
      "output": 1.8,
      "cacheWrite": 0.375
    }
  },
  {
    "id": "qwen/qwen3.6-27b",
    "name": "Qwen3.6 27B",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 262144,
    "maxOutputTokens": 81920,
    "temperature": true,
    "releaseDate": "2026-04-22",
    "cost": {
      "input": 0.32,
      "output": 3.2
    }
  },
  {
    "id": "qwen/qwen3.6-35b-a3b",
    "name": "Qwen3.6 35B-A3B",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 262144,
    "maxOutputTokens": 235929,
    "temperature": true,
    "releaseDate": "2026-04-17",
    "cost": {
      "input": 0.15,
      "output": 1,
      "cacheRead": 0.05
    }
  },
  {
    "id": "qwen/qwen3.6-flash",
    "name": "Qwen3.6 Flash",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1000000,
    "maxOutputTokens": 65536,
    "temperature": true,
    "releaseDate": "2026-04-27",
    "cost": {
      "input": 0.1875,
      "output": 1.125,
      "cacheWrite": 0.234375
    }
  },
  {
    "id": "qwen/qwen3.6-max-preview",
    "name": "Qwen3.6 Max Preview",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "input": [
      "text"
    ],
    "contextWindow": 262144,
    "maxOutputTokens": 65536,
    "temperature": true,
    "releaseDate": "2026-04-20",
    "cost": {
      "input": 1.027,
      "output": 6.162,
      "cacheWrite": 1.28375
    }
  },
  {
    "id": "qwen/qwen3.6-plus",
    "name": "Qwen3.6 Plus",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1000000,
    "maxOutputTokens": 65536,
    "temperature": true,
    "releaseDate": "2026-04-02",
    "cost": {
      "input": 0.325,
      "output": 1.95,
      "cacheWrite": 0.40625
    }
  },
  {
    "id": "qwen/qwen3.7-flash",
    "name": "Qwen3.7 Flash",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": "none",
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": "xhigh"
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1000000,
    "maxInputTokens": 991808,
    "maxOutputTokens": 65536,
    "temperature": true,
    "releaseDate": "2026-07-15",
    "cost": {
      "input": 0.03,
      "output": 0.13,
      "cacheRead": 0.006,
      "cacheWrite": 0.038
    }
  },
  {
    "id": "qwen/qwen3.7-max",
    "name": "Qwen3.7 Max",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "input": [
      "text"
    ],
    "contextWindow": 1000000,
    "maxOutputTokens": 131072,
    "temperature": true,
    "releaseDate": "2026-05-21",
    "cost": {
      "input": 1.475,
      "output": 4.425,
      "cacheRead": 0.295,
      "cacheWrite": 1.84375
    }
  },
  {
    "id": "qwen/qwen3.7-plus",
    "name": "Qwen3.7 Plus",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1000000,
    "maxOutputTokens": 131072,
    "temperature": true,
    "releaseDate": "2026-06-02",
    "cost": {
      "input": 0.32,
      "output": 1.28,
      "cacheRead": 0.064,
      "cacheWrite": 0.4
    }
  },
  {
    "id": "qwen/qwen3.8-2.4t-a95b",
    "name": "Qwen3.8 2.4T A95B",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": "low",
      "medium": "medium",
      "high": null,
      "xhigh": "xhigh"
    },
    "input": [
      "text"
    ],
    "contextWindow": 1048576,
    "maxOutputTokens": 131072,
    "temperature": true,
    "releaseDate": "2026-08-12",
    "cost": {
      "input": 2,
      "output": 6,
      "cacheRead": 0.25
    }
  },
  {
    "id": "qwen/qwen3.8-27b",
    "name": "Qwen3.8 27B",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": "low",
      "medium": "medium",
      "high": null,
      "xhigh": "xhigh"
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1000000,
    "maxOutputTokens": 235929,
    "temperature": true,
    "releaseDate": "2026-08-14",
    "cost": {
      "input": 0.0249,
      "output": 4.35,
      "cacheRead": 0.0199
    }
  },
  {
    "id": "qwen/qwen3.8-27b:free",
    "name": "Qwen3.8 27B (free)",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": "low",
      "medium": "medium",
      "high": null,
      "xhigh": "xhigh"
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 262144,
    "maxOutputTokens": 235929,
    "temperature": true,
    "releaseDate": "2026-08-14",
    "cost": {
      "input": 0,
      "output": 0
    }
  },
  {
    "id": "qwen/qwen3.8-flash",
    "name": "Qwen3.8 Flash",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": "none",
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": "xhigh"
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1000000,
    "maxOutputTokens": 131072,
    "temperature": true,
    "releaseDate": "2026-08-26",
    "cost": {
      "input": 0.15,
      "output": 0.47,
      "cacheRead": 0.016,
      "cacheWrite": 0.2
    }
  },
  {
    "id": "qwen/qwen3.8-max-0902",
    "name": "Qwen3.8 Max 0902",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": "xhigh"
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1000000,
    "maxOutputTokens": 131072,
    "temperature": true,
    "releaseDate": "2026-09-02",
    "cost": {
      "input": 2,
      "output": 6,
      "cacheRead": 0.25,
      "cacheWrite": 2.5
    }
  },
  {
    "id": "qwen/qwen3.8-max-prime",
    "name": "Qwen 3.8 Max Prime",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": "xhigh"
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1000000,
    "maxOutputTokens": 131072,
    "temperature": true,
    "releaseDate": "2026-09-23",
    "cost": {
      "input": 4,
      "output": 12,
      "cacheRead": 0.5
    }
  },
  {
    "id": "qwen/qwen3.8-omni-flash",
    "name": "Qwen3.8 Omni Flash",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": "none",
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": "xhigh"
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1000000,
    "maxOutputTokens": 131072,
    "temperature": true,
    "releaseDate": "2026-09-17",
    "cost": {
      "input": 0.15,
      "output": 0.47,
      "cacheRead": 0.016
    }
  },
  {
    "id": "rekaai/reka-edge",
    "name": "Reka Edge",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": false,
    "input": [
      "image",
      "text"
    ],
    "contextWindow": 16384,
    "maxOutputTokens": 14745,
    "temperature": true,
    "releaseDate": "2026-03-20",
    "cost": {
      "input": 0.1,
      "output": 0.1
    }
  },
  {
    "id": "relace/relace-search",
    "name": "Relace Search",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": false,
    "input": [
      "text"
    ],
    "contextWindow": 256000,
    "maxOutputTokens": 128000,
    "temperature": true,
    "releaseDate": "2025-12-08",
    "cost": {
      "input": 1,
      "output": 3
    }
  },
  {
    "id": "sakana/fugu-max",
    "name": "Fugu Max",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": null,
      "medium": null,
      "high": "high",
      "xhigh": "xhigh"
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1000000,
    "maxOutputTokens": 128000,
    "temperature": false,
    "releaseDate": "2026-09-11",
    "cost": {
      "input": 2,
      "output": 6,
      "cacheRead": 0.25
    }
  },
  {
    "id": "sakana/fugu-ultra",
    "name": "Fugu Ultra",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": null,
      "medium": null,
      "high": "high",
      "xhigh": "xhigh"
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1000000,
    "maxOutputTokens": 128000,
    "temperature": false,
    "releaseDate": "2026-06-15",
    "cost": {
      "input": 5,
      "output": 30,
      "cacheRead": 0.5
    }
  },
  {
    "id": "sakana/fugu-ultra-v2",
    "name": "Fugu Ultra v2",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": null,
      "medium": null,
      "high": "high",
      "xhigh": "xhigh"
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1000000,
    "maxOutputTokens": 128000,
    "temperature": false,
    "releaseDate": "2026-09-11",
    "cost": {
      "input": 5,
      "output": 30,
      "cacheRead": 0.5
    }
  },
  {
    "id": "sakana/sakana-namazu",
    "name": "Sakana Namazu",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": "none",
      "low": null,
      "medium": null,
      "high": "high",
      "xhigh": null
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 262144,
    "maxOutputTokens": 65536,
    "temperature": false,
    "releaseDate": "2026-08-03",
    "cost": {
      "input": 0.95,
      "output": 4,
      "cacheRead": 0.15
    }
  },
  {
    "id": "sao10k/l3.1-euryale-70b",
    "name": "Llama 3.1 Euryale 70B v2.2",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": false,
    "input": [
      "text"
    ],
    "contextWindow": 131072,
    "maxOutputTokens": 16384,
    "temperature": true,
    "releaseDate": "2024-08-28",
    "cost": {
      "input": 0.85,
      "output": 0.85
    }
  },
  {
    "id": "stealth/space-bunny-alpha",
    "name": "Space Bunny Alpha",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": "xhigh"
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1000000,
    "maxOutputTokens": 524288,
    "temperature": true,
    "releaseDate": "2026-09-23",
    "cost": {
      "input": 0,
      "output": 0
    }
  },
  {
    "id": "stepfun/step-3.5-flash",
    "name": "Step 3.5 Flash",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "input": [
      "text"
    ],
    "contextWindow": 262144,
    "maxOutputTokens": 65536,
    "temperature": true,
    "releaseDate": "2026-01-29",
    "cost": {
      "input": 0.1,
      "output": 0.3
    }
  },
  {
    "id": "stepfun/step-3.7-flash",
    "name": "Step 3.7 Flash",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": null
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 262144,
    "maxInputTokens": 256000,
    "maxOutputTokens": 230400,
    "temperature": true,
    "releaseDate": "2026-05-29",
    "cost": {
      "input": 0.2,
      "output": 1.15,
      "cacheRead": 0.04
    }
  },
  {
    "id": "tencent/hy3",
    "name": "Hy3",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": "none",
      "low": "low",
      "medium": null,
      "high": "high",
      "xhigh": null
    },
    "input": [
      "text"
    ],
    "contextWindow": 262144,
    "maxInputTokens": 192000,
    "maxOutputTokens": 128000,
    "temperature": true,
    "releaseDate": "2026-07-06",
    "cost": {
      "input": 0.132,
      "output": 0.528,
      "cacheRead": 0.033
    }
  },
  {
    "id": "tencent/hy3-preview",
    "name": "Hy3 preview",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": "none",
      "low": "low",
      "medium": null,
      "high": "high",
      "xhigh": null
    },
    "input": [
      "text"
    ],
    "contextWindow": 262144,
    "maxOutputTokens": 235929,
    "temperature": true,
    "releaseDate": "2026-04-20",
    "cost": {
      "input": 0.18,
      "output": 0.6,
      "cacheRead": 0.06
    }
  },
  {
    "id": "tencent/hy4-preview",
    "name": "Hy4 preview",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": "none",
      "low": "low",
      "medium": null,
      "high": "high",
      "xhigh": null
    },
    "input": [
      "text"
    ],
    "contextWindow": 1048576,
    "maxOutputTokens": 64000,
    "temperature": true,
    "releaseDate": "2026-08-28",
    "cost": {
      "input": 0.834,
      "output": 2.501,
      "cacheRead": 0.042
    }
  },
  {
    "id": "thinkingmachines/inkling",
    "name": "Inkling",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": "none",
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": null
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 524288,
    "maxOutputTokens": 471859,
    "temperature": true,
    "releaseDate": "2026-07-15",
    "cost": {
      "input": 1,
      "output": 4.05,
      "cacheRead": 0.17
    }
  },
  {
    "id": "thinkingmachines/inkling-small",
    "name": "Inkling Small",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": "none",
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": null
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 524288,
    "maxOutputTokens": 262144,
    "temperature": true,
    "releaseDate": "2026-07-30",
    "cost": {
      "input": 0.45,
      "output": 1.2,
      "cacheRead": 0.1
    }
  },
  {
    "id": "thinkingmachines/inkling-small:free",
    "name": "Inkling Small (free)",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": "none",
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": null
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1048576,
    "maxOutputTokens": 262144,
    "temperature": true,
    "releaseDate": "2026-07-30",
    "cost": {
      "input": 0,
      "output": 0
    }
  },
  {
    "id": "thinkingmachines/inkling:free",
    "name": "Inkling (free)",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": "none",
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": null
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1048576,
    "maxOutputTokens": 262144,
    "temperature": true,
    "releaseDate": "2026-07-15",
    "cost": {
      "input": 0,
      "output": 0
    }
  },
  {
    "id": "unbiased/pareto",
    "name": "Pareto",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": false,
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 262144,
    "maxOutputTokens": 131072,
    "temperature": true,
    "releaseDate": "2026-09-17",
    "cost": {
      "input": 2.5,
      "output": 7.5,
      "cacheRead": 0.25
    }
  },
  {
    "id": "upstage/solar-mini4",
    "name": "Solar Mini 4",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": "none",
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": "xhigh"
    },
    "input": [
      "text"
    ],
    "contextWindow": 524288,
    "maxOutputTokens": 131072,
    "temperature": true,
    "releaseDate": "2026-09-23",
    "cost": {
      "input": 0.05,
      "output": 0.2,
      "cacheRead": 0.005
    }
  },
  {
    "id": "upstage/solar-pro-3",
    "name": "Solar Pro 3",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": "none",
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": null
    },
    "input": [
      "text"
    ],
    "contextWindow": 131072,
    "maxOutputTokens": 117964,
    "temperature": true,
    "releaseDate": "2026-01-27",
    "cost": {
      "input": 0.15,
      "output": 0.6,
      "cacheRead": 0.015
    }
  },
  {
    "id": "upstage/solar-pro4",
    "name": "Solar Pro 4",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": "none",
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": "xhigh"
    },
    "input": [
      "text"
    ],
    "contextWindow": 524288,
    "maxOutputTokens": 131072,
    "temperature": true,
    "releaseDate": "2026-08-10",
    "cost": {
      "input": 0.09,
      "output": 0.36,
      "cacheRead": 0.018
    }
  },
  {
    "id": "x-ai/grok-4.20",
    "name": "Grok 4.20",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 2000000,
    "maxOutputTokens": 1800000,
    "temperature": true,
    "releaseDate": "2026-03-31",
    "cost": {
      "input": 1.25,
      "output": 2.5,
      "cacheRead": 0.2
    }
  },
  {
    "id": "x-ai/grok-4.3",
    "name": "Grok 4.3",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": "none",
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": null
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1000000,
    "maxOutputTokens": 900000,
    "temperature": true,
    "releaseDate": "2026-04-17",
    "cost": {
      "input": 1.25,
      "output": 2.5,
      "cacheRead": 0.2
    }
  },
  {
    "id": "x-ai/grok-4.5",
    "name": "Grok 4.5",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": null
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 500000,
    "maxOutputTokens": 450000,
    "temperature": true,
    "releaseDate": "2026-07-08",
    "cost": {
      "input": 2,
      "output": 6,
      "cacheRead": 0.3
    }
  },
  {
    "id": "x-ai/grok-4.6",
    "name": "Grok 4.6",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": "xhigh"
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 500000,
    "maxOutputTokens": 450000,
    "temperature": true,
    "releaseDate": "2026-08-12",
    "cost": {
      "input": 2,
      "output": 6,
      "cacheRead": 0.5
    }
  },
  {
    "id": "x-ai/grok-4.7",
    "name": "Grok 4.7",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": "xhigh"
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 500000,
    "maxOutputTokens": 450000,
    "temperature": true,
    "releaseDate": "2026-09-21",
    "cost": {
      "input": 2,
      "output": 6,
      "cacheRead": 0.5
    }
  },
  {
    "id": "x-ai/grok-build-0.1",
    "name": "Grok Build 0.1",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 256000,
    "maxOutputTokens": 230400,
    "temperature": true,
    "releaseDate": "2026-04-16",
    "cost": {
      "input": 1,
      "output": 2,
      "cacheRead": 0.2
    }
  },
  {
    "id": "xiaomi/mimo-v2.5",
    "name": "MiMo-V2.5",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1050000,
    "maxOutputTokens": 131072,
    "temperature": true,
    "interleavedReasoningField": "reasoning_details",
    "releaseDate": "2026-04-22",
    "cost": {
      "input": 0.14,
      "output": 0.28,
      "cacheRead": 0.0028
    }
  },
  {
    "id": "xiaomi/mimo-v2.5-pro",
    "name": "MiMo-V2.5-Pro",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "input": [
      "text"
    ],
    "contextWindow": 1050000,
    "maxOutputTokens": 131072,
    "temperature": true,
    "interleavedReasoningField": "reasoning_content",
    "releaseDate": "2026-04-22",
    "cost": {
      "input": 0.435,
      "output": 0.87,
      "cacheRead": 0.0036
    }
  },
  {
    "id": "xiaomi/mimo-v2.6-flash",
    "name": "MiMo-V2.6-Flash",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1050000,
    "maxOutputTokens": 131072,
    "temperature": true,
    "releaseDate": "2026-09-22",
    "cost": {
      "input": 0.14,
      "output": 0.28,
      "cacheRead": 0.0028
    }
  },
  {
    "id": "xiaomi/mimo-v2.6-pro",
    "name": "MiMo-V2.6-Pro",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1050000,
    "maxOutputTokens": 131072,
    "temperature": true,
    "releaseDate": "2026-09-22",
    "cost": {
      "input": 0.435,
      "output": 0.87,
      "cacheRead": 0.0036
    }
  },
  {
    "id": "xiaomi/mimo-v2.6-pro-ultraspeed",
    "name": "MiMo-V2.6-Pro-UltraSpeed",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1048576,
    "maxOutputTokens": 131072,
    "temperature": true,
    "releaseDate": "2026-09-21",
    "cost": {
      "input": 4.35,
      "output": 8.7,
      "cacheRead": 0.036
    }
  },
  {
    "id": "z-ai/glm-4.5",
    "name": "GLM-4.5",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "input": [
      "text"
    ],
    "contextWindow": 131072,
    "maxOutputTokens": 98304,
    "temperature": true,
    "releaseDate": "2025-07-28",
    "cost": {
      "input": 0.6,
      "output": 2.2,
      "cacheRead": 0.11
    }
  },
  {
    "id": "z-ai/glm-4.5-air",
    "name": "GLM-4.5-Air",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "input": [
      "text"
    ],
    "contextWindow": 131072,
    "maxOutputTokens": 98304,
    "temperature": true,
    "releaseDate": "2025-07-28",
    "cost": {
      "input": 0.13,
      "output": 0.85,
      "cacheRead": 0.025
    }
  },
  {
    "id": "z-ai/glm-4.5v",
    "name": "GLM-4.5V",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 65536,
    "maxOutputTokens": 16384,
    "temperature": true,
    "releaseDate": "2025-08-11",
    "cost": {
      "input": 0.6,
      "output": 1.8,
      "cacheRead": 0.11
    }
  },
  {
    "id": "z-ai/glm-4.6",
    "name": "GLM-4.6",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "input": [
      "text"
    ],
    "contextWindow": 204800,
    "maxOutputTokens": 16384,
    "temperature": true,
    "releaseDate": "2025-09-30",
    "cost": {
      "input": 0.43,
      "output": 1.75,
      "cacheRead": 0.08
    }
  },
  {
    "id": "z-ai/glm-4.6v",
    "name": "GLM-4.6V",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 131072,
    "maxOutputTokens": 32768,
    "temperature": true,
    "releaseDate": "2025-12-08",
    "cost": {
      "input": 0.3,
      "output": 0.9,
      "cacheRead": 0.055
    }
  },
  {
    "id": "z-ai/glm-4.7",
    "name": "GLM-4.7",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "input": [
      "text"
    ],
    "contextWindow": 204800,
    "maxOutputTokens": 131072,
    "temperature": true,
    "interleavedReasoningField": "reasoning_details",
    "releaseDate": "2025-12-22",
    "cost": {
      "input": 0.6,
      "output": 2.2,
      "cacheRead": 0.11
    }
  },
  {
    "id": "z-ai/glm-4.7-flash",
    "name": "GLM-4.7-Flash",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "input": [
      "text"
    ],
    "contextWindow": 200000,
    "maxOutputTokens": 117964,
    "temperature": true,
    "interleavedReasoningField": "reasoning_details",
    "releaseDate": "2026-01-19",
    "cost": {
      "input": 0.0605,
      "output": 0.4
    }
  },
  {
    "id": "z-ai/glm-5",
    "name": "GLM-5",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "input": [
      "text"
    ],
    "contextWindow": 204800,
    "maxOutputTokens": 128000,
    "temperature": true,
    "interleavedReasoningField": "reasoning_content",
    "releaseDate": "2026-02-12",
    "cost": {
      "input": 0.6,
      "output": 1.92,
      "cacheRead": 0.12
    }
  },
  {
    "id": "z-ai/glm-5-turbo",
    "name": "GLM-5-Turbo",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "input": [
      "text"
    ],
    "contextWindow": 202752,
    "maxOutputTokens": 131072,
    "temperature": true,
    "interleavedReasoningField": "reasoning_content",
    "releaseDate": "2026-03-16",
    "cost": {
      "input": 1.2,
      "output": 4,
      "cacheRead": 0.24
    }
  },
  {
    "id": "z-ai/glm-5.1",
    "name": "GLM-5.1",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "input": [
      "text"
    ],
    "contextWindow": 204800,
    "maxOutputTokens": 131072,
    "temperature": true,
    "interleavedReasoningField": "reasoning_content",
    "releaseDate": "2026-04-07",
    "cost": {
      "input": 1.4,
      "output": 4.4,
      "cacheRead": 0.26
    }
  },
  {
    "id": "z-ai/glm-5.2",
    "name": "GLM-5.2",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": null,
      "medium": null,
      "high": "high",
      "xhigh": "xhigh"
    },
    "input": [
      "text"
    ],
    "contextWindow": 1048576,
    "maxOutputTokens": 943718,
    "temperature": true,
    "interleavedReasoningField": "reasoning_content",
    "releaseDate": "2026-06-13",
    "cost": {
      "input": 0.41,
      "output": 3.99,
      "cacheRead": 0.26
    }
  },
  {
    "id": "z-ai/glm-5.3",
    "name": "GLM-5.3",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": "low",
      "medium": null,
      "high": "high",
      "xhigh": null
    },
    "input": [
      "text"
    ],
    "contextWindow": 1048576,
    "maxOutputTokens": 943717,
    "temperature": true,
    "releaseDate": "2026-08-14",
    "cost": {
      "input": 1.4,
      "output": 4.4,
      "cacheRead": 0.26
    }
  },
  {
    "id": "z-ai/glm-5.3-flash",
    "name": "GLM-5.3-Flash",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": "low",
      "medium": null,
      "high": "high",
      "xhigh": null
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1048576,
    "maxOutputTokens": 943717,
    "temperature": true,
    "releaseDate": "2026-08-26",
    "cost": {
      "input": 0.15,
      "output": 0.5,
      "cacheRead": 0.03
    }
  },
  {
    "id": "z-ai/glm-5.3-flashx",
    "name": "GLM 5.3 FlashX",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": "low",
      "medium": null,
      "high": "high",
      "xhigh": null
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1048576,
    "maxOutputTokens": 131072,
    "temperature": true,
    "releaseDate": "2026-09-18",
    "cost": {
      "input": 0.37,
      "output": 1.25,
      "cacheRead": 0.09
    }
  },
  {
    "id": "z-ai/glm-5.3-prime",
    "name": "GLM 5.3 Prime",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": "low",
      "medium": null,
      "high": "high",
      "xhigh": null
    },
    "input": [
      "text"
    ],
    "contextWindow": 1000000,
    "maxOutputTokens": 131072,
    "temperature": true,
    "releaseDate": "2026-09-23",
    "cost": {
      "input": 2.8,
      "output": 8.8,
      "cacheRead": 0.56
    }
  },
  {
    "id": "z-ai/glm-5v-turbo",
    "name": "GLM-5V-Turbo",
    "provider": "openrouter",
    "protocol": "anthropic-messages",
    "baseUrl": "https://openrouter.ai/api/v1",
    "reasoning": true,
    "input": [
      "image",
      "text"
    ],
    "contextWindow": 202752,
    "maxOutputTokens": 131072,
    "temperature": true,
    "releaseDate": "2026-04-01",
    "cost": {
      "input": 1.2,
      "output": 4,
      "cacheRead": 0.24
    }
  },
  {
    "id": "grok-4.20-0309-non-reasoning",
    "name": "Grok 4.20 (Non-Reasoning)",
    "provider": "xai",
    "protocol": "openai-completions",
    "baseUrl": "https://api.openai.com/v1",
    "reasoning": false,
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1000000,
    "maxOutputTokens": 30000,
    "temperature": true,
    "releaseDate": "2026-03-09",
    "cost": {
      "input": 1.25,
      "output": 2.5,
      "cacheRead": 0.2
    }
  },
  {
    "id": "grok-4.20-0309-reasoning",
    "name": "Grok 4.20 (Reasoning)",
    "provider": "xai",
    "protocol": "openai-completions",
    "baseUrl": "https://api.openai.com/v1",
    "reasoning": true,
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1000000,
    "maxOutputTokens": 30000,
    "temperature": true,
    "releaseDate": "2026-03-09",
    "cost": {
      "input": 1.25,
      "output": 2.5,
      "cacheRead": 0.2
    }
  },
  {
    "id": "grok-4.3",
    "name": "Grok 4.3",
    "provider": "xai",
    "protocol": "openai-completions",
    "baseUrl": "https://api.openai.com/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": "none",
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": null
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1000000,
    "maxOutputTokens": 30000,
    "temperature": true,
    "releaseDate": "2026-04-17",
    "cost": {
      "input": 1.25,
      "output": 2.5,
      "cacheRead": 0.2
    }
  },
  {
    "id": "grok-4.5",
    "name": "Grok 4.5",
    "provider": "xai",
    "protocol": "openai-completions",
    "baseUrl": "https://api.openai.com/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": null
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 500000,
    "maxOutputTokens": 500000,
    "temperature": true,
    "releaseDate": "2026-07-08",
    "cost": {
      "input": 2,
      "output": 6,
      "cacheRead": 0.3
    }
  },
  {
    "id": "grok-4.6",
    "name": "Grok 4.6",
    "provider": "xai",
    "protocol": "openai-completions",
    "baseUrl": "https://api.openai.com/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": "xhigh"
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 500000,
    "maxOutputTokens": 500000,
    "temperature": true,
    "releaseDate": "2026-08-12",
    "cost": {
      "input": 2,
      "output": 6,
      "cacheRead": 0.5
    }
  },
  {
    "id": "grok-4.7",
    "name": "Grok 4.7",
    "provider": "xai",
    "protocol": "openai-completions",
    "baseUrl": "https://api.openai.com/v1",
    "reasoning": true,
    "thinkingLevelMap": {
      "none": null,
      "low": "low",
      "medium": "medium",
      "high": "high",
      "xhigh": "xhigh"
    },
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 500000,
    "maxOutputTokens": 500000,
    "temperature": true,
    "releaseDate": "2026-09-21",
    "cost": {
      "input": 2,
      "output": 6,
      "cacheRead": 0.5
    }
  },
  {
    "id": "grok-build-0.1",
    "name": "Grok Build 0.1",
    "provider": "xai",
    "protocol": "openai-completions",
    "baseUrl": "https://api.openai.com/v1",
    "reasoning": true,
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 256000,
    "maxOutputTokens": 256000,
    "temperature": true,
    "releaseDate": "2026-04-16",
    "cost": {
      "input": 1,
      "output": 2,
      "cacheRead": 0.2
    }
  }
];
