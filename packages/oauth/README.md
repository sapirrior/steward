# Package Name (`@steward/oauth`)

Zero-dependency, cross-platform OAuth credential store and authentication flows (PKCE & Device Code) for Steward.

---

## 1. Overview & Architecture

### High-Level Mental Model
`@steward/oauth` manages the complete credential lifecycle for AI providers in Steward. It delivers:
- **Zero-Dependency Flows:** PKCE Authorization Code flow (with ephemeral local loopback HTTP servers) and Device Code authorization flows.
- **Secure File Storage:** Atomic write operations, cross-process lock files, and owner-only POSIX permissions (`0o700` directory, `0o600` file) stored at `~/.steward/auth.json`.
- **Proactive Token Refresh:** Transparent token refreshing with a 5-minute pre-expiration buffer and concurrent request deduplication.
- **Safe Status Introspection:** Redacted authentication status reporting guaranteed never to expose raw secrets or access tokens.
- **Cross-Platform Browser Launcher:** Automatic browser launching supporting macOS (`open`), Linux (`xdg-open`), Windows (`cmd.exe /c start`), and Android Termux (`termux-open-url`).

### Architecture & Data Flow (ASCII Diagram)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            @steward/oauth Engine                            │
└─────────────────────────────────────────────────────────────────────────────┘

                                 CLI / App
                                     │
           ┌─────────────────────────┼─────────────────────────┐
           ▼                         ▼                         ▼
   login("openrouter")    login("github-copilot")     getToken("github-copilot")
           │                         │                         │
           ▼                         ▼                         ▼
 ┌───────────────────┐     ┌───────────────────┐     ┌───────────────────┐
 │ PKCE Auth Flow    │     │ Device Code Flow  │     │ Proactive Refresh │
 │ 1. generatePKCE() │     │ 1. Request Code   │     │ 1. Check Expiry   │
 │ 2. Ephemeral HTTP │     │ 2. Display Prompt │     │ 2. In-Flight Lock │
 │ 3. launchBrowser()│     │ 3. Device Poller  │     │ 3. Exchange Token │
 │ 4. Token Exchange │     │ 4. Copilot Token  │     │ 4. Update Store   │
 └─────────┬─────────┘     └─────────┬─────────┘     └─────────┬─────────┘
           │                         │                         │
           └─────────────────────────┼─────────────────────────┘
                                     │
                                     ▼
                       ┌───────────────────────────┐
                       │   Dual-Layer Store Lock   │
                       │   - In-Process Queue      │
                       │   - File Lock (.lock)     │
                       └─────────────┬─────────────┘
                                     │
                                     ▼
                       ┌───────────────────────────┐
                       │ Atomic JSON Store Writer  │
                       │ - Temp File (auth.tmp.*)  │
                       │ - chmod 0o600 / 0o700     │
                       │ - fsync + Atomic Rename   │
                       └─────────────┬─────────────┘
                                     │
                                     ▼
                        ~/.steward/auth.json (0o600)
```

### Key Technical Invariants

1. **Zero External Runtime Dependencies:** Implemented purely in TypeScript using Node.js/Bun built-ins (`node:crypto`, `node:fs`, `node:http`, `node:child_process`, `node:os`, `node:path`).
2. **Never Commit or Log Secrets:** Errors and status representations (`AuthStatus`, `AuthStorageError`, `OAuthError`) explicitly strip or omit credential payloads.
3. **Dual-Layer Concurrency Locking:** File mutations are protected both in-process (via a Promise queue) and cross-process (via exclusive `wx` creation of `~/.steward/auth.json.lock`).
4. **Crash-Safe Atomic File Writes:** Writes are serialized to temporary files (`auth.tmp.<timestamp>.<randomHex>`), flushed with `fsync`, permission-locked (`0o600`), and atomically renamed over the target file.
5. **In-Flight Refresh Coalescing:** Multiple concurrent calls to `getToken()` for the same expiring provider coalesce into a single HTTP token refresh request.
6. **Proactive Refresh Window:** Tokens expiring within 5 minutes (`EXPIRY_BUFFER_MS = 300_000`) trigger proactive background refreshes before downstream API calls fail.

---

## 2. Quick Start & Basic Usage

```typescript
import { setupAuth, login, getToken, authStatus, logout } from '@steward/oauth';

// 1. Initialize auth storage directory on application startup
await setupAuth();

// 2. Perform interactive login (e.g. OpenRouter via PKCE or GitHub Copilot via Device Code)
const result = await login('openrouter', {
  onAuthUrl: (url) => console.log(`Please authorize at: ${url}`),
});

if (result.success) {
  console.log(`Successfully signed in: ${result.account ?? result.provider}`);
}

// 3. Retrieve valid, auto-refreshed access token for API requests
const token = await getToken('openrouter');
if (token) {
  console.log('Token acquired (ready for authorization headers).');
}

// 4. Inspect current authentication status safely
const status = await authStatus();
console.log('GitHub Copilot logged in?', status['github-copilot']?.loggedIn);

// 5. Logout
await logout('openrouter');
```

---

## 3. Core Concepts & Mental Model

### Authentication Providers & Strategies

| Provider ID | Flow Type | Endpoint / Protocol | Expiration / Refresh |
| :--- | :--- | :--- | :--- |
| `'openrouter'` | **PKCE Authorization Code** | `https://openrouter.ai/auth` with dynamic local HTTP callback | Permanent API Key (no refresh required) |
| `'github-copilot'` | **Device Code Flow** | `https://github.com/login/device/code` & `api.github.com/copilot_internal/v2/token` | 30-minute session token refreshed via GitHub OAuth token |

### Storage & Security Architecture
- **Location:** Stored by default at `~/.steward/auth.json` (or overridden by environment variables `STEWARD_AUTH_FILE` or `STEWARD_AUTH_DIR`).
- **Permissions:** Directory mode `0o700` (`rwx------`), file mode `0o600` (`rw-------`).
- **Atomic Operations:** Write mutations use temp-file creation followed by `fsync` and atomic `rename`. On Windows systems, transient `EPERM`/`EBUSY` locks are retried with exponential backoff.

### Transparent Token Refreshing
When `getToken(provider)` is called:
1. If the token record has no expiration timestamp or `expiresAt > Date.now() + 5 minutes`, the stored `access` token is returned immediately.
2. If the token is within the 5-minute buffer, the registered `ProviderRefresher` is called.
3. If refresh fails with a permanent error (`400`, `401`, `403`, `INVALID_GRANT`, `TOKEN_REVOKED`), the stored credential is automatically deleted.
4. If refresh fails due to a transient network drop and the existing token has not strictly expired, the existing token is returned as a fallback.

---

## 4. API & Contract Reference

### Primary Types (`src/types.ts`)

#### `OAuthProviderId`
```typescript
export type OAuthProviderId = 'openrouter' | 'github-copilot' | (string & {});
```

#### `DeviceCodePrompt`
Delivered to `onDeviceCode` callbacks during device code flows.
```typescript
export interface DeviceCodePrompt {
  userCode: string;
  verificationUri: string;
  expiresIn: number;
  interval: number;
}
```

#### `LoginOptions`
```typescript
export interface LoginOptions {
  onAuthUrl?: (url: string) => void;
  onDeviceCode?: (info: DeviceCodePrompt) => void;
  signal?: AbortSignal;
}
```

#### `LoginResult`
```typescript
export interface LoginResult {
  provider: string;
  success: boolean;
  account?: string;
  error?: string;
}
```

#### `ProviderAuthStatus` & `AuthStatus`
```typescript
export interface ProviderAuthStatus {
  loggedIn: boolean;
  type?: 'oauth' | 'api-key';
  expiresAt?: number;
  account?: string;
}

export type AuthStatus = Record<string, ProviderAuthStatus>;
```

#### `TokenRecord`
```typescript
export interface TokenRecord {
  type: 'oauth' | 'api-key';
  access: string;
  refresh?: string;
  expires?: number;
  account?: string;
  enterpriseUrl?: string;
}
```

#### `OAuthError`
Structured domain error for authentication failures.
```typescript
export class OAuthError extends Error {
  readonly code: 'oauth' | 'aborted' | 'timeout' | 'cancelled' | 'unsupported_provider';
  readonly provider?: string;
}
```

---

## 5. Functions & Utilities Reference

### Top-Level Exports (`src/index.ts`)

#### `setupAuth(): Promise<void>`
Initializes the auth directory with `0o700` permissions. Idempotent and safe to run on application startup.

#### `login(provider: string, options?: LoginOptions): Promise<LoginResult>`
Executes the interactive OAuth login flow for the specified provider and persists valid credentials.

#### `getToken(provider: string, signal?: AbortSignal): Promise<string | null>`
Retrieves a valid, unexpired access token for the provider, executing proactive refresh if approaching expiration.

#### `logout(provider: string): Promise<boolean>`
Removes stored credentials for the specified provider. Returns `true` if credentials existed and were deleted.

#### `logoutAll(): Promise<number>`
Clears all credentials across all providers. Returns the number of removed provider records.

#### `authStatus(): Promise<AuthStatus>`
Returns public status information (logged in state, expiration timestamp, account email) for all providers without exposing secrets.

#### `launch(url: string): Promise<void>`
Cross-platform browser launcher opening the URL in the system browser.

#### `registerTokenRefresher(provider: string, refresher: ProviderRefresher): void`
Registers a custom token refresh handler for an OAuth provider.

### Store Functions (`src/store.ts`)

| Function | Signature | Description |
| :--- | :--- | :--- |
| `getAuthFilePath` | `() => string` | Resolves canonical path to `auth.json`. |
| `readAuthStore` | `() => Promise<AuthStoreData>` | Reads and parses JSON store. |
| `writeAuthStore` | `(data: AuthStoreData) => Promise<void>` | Writes JSON store atomically. |
| `mutateAuthStore` | `<T>(mutator: (data) => ...) => Promise<T>` | Thread/process-safe read-modify-write mutation. |
| `getStoredToken` | `(provider: string) => Promise<TokenRecord \| null>` | Gets raw token record for provider. |
| `saveStoredToken` | `(provider: string, token: TokenRecord) => Promise<void>` | Saves token record for provider. |
| `deleteStoredToken`| `(provider: string) => Promise<boolean>` | Deletes token record for provider. |
| `clearStoredTokens` | `() => Promise<number>` | Clears all stored tokens. |

### Utilities

- **`generatePKCE()` (`src/utils/pkce.ts`):** Returns `{ verifier, challenge }` implementing RFC 7636 SHA-256 code challenge.
- **`startOAuthCallbackServer(options)` (`src/utils/callback-server.ts`):** Starts a temporary loopback HTTP server to receive OAuth redirect callbacks and serve styled feedback pages.
- **`pollOAuthDeviceCodeFlow(options)` (`src/utils/device-poller.ts`):** Polls device authorization endpoints with interval adjustments and abort signal handling.
- **`launchBrowser(url)` (`src/utils/browser.ts`):** Spawns system browser processes across Windows, macOS, Linux, and Android Termux.

---

## 6. Advanced Patterns & Practical Guides

### Handling Custom Device Code UI
```typescript
import { login } from '@steward/oauth';

const result = await login('github-copilot', {
  onDeviceCode: ({ userCode, verificationUri }) => {
    console.log(`\nOpen: ${verificationUri}`);
    console.log(`Enter Code: ${userCode}\n`);
  },
  signal: abortController.signal,
});
```

### Custom Storage Location
Override default storage path using environment variables:
```bash
export STEWARD_AUTH_FILE="/custom/secure/path/auth.json"
# or
export STEWARD_AUTH_DIR="/custom/secure/directory"
```

---

## 7. Real-World Gotchas, Tips & Edge Cases

1. **Headless & SSH Environments:**
   In remote SSH or headless servers where no display manager exists, `launchBrowser()` fails silently without throwing errors. The `onAuthUrl` and `onDeviceCode` callbacks provide the URL for manual copy-pasting.
2. **Ephemeral Ports for OpenRouter:**
   OpenRouter's OAuth implementation supports dynamic callback ports (`port: 0`), avoiding port collision errors when running multiple development instances.
3. **Windows File Locking Retries:**
   On Windows, rapid file replacement can trigger `EPERM` or `EBUSY`. `writeAuthStore` retries up to 5 times with exponential backoff before failing.
4. **Transient Network Drop Resilience:**
   If token refresh fails due to a network error but the currently cached token is not yet past its hard expiration date, `getOrRefreshToken` falls back to the existing token.

---

## 8. Directory & Module Map

```
packages/oauth/
├── src/
│   ├── index.ts                # Package entrypoint & public API exports
│   ├── types.ts                # Domain contracts (TokenRecord, LoginOptions, AuthStatus)
│   ├── errors.ts               # OAuthError domain error class
│   ├── store.ts                # Atomic JSON storage, file locking, permissions
│   ├── refresh.ts              # Proactive token refresh & in-flight deduplication
│   ├── status.ts               # Safe public auth status reporting
│   ├── providers/
│   │   ├── index.ts            # Provider registry & dispatcher
│   │   ├── openrouter.ts       # OpenRouter PKCE authorization code flow
│   │   └── github-copilot.ts   # GitHub Copilot device code flow & token exchange
│   └── utils/
│       ├── pkce.ts             # RFC 7636 PKCE verifier & SHA-256 challenge generator
│       ├── callback-server.ts  # Ephemeral HTTP loopback callback receiver & HTML UI
│       ├── device-poller.ts    # Polling utility for device code authentication
│       └── browser.ts          # Cross-platform default browser launcher
├── tests/                      # Colocated integration test suites
├── package.json                # Workspace package definition (@steward/oauth)
├── tsconfig.json               # TypeScript configuration
└── README.md                   # Authoritative READMEDOC documentation manual
```

---

## 9. Verification & Testing

Run unit and integration tests via Bun:

```bash
# Run OAuth tests
bun test ./packages/oauth/tests
```
