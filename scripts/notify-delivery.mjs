import { readFileSync, existsSync, appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { notifyStage } from './implementation-handoff.mjs';
import { lifecycleMessage, normalizeNotificationLocale, notificationTitle } from './notification-copy.mjs';

export function deliveryMessage(stage, { report, sha, repository, runUrl, locale = 'en' }) {
  if (stage === 'INTEGRATED') {
    if (!report?.merged?.length) return null;
    return lifecycleMessage('INTEGRATED', { locale, lines: [
      'branch: develop',
      ...report.merged.flatMap(item => [
        `PR: https://github.com/${repository}/pull/${item.pr}`,
        `commit: ${item.merge}`,
      ]),
      'DEV verification remains Integration responsibility.',
      `Run: ${runUrl}`,
    ] });
  }
  if (stage !== 'DEV_DEPLOYED' || !/^[a-f0-9]{40}$/.test(sha || '')) throw new Error('INVALID_DELIVERY_RESULT');
  return lifecycleMessage('DEV_DEPLOYED', { locale, lines: [
    'branch: develop',
    `commit: ${sha}`,
    'Fast checks / DEV / HTTP-source / focused browser passed.',
    `Run: ${runUrl}`,
  ] });
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
  const locale = normalizeNotificationLocale(process.env.NOTIFY_LOCALE || 'ja');
  const message = deliveryMessage(stage, { report, sha: process.env.FINAL_SHA,
    repository: process.env.GITHUB_REPOSITORY, locale,
    runUrl: `https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}` });
  if (!message) { writeOutput('skipped'); return; }
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
