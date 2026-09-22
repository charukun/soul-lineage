import { isValidationRun, validationRuns } from './integration.mjs';

const stackFastContext = 'integration/stack-fast';

function runIdFromTarget(url) {
  const match = String(url || '').match(/\/actions\/runs\/(\d+)(?:\b|\/|$)/);
  return match ? Number(match[1]) : null;
}

async function normalExactHeadFastFailure(c, pr) {
  const run = (await validationRuns(c, pr)).find(isValidationRun);
  if (!run || ['queued', 'waiting', 'requested', 'pending'].includes(run.status)) return null;
  const jobs = await c.pages(`/actions/runs/${run.id}/jobs?filter=latest`, 'jobs', { maxPages: 3 });
  const job = jobs.find(item => item.name === 'Validate and build');
  if (job?.status !== 'completed' || !['failure', 'timed_out'].includes(job.conclusion) ||
      (job.head_sha && job.head_sha !== pr.head.sha) ||
      (job.run_attempt && run.run_attempt && job.run_attempt !== run.run_attempt)) return null;
  if (!Number.isSafeInteger(run.id) || !Number.isSafeInteger(job.id)) return null;
  return {
    head: pr.head.sha,
    runId: run.id,
    runAttempt: run.run_attempt || 1,
    jobId: job.id,
    jobName: job.name,
    conclusion: job.conclusion,
    runUrl: `https://github.com/${pr.head.repo.full_name}/actions/runs/${run.id}`,
    jobUrl: `https://github.com/${pr.head.repo.full_name}/actions/runs/${run.id}/job/${job.id}`,
  };
}

async function trustedRefreshedHeadFailure(c, pr) {
  const statuses = await c.pages(`/commits/${pr.head.sha}/statuses`, undefined, { maxPages: 10 });
  const status = statuses.find(item => item.context === stackFastContext && item.state === 'failure');
  const runId = runIdFromTarget(status?.target_url);
  if (!Number.isSafeInteger(runId)) return null;

  const run = await c.api('GET', `${c.root}/actions/runs/${runId}`);
  if (run.repository?.full_name !== pr.base.repo.full_name || run.event !== 'workflow_dispatch' ||
      run.head_branch !== 'develop' || run.path !== '.github/workflows/deploy.yml') return null;

  const jobs = await c.pages(`/actions/runs/${runId}/jobs?filter=latest`, 'jobs', { maxPages: 3 });
  const suffix = `Stack Validate and build #${pr.number}`;
  const job = jobs.find(item => item.name === suffix || item.name?.endsWith(` / ${suffix}`));
  if (job?.status !== 'completed' || !['failure', 'timed_out'].includes(job.conclusion) ||
      !Number.isSafeInteger(job.id)) return null;

  return {
    head: pr.head.sha,
    runId,
    runAttempt: run.run_attempt || 1,
    jobId: job.id,
    jobName: job.name,
    conclusion: job.conclusion,
    runUrl: `https://github.com/${pr.head.repo.full_name}/actions/runs/${runId}`,
    jobUrl: `https://github.com/${pr.head.repo.full_name}/actions/runs/${runId}/job/${job.id}`,
  };
}

// Workflow conclusions include browser/observation jobs. Only a completed exact-head
// trusted fast job is source-repair evidence. Bot-refreshed heads may carry an
// approval-required pull_request run with zero jobs; trusted Integration validation
// is the authoritative fallback for those heads.
export async function exactHeadFastFailure(c, pr) {
  return await normalExactHeadFastFailure(c, pr) || await trustedRefreshedHeadFailure(c, pr);
}
