const PHASE_NAMES = Object.freeze({
  observation: '改善前の確認', investigation: '原因の調査', implementation: '修正',
  causalValidation: '動作の検証', afterObservation: '改善後の確認', verdict: '効果の判定',
  astraValidation: '最終検証', freshness: '取り込み前の確認', merge: 'developへの反映',
  devPublish: 'DEV公開',
});
const GAME_NAMES = Object.freeze({ kuumetsu: '喰滅廻遊', rinne: '百年転生', village: '村づくり' });
const LIVE = new Set(['running', 'validating']);
const time = value => { const n = Date.parse(value || ''); return Number.isFinite(n) ? n : 0; };
export const iterationPhaseName = step => PHASE_NAMES[step?.id || step] || step?.label || '工程未記録';
export const iterationGameName = item => GAME_NAMES[item?.game || item?.autonomous?.game] || '対象未記録';
export function iterationTitle(item = {}) {
  const title = String(item.theme || item.title || '改善内容の記録待ち').trim();
  return title.replace(new RegExp('^' + iterationGameName(item) + '\\s*[：:]\\s*'), '');
}
export function iterationPublication(item = {}) {
  if (item.publication) return item.publication;
  // Old snapshots are not proof of a new publication. Keep unknown distinct from queued.
  return { state: 'unknown', url: null };
}
export function iterationPresentation(item = {}, { syncStatus = 'ok' } = {}) {
  const steps = item.steps || item.iterationSteps || [];
  const merged = item.merged === true || item.state === 'Merged' || Boolean(item.mergedAt);
  const execution = item.execution || {};
  const failure = steps.find(step => step.id !== 'devPublish' && step.state === 'problem');
  const recorded = steps.find(step => step.id === item.currentStep && !['done', 'skipped'].includes(step.state));
  const actual = steps.find(step => step.state === 'running' && step.runId && step.runId === execution.runId);
  const current = failure || actual || recorded || steps.find(step => step.state === 'running')
    || steps.find(step => ['waiting', 'pending'].includes(step.state));
  const phase = iterationPhaseName(current);
  const publication = iterationPublication(item);
  const publicationText = ({
    done: 'DEV公開済み', running: 'DEV公開中', waiting: 'DEV公開待ち',
    problem: 'DEV公開に問題', unknown: 'DEV公開は未確認', notStarted: 'DEV公開は反映後',
  })[publication.state] || 'DEV公開は未確認';
  const effect = ({ supported: '効果を確認', inconclusive: '効果は未確定', refuted: '改善仮説は不成立' })[item.verdict]
    || '効果判定は未記録';
  const base = { merged, currentStep: current?.id || null, phase, publicationText,
    publicationProblem: publication.state === 'problem', effect, updatedAt: item.updatedAt || execution.lastActivityAt || null };
  if (merged) return { ...base, status: 'complete', tone: 'ok', label: '反映済み',
    headline: 'developへの反映が完了',
    reason: publication.state === 'problem' ? '改善の取り込みは完了しています。DEV公開の問題は別に確認が必要です。' : '改善の取り込みは完了しています。',
    next: publication.state === 'problem' ? '公開の失敗内容を確認する' : publication.state === 'done' ? '変更内容と効果の記録を確認する' : '公開状況は別表示で確認する' };
  if (failure) return { ...base, status: 'problem', tone: 'danger', label: '要対応',
    headline: phase + 'で問題', reason: failure.summary || 'この工程に失敗の記録があり、まだdevelopへ反映されていません。',
    next: '同じPRで失敗した工程を確認・修復する' };
  if (syncStatus !== 'ok') return { ...base, status: 'waiting', tone: 'muted', label: '最新状態未確認',
    headline: '最後の記録：' + phase, reason: '最新の同期に失敗しています。保存された記録を表示しています。', next: '再読込して最新状態を確認する' };
  if (LIVE.has(execution.state) && execution.runId) return { ...base, status: 'running', tone: 'progress', label: '実行中',
    headline: (execution.state === 'validating' ? '最終検証' : phase) + 'を実行中',
    reason: 'GitHub Actionsの実行を確認しています。まだdevelopへは反映されていません。',
    next: '実行結果を確認して次の工程へ進む' };
  if (execution.state === 'merging') return { ...base, status: 'waiting', tone: 'warning', label: '反映待ち',
    headline: '検証済み・developへの反映待ち', reason: '検証は完了していますが、取り込みはまだ完了していません。',
    next: '同じPRで取り込み前の確認と反映を行う' };
  return { ...base, status: 'waiting', tone: 'muted', label: '実行未確認',
    headline: '最後の記録：' + phase,
    reason: 'GitHub上の実行中の処理は確認できません。Chat側の稼働・停止は判定できません。',
    next: '同じPRの進行状況を確認する' };
}
export function iterationOverview(state = {}) {
  const raw = Array.isArray(state.autonomousIterations) ? state.autonomousIterations : [];
  const entries = raw.filter(item => GAME_NAMES[item.game || item.autonomous?.game]).map(item => ({
    item, view: iterationPresentation(item, { syncStatus: state.syncStatus || 'unknown' }),
  }));
  const rank = { problem: 0, running: 1, waiting: 2, complete: 3 };
  entries.sort((a, b) => rank[a.view.status] - rank[b.view.status] || time(b.item.updatedAt) - time(a.item.updatedAt));
  const counts = { running: 0, waiting: 0, problem: 0, complete: 0, publicationProblem: 0 };
  for (const { view } of entries) {
    counts[view.status]++;
    if (view.publicationProblem) counts.publicationProblem++;
  }
  return { entries, counts };
}
