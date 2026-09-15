const STAGES = Object.freeze({
  READY_FOR_INTEGRATION: Object.freeze({ badge: 'WAIT' }),
  INTEGRATED: Object.freeze({ badge: 'INFO' }),
  DEV_DEPLOYED: Object.freeze({ badge: 'OK' }),
  FAILED: Object.freeze({ badge: 'WARN' }),
  BROWSER_VERIFIED: Object.freeze({ badge: 'OK' }),
});

export const NOTIFICATION_STAGES = Object.freeze(Object.keys(STAGES));

function presentation(stage) {
  const value = STAGES[stage];
  if (!value) throw new Error(`UNKNOWN_NOTIFICATION_STAGE:${stage}`);
  return value;
}

function transportValue(value) {
  if (Array.isArray(value)) return value.map(transportValue).join(',');
  return String(value).replace(/[\r\n]+/g, ' ').trim();
}

export function notificationHeadline(stage) {
  const value = presentation(stage);
  return `[${value.badge}][${stage}]`;
}

export function notificationTitle(stage) {
  const value = presentation(stage);
  return `RINNE [${value.badge}] ${stage}`;
}

export function lifecycleMessage(stage, { fields = {}, lines = [] } = {}) {
  const value = presentation(stage);
  const stableFields = Object.entries(fields)
    .filter(([, field]) => field !== undefined && field !== null && field !== '')
    .map(([key, field]) => `${key}: ${transportValue(field)}`);
  return [
    notificationHeadline(stage),
    stage,
    `severity: ${value.badge}`,
    ...stableFields,
    ...lines.filter(Boolean).map(transportValue),
  ].join('\n');
}
