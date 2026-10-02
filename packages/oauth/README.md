# @steward/oauth

Zero-dependency OAuth credential store and authentication flows for Steward.

`@steward/oauth` manages persistent authentication tokens, automatic OAuth token refresh cycles, PKCE browser authorization flows, and GitHub Copilot Device Authorization Grants with **zero external dependencies**.

---

## Architecture & Boundaries

- **Zero Steward Dependencies:** `@steward/oauth` imports nothing from `@steward/ai`, `@steward/agent`, or `@steward/cli`.
- **Sole Consumer:** Only `@steward/cli` imports `@steward/oauth` directly.
- **Secure File Storage:** Manages credentials at `~/.steward/auth.json` with owner-only file permissions (`0o600`), atomic rename writes, and concurrency locking.
- **Secret Redaction:** Token secrets are strictly redacted from error messages and logs.

---

## Package API Reference

Documentation organized according to the **Sonnet Convention** (*File $\to$ Export $\to$ Type $\to$ Description & Constraints*):

### 1. `src/index.ts` & `src/types.ts`

| Export | Type | Description & Constraints |
| :--- | :--- | :--- |
| `setupAuth` | `() => Promise<void>` | Initializes `~/.steward` directory with `0o700` permissions. Safe and idempotent. |
| `getToken` | `(provider: string) => Promise<string \| null>` | Returns a valid, unexpired access token for the provider. Transparently refreshes expired tokens. |
| `login` | `(provider: string, options?: LoginOptions) => Promise<LoginResult>` | Initiates interactive OAuth login (browser PKCE or device grant). |
| `logout` | `(provider: string) => Promise<boolean>` | Removes stored credentials for the specified provider. |
| `logoutAll` | `() => Promise<number>` | Removes stored credentials across all providers. |
| `authStatus` | `() => Promise<AuthStatus>` | Returns safe provider authentication status map without leaking secret tokens. |
| `launch` | `(url: string) => Promise<void>` | Launches authentication URLs in the default system web browser. |
| `OAuthProviderId` | `type` | Supported OAuth provider identifier string union. |
| `LoginOptions` | `interface` | Options for interactive authentication callbacks (`onAuthUrl`, `onDeviceCode`, `signal`). |
| `LoginResult` | `interface` | Outcome descriptor for login operations (`provider`, `success`, `account`, `error`). |
| `AuthStatus` | `type` | Map of provider IDs to `ProviderAuthStatus` records. |
| `TokenRecord` | `interface` | Internal storage representation of OAuth and API-key credentials. |

### 2. `src/store.ts`


| Export | Type | Description & Constraints |
| :--- | :--- | :--- |
| `readAuthStore` | `() => Promise<AuthStoreData>` | Reads entire auth store from `~/.steward/auth.json`. Returns empty object if missing. |
| `writeAuthStore` | `(data: AuthStoreData) => Promise<void>` | Writes auth data atomically with `0o600` mode via temp file and rename. |
| `mutateAuthStore` | `(mutator: (data: AuthStoreData) => Promise<...> \| ...) => Promise<T>` | Performs synchronized read-modify-write mutation protected by process lock queue and file lock. |
| `getStoredToken` | `(provider: string) => Promise<TokenRecord \| null>` | Retrieves stored token record for provider. |
| `saveStoredToken` | `(provider: string, token: TokenRecord) => Promise<void>` | Persists token record for provider atomically. |
| `deleteStoredToken` | `(provider: string) => Promise<boolean>` | Deletes token record for provider atomically. |
| `clearStoredTokens` | `() => Promise<number>` | Deletes all stored tokens across all providers atomically. |
| `ensureAuthDir` | `() => Promise<string>` | Ensures auth storage directory exists with `0o700` mode. |
| `getAuthFilePath` | `() => string` | Resolves canonical path to `auth.json`. |
| `AuthStorageError` | `class extends Error` | Structured domain error for storage failures without token exposure. |

### 3. `src/refresh.ts`

| Export | Type | Description & Constraints |
| :--- | :--- | :--- |
| `getOrRefreshToken` | `(provider: string, signal?: AbortSignal) => Promise<string \| null>` | Returns valid token; transparently refreshes if within 5-min buffer and coalesces concurrent calls. |
| `registerTokenRefresher` | `(provider: string, refresher: ProviderRefresher) => void` | Registers provider-specific token refresh implementation. |
| `isTokenExpiring` | `(token: TokenRecord) => boolean` | Checks if token expires within the proactive 5-minute buffer. |
| `EXPIRY_BUFFER_MS` | `number` | Proactive expiration threshold in milliseconds (`300,000` ms / 5 min). |

### 4. `src/providers/`

| File | Export | Type | Description & Constraints |
| :--- | :--- | :--- | :--- |
| `anthropic.ts` | `loginAnthropic` / `refreshAnthropic` | Functions | PKCE OAuth login and proactive token refresh via `claude.ai` and `platform.claude.com`. |
| `openrouter.ts` | `loginOpenRouter` / `refreshOpenRouter` | Functions | PKCE OAuth login minting permanent API keys via `openrouter.ai`. |
| `github-copilot.ts` | `loginGitHubCopilot` / `refreshGitHubCopilot` | Functions | RFC 8628 Device Code flow and session token management for GitHub Copilot. |
| `index.ts` | `executeProviderLogin` | Function | Dispatches provider login handler and stores resulting credentials. |

### 5. `src/utils/`

| File | Export | Type | Description & Constraints |
| :--- | :--- | :--- | :--- |
| `pkce.ts` | `generatePKCE` | Function | Generates standard cryptographic PKCE verifier and S256 challenge. |
| `callback-server.ts` | `startOAuthCallbackServer` | Function | Runs local loopback HTTP server with formatted status responses and cancellation support. |
| `device-poller.ts` | `pollOAuthDeviceCodeFlow` | Function | Robust RFC 8628 interval-aware polling helper with `slow_down` throttling. |



