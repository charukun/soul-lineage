import { ageLabel, boardAlerts, snapshotAge } from './health.mjs';
import { PULSE_COPY } from './pulse-contract.mjs';

const HIDDEN_SYSTEM_ALERTS = new Set(['sync-stale','sync-failed','sync-unavailable','client-fetch','github-sync-degraded']);

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
      meta: age === null ? '自動復旧中' : `最終確定 ${ageLabel(age)}`,
    };
  }

  if (tower?.status === 'NEEDS_USER') {
    return {
      tone: 'danger',
      title: PULSE_COPY.needsUser.syncTitle,
      meta: tower.summary || '対応が必要な項目があります',
    };
  }

  if (state?.syncStatus === 'degraded') {
    return {
      tone: 'warning',
      title: '再同期中',
      meta: age === null ? '前回値を確認中' : `最終確定 ${ageLabel(age)}`,
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
    meta: `${ageLabel(age)} · イベント駆動`,
  };
}
