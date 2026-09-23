import { ageLabel, boardAlerts, snapshotAge } from './health.mjs';
import { PULSE_COPY } from './pulse-contract.mjs';

const HIDDEN_SYSTEM_ALERTS = new Set(['sync-stale','sync-failed','sync-unavailable','client-fetch','github-sync-degraded']);

const syncClock = value => {
  const date = new Date(value || '');
  if (Number.isNaN(date.getTime())) return '未記録';
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date) + ' JST';
};
const syncStamp = (state, age, prefix = 'Git同期') =>
  age === null ? prefix + ' 未記録' : prefix + ' ' + syncClock(state?.generatedAt) + ' · ' + ageLabel(age);

export function eventDrivenAlerts(state, now = Date.now(), loadError = null) {
  if (!state && loadError) return [];
  if (Array.isArray(state?.controlTower?.incidents)) {
    return state.controlTower.incidents.filter(item => item.userActionRequired === true);
  }
  return boardAlerts(state, now, loadError).filter(item => !HIDDEN_SYSTEM_ALERTS.has(item.type));
}

export function syncPresentation(state, now = Date.now(), loadError = null) {
  const age = snapshotAge(state, now);
  const tower = state?.controlTower;

  if (loadError) {
    return {
      tone: 'warning',
      title: PULSE_COPY.recovery.syncTitle,
      meta: age === null ? PULSE_COPY.recovery.headline : syncStamp(state, age, '最終確定'),
    };
  }

  if (tower?.status === 'NEEDS_USER') {
    return {
      tone: 'danger',
      title: PULSE_COPY.needsUser.syncTitle,
      meta: (tower.summary || '対応が必要な項目があります') + ' · ' + syncStamp(state, age),
    };
  }

  if (state?.syncStatus === 'degraded') {
    return {
      tone: 'warning',
      title: PULSE_COPY.recovery.syncTitle,
      meta: age === null ? '前回値を確認中' : syncStamp(state, age, '最終確定'),
    };
  }

  if (age === null) {
    return {
      tone: 'warning',
      title: PULSE_COPY.unknown.syncTitle,
      meta: '最終反映を確認中',
    };
  }

  return {
    tone: 'ok',
    title: PULSE_COPY.synced.syncTitle,
    meta: syncStamp(state, age) + ' · イベント駆動',
  };
}
