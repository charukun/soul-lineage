export const REPOSITORY = 'charukun/soul-lineage';
export const GITHUB_API = `https://api.github.com/repos/${REPOSITORY}`;
export const PAGES_ROOT = 'https://charukun.github.io/soul-lineage/';
export const STALL_WARNING_MS = 10 * 60 * 1000;
export const API_HISTORY_PAGE_LIMIT = 10;
const FAILURE_CONCLUSIONS = new Set(['failure', 'timed_out', 'action_required', 'startup_failure', 'stale']);
export function shortSha(value) { return typeof value === 'string' && value.length >= 7 ? value.slice(0, 12) : null; }
export function parseMergePulls(commits = []) {
  const byNumber = new Map();
  for (const item of commits) {
    const message = item?.commit?.message || '';
    const match = (message.split('\n')[0] || '').match(/^Merge pull request #(\d+) from /i);
    if (!match) continue;
    const number = Number(match[1]);
    const paragraphs = message.split(/\n\s*\n/).map(x => x.trim()).filter(Boolean);
    const title = paragraphs[1]?.split('\n')[0]?.trim() || `PR #${number}`;
    if (!byNumber.has(number)) byNumber.set(number, { number, title, mergedAt: item?.commit?.committer?.date || item?.commit?.author?.date || null, mergeCommit: item?.sha || null, url: `https://github.com/${REPOSITORY}/pull/${number}` });
  }
  return [...byNumber.values()].sort((a, b) => (b.mergedAt ? Date.parse(b.mergedAt) : 0) - (a.mergedAt ? Date.parse(a.mergedAt) : 0) || b.number - a.number);
}
export function diffPulls(a = [], b = []) { const other = new Set(b.map(item => item.number)); return a.filter(item => !other.has(item.number)); }
export function workflowFailure(run) { return run?.status === 'completed' && FAILURE_CONCLUSIONS.has(run?.conclusion); }
export function latestRunForSha(runs, sha, workflowName = 'CI') { return (runs || []).find(run => run?.name === workflowName && run?.head_sha === sha) || null; }
export function classifyPull(pr, runs = [], developRuns = [], now = Date.now()) {
  const ci = latestRunForSha(runs, pr?.head?.sha, 'CI');
  const base = { number: pr.number, title: pr.title, url: pr.html_url || `https://github.com/${REPOSITORY}/pull/${pr.number}`, headSha: pr?.head?.sha || null,
    updatedAt: pr.updated_at || pr.created_at || null, ci: ci ? { status: ci.status, conclusion: ci.conclusion, url: ci.html_url, updatedAt: ci.updated_at || ci.created_at || null } : null };
  if (pr.draft) return { ...base, stage: 'READY_WAIT', label: '作業中', tone: 'info', reason: 'Draft PR' };
  if (!ci || ci.status !== 'completed') return { ...base, stage: 'READY_WAIT', label: '自動テスト待ち', tone: 'info', reason: ci ? 'CI実行中' : 'CI待ち' };
  if (FAILURE_CONCLUSIONS.has(ci.conclusion)) return { ...base, stage: 'CI_FAILED', label: 'CI失敗', tone: 'danger', reason: ci.conclusion || 'failure' };
  if (ci.conclusion !== 'success') return { ...base, stage: 'READY_WAIT', label: '自動テストの確認待ち', tone: 'warning', reason: ci.conclusion === 'cancelled' ? 'CIは中断されました。再実行の結果待ちです。' : `CI: ${ci.conclusion || ci.status}` };
  const ciTime = Date.parse(ci.updated_at || ci.created_at || pr.updated_at || pr.created_at || 0) || now;
  const stalledMs = Math.max(0, now - ciTime);
  return { ...base, stage: 'MERGE_WAIT', label: '統合待ち', tone: stalledMs >= STALL_WARNING_MS ? 'danger' : 'warning', reason: 'Ready状態でCI成功後も、まだ統合されていません。', stalledMs,
    warning: stalledMs >= STALL_WARNING_MS, eligibleSince: new Date(ciTime).toISOString() };
}
export function environmentDiff(dev, prod) {
  if (dev?.historyComplete !== true || prod?.historyComplete !== true) return { count: null, pulls: [], label: 'DEV / Production差分は公開履歴を確定できるまで未確定', exact: false };
  const pulls = diffPulls(dev.reflectedPrs || [], prod.reflectedPrs || []);
  return { count: pulls.length, pulls, label: pulls.length === 0 ? 'DEVとProductionは同一PR範囲' : `DEVはProductionより +${pulls.length} PR`, exact: true };
}
export function publishedCommit(manifest, environment) {
  const snapshot = manifest?.environmentSnapshots?.[environment];
  if (snapshot?.commit) return { commit: snapshot.commit, deployedAt: snapshot.deployedAt || null, exact: true };
  if (environment === 'dev' && manifest?.validatedDevelop) return { commit: manifest.validatedDevelop, deployedAt: null, exact: true };
  const commits = [...new Set((manifest?.entries || []).filter(entry => entry.environment === environment).map(entry => entry?.version?.commit).filter(Boolean))];
  return commits.length === 1 ? { commit: commits[0], deployedAt: null, exact: true } : { commit: null, deployedAt: null, exact: false, sourceCommits: commits };
}
export function deploymentQueue(compare) {
  if (!compare) return { state: 'unknown', commitsAhead: null, pulls: [], warning: false };
  const commits = compare.commits || [];
  return { state: compare.status || 'unknown', commitsAhead: Number(compare.ahead_by ?? commits.length), commitsBehind: Number(compare.behind_by ?? 0),
    totalCommits: Number(compare.total_commits ?? commits.length), pulls: parseMergePulls(commits), warning: compare.status === 'diverged' || Number(compare.behind_by || 0) > 0 };
}
export function overallIntegration(queue = [], latestDevelopRun = null, deployQueues = []) {
  if (queue.some(item => item.stage === 'FAILED' || item.stage === 'CI_FAILED') || workflowFailure(latestDevelopRun)) return { label: 'Failed', tone: 'danger' };
  if (deployQueues.some(item => item?.warning)) return { label: 'Failed', tone: 'danger' };
  if (latestDevelopRun && ['queued', 'in_progress', 'waiting', 'requested', 'pending'].includes(latestDevelopRun.status)) return { label: 'Integration中', tone: 'progress' };
  if (queue.some(item => item.stage === 'INTEGRATING')) return { label: 'Integration中', tone: 'progress' };
  if (queue.some(item => item.warning)) return { label: '滞留あり', tone: 'danger' };
  if (deployQueues.some(item => (item?.commitsAhead || 0) > 0)) return { label: 'deploy待ち', tone: 'warning' };
  if (queue.some(item => item.stage === 'MERGE_WAIT')) return { label: 'merge待ち', tone: 'warning' };
  if (queue.some(item => item.stage === 'READY_WAIT')) return { label: 'Ready待ち', tone: 'info' };
  return { label: '正常', tone: 'ok' };
}
