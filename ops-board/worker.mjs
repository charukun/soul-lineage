import { DurableObject } from 'cloudflare:workers';
import {
  API_HISTORY_PAGE_LIMIT,
  GITHUB_API,
  PAGES_ROOT,
  REPOSITORY,
  classifyPull,
  deploymentQueue,
  environmentDiff,
  overallIntegration,
  parseMergePulls,
  publishedCommit,
  workflowFailure,
} from './model.mjs';
import { splitPulls } from './pulls.mjs';
import { buildApplications } from './applications.mjs';

const STATE_KEY = 'ops-state-v1';
const REFRESH_TOKEN_HEADER = 'authorization';
const API_VERSION = '2022-11-28';
const HISTORY_PAGE_SIZE = 100;
const MAX_PREVIEW_ENVIRONMENTS = 4;

const failureConclusions = new Set(['failure', 'cancelled', 'timed_out', 'action_required', 'startup_failure', 'stale']);

function json(data, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set('content-type', 'application/json; charset=utf-8');
  headers.set('cache-control', 'no-store');
  return new Response(JSON.stringify(data), { ...init, headers });
}

function isoNow() {
  return new Date().toISOString();
}

function runView(run) {
  if (!run) return null;
  return {
    id: run.id,
    workflow: run.name,
    status: run.status,
    conclusion: run.conclusion,
    branch: run.head_branch,
    sha: run.head_sha,
    event: run.event,
    createdAt: run.created_at,
    updatedAt: run.updated_at,
    url: run.html_url,
  };
}

function deploymentState(branchSha, deployedSha, run) {
  if (!deployedSha) return 'unknown';
  if (branchSha === deployedSha) return 'success';
  if (run && ['queued', 'in_progress', 'waiting', 'requested', 'pending'].includes(run.status)) return 'deploying';
  if (run && workflowFailure(run)) return 'failed';
  return 'waiting';
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      accept: 'application/vnd.github+json',
      'user-agent': 'rinne-ops-board/1.0',
      ...(options.headers || {}),
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`${options.label || 'fetch'}: HTTP ${response.status}`);
  return { data: await response.json(), response };
}

async function github(path) {
  return fetchJson(`${GITHUB_API}${path}`, {
    headers: { 'x-github-api-version': API_VERSION },
    label: `GitHub ${path}`,
  });
}

async function githubHistory(sha) {
  const commits = [];
  let complete = false;
  let rateRemaining = null;
  for (let page = 1; page <= API_HISTORY_PAGE_LIMIT; page++) {
    const { data, response } = await github(`/commits?sha=${encodeURIComponent(sha)}&per_page=${HISTORY_PAGE_SIZE}&page=${page}`);
    if (!Array.isArray(data)) throw new Error('GitHub commit history returned a non-array payload');
    commits.push(...data);
    rateRemaining = Number(response.headers.get('x-ratelimit-remaining'));
    if (data.length < HISTORY_PAGE_SIZE) {
      complete = true;
      break;
    }
  }
  return { pulls: parseMergePulls(commits), historyComplete: complete, commitCountScanned: commits.length, rateRemaining };
}

function canReuseHistory(previousEnvironment, commit) {
  return Boolean(commit && previousEnvironment?.deployedCommit === commit && Array.isArray(previousEnvironment?.reflectedPrs));
}

async function withHistory(environment, previousEnvironment) {
  if (!environment.deployedCommit) return { ...environment, reflectedPrs: [], reflectedPrCount: null, historyComplete: false };
  if (canReuseHistory(previousEnvironment, environment.deployedCommit)) {
    return {
      ...environment,
      reflectedPrs: previousEnvironment.reflectedPrs,
      reflectedPrCount: previousEnvironment.reflectedPrCount,
      historyComplete: previousEnvironment.historyComplete,
      commitCountScanned: previousEnvironment.commitCountScanned,
    };
  }
  const history = await githubHistory(environment.deployedCommit);
  return {
    ...environment,
    ...history,
    reflectedPrCount: history.historyComplete ? history.pulls.length : null,
    reflectedPrs: history.pulls,
  };
}

function previewCandidates(runs) {
  const names = [];
  for (const run of runs) {
    if (!run?.name || run.name === 'Rinne Ops Board') continue;
    if (!/(visual.*review|review.*preview|preview)/i.test(run.name)) continue;
    if (!names.includes(run.name)) names.push(run.name);
    if (names.length >= MAX_PREVIEW_ENVIRONMENTS) break;
  }
  return names.map(name => {
    const all = runs.filter(run => run.name === name);
    return { name, latest: all[0] || null, success: all.find(run => run.status === 'completed' && run.conclusion === 'success') || null };
  }).filter(item => item.success);
}

function previewName(context, workflowName) {
  if (context === 'visual-review/public') return 'Visual Review Lab';
  return workflowName.replace(/\bpreview\b/ig, '').trim() || context.replace(/\/public$/, '');
}

async function buildPreviewEnvironment(candidate, branches, previous) {
  const success = candidate.success;
  const prior = (previous?.environments || []).find(env => env.kind === 'preview' && env.workflow === candidate.name);
  let publicStatus = null;
  if (prior?.deployedCommit === success.head_sha && prior?.publicStatus?.targetUrl) {
    publicStatus = prior.publicStatus;
  } else {
    const { data } = await github(`/commits/${success.head_sha}/status`);
    const statuses = Array.isArray(data.statuses) ? data.statuses : [];
    const selected = statuses.find(status => status.state === 'success' && /\/public$/.test(status.context || '') && /^https:\/\//.test(status.target_url || ''))
      || statuses.find(status => /\/public$/.test(status.context || '') && /^https:\/\//.test(status.target_url || ''));
    if (!selected) return null;
    publicStatus = {
      state: selected.state,
      context: selected.context,
      targetUrl: selected.target_url,
      updatedAt: selected.updated_at || selected.created_at || null,
    };
  }
  const branchSha = branches.get(success.head_branch)?.commit?.sha || success.head_sha;
  const latest = candidate.latest;
  const environment = {
    id: publicStatus.context.replace(/\/public$/, ''),
    kind: 'preview',
    name: previewName(publicStatus.context, candidate.name),
    workflow: candidate.name,
    branch: success.head_branch,
    branchCommit: branchSha,
    deployedCommit: success.head_sha,
    deployedAt: publicStatus.updatedAt,
    url: publicStatus.targetUrl,
    deployState: latest?.head_sha === success.head_sha && latest?.conclusion === 'success'
      ? 'success'
      : (latest && latest.status !== 'completed' ? 'deploying' : (latest && failureConclusions.has(latest.conclusion) ? 'failed' : 'success')),
    publicStatus,
    latestRun: runView(latest),
    source: 'GitHub Actions + commit status',
  };
  return withHistory(environment, prior);
}

async function compareQueue(deployedCommit, branchCommit) {
  if (!deployedCommit || !branchCommit) return deploymentQueue(null);
  if (deployedCommit === branchCommit) return deploymentQueue({ status: 'identical', ahead_by: 0, behind_by: 0, total_commits: 0, commits: [] });
  const { data } = await github(`/compare/${encodeURIComponent(deployedCommit)}...${encodeURIComponent(branchCommit)}`);
  return deploymentQueue(data);
}

function environmentFromManifest(id, manifest, branchCommit, deployRun) {
  const published = publishedCommit(manifest, id);
  const name = { dev: 'DEV', staging: 'STAGING / 検証', prod: 'Production' }[id];
  const branch = manifest.environmentSnapshots?.[id]?.branch || (id === 'prod' ? 'main' : 'develop');
  return {
    id,
    kind: 'pages',
    name,
    branch,
    branchCommit,
    deployedCommit: published.commit,
    sourceCommits: published.sourceCommits || [],
    deployedAt: published.deployedAt || null,
    url: `${PAGES_ROOT}${id}/`,
    deployState: deploymentState(branchCommit, published.commit, deployRun),
    latestRun: runView(deployRun),
    source: 'GitHub Pages deployment-manifest.json',
    exactCommit: published.exact,
  };
}

function recentFailures(runs) {
  return runs.filter(run => run.status === 'completed' && failureConclusions.has(run.conclusion)).slice(0, 10).map(runView);
}

export async function buildState(previous = null) {
  const startedAt = isoNow();
  const manifestUrl = new URL('deployment-manifest.json', PAGES_ROOT);
  manifestUrl.searchParams.set('ops', Date.now().toString());
  const [manifestResult, branchesResult, pullsResult, runsResult] = await Promise.all([
    fetchJson(manifestUrl, { headers: { accept: 'application/json' }, label: 'Published deployment manifest' }),
    github('/branches?per_page=100'),
    github('/pulls?state=all&base=develop&sort=updated&direction=desc&per_page=100'),
    github('/actions/runs?per_page=100'),
  ]);

  const manifest = manifestResult.data;
  const branches = new Map((branchesResult.data || []).map(branch => [branch.name, branch]));
  const allPulls = Array.isArray(pullsResult.data) ? pullsResult.data : [];
  const openPulls = allPulls
    .filter(pr => pr.state === 'open')
    .sort((a, b) => (Date.parse(a.created_at || 0) || 0) - (Date.parse(b.created_at || 0) || 0));
  const pullRequests = splitPulls(allPulls);
  const runs = Array.isArray(runsResult.data?.workflow_runs) ? runsResult.data.workflow_runs : [];
  const developRuns = runs.filter(run => run.name === 'Deploy DEV and PROD' && run.head_branch === 'develop');
  const mainRuns = runs.filter(run => run.name === 'Deploy DEV and PROD' && run.head_branch === 'main');
  const latestDevelopRun = developRuns[0] || null;
  const latestMainRun = mainRuns[0] || null;
  const previousById = new Map((previous?.environments || []).map(env => [env.id, env]));

  let dev = environmentFromManifest('dev', manifest, branches.get('develop')?.commit?.sha || null, latestDevelopRun);
  let prod = environmentFromManifest('prod', manifest, branches.get('main')?.commit?.sha || null, latestMainRun);
  let staging = environmentFromManifest('staging', manifest, publishedCommit(manifest, 'staging').commit, null);
  staging = await withHistory(staging, previousById.get('staging'));
  staging.source = 'Pinned validation release / published manifest';
  dev = await withHistory(dev, previousById.get('dev'));
  prod = await withHistory(prod, previousById.get('prod'));
  dev.deployQueue = await compareQueue(dev.deployedCommit, dev.branchCommit);
  prod.deployQueue = await compareQueue(prod.deployedCommit, prod.branchCommit);

  const previews = [];
  for (const candidate of previewCandidates(runs)) {
    const environment = await buildPreviewEnvironment(candidate, branches, previous);
    if (environment) previews.push(environment);
  }
  const applications = buildApplications(manifest, [dev, staging, prod, ...previews], runs);

  const integrationQueue = openPulls.map(pr => classifyPull(pr, runs, developRuns));
  const diff = environmentDiff(dev, prod);
  const integration = overallIntegration(integrationQueue, latestDevelopRun, [dev.deployQueue, prod.deployQueue]);
  const alerts = [];
  for (const item of integrationQueue.filter(item => item.warning)) {
    alerts.push({ type: 'stalled-ready-pr', tone: 'danger', title: `#${item.number} がIntegration滞留`, detail: item.reason, url: item.url, since: item.eligibleSince });
  }
  for (const env of [dev, prod]) {
    if (env.deployQueue?.warning) alerts.push({ type: 'branch-diverged', tone: 'danger', title: `${env.name} のbranch/deploy系譜に異常`, detail: `${env.deployQueue.state}: ahead ${env.deployQueue.commitsAhead}, behind ${env.deployQueue.commitsBehind}`, url: env.url });
    else if ((env.deployQueue?.commitsAhead || 0) > 0) alerts.push({ type: 'deploy-wait', tone: 'warning', title: `${env.name} deploy待ち`, detail: `${env.deployQueue.commitsAhead} commit 未公開`, url: env.url });
  }
  if (workflowFailure(latestDevelopRun)) alerts.push({ type: 'integration-failed', tone: 'danger', title: 'Integration workflow失敗', detail: latestDevelopRun.conclusion, url: latestDevelopRun.html_url });

  const rateRemaining = Math.min(...[branchesResult, pullsResult, runsResult]
    .map(item => Number(item.response.headers.get('x-ratelimit-remaining')))
    .filter(Number.isFinite));

  return {
    schemaVersion: 1,
    repository: REPOSITORY,
    generatedAt: isoNow(),
    startedAt,
    syncSource: 'GitHub API + published deployment manifests/statuses',
    githubRateRemaining: Number.isFinite(rateRemaining) ? rateRemaining : null,
    pullRequests: {
      normal: pullRequests.normal,
      visualReview: pullRequests.visualReview,
      total: allPulls.length,
      truncated: allPulls.length >= 100,
    },
    applications,
    environments: [dev, staging, prod, ...previews],
    environmentDiff: diff,
    integration: {
      ...integration,
      queue: integrationQueue,
      latestRun: runView(latestDevelopRun),
      deployWaiting: dev.deployQueue?.pulls || [],
      watchdog: {
        stalledThresholdMinutes: 10,
        staleReadyCount: integrationQueue.filter(item => item.warning).length,
      },
    },
    recentActionFailures: recentFailures(runs),
    alerts,
    publicManifest: {
      url: manifestUrl.origin + manifestUrl.pathname,
      schemaVersion: manifest.schemaVersion,
      validatedDevelop: manifest.validatedDevelop || null,
      environmentSnapshots: manifest.environmentSnapshots || null,
    },
  };
}

export class OpsState extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx = ctx;
    this.env = env;
    this.inflight = null;
  }

  async getState() {
    return await this.ctx.storage.get(STATE_KEY) || null;
  }

  async refresh(source = 'manual') {
    if (this.inflight) return this.inflight;
    this.inflight = (async () => {
      const previous = await this.getState();
      try {
        const state = await buildState(previous);
        state.refreshReason = source;
        state.syncStatus = 'ok';
        await this.ctx.storage.put(STATE_KEY, state);
        return state;
      } catch (error) {
        if (!previous) throw error;
        const degraded = {
          ...previous,
          syncStatus: 'degraded',
          syncError: String(error?.message || error),
          lastAttemptAt: isoNow(),
          refreshReason: source,
        };
        await this.ctx.storage.put(STATE_KEY, degraded);
        return degraded;
      } finally {
        this.inflight = null;
      }
    })();
    return this.inflight;
  }
}

function authorized(request, env) {
  const token = env.OPS_REFRESH_TOKEN;
  if (!token) return false;
  return request.headers.get(REFRESH_TOKEN_HEADER) === `Bearer ${token}`;
}

async function stateStub(env) {
  return env.OPS_STATE.getByName('global');
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/state' && request.method === 'GET') {
      const stub = await stateStub(env);
      let state = await stub.getState();
      if (!state) state = await stub.refresh('cold-start');
      return json(state);
    }
    if (url.pathname === '/api/refresh' && request.method === 'POST') {
      if (!authorized(request, env)) return json({ error: 'unauthorized' }, { status: 401 });
      const stub = await stateStub(env);
      return json(await stub.refresh('github-event'));
    }
    if (url.pathname.startsWith('/api/')) return json({ error: 'not_found' }, { status: 404 });
    return env.ASSETS.fetch(request);
  },

  async scheduled(controller, env, ctx) {
    const stub = await stateStub(env);
    ctx.waitUntil(stub.refresh(`cron:${controller.cron}`));
  },
};
