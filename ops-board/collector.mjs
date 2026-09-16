import { API_HISTORY_PAGE_LIMIT, PAGES_ROOT, REPOSITORY, classifyPull, deploymentQueue, environmentDiff, overallIntegration, parseMergePulls, publishedCommit, reconcileIntegrationQueue, workflowFailure } from './model.mjs';
import { splitPulls, isVisualReviewPull } from './pulls.mjs';
import { buildApplications, VISUAL_REVIEW_PUBLIC_URL } from './applications.mjs';
import { createGithubClient } from './github-client.mjs';
import { syncPullSnapshot } from './pull-snapshot.mjs';
import { enrichTargets, actionProblems } from './review-model.mjs';
import { FAILED_CONCLUSIONS, estimatePublicationDuration } from './public/health.mjs';
import { collectRescue } from './rescue.mjs';
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
  // Anonymous reconciliation is a recovery path. Keep its scarce public quota for current
  // branch/PR/Actions state; authenticated event refreshes populate expensive history.
  if (client.scope === 'public') return { ...env, reflectedPrs: [], reflectedPrCount: null, historyComplete: false, commitCountScanned: 0 };
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
  const names = [...new Set(runs.filter(run => {
    const name = run?.name || '';
    return name !== 'Rinne Ops Board' && !/(visual.*review|review.*preview)/i.test(name) && /preview/i.test(name);
  }).map(run => run.name))].slice(0, 4);
  return names.map(name => { const all = runs.filter(run => run.name === name); return { name, latest: all[0], success: all.find(run => run.status === 'completed' && run.conclusion === 'success') }; }).filter(x => x.success);
}
async function previewEnvironment(candidate, branches, previous, client) {
  const success = candidate.success, latest = candidate.latest;
  const prior = (previous?.environments || []).find(env => env.kind === 'preview' && env.workflow === candidate.name);
  let publicStatus = prior?.deployedCommit === success.head_sha ? prior.publicStatus : null;
  if (!publicStatus?.targetUrl) {
    if (client.scope === 'public' || !client.deepAllowed) return prior || null;
    const { data } = await client.get(`/commits/${success.head_sha}/status`, { maxAgeMs: 60_000 });
    const selected = (data.statuses || []).find(status => status.state === 'success' && /\/public$/.test(status.context || '') && /^https:\/\//.test(status.target_url || ''));
    if (!selected) return null;
    publicStatus = { state: selected.state, context: selected.context, targetUrl: selected.target_url, updatedAt: selected.updated_at || selected.created_at || null };
  }
  const env = { id: publicStatus.context.replace(/\/public$/, ''), kind: 'preview', name: candidate.name.replace(/\bpreview\b/ig, '').trim(),
    workflow: candidate.name, branch: success.head_branch, branchCommit: branches.get(success.head_branch)?.commit?.sha || success.head_sha,
    deployedCommit: success.head_sha, deployedAt: publicStatus.updatedAt, url: publicStatus.targetUrl,
    deployState: RUNNING.has(latest?.status) ? 'deploying' : FAILED_CONCLUSIONS.has(latest?.conclusion) ? 'failed' : latest?.conclusion === 'cancelled' ? 'waiting' : 'success',
    publicStatus, latestRun: runView(latest), source: 'GitHub Actions + commit status' };
  return withHistory(env, prior, client);
}
async function visualReviewEnvironment(developSha, previous, client) {
  const prior = (previous?.environments || []).find(env => env.id === 'visual-review');
  const base = {
    id: 'visual-review', kind: 'preview', name: 'Visual Review Lab', workflow: 'Visual Review Preview',
    branch: 'develop', branchCommit: developSha, deployedCommit: null, deployedAt: null,
    url: VISUAL_REVIEW_PUBLIC_URL, deployState: 'unknown', publicStatus: null, latestRun: null,
    source: 'exact develop visual-review/public status',
  };
  if (!developSha) return prior ? { ...prior, url: VISUAL_REVIEW_PUBLIC_URL, branchCommit: null } : base;
  if (client.scope === 'public' || !client.deepAllowed) {
    if (!prior) return base;
    return {
      ...prior,
      branchCommit: developSha,
      url: VISUAL_REVIEW_PUBLIC_URL,
      deployState: prior.deployedCommit === developSha ? prior.deployState : 'waiting',
      source: 'cached exact develop visual-review/public status',
    };
  }
  const { data } = await client.get(`/commits/${developSha}/status`, { maxAgeMs: 30_000 });
  const selected = (data.statuses || []).find(status => status.context === 'visual-review/public') || null;
  if (!selected) return { ...base, deployState: 'waiting' };
  const deployState = selected.state === 'success' ? 'success'
    : selected.state === 'pending' ? 'deploying'
      : ['failure', 'error'].includes(selected.state) ? 'failed' : 'unknown';
  const publicStatus = {
    state: selected.state,
    context: selected.context,
    targetUrl: selected.target_url || VISUAL_REVIEW_PUBLIC_URL,
    updatedAt: selected.updated_at || selected.created_at || null,
  };
  return {
    ...base,
    deployedCommit: selected.state === 'success' ? developSha : prior?.deployedCommit || null,
    deployedAt: selected.state === 'success' ? publicStatus.updatedAt : prior?.deployedAt || null,
    deployState,
    publicStatus,
  };
}

export async function buildState(previous = null, { storage, token = '', fetchImpl = fetch, reason = 'manual' } = {}) {
  const startedAt = stamp();
  const client = createGithubClient({ storage, token, fetchImpl });
  try {
    const manifestUrl = new URL('deployment-manifest.json', PAGES_ROOT); manifestUrl.searchParams.set('ops', Date.now());
    const response = await fetchImpl(manifestUrl, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`公開manifest取得: HTTP ${response.status}`);
    const manifest = await response.json();
    if (manifest?.schemaVersion !== 1 || !Array.isArray(manifest.entries)) throw new Error('公開manifestの形式が不正です');
    const branchesResult = await client.get('/branches?per_page=100', { maxAgeMs: 30_000 });
    const branches = new Map((branchesResult.data || []).map(branch => [branch.name, branch]));
    const developSha = branches.get('develop')?.commit?.sha || null;
    const pullSync = await syncPullSnapshot(client, storage);
    const allPulls = pullSync.pulls;
    const { data: actions } = await client.get('/actions/runs?per_page=100', { maxAgeMs: 30_000 });
    const runs = Array.isArray(actions?.workflow_runs) ? actions.workflow_runs : [];
    const developRuns = runs.filter(run => run.name === 'Deploy DEV and PROD' && run.head_branch === 'develop');
    const mainRuns = runs.filter(run => run.name === 'Deploy DEV and PROD' && run.head_branch === 'main');
    const latestDevelopRun = developRuns[0] || null;
    const previousById = new Map((previous?.environments || []).map(env => [env.id, env]));
    let dev = environmentFromManifest('dev', manifest, developSha, latestDevelopRun);
    let prod = environmentFromManifest('prod', manifest, branches.get('main')?.commit?.sha || null, mainRuns[0]);
    dev = await withHistory(dev, previousById.get('dev'), client);
    prod = await withHistory(prod, previousById.get('prod'), client);
    let staging = environmentFromManifest('staging', manifest, publishedCommit(manifest, 'staging').commit, null);
    staging = await withHistory(staging, previousById.get('staging'), client);
    staging.source = 'Pinned validation release / published manifest';
    dev.deployQueue = await compareQueue(dev.deployedCommit, dev.branchCommit, client);
    prod.deployQueue = await compareQueue(prod.deployedCommit, prod.branchCommit, client);
    const previews = [];
    const visualReview = await visualReviewEnvironment(developSha, previous, client);
    if (visualReview) previews.push(visualReview);
    for (const candidate of previewCandidates(runs)) { const env = await previewEnvironment(candidate, branches, previous, client); if (env) previews.push(env); }
    const applications = buildApplications(manifest, [dev, staging, prod, ...previews], runs);

    const integrationRescue = await collectRescue(client, previous?.integrationRescue);
    const plan = integrationRescue?.flowControl?.reconciliation || null;
    const openPulls = allPulls.filter(pr => pr.state === 'open' && !isVisualReviewPull(pr)).sort((a, b) => Date.parse(a.created_at || 0) - Date.parse(b.created_at || 0));
    const baseIntegrationQueue = openPulls.map(pr => classifyPull(pr, runs, developRuns));
    const reconciled = reconcileIntegrationQueue(baseIntegrationQueue, plan, developSha);
    const integrationQueue = reconciled.queue;
    const deliveryVerified = dev.deployState === 'success' && dev.deployedCommit === developSha && dev.exactCommit !== false;
    const integration = overallIntegration(integrationQueue, latestDevelopRun, [dev.deployQueue, prod.deployQueue], Date.now(), {
      deliveryVerified,
      reconciliationFresh: reconciled.fresh,
      actionableIdle: reconciled.actionableIdle,
    });
    const recoveryFrom = RUNNING.has(latestDevelopRun?.status) && latestDevelopRun?.head_sha === developSha
      ? developRuns.slice(1).find(run => run.head_sha === developSha && workflowFailure(run)) || null
      : null;
    const deliveryEstimate = estimatePublicationDuration(developRuns);
    const alerts = [];
    for (const env of [dev, prod]) {
      if (env.deployQueue?.warning) alerts.push({ type: 'branch-diverged', environment: env.id, tone: 'danger', title: `${env.name} の公開版とブランチの系譜を確認`, detail: `${env.deployQueue.state}: ahead ${env.deployQueue.commitsAhead}, behind ${env.deployQueue.commitsBehind}`, url: env.url });
      else if ((env.deployQueue?.commitsAhead || 0) > 0 && env.id !== 'dev') alerts.push({ type: 'deploy-wait', environment: env.id, tone: 'warning', title: `${env.name} 公開待ち`, detail: `${env.deployQueue.commitsAhead} commit 未公開`, url: env.url });
    }
    if (workflowFailure(latestDevelopRun) && !deliveryVerified) alerts.push({ type: 'integration-failed', tone: 'danger', title: 'DEV公開で問題を検出', detail: '公開・検証処理が失敗しています。再試行が始まるまで要確認です。', url: latestDevelopRun.html_url });
    if (reconciled.actionableIdle) alerts.push({ type: 'reconciliation-idle', tone: 'warning', title: '自動統合の再配分待ち', detail: '処理可能なReady PRがありますが、現在のexecutor割当が0です。次のreconcileで再配分します。' });

    const targetLimit = client.deepAllowed && token ? 4 : 0;
    const targets = await enrichTargets(allPulls, client, storage, targetLimit);
    const pullRequests = splitPulls(targets.pulls);
    const failures = actionProblems(runs, allPulls, { verifiedDevelopSha: deliveryVerified ? developSha : null });
    const now = stamp();
    return { schemaVersion: 2, repository: REPOSITORY, generatedAt: now, lastAttemptAt: now, startedAt, syncStatus: 'ok',
      syncSource: 'GitHub API incremental snapshot + published deployment manifests/statuses', syncReason: reason,
      githubRateRemaining: client.remaining,
      githubApi: { scope: client.scope, requests: client.requests, cacheHits: client.cacheHits, maxRequests: client.maxRequests,
        remaining: client.remaining, rate: client.rate, deepEnrichment: client.deepAllowed && token ? 'enabled' : 'deferred' },
      githubFailure: null,
      pullSync: { mode: pullSync.mode, pages: pullSync.pages, complete: pullSync.complete, watermark: pullSync.watermark, fullAt: pullSync.fullAt },
      pullRequests: { ...pullRequests, total: allPulls.length, truncated: !pullSync.complete, targetLookup: { ready: targets.ready, pending: targets.pending, unavailable: targets.unavailable, attempted: targets.attempted } },
      applications, applicationsUpdatedAt: now, applicationsSource: 'public-manifest', environments: [dev, staging, prod, ...previews], environmentDiff: environmentDiff(dev, prod),
      integration: { ...integration, queue: integrationQueue, latestRun: runView(latestDevelopRun), deployWaiting: dev.deployQueue?.pulls || [],
        recovering: Boolean(recoveryFrom), recoveryFrom: runView(recoveryFrom), deliveryEstimate,
        watchdog: { reconciliationFresh: reconciled.fresh, reconciliationReason: reconciled.reason, actionableIdle: reconciled.actionableIdle,
          readyCount: reconciled.readyCount, planGeneratedAt: reconciled.generatedAt, deliveryVerified } },
      integrationRescue,
      deliveryObservability: { notification: integrationRescue?.notification || 'not configured' },
      recentActionFailures: failures.current.map(runView), actionHistory: failures.history.map(runView), alerts,
      publicManifest: { url: manifestUrl.origin + manifestUrl.pathname, schemaVersion: manifest.schemaVersion, validatedDevelop: manifest.validatedDevelop || null, environmentSnapshots: manifest.environmentSnapshots || null } };
  } finally { await client.prune(); }
}
