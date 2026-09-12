import { API_HISTORY_PAGE_LIMIT, PAGES_ROOT, REPOSITORY, classifyPull, deploymentQueue, environmentDiff, overallIntegration, parseMergePulls, publishedCommit, workflowFailure } from './model.mjs';
import { splitPulls, isVisualReviewPull } from './pulls.mjs';
import { buildApplications } from './applications.mjs';
import { createGithubClient } from './github-client.mjs';
import { enrichTargets, actionProblems } from './review-model.mjs';
import { FAILED_CONCLUSIONS } from './public/health.mjs';
const RUNNING = new Set(['queued', 'in_progress', 'waiting', 'requested', 'pending']);
const stamp = () => new Date().toISOString();
function runView(run) {
  return run ? { id: run.id, workflow: run.name, status: run.status, conclusion: run.conclusion, branch: run.head_branch, sha: run.head_sha,
    event: run.event, createdAt: run.created_at, updatedAt: run.updated_at, url: run.html_url, ...(run.historyLabel ? { historyLabel: run.historyLabel } : {}) } : null;
}
function deploymentState(branchSha, deployedSha, run) {
  if (!deployedSha) return 'unknown';
  if (branchSha === deployedSha) return 'success';
  if (RUNNING.has(run?.status)) return 'deploying';
  if (workflowFailure(run)) return 'failed';
  return 'waiting';
}
export function environmentFromManifest(id, manifest, branchCommit, deployRun) {
  const published = publishedCommit(manifest, id);
  return { id, kind: 'pages', name: { dev: 'DEV', staging: 'STAGING / 検証', prod: 'Production' }[id], branch: manifest.environmentSnapshots?.[id]?.branch || (id === 'prod' ? 'main' : 'develop'), branchCommit,
    deployedCommit: published.commit, sourceCommits: published.sourceCommits || [], deployedAt: published.deployedAt || null, url: `${PAGES_ROOT}${id}/`,
    deployState: deploymentState(branchCommit, published.commit, deployRun), latestRun: runView(deployRun), source: 'GitHub Pages deployment-manifest.json', exactCommit: published.exact };
}
async function withHistory(env, previous, client) {
  if (!env.deployedCommit) return { ...env, reflectedPrs: [], reflectedPrCount: null, historyComplete: false };
  if (previous?.deployedCommit === env.deployedCommit && previous.historyComplete === true && Array.isArray(previous.reflectedPrs)) {
    return { ...env, reflectedPrs: previous.reflectedPrs, reflectedPrCount: previous.reflectedPrCount, historyComplete: true, commitCountScanned: previous.commitCountScanned };
  }
  const commits = [];
  let complete = false;
  for (let page = 1; page <= API_HISTORY_PAGE_LIMIT; page++) {
    const { data, response } = await client.get(`/commits?sha=${encodeURIComponent(env.deployedCommit)}&per_page=100&page=${page}`, { immutable: true });
    if (!Array.isArray(data)) throw new Error('GitHub commit history returned a non-array payload');
    commits.push(...data);
    if (!/rel="next"/.test(response.headers.get('link') || '')) { complete = true; break; }
  }
  const reflectedPrs = parseMergePulls(commits);
  return { ...env, reflectedPrs, reflectedPrCount: complete ? reflectedPrs.length : null, historyComplete: complete, commitCountScanned: commits.length };
}
async function compareQueue(deployed, branch, client) {
  if (!deployed || !branch) return deploymentQueue(null);
  if (deployed === branch) return deploymentQueue({ status: 'identical', ahead_by: 0, behind_by: 0, total_commits: 0, commits: [] });
  const { data } = await client.get(`/compare/${encodeURIComponent(deployed)}...${encodeURIComponent(branch)}`, { immutable: true });
  return deploymentQueue(data);
}
function previewCandidates(runs) {
  const names = [...new Set(runs.filter(run => run?.name !== 'Rinne Ops Board' && /(visual.*review|review.*preview|preview)/i.test(run?.name || '')).map(run => run.name))].slice(0, 4);
  return names.map(name => { const all = runs.filter(run => run.name === name); return { name, latest: all[0], success: all.find(run => run.status === 'completed' && run.conclusion === 'success') }; }).filter(x => x.success);
}
async function previewEnvironment(candidate, branches, previous, client) {
  const success = candidate.success, latest = candidate.latest;
  const prior = (previous?.environments || []).find(env => env.kind === 'preview' && env.workflow === candidate.name);
  let publicStatus = prior?.deployedCommit === success.head_sha ? prior.publicStatus : null;
  if (!publicStatus?.targetUrl) {
    const { data } = await client.get(`/commits/${success.head_sha}/status`);
    // A failed action is not proof of deployment; accept only a successful public status.
    const selected = (data.statuses || []).find(status => status.state === 'success' && /\/public$/.test(status.context || '') && /^https:\/\//.test(status.target_url || ''));
    if (!selected) return null;
    publicStatus = { state: selected.state, context: selected.context, targetUrl: selected.target_url, updatedAt: selected.updated_at || selected.created_at || null };
  }
  const env = { id: publicStatus.context.replace(/\/public$/, ''), kind: 'preview', name: publicStatus.context === 'visual-review/public' ? 'Visual Review Lab' : candidate.name.replace(/\bpreview\b/ig, '').trim(),
    workflow: candidate.name, branch: success.head_branch, branchCommit: branches.get(success.head_branch)?.commit?.sha || success.head_sha,
    deployedCommit: success.head_sha, deployedAt: publicStatus.updatedAt, url: publicStatus.targetUrl,
    deployState: RUNNING.has(latest?.status) ? 'deploying' : FAILED_CONCLUSIONS.has(latest?.conclusion) ? 'failed' : latest?.conclusion === 'cancelled' ? 'waiting' : 'success',
    publicStatus, latestRun: runView(latest), source: 'GitHub Actions + commit status' };
  return withHistory(env, prior, client);
}

export async function buildState(previous = null, { storage, token = '', fetchImpl = fetch } = {}) {
  const startedAt = stamp();
  const client = createGithubClient({ storage, token, fetchImpl });
  try {
    const manifestUrl = new URL('deployment-manifest.json', PAGES_ROOT); manifestUrl.searchParams.set('ops', Date.now());
    const response = await fetchImpl(manifestUrl, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`公開manifest取得: HTTP ${response.status}`);
    const manifest = await response.json();
    if (manifest?.schemaVersion !== 1 || !Array.isArray(manifest.entries)) throw new Error('公開manifestの形式が不正です');
    const branchesResult = await client.get('/branches?per_page=100');
    const branches = new Map((branchesResult.data || []).map(branch => [branch.name, branch]));
    const pulls = [];
    let pullsComplete = false;
    for (let page = 1; page <= 6; page++) {
      const { data, response } = await client.get(`/pulls?state=all&base=develop&sort=updated&direction=desc&per_page=100&page=${page}`);
      if (!Array.isArray(data)) throw new Error('GitHub PR一覧の形式が不正です');
      pulls.push(...data);
      if (!/rel="next"/.test(response.headers.get('link') || '')) { pullsComplete = true; break; }
    }
    const allPulls = [...new Map(pulls.map(pr => [pr.number, pr])).values()];
    const { data: actions } = await client.get('/actions/runs?per_page=100');
    const runs = Array.isArray(actions?.workflow_runs) ? actions.workflow_runs : [];
    const developRuns = runs.filter(run => run.name === 'Deploy DEV and PROD' && run.head_branch === 'develop');
    const mainRuns = runs.filter(run => run.name === 'Deploy DEV and PROD' && run.head_branch === 'main');
    const previousById = new Map((previous?.environments || []).map(env => [env.id, env]));
    let dev = environmentFromManifest('dev', manifest, branches.get('develop')?.commit?.sha || null, developRuns[0]);
    let prod = environmentFromManifest('prod', manifest, branches.get('main')?.commit?.sha || null, mainRuns[0]);
    dev = await withHistory(dev, previousById.get('dev'), client);
    prod = await withHistory(prod, previousById.get('prod'), client);
    let staging = environmentFromManifest('staging', manifest, publishedCommit(manifest, 'staging').commit, null);
    staging = await withHistory(staging, previousById.get('staging'), client);
    staging.source = 'Pinned validation release / published manifest';
    dev.deployQueue = await compareQueue(dev.deployedCommit, dev.branchCommit, client);
    prod.deployQueue = await compareQueue(prod.deployedCommit, prod.branchCommit, client);
    const previews = [];
    for (const candidate of previewCandidates(runs)) { const env = await previewEnvironment(candidate, branches, previous, client); if (env) previews.push(env); }
    const applications = buildApplications(manifest, [dev, staging, prod, ...previews], runs);
    const openPulls = allPulls.filter(pr => pr.state === 'open' && !isVisualReviewPull(pr)).sort((a, b) => Date.parse(a.created_at || 0) - Date.parse(b.created_at || 0));
    const integrationQueue = openPulls.map(pr => classifyPull(pr, runs, developRuns));
    const integration = overallIntegration(integrationQueue, developRuns[0], [dev.deployQueue, prod.deployQueue]);
    const alerts = [];
    for (const item of integrationQueue.filter(item => item.warning)) alerts.push({ type: 'stalled-ready-pr', tone: 'danger', title: `#${item.number} がIntegration滞留`, detail: item.reason, url: item.url, since: item.eligibleSince });
    for (const env of [dev, prod]) {
      if (env.deployQueue?.warning) alerts.push({ type: 'branch-diverged', tone: 'danger', title: `${env.name} の公開版とブランチの系譜を確認`, detail: `${env.deployQueue.state}: ahead ${env.deployQueue.commitsAhead}, behind ${env.deployQueue.commitsBehind}`, url: env.url });
      else if ((env.deployQueue?.commitsAhead || 0) > 0) alerts.push({ type: 'deploy-wait', tone: 'warning', title: `${env.name} 公開待ち`, detail: `${env.deployQueue.commitsAhead} commit 未公開`, url: env.url });
    }
    if (workflowFailure(developRuns[0])) alerts.push({ type: 'integration-failed', tone: 'danger', title: '自動統合処理が失敗', detail: developRuns[0].conclusion, url: developRuns[0].html_url });
    // Target lookup is optional: a rate-limit here must not discard fresh deploy/CI facts.
    const targets = await enrichTargets(allPulls, client, storage, token ? 16 : 2);
    const pullRequests = splitPulls(targets.pulls);
    const failures = actionProblems(runs, allPulls);
    const now = stamp();
    return { schemaVersion: 2, repository: REPOSITORY, generatedAt: now, lastAttemptAt: now, startedAt, syncStatus: 'ok',
      syncSource: 'GitHub API + published deployment manifests/statuses', githubRateRemaining: client.remaining,
      pullRequests: { ...pullRequests, total: allPulls.length, truncated: !pullsComplete, targetLookup: { ready: targets.ready, pending: targets.pending, unavailable: targets.unavailable, attempted: targets.attempted } },
      applications, applicationsUpdatedAt: now, applicationsSource: 'public-manifest', environments: [dev, staging, prod, ...previews], environmentDiff: environmentDiff(dev, prod),
      integration: { ...integration, queue: integrationQueue, latestRun: runView(developRuns[0]), deployWaiting: dev.deployQueue?.pulls || [], watchdog: { stalledThresholdMinutes: 10, staleReadyCount: integrationQueue.filter(item => item.warning).length } },
      recentActionFailures: failures.current.map(runView), actionHistory: failures.history.map(runView), alerts,
      publicManifest: { url: manifestUrl.origin + manifestUrl.pathname, schemaVersion: manifest.schemaVersion, validatedDevelop: manifest.validatedDevelop || null, environmentSnapshots: manifest.environmentSnapshots || null } };
  } finally { await client.prune(); }
}
