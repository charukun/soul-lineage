import { readFileSync, existsSync, appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { notifyStage } from './implementation-handoff.mjs';
import { lifecycleMessage, notificationTitle } from './notification-copy.mjs';

export const PERSONAL_DEV_EMAIL_REPOSITORY = 'charukun/soul-lineage';
export const PERSONAL_DEV_EMAIL_LOGIN = 'charukun';
export const PERSONAL_DEV_URL = 'https://charukun.github.io/soul-lineage/dev/';

export function deliveryMessage(stage, { report, sha, repository, runUrl }) {
  if (stage === 'INTEGRATED') {
    if (!report?.merged?.length) return null;
    const fields = {
      phase: 'INTEGRATION',
      outcome: 'MERGED',
      branch: 'develop',
      dev_publication: 'PENDING',
      next: 'DEV_DEPLOYED|FAILED',
      run_url: runUrl,
    };
    report.merged.forEach((item, index) => {
      const slot = index + 1;
      fields[`pr_${slot}`] = `https://github.com/${repository}/pull/${item.pr}`;
      fields[`commit_${slot}`] = item.merge;
    });
    return lifecycleMessage('INTEGRATED', { fields });
  }
  if (stage !== 'DEV_DEPLOYED' || !/^[a-f0-9]{40}$/.test(sha || '')) throw new Error('INVALID_DELIVERY_RESULT');
  return lifecycleMessage('DEV_DEPLOYED', { fields: {
    phase: 'DELIVERY',
    outcome: 'VERIFIED',
    branch: 'develop',
    commit: sha,
    verification: 'FAST_CHECKS+DEV_PUBLIC+HTTP_SOURCE',
    browser: 'ASYNC_DIAGNOSTICS',
    action: 'NONE',
    run_url: runUrl,
  } });
}

export function personalDevEmailEligible({ repository, pr }) {
  return repository === PERSONAL_DEV_EMAIL_REPOSITORY && pr?.user?.login === PERSONAL_DEV_EMAIL_LOGIN;
}

export function personalDevChangeLabel(pr) {
  const firstBodyLine = String(pr?.body || '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .find(Boolean);
  return firstBodyLine || String(pr?.title || '').trim();
}

export function devChangeEmailMessage({ pr, repository }) {
  if (!personalDevEmailEligible({ repository, pr }) || !pr?.number) return null;
  const label = personalDevChangeLabel(pr);
  if (!label) return null;
  return [
    'DEV反映完了',
    `「${label}」をDEVに反映しました。`,
    `DEVを確認: ${PERSONAL_DEV_URL}`,
  ].join('\n');
}

async function githubJson(request, url, { token, method = 'GET', body } = {}) {
  const response = await request(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`GITHUB_DELIVERY_RECEIPT_FAILED:${response.status}:${method}:${url}`);
  return response.status === 204 ? null : response.json();
}

export async function findAssociatedDevelopPr({ token = '', repository, sha, request = fetch }) {
  if (!token) return null;
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository || '') || !/^[a-f0-9]{40}$/.test(sha || '')) throw new Error('INVALID_GITHUB_DELIVERY_PR');
  const root = `https://api.github.com/repos/${repository}`;
  const prs = await githubJson(request, `${root}/commits/${sha}/pulls?per_page=100`, { token });
  return prs.filter(item => item.merged_at && item.base?.ref === 'develop')
    .sort((a, b) => new Date(b.merged_at) - new Date(a.merged_at))[0] || null;
}

export async function recordDevelopDeliveryStatus({ token = '', repository, sha, runUrl, request = fetch }) {
  if (!token) return 'not-configured';
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository || '') || !/^[a-f0-9]{40}$/.test(sha || '')) throw new Error('INVALID_GITHUB_DELIVERY_STATUS');
  await githubJson(request, `https://api.github.com/repos/${repository}/statuses/${sha}`, {
    token,
    method: 'POST',
    body: {
      state: 'success',
      context: 'integration/develop',
      description: 'DEV published; HTTP/source verified; browser diagnostics are asynchronous',
      target_url: runUrl,
    },
  });
  return 'recorded';
}

export async function recordGithubDeliveryReceipt({ token = '', repository, sha, message, pr: associatedPr, request = fetch }) {
  if (!token) return 'not-configured';
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository || '') || !/^[a-f0-9]{40}$/.test(sha || '')) throw new Error('INVALID_GITHUB_DELIVERY_RECEIPT');
  const root = `https://api.github.com/repos/${repository}`;
  const pr = associatedPr === undefined
    ? await findAssociatedDevelopPr({ token, repository, sha, request })
    : associatedPr;
  if (!pr) return 'no-associated-pr';
  if (!personalDevEmailEligible({ repository, pr }) || !message) return 'personal-email-not-applicable';

  const marker = `<!-- dev-delivery-receipt:${sha} -->`;
  for (let page = 1; page <= 3; page++) {
    const comments = await githubJson(request, `${root}/issues/${pr.number}/comments?per_page=100&page=${page}`, { token });
    if (comments.some(comment => (comment.body || '').includes(marker))) return 'existing';
    if (comments.length < 100) break;
    if (page === 3) throw new Error('GITHUB_DELIVERY_RECEIPT_COMMENT_PAGE_LIMIT');
  }
  await githubJson(request, `${root}/issues/${pr.number}/comments`, {
    token,
    method: 'POST',
    body: { body: `${marker}\n@${PERSONAL_DEV_EMAIL_LOGIN}\n${message}` },
  });
  return 'github-pr-comment';
}

export function notificationStatus(channel) {
  return channel === 'ntfy' ? { state: 'success', description: 'ntfy smartphone delivery confirmed' } :
    channel === 'not-configured' ? { state: 'error', description: 'NTFY_TOPIC_URL is not configured; smartphone delivery unconfirmed' } :
    channel === 'skipped' ? { state: 'success', description: 'No delivery notification required for this run' } :
    { state: 'failure', description: 'ntfy delivery failed; GitHub remains authoritative' };
}

function writeOutput(channel) {
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `channel=${channel}\n`);
}

async function main() {
  if (process.env.GITHUB_REF !== 'refs/heads/develop' || process.env.GITHUB_REPOSITORY !== PERSONAL_DEV_EMAIL_REPOSITORY) throw new Error('DEVELOP_DELIVERY_ONLY');
  const [stage, reportPath] = process.argv.slice(2);
  const report = reportPath && existsSync(reportPath) ? JSON.parse(readFileSync(reportPath, 'utf8')) : null;
  const runUrl = `https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`;

  let associatedPr = null;
  if (stage === 'DEV_DEPLOYED') {
    try {
      associatedPr = await findAssociatedDevelopPr({
        token: process.env.GITHUB_TOKEN,
        repository: process.env.GITHUB_REPOSITORY,
        sha: process.env.FINAL_SHA,
      });
    } catch (error) {
      console.warn(`::warning::DEV change lookup failed; no personal development email will be created: ${error.message}`);
    }
  }

  const message = deliveryMessage(stage, { report, sha: process.env.FINAL_SHA,
    repository: process.env.GITHUB_REPOSITORY, runUrl });
  if (!message) { writeOutput('skipped'); return; }

  if (stage === 'DEV_DEPLOYED') {
    try {
      const status = await recordDevelopDeliveryStatus({
        token: process.env.GITHUB_TOKEN,
        repository: process.env.GITHUB_REPOSITORY,
        sha: process.env.FINAL_SHA,
        runUrl,
      });
      console.log(`GitHub DEV delivery status: ${status}`);
    } catch (error) {
      console.warn(`::warning::GitHub DEV delivery status failed: ${error.message}`);
    }
    try {
      const emailMessage = devChangeEmailMessage({
        pr: associatedPr,
        repository: process.env.GITHUB_REPOSITORY,
      });
      const receipt = await recordGithubDeliveryReceipt({
        token: process.env.GITHUB_TOKEN,
        repository: process.env.GITHUB_REPOSITORY,
        sha: process.env.FINAL_SHA,
        message: emailMessage,
        pr: associatedPr,
      });
      console.log(`Personal development email receipt: ${receipt}`);
    } catch (error) {
      console.warn(`::warning::Personal development email receipt failed: ${error.message}`);
    }
  }

  let channel = 'failed';
  try {
    channel = await notifyStage(message, {
      url: process.env.NTFY_TOPIC_URL,
      token: process.env.NTFY_TOKEN,
      title: notificationTitle(stage),
    });
  } catch (error) {
    writeOutput(channel);
    throw error;
  }
  writeOutput(channel);
  console.log(message);
  if (channel === 'not-configured') console.warn('::warning::NTFY_TOPIC_URL not configured; GitHub is authoritative, smartphone delivery unconfirmed.');
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
