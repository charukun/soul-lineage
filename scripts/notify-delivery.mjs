import { readFileSync, existsSync, appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { lifecycleMessage } from './notification-copy.mjs';

export const PERSONAL_DEV_EMAIL_REPOSITORY = 'charukun/soul-lineage';
export const PERSONAL_DEV_EMAIL_LOGIN = 'charukun';
export const PERSONAL_DEV_URL = 'https://charukun.github.io/soul-lineage/dev/';
const DEV_LKG_PREFIX = 'dev-lkg-site-';
const SHA = /^[a-f0-9]{40}$/;

export function deliveryMessage(stage, { report, sha, repository, runUrl }) {
  if (stage === 'MERGED_TO_DEVELOP' || stage === 'INTEGRATED') {
    if (!report?.merged?.length) return null;
    const fields = {
      phase: 'DEVELOP_MERGE',
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
    return lifecycleMessage('MERGED_TO_DEVELOP', { fields });
  }
  if (stage !== 'DEV_DEPLOYED' || !/^[a-f0-9]{40}$/.test(sha || '')) throw new Error('INVALID_DELIVERY_RESULT');
  return lifecycleMessage('DEV_DEPLOYED', { fields: {
    phase: 'DELIVERY',
    outcome: 'VERIFIED',
    branch: 'develop',
    commit: sha,
    verification: 'FAST_CHECKS+DEV_PUBLIC+HTTP_SOURCE',
    browser: 'OPT_IN',
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
    `確認画像・動画の報告: https://github.com/${repository}/pull/${pr.number}`,
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

export function choosePreviousPublishedDevelopSha(artifacts = [], currentSha = '') {
  return artifacts
    .filter(artifact => !artifact?.expired && String(artifact?.name || '').startsWith(DEV_LKG_PREFIX))
    .map(artifact => ({ artifact, sha: String(artifact.name).slice(DEV_LKG_PREFIX.length) }))
    .filter(item => SHA.test(item.sha) && item.sha !== currentSha)
    .sort((a, b) => Date.parse(b.artifact.created_at || 0) - Date.parse(a.artifact.created_at || 0))[0]?.sha || null;
}

export async function findPreviousPublishedDevelopSha({ token = '', repository, sha, request = fetch }) {
  if (!token) return null;
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository || '') || !SHA.test(sha || '')) throw new Error('INVALID_GITHUB_DELIVERY_BASE');
  const root = `https://api.github.com/repos/${repository}`,artifacts=[];
  for (let page = 1; page <= 3; page++) {
    const payload = await githubJson(request, `${root}/actions/artifacts?per_page=100&page=${page}`, { token });
    const rows = Array.isArray(payload?.artifacts) ? payload.artifacts : [];
    artifacts.push(...rows);
    if (rows.length < 100) break;
  }
  return choosePreviousPublishedDevelopSha(artifacts, sha);
}

function mergePrNumber(commit) {
  const match = String(commit?.commit?.message || '').match(/^Merge (?:pull request|PR) #(\d+)\b/m);
  return match ? Number(match[1]) : null;
}

async function mergedDevelopPrNumbersForCommit({ token, repository, root, commit, request }) {
  const fromMessage = mergePrNumber(commit);
  if (fromMessage) return [fromMessage];
  if (!SHA.test(commit?.sha || '') || !Array.isArray(commit?.parents) || commit.parents.length < 2) return [];
  const associated = await githubJson(request, `${root}/commits/${commit.sha}/pulls?per_page=100`, { token });
  return associated
    .filter(pr => pr?.merged_at && pr?.base?.ref === 'develop' && pr?.base?.repo?.full_name === repository && Number.isInteger(pr?.number))
    .map(pr => pr.number);
}

export async function findPublishedDevelopPrs({ token = '', repository, sha, request = fetch }) {
  if (!token) return [];
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository || '') || !SHA.test(sha || '')) throw new Error('INVALID_GITHUB_DELIVERY_RANGE');
  const root = `https://api.github.com/repos/${repository}`;
  const previous = await findPreviousPublishedDevelopSha({ token, repository, sha, request });
  if (!previous) {
    const direct = await findAssociatedDevelopPr({ token, repository, sha, request });
    return direct ? [direct] : [];
  }

  const numbers = new Set();
  for (let page = 1; page <= 3; page++) {
    const compared = await githubJson(request, `${root}/compare/${previous}...${sha}?per_page=100&page=${page}`, { token });
    if (page === 1 && !['ahead', 'identical'].includes(compared?.status)) {
      const direct = await findAssociatedDevelopPr({ token, repository, sha, request });
      return direct ? [direct] : [];
    }
    const commits = Array.isArray(compared?.commits) ? compared.commits : [];
    for (const commit of commits) {
      const commitNumbers = await mergedDevelopPrNumbersForCommit({ token, repository, root, commit, request });
      commitNumbers.forEach(number => numbers.add(number));
    }
    if (commits.length < 100) break;
    if (page === 3) throw new Error('GITHUB_DELIVERY_RANGE_PAGE_LIMIT');
  }

  const prs = [];
  for (const number of numbers) {
    const pr = await githubJson(request, `${root}/pulls/${number}`, { token });
    if (pr?.merged_at && pr?.base?.ref === 'develop' && pr?.base?.repo?.full_name === repository && SHA.test(pr?.merge_commit_sha || '')) prs.push(pr);
  }
  prs.sort((a, b) => Date.parse(a.merged_at) - Date.parse(b.merged_at) || a.number - b.number);
  if (prs.length) return prs;
  const direct = await findAssociatedDevelopPr({ token, repository, sha, request });
  return direct ? [direct] : [];
}

export async function findAssociatedDevelopPr({ token = '', repository, sha, request = fetch }) {
  if (!token) return null;
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository || '') || !SHA.test(sha || '')) throw new Error('INVALID_GITHUB_DELIVERY_PR');
  const root = `https://api.github.com/repos/${repository}`;
  const prs = await githubJson(request, `${root}/commits/${sha}/pulls?per_page=100`, { token });
  return prs.filter(item => item.merged_at && item.base?.ref === 'develop')
    .sort((a, b) => new Date(b.merged_at) - new Date(a.merged_at))[0] || null;
}

export async function recordDevelopDeliveryStatus({ token = '', repository, sha, runUrl, request = fetch }) {
  if (!token) return 'not-configured';
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository || '') || !SHA.test(sha || '')) throw new Error('INVALID_GITHUB_DELIVERY_STATUS');
  await githubJson(request, `https://api.github.com/repos/${repository}/statuses/${sha}`, {
    token,
    method: 'POST',
    body: {
      state: 'success',
      context: 'dev/delivery',
      description: 'DEV published; HTTP/source verified; browser verification is opt-in',
      target_url: runUrl,
    },
  });
  return 'recorded';
}

export async function recordGithubDeliveryReceipt({ token = '', repository, sha, message, pr: associatedPr, request = fetch }) {
  if (!token) return 'not-configured';
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository || '') || !SHA.test(sha || '')) throw new Error('INVALID_GITHUB_DELIVERY_RECEIPT');
  const root = `https://api.github.com/repos/${repository}`;
  const pr = associatedPr === undefined
    ? await findAssociatedDevelopPr({ token, repository, sha, request })
    : associatedPr;
  if (!pr) return 'no-associated-pr';
  if (!personalDevEmailEligible({ repository, pr }) || !message) return 'personal-email-not-applicable';

  const receiptSha = SHA.test(pr?.merge_commit_sha || '') ? pr.merge_commit_sha : sha;
  const marker = `<!-- dev-delivery-receipt:${receiptSha} -->`;
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

export async function recordGithubDeliveryReceipts({ token = '', repository, sha, prs = [], request = fetch }) {
  const results = [];
  for (const pr of prs) {
    const message = devChangeEmailMessage({ pr, repository });
    const receipt = await recordGithubDeliveryReceipt({ token, repository, sha, message, pr, request });
    results.push({ pr: pr?.number || null, receipt });
  }
  return results;
}

export function developmentEmailStatus(state) {
  return state === 'success' ? { state: 'success', description: 'GitHub PR DEV receipt created or already present' } :
    state === 'skipped' ? { state: 'success', description: 'No eligible merged PR required a DEV receipt' } :
    { state: 'failure', description: 'DEV email receipt creation failed; inspect publisher logs' };
}

function writeOutput(devEmail = 'skipped') {
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `dev_email=${devEmail}\n`);
}

async function main() {
  if (process.env.GITHUB_REF !== 'refs/heads/develop' || process.env.GITHUB_REPOSITORY !== PERSONAL_DEV_EMAIL_REPOSITORY) throw new Error('DEVELOP_DELIVERY_ONLY');
  const [stage, reportPath] = process.argv.slice(2);
  const report = reportPath && existsSync(reportPath) ? JSON.parse(readFileSync(reportPath, 'utf8')) : null;
  const runUrl = `https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`;

  let associatedPrs = [], devEmail = 'skipped';
  if (stage === 'DEV_DEPLOYED') {
    try {
      associatedPrs = await findPublishedDevelopPrs({
        token: process.env.GITHUB_TOKEN,
        repository: process.env.GITHUB_REPOSITORY,
        sha: process.env.FINAL_SHA,
      });
    } catch (error) {
      console.warn(`::warning::DEV change range lookup failed; falling back to the exact published SHA: ${error.message}`);
      try {
        const direct = await findAssociatedDevelopPr({
          token: process.env.GITHUB_TOKEN,
          repository: process.env.GITHUB_REPOSITORY,
          sha: process.env.FINAL_SHA,
        });
        associatedPrs = direct ? [direct] : [];
      } catch (fallbackError) {
        console.warn(`::warning::DEV change fallback lookup failed; no personal development email will be created: ${fallbackError.message}`);
        devEmail = 'failure';
      }
    }
  }

  const message = deliveryMessage(stage, { report, sha: process.env.FINAL_SHA,
    repository: process.env.GITHUB_REPOSITORY, runUrl });
  if (!message) { writeOutput(devEmail); return; }

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
      const receipts = await recordGithubDeliveryReceipts({
        token: process.env.GITHUB_TOKEN,
        repository: process.env.GITHUB_REPOSITORY,
        sha: process.env.FINAL_SHA,
        prs: associatedPrs,
      });
      const applicable = receipts.filter(item => !['personal-email-not-applicable', 'no-associated-pr', 'not-configured'].includes(item.receipt));
      devEmail = applicable.length ? 'success' : associatedPrs.length ? 'skipped' : devEmail;
      console.log(`Personal development email receipts: ${JSON.stringify(receipts)}`);
    } catch (error) {
      devEmail = 'failure';
      console.warn(`::warning::Personal development email receipts failed: ${error.message}`);
    }
  }

  writeOutput(devEmail);
  console.log(message);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
