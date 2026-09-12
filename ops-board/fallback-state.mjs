import { PAGES_ROOT } from './model.mjs';
import { publishedFallback } from './published-fallback.mjs';

// A partial manifest refresh must not claim that GitHub history has also been refreshed.
export async function degradedState(previous, error, { source = 'manual', now = new Date().toISOString(), fetchImpl = fetch } = {}) {
  let state;
  try {
    const url = new URL('deployment-manifest.json', PAGES_ROOT);
    url.searchParams.set('ops-fallback', now);
    const response = await fetchImpl(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`公開manifest: HTTP ${response.status}`);
    state = publishedFallback(previous, await response.json(), { now, error, source });
    state.manifestSyncError = null;
  } catch (manifestError) {
    if (!previous) throw error;
    state = { ...previous, syncStatus: 'degraded', syncError: String(error?.message || '取得失敗'),
      manifestSyncError: String(manifestError?.message || '公開情報の取得失敗'), lastAttemptAt: now, refreshReason: source };
  }
  return { ...state, schemaVersion: 2, nextRetryAt: error?.retryAt ? new Date(error.retryAt).toISOString() : null };
}
