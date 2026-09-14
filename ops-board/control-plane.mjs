const ACTIVE = new Set(['queued', 'in_progress', 'waiting', 'requested', 'pending']);

function latestByContext(statuses = []) {
  const map = new Map();
  for (const status of statuses) if (!map.has(status.context)) map.set(status.context, status);
  return map;
}

function statusView(status, kind) {
  if (!status) return { state: 'unknown', label: 'UNKNOWN', description: 'status未記録', url: null, updatedAt: null };
  const description = status.description || '';
  const label = kind === 'notification'
    ? status.state === 'success' ? 'HEALTHY' : /not configured|unconfirmed/i.test(description) ? 'MISCONFIGURED' : 'FAILED'
    : kind === 'wakeup'
      ? status.state === 'pending' ? 'COALESCED' : status.state === 'success' ? 'IDLE' : 'FAILED'
      : status.state === 'success' ? 'HEALTHY' : status.state === 'pending' ? 'PENDING' : 'FAILED';
  return { state: status.state, label, description, url: status.target_url || null, updatedAt: status.updated_at || status.created_at || null };
}

export function workflowPressure(runs = [], now = Date.now()) {
  const recent = runs.filter(run => now - Date.parse(run.created_at || 0) >= 0 && now - Date.parse(run.created_at || 0) < 86400000);
  const groups = new Map();
  for (const run of recent) {
    const key = `${run.head_sha || 'none'}:${run.event || 'unknown'}`;
    groups.set(key, (groups.get(key) || 0) + 1);
  }
  return {
    runs24h: recent.length,
    active: recent.filter(run => ACTIVE.has(run.status)).length,
    cancelled: recent.filter(run => run.conclusion === 'cancelled').length,
    duplicateRuns: [...groups.values()].reduce((sum, count) => sum + Math.max(0, count - 1), 0),
  };
}

export function controlPlaneHealth({ statuses = [], runs = [], now = Date.now() } = {}) {
  const latest = latestByContext(statuses);
  return {
    notification: statusView(latest.get('notification/ntfy'), 'notification'),
    canary: statusView(latest.get('integration/canary'), 'canary'),
    wakeup: statusView(latest.get('integration/wakeup'), 'wakeup'),
    workflow: workflowPressure(runs, now),
  };
}
