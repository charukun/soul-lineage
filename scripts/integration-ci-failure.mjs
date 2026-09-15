import { isValidationRun, validationRuns } from './integration.mjs';

// Workflow conclusions include browser/observation jobs. Only the newest validation
// run's completed fast job is evidence of a source repair, even while its wake runs.
export async function exactHeadFastFailure(c, pr) {
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
