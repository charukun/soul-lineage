export const AUTHENTICATED_STATE_READ_REFRESH_MS = 45_000;
export const PUBLIC_STATE_READ_REFRESH_MS = 5 * 60_000;

function timestamp(value) {
  const parsed = Date.parse(value || '');
  return Number.isFinite(parsed) ? parsed : null;
}

export function stateReadRefreshMode(state, {
  authenticated = false,
  now = Date.now(),
} = {}) {
  const generatedAt = timestamp(state?.generatedAt);
  const nowMs = Number.isFinite(Number(now)) ? Number(now) : Date.now();
  const maxAgeMs = authenticated ? AUTHENTICATED_STATE_READ_REFRESH_MS : PUBLIC_STATE_READ_REFRESH_MS;
  if (generatedAt === null) return authenticated ? 'authenticated' : 'public';
  if (Math.max(0, nowMs - generatedAt) < maxAgeMs) return null;
  return authenticated ? 'authenticated' : 'public';
}
