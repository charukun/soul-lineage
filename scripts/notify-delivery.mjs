import { readFileSync, existsSync, appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { notifyStage } from './implementation-handoff.mjs';
import { lifecycleMessage, notificationTitle } from './notification-copy.mjs';

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

export function devChangeEmailMessage({ pr, sha, repository, runUrl, locale = 'ja' }) {
  if (!pr?.number || !pr?.title) return null;
  const language = /^en(?:[-_]|$)/i.test(String(locale)) ? 'en' : 'ja';
  if (language === 'ja') return [
    'DEV反映完了',
    `修正内容: ${pr.title}`,
    'DEVで確認できます。',
    'https://charukun.github.io/soul-lineage/dev/',
    `PR: https://github.com/${repository}/pull/${pr.number}`,
    `commit: ${sha}`,
    `Run: ${runUrl}`,
  ].join('\n');
  return [
    'DEV deployment complete',
    `Change: ${pr.title}`,
    'Review it on DEV:',
    'https://charukun.github.io/soul-lineage/dev/',
    `PR: https://github.com/${repository}/pull/${pr.number}`,
    `commit: ${sha}`,
    `Run: ${runUrl}`,
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

export async function recordGithubDeliveryReceipt({ token = '', repository, sha, runUrl, message, pr: associatedPr, request = fetch }) {
  if (!token) return 'not-configured';
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository || '') || !/^[a-f0-9]{40}$/.test(sha || '')) throw new Error('INVALID_GITHUB_DELIVERY_RECEIPT');
  const root = `https://api.github.com/repos/${repository}`;
  const pr = associatedPr === undefined
    ? await findAssociatedDevelopPr({ token, repository, sha, request })
    : associatedPr;
  if (!pr) return 'no-associated-pr';
  const marker = `<!-- dev-delivery-receipt:${sha} -->`;
  for (let page = 1; page <= 3; page++) {
    const comments = await githubJson(request, `${root}/issues/${pr.number}/comments?per_page=100&page=${page}`, { token });
    if (comments.some(comment => (comment.body || '').includes(marker))) return 'existing';
    if (comments.length < 100) break;
    if (page === 3) throw new Error('GITHUB_DELIVERY_RECEIPT_COMMENT_PAGE_LIMIT');
  }
  const mention = pr.user?.login ? `@${pr.user.login}\n` : '';
  await githubJson(request, `${root}/issues/${pr.number}/comments`, {
    token,
    method: 'POST',
    body: { body: `${marker}\n${mention}${message}\n\nreceipt: VERIFIED_DEV_PUBLICATION\nDevelopment DEV delivery receipt. GitHub PR subscription/mention provides the email notification.\n${runUrl}` },
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
  if (process.env.GITHUB_REF !== 'refs/heads/develop' || process.env.GITHUB_REPOSITORY !== 'charukun/soul-lineage') throw new Error('DEVELOP_DELIVERY_ONLY');
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
      console.warn(`::warning::DEV change lookup failed; no development email receipt will be created: ${error.message}`);
    }
  }

  const message = deliveryMessage(stage, { report, sha: process.env.FINAL_SHA,
    repository: process.env.GITHUB_REPOSITORY, runUrl });
  if (!message) { writeOutput('skipped'); return; }

  // GitHub is the delivery source of truth. The human-facing DEV change notice is a PR comment,
  // which is delivered through the developer's existing GitHub email subscription/mention route.
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
        sha: process.env.FINAL_SHA,
        repository: process.env.GITHUB_REPOSITORY,
        runUrl,
      });
      const receipt = await recordGithubDeliveryReceipt({
        token: process.env.GITHUB_TOKEN,
        repository: process.env.GITHUB_REPOSITORY,
        sha: process.env.FINAL_SHA,
        runUrl,
        message: emailMessage || message,
        pr: associatedPr,
      });
      console.log(`GitHub development email receipt: ${receipt}`);
    } catch (error) {
      console.warn(`::warning::GitHub development email receipt failed: ${error.message}`);
    }
  }

  // Preserve the pre-existing lifecycle channel, but do not put the requested change title/DEV review copy in it.
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
