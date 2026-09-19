export const PULSE_CONTRACT_VERSION = 1;

export const PULSE_ROLE = Object.freeze({
  HUMAN_ACTION: 'human-action',
  DEVELOPMENT: 'development',
  DEV_PUBLICATION: 'dev-publication',
  RECENT: 'recent',
});

export const PULSE_FIRST_GLANCE = Object.freeze([
  PULSE_ROLE.DEVELOPMENT,
  PULSE_ROLE.DEV_PUBLICATION,
  PULSE_ROLE.HUMAN_ACTION,
  PULSE_ROLE.RECENT,
]);

export const PULSE_CONTROL_STATE = Object.freeze({
  SYNCED: 'SYNCED',
  PROCESSING: 'PROCESSING',
  RECOVERING: 'RECOVERING',
  NEEDS_USER: 'NEEDS_USER',
  UNKNOWN: 'UNKNOWN',
});

export const PULSE_COPY = Object.freeze({
  recovery: Object.freeze({
    headline: '自動復旧中',
    summary: '最新状態を再取得しています。今は操作不要です。',
    syncTitle: '再同期中',
  }),
  synced: Object.freeze({
    syncTitle: '同期済み',
  }),
  needsUser: Object.freeze({
    syncTitle: '確認が必要',
  }),
  unknown: Object.freeze({
    syncTitle: '同期確認中',
  }),
});

export function pulseRoleSelector(role) {
  return `[data-pulse-role="${role}"]`;
}
