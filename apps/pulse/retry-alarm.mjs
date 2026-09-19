export function retryAlarmAt(state, now = Date.now()) {
  const value = Date.parse(state?.nextRetryAt || '');
  return Number.isFinite(value) && value > now ? value : null;
}

export async function reconcileRetryAlarm(storage, state, now = Date.now()) {
  if (!storage) return null;
  const target = retryAlarmAt(state, now);
  if (target !== null && typeof storage.setAlarm === 'function') {
    const current = typeof storage.getAlarm === 'function' ? await storage.getAlarm() : null;
    if (current !== target) await storage.setAlarm(target);
    return target;
  }
  if (typeof storage.deleteAlarm === 'function') await storage.deleteAlarm();
  return null;
}
