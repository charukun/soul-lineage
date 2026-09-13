// Ready is the worker's terminal boundary, independent of CI/browser completion.
// Run only from trusted develop in the existing immediate CI observation job.
export const HANDOFF_CONTEXT = 'implementation/handoff';
export const READY = 'READY_FOR_INTEGRATION';
export const WORKER_CI_RULES = `Read docs/RINNE_PROJECT_EXECUTION_POLICY.md.
Do not wait for GitHub Actions, CI or Playwright/browser completion. No gh run watch,
gh pr checks --watch, repeated Actions/check API reads, or sleep/polling until completion.
Running / Queued / Pending means hand off without waiting. One short post-push snapshot
may identify an already-failed check; never wait for an unfinished check to fail or pass.
The wrapper owns push/Ready and then ends the worker responsibility as READY_FOR_INTEGRATION.
Integration owns continued CI/browser monitoring, retries, merge and DEV deployment.
Return your implementation result immediately; session silence is not a monitoring service.`;

export function handoffSnapshot(pr, repository, expectedHead = pr?.head?.sha) {
  if (pr?.state !== 'open' || pr.draft || pr.base?.ref !== 'develop' ||
      pr.head?.repo?.full_name !== repository || pr.head.sha !== expectedHead ||
      !['OWNER', 'MEMBER', 'COLLABORATOR'].includes(pr.author_association) ||
      pr.head.ref === 'work/visual-review-lab-v2') return null;
  return { stage: READY, workerEnded: true, monitoringOwner: 'Integration',
    branch: pr.head.ref, commit: pr.head.sha, pr: pr.number, url: pr.html_url,
    ready: true, ci: 'Integration owns current checks; completion is not awaited' };
}

export async function notifyStage(message, { url = '', token = '', request = fetch } = {}) {
  if (!url) return 'not-configured';
  if (!url.startsWith('https://')) throw new Error('NTFY_HTTPS_REQUIRED');
  const response = await request(url, { method: 'POST',
    headers: { 'Content-Type': 'text/plain; charset=utf-8', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: message, signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`NTFY_FAILED:${response.status}`);
  return 'ntfy';
}

export async function recordHandoff({ github, repo, number, expectedHead, runUrl, notification, warn = () => {} }) {
  const repository = `${repo.owner}/${repo.repo}`;
  const readPull = async () => (await github.rest.pulls.get({ ...repo, pull_number: number })).data;
  const pr = await readPull();
  const snapshot = handoffSnapshot(pr, repository, expectedHead);
  if (!snapshot) return { skipped: true };
  const marker = `<!-- implementation-handoff:${number}:${snapshot.commit} -->`;
  let previous;
  // Bounded pagination of a durable receipt, never CI polling.
  for (let page = 1; page <= 3; page++) {
    const { data } = await github.rest.issues.listComments({ ...repo, issue_number: number, per_page: 100, page });
    previous = data.find(c => c.user?.login === 'github-actions[bot]' && c.body?.includes(marker));
    if (previous || data.length < 100) break;
    if (page === 3) throw new Error('HANDOFF_COMMENT_PAGE_LIMIT');
  }
  // Ready/Draft/head can change while reading receipts; never record a stale event.
  if (!handoffSnapshot(await readPull(), repository, expectedHead)) return { skipped: true };
  const message = `${pr.title}\n${READY}\nbranch: ${snapshot.branch}\ncommit: ${snapshot.commit}\nPR: ${snapshot.url}\nReady for review: true\nCI / browser / retry owner: Integration\nImplementation worker: ended; no CI wait\nRun: ${runUrl}`;
  await github.rest.repos.createCommitStatus({ ...repo, sha: snapshot.commit, context: HANDOFF_CONTEXT,
    state: 'success', description: `${READY}; worker ended; CI owned by Integration`, target_url: snapshot.url });
  let channel = previous?.body?.includes('notification: ntfy') ? 'ntfy' : 'not-configured';
  if (channel !== 'ntfy') {
    try { channel = await notifyStage(message, notification); }
    catch (error) { channel = 'failed'; warn(error.message); }
  }
  if (channel === 'not-configured') warn('NTFY_TOPIC_URL is not configured; GitHub handoff recorded, smartphone delivery unconfirmed.');
  const body = `${marker}\n${message}\nnotification: ${channel}\n\nThis receipt is not CI success, merge approval, or DEV publication. Holds and all Integration gates remain applicable.`;
  if (!previous) await github.rest.issues.createComment({ ...repo, issue_number: number, body });
  else if (previous.body !== body) await github.rest.issues.updateComment({ ...repo, comment_id: previous.id, body });
  return { ...snapshot, notification: channel };
}
