export const stackFastContext = 'integration/stack-fast';

function runIdFromTarget(url) {
  const match = String(url || '').match(/\/actions\/runs\/(\d+)(?:\b|\/|$)/);
  return match ? match[1] : null;
}

export async function trustedStackFastEvidence(c, pr, options = {}) {
  const cache = options.cache === true;
  const statuses = await c.pages(`/commits/${pr.head.sha}/statuses`, undefined, { maxPages: 10, cache });
  const status = statuses.find(item => item.context === stackFastContext);
  if (status?.state !== 'success') return null;
  const runId = runIdFromTarget(status.target_url);
  if (!runId) return null;

  const run = await c.api('GET', `${c.root}/actions/runs/${runId}`);
  if (run.repository?.full_name !== pr.base.repo.full_name || run.event !== 'workflow_dispatch' ||
      run.head_branch !== 'develop' || run.path !== '.github/workflows/deploy.yml') return null;

  const [artifacts, jobs] = await Promise.all([
    c.pages(`/actions/runs/${runId}/artifacts`, 'artifacts', { maxPages: 3, cache }),
    c.pages(`/actions/runs/${runId}/jobs?filter=latest`, 'jobs', { maxPages: 3, cache }),
  ]);
  if (!artifacts.some(item => item.name === `pr-fast-${pr.number}-${pr.head.sha}` && !item.expired)) return null;
  const suffix = `Stack Validate and build #${pr.number}`;
  const job = jobs.find(item => item.name === suffix || item.name?.endsWith(` / ${suffix}`));
  if (job?.status !== 'completed' || job.conclusion !== 'success') return null;
  return { pr: pr.number, head: pr.head.sha, runId: String(runId), source: 'integration-rescue-stack' };
}
