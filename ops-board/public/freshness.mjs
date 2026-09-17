import { ageLabel, boardAlerts, snapshotAge } from './health.mjs';

const HIDDEN_TIME_ONLY_ALERTS = new Set(['sync-stale']);

export function eventDrivenAlerts(state, now = Date.now(), loadError = null) {
  return boardAlerts(state, now, loadError).filter(item => !HIDDEN_TIME_ONLY_ALERTS.has(item.type));
}

export function syncPresentation(state, now = Date.now(), loadError = null) {
  const age = snapshotAge(state, now);
  const failed = Boolean(loadError) || state?.syncStatus === 'degraded';

  if (failed) {
    return {
      tone: 'danger',
      title: 'GitHub同期に問題',
      meta: age === null ? '最新状態を確認できません' : `${ageLabel(age)}の確定情報を表示 · 再試行待ち`,
    };
  }

  if (age === null) {
    return {
      tone: 'warning',
      title: 'GitHub状態を確認中',
      meta: '最終反映を確認しています',
    };
  }

  return {
    tone: 'ok',
    title: 'GitHub状態を反映済み',
    meta: `最終反映 ${ageLabel(age)} · イベント駆動`,
  };
}
