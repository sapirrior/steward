/**
 * Constants and operational defaults for @steward/sdk.
 */

/** Default maximum steps for an agent execution turn */
export const DEFAULT_MAX_STEPS = 50;

/** Default Ollama local API base URL */
export const DEFAULT_OLLAMA_BASE_URL = 'http://localhost:11434/v1';

/** Default OpenRouter API base URL */
export const DEFAULT_OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

/** Default GitHub Copilot API base URL */
export const DEFAULT_COPILOT_BASE_URL = 'https://api.githubcopilot.com';

/** Default HTTP request headers for GitHub Copilot */
export const DEFAULT_COPILOT_HEADERS: Readonly<Record<string, string>> = Object.freeze({
  'Editor-Version': 'vscode/1.96.2',
  'Editor-Plugin-Version': 'copilot-chat/0.24.1',
  'User-Agent': 'GitHubCopilotChat/0.24.1',
  Accept: 'application/json',
});

/** Default HTTP request headers for OpenRouter */
export const DEFAULT_OPENROUTER_HEADERS: Readonly<Record<string, string>> = Object.freeze({
  'HTTP-Referer': 'https://github.com/sapirrior/steward',
  'X-Title': 'Steward',
});

/** Default max retry attempts for transient request failures */
export const DEFAULT_MAX_RETRIES = 2;

/** Default stream-level retries */
export const DEFAULT_STREAM_RETRIES = 0;
