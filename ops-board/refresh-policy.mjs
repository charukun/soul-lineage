export const ANONYMOUS_RECONCILE_MIN_AGE_MS = 20 * 60 * 1000;

export function shouldReuseFreshState(previous, { source = 'manual', authenticated = false, now = Date.now() } = {}) {
  if (authenticated || !String(source).startsWith('cron:')) return false;
  if (!previous || previous.syncStatus !== 'ok') return false;
  const generatedAt = Date.parse(previous.generatedAt || '');
  if (!Number.isFinite(generatedAt)) return false;
  const age = now - generatedAt;
  return age >= 0 && age < ANONYMOUS_RECONCILE_MIN_AGE_MS;
}
