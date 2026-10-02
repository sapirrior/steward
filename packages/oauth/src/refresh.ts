import { getStoredToken, saveStoredToken, deleteStoredToken } from './store.js';
import type { TokenRecord } from './types.js';

/**
 * 5-minute safety margin before expiration to refresh tokens proactively.
 */
export const EXPIRY_BUFFER_MS = 5 * 60 * 1000;

export type ProviderRefresher = (token: TokenRecord, signal?: AbortSignal) => Promise<TokenRecord>;

const refreshers = new Map<string, ProviderRefresher>();

/**
 * Registers a token refresh handler for an OAuth provider.
 */
export function registerTokenRefresher(provider: string, refresher: ProviderRefresher): void {
  refreshers.set(provider, refresher);
}

/**
 * In-flight promise cache to coalesce concurrent refresh requests for the same provider.
 */
const inFlightRefreshes = new Map<string, Promise<string | null>>();

/**
 * Checks whether a token is expired or within the proactive refresh buffer.
 */
export function isTokenExpiring(token: TokenRecord): boolean {
  if (!token.expires) {
    return false;
  }
  return Date.now() + EXPIRY_BUFFER_MS >= token.expires;
}

/**
 * Retrieves a valid access token for a provider, performing transparent refresh if needed.
 * Coalesces concurrent calls for the same provider into a single refresh execution.
 */
export async function getOrRefreshToken(
  provider: string,
  signal?: AbortSignal,
): Promise<string | null> {
  const existing = await getStoredToken(provider);
  if (!existing) {
    return null;
  }

  // If token has no expiry or is still valid well beyond buffer, return immediately
  if (!isTokenExpiring(existing)) {
    return existing.access;
  }

  const refresher = refreshers.get(provider);
  if (!refresher) {
    // No refresher registered; return current token if not strictly expired yet
    if (existing.expires && Date.now() > existing.expires) {
      return null;
    }
    return existing.access;
  }

  // Coalesce in-flight refresh requests for the same provider
  const inFlight = inFlightRefreshes.get(provider);
  if (inFlight) {
    return inFlight;
  }

  const refreshPromise = (async () => {
    try {
      const refreshed = await refresher(existing, signal);
      await saveStoredToken(provider, refreshed);
      return refreshed.access;
    } catch (err: any) {
      // If refresh failed permanently (e.g. 400/401/invalid_grant/revoked), invalidate stored credentials
      const status = err?.status || err?.cause?.status;
      const isPermanentFailure =
        status === 400 ||
        status === 401 ||
        status === 403 ||
        err?.code === 'INVALID_GRANT' ||
        err?.code === 'TOKEN_REVOKED';

      if (isPermanentFailure) {
        await deleteStoredToken(provider);
        return null;
      }

      // If transient error (network drop) but existing token hasn't strictly expired yet, return it
      if (existing.expires && Date.now() < existing.expires) {
        return existing.access;
      }

      return null;
    } finally {
      inFlightRefreshes.delete(provider);
    }
  })();

  inFlightRefreshes.set(provider, refreshPromise);
  return refreshPromise;
}
