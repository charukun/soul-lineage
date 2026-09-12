import { targetAppsFromFiles } from './pulls.mjs';
import { FAILED_CONCLUSIONS } from './public/health.mjs';

export function targetRevision(pr) {
  if (!pr?.head?.sha || !pr?.base?.sha) return null;
  const base = pr.state === 'closed' ? `closed:${pr.merged_at || pr.closed_at || ''}:${pr.merge_commit_sha || pr.base.sha}` : pr.base.sha;
  return `${pr.number}:${pr.head.sha}:${base}`;
}

export async function enrichTargets(pulls, client, storage, limit = 2, now = Date.now()) {
  const result = pulls.map(pr => ({ ...pr, targetApps: [], targetAppsComplete: false, targetAppsStatus: 'pending' }));
  const pending = [];
  for (const pr of result) {
    const saved = await storage?.get(`ops-targets:${pr.number}`);
    const revision = targetRevision(pr);
    if (revision && saved?.revision === revision && saved.complete) {
      Object.assign(pr, { targetApps: saved.targets, targetAppsComplete: true, targetAppsStatus: 'ready', targetAppsUpdatedAt: saved.updatedAt });
    } else pending.push({ pr, saved, revision });
  }
  // Open work first; historical PRs are then warmed once, not on every filter click.
  pending.sort((a, b) => Number(b.pr.state === 'open') - Number(a.pr.state === 'open') || (a.saved?.attemptAt || 0) - (b.saved?.attemptAt || 0));
  let attempted = 0;
  for (const { pr, revision, saved } of pending) {
    if (!revision || attempted >= limit || client.available < 3) continue;
    if (saved?.revision === revision && saved.retryAt > now) { pr.targetAppsStatus = 'unavailable'; continue; }
    attempted++;
    try {
      const files = [];
      let complete = false;
      for (let page = 1; page <= 30 && client.available > 1; page++) {
        const { data, response } = await client.get(`/pulls/${pr.number}/files?per_page=100&page=${page}`);
        if (!Array.isArray(data)) throw new Error('変更ファイルの形式が不正です');
        files.push(...data);
        if (!/rel="next"/.test(response.headers.get('link') || '')) { complete = true; break; }
      }
      const { data: confirmed } = await client.get(`/pulls/${pr.number}`);
      if (targetRevision(confirmed) !== revision) throw new Error('取得中にPRの版が更新されました');
      // REST returns at most 3,000 changed files. Never claim complete coverage beyond it.
      complete = complete && Number.isInteger(confirmed.changed_files) && files.length === confirmed.changed_files;
      const paths = files.flatMap(file => [file.filename, file.previous_filename].filter(Boolean));
      const targets = targetAppsFromFiles(paths);
      const updatedAt = new Date(now).toISOString();
      await storage?.put(`ops-targets:${pr.number}`, { revision, targets, complete, updatedAt, attemptAt: now, retryAt: complete ? 0 : now + 300000 });
      Object.assign(pr, { targetApps: targets, targetAppsComplete: complete, targetAppsStatus: complete ? 'ready' : 'partial', targetAppsUpdatedAt: updatedAt });
    } catch (error) {
      pr.targetAppsStatus = 'unavailable';
      await storage?.put(`ops-targets:${pr.number}`, { revision, complete: false, attemptAt: now, retryAt: error.retryAt || now + 300000 });
      if (error.rateLimited || error.budgetLimited) break;
    }
  }
  return { pulls: result, attempted, ready: result.filter(pr => pr.targetAppsComplete).length, pending: result.filter(pr => pr.targetAppsStatus === 'pending').length,
    unavailable: result.filter(pr => ['unavailable', 'partial'].includes(pr.targetAppsStatus)).length };
}

export function actionProblems(runs = [], pulls = []) {
  const open = new Map(pulls.filter(pr => pr.state === 'open').map(pr => [pr.head?.ref, pr.head?.sha]));
  const closed = new Set(pulls.filter(pr => pr.state === 'closed').map(pr => pr.head?.ref));
  const ordered = [...runs].sort((a, b) => Date.parse(b.created_at || 0) - Date.parse(a.created_at || 0) || b.id - a.id);
  const key = run => `${run.workflow_id || run.name}:${run.head_branch}:${run.event || ''}`;
  const latest = new Map();
  const current = [], history = [];
  for (const run of ordered) { if (!latest.has(key(run))) latest.set(key(run), run); }
  for (const run of ordered) {
    if (run.status !== 'completed' || !(FAILED_CONCLUSIONS.has(run.conclusion) || run.conclusion === 'cancelled')) continue;
    const last = latest.get(key(run));
    let historyLabel = '';
    if (run.conclusion === 'cancelled') historyLabel = '中断';
    else if (last?.id !== run.id) historyLabel = last?.conclusion === 'success' ? '後続の成功で解消' : '過去の実行';
    else if (open.has(run.head_branch) && open.get(run.head_branch) !== run.head_sha) historyLabel = '旧版の失敗';
    else if (!open.has(run.head_branch) && closed.has(run.head_branch) && !['develop', 'main'].includes(run.head_branch)) historyLabel = '終了済みPRの記録';
    if (historyLabel) history.push({ ...run, historyLabel }); else current.push(run);
  }
  return { current: current.slice(0, 10), history: history.slice(0, 20) };
}
