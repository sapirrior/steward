# @steward/oauth

Zero-dependency OAuth credential store and authentication flows for Steward.

`@steward/oauth` manages persistent authentication tokens, automatic OAuth token refresh cycles, PKCE browser authorization flows, and GitHub Copilot Device Authorization Grants with **zero external dependencies**.

---

## Architecture & Boundaries

- **Zero Steward Dependencies:** `@steward/oauth` imports nothing from `@steward/ai`, `@steward/agent`, or `@steward/cli`.
- **Sole Consumer:** Only `@steward/cli` imports `@steward/oauth` directly.
- **Secure File Storage:** Manages credentials at `~/steward/auth.json` with owner-only file permissions (`0o600`), atomic rename writes, and concurrency locking.
- **Secret Redaction:** Token secrets are strictly redacted from error messages and logs.

---

## Package API Reference

Documentation organized according to the **Sonnet Convention** (*File $\to$ Export $\to$ Type $\to$ Description & Constraints*):

### 1. `src/index.ts` & `src/types.ts`

| Export | Type | Description & Constraints |
| :--- | :--- | :--- |
| `setupAuth` | `() => Promise<void>` | Initializes `~/steward` directory with `0o700` permissions. Safe and idempotent. |
| `getToken` | `(provider: string) => Promise<string \| null>` | Returns a valid, unexpired access token for the provider. Transparently refreshes expired tokens. |
| `login` | `(provider: string, options?: LoginOptions) => Promise<LoginResult>` | Initiates interactive OAuth login (browser PKCE or device grant). |
| `logout` | `(provider: string) => Promise<void>` | Removes stored credentials for the specified provider. |
| `authStatus` | `() => Promise<AuthStatus>` | Returns safe provider authentication status map without leaking secret tokens. |
| `launch` | `(url: string) => Promise<void>` | Launches authentication URLs in the default system web browser. |
| `OAuthProviderId` | `type` | Supported OAuth provider identifier string union. |
| `LoginOptions` | `interface` | Options for interactive authentication callbacks (`onAuthUrl`, `onDeviceCode`, `signal`). |
| `LoginResult` | `interface` | Outcome descriptor for login operations (`provider`, `success`, `account`, `error`). |
| `AuthStatus` | `type` | Map of provider IDs to `ProviderAuthStatus` records. |
| `TokenRecord` | `interface` | Internal storage representation of OAuth and API-key credentials. |
