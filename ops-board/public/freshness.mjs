import { ageLabel, boardAlerts, snapshotAge } from './health.mjs';

const HIDDEN_TIME_ONLY_ALERTS = new Set(['sync-stale']);

export function eventDrivenAlerts(state, now = Date.now(), loadError = null) {
  if (Array.isArray(state?.controlTower?.incidents)) {
    return state.controlTower.incidents.filter(item => item.userActionRequired === true);
  }
  return boardAlerts(state, now, loadError).filter(item => !HIDDEN_TIME_ONLY_ALERTS.has(item.type));
}

export function syncPresentation(state, now = Date.now(), loadError = null) {
  const age = snapshotAge(state, now);
  const tower = state?.controlTower;

  if (loadError) {
    return {
      tone: 'warning',
      title: '表示更新を再試行中',
      meta: age === null ? '現在状態を確認できません' : `${ageLabel(age)}の確定情報を表示`,
    };
  }

  if (tower?.status === 'NEEDS_USER') {
    return {
      tone: 'danger',
      title: '確認が必要',
      meta: tower.summary || '対応が必要な項目があります',
    };
  }

  if (state?.syncStatus === 'degraded') {
    return {
      tone: 'warning',
      title: 'GitHub同期を自動再確認中',
      meta: age === null ? '前回値を確認しています' : `${ageLabel(age)}の確定情報を表示`,
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
