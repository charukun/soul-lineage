import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { notifyStage } from './implementation-handoff.mjs';

export function deliveryMessage(stage, { report, sha, repository, runUrl }) {
  if (stage === 'INTEGRATED') {
    if (!report?.merged?.length) return null;
    return `Integration\nINTEGRATED\nbranch: develop\n${report.merged.map(item =>
      `PR: https://github.com/${repository}/pull/${item.pr}\ncommit: ${item.merge}`).join('\n')}\nDEV verification remains Integration responsibility.\nRun: ${runUrl}`;
  }
  if (stage !== 'DEV_DEPLOYED' || !/^[a-f0-9]{40}$/.test(sha || '')) throw new Error('INVALID_DELIVERY_RESULT');
  return `Integration\nDEV_DEPLOYED\nbranch: develop\ncommit: ${sha}\nFast checks / DEV / HTTP-source / focused browser passed.\nRun: ${runUrl}`;
}

async function main() {
  if (process.env.GITHUB_REF !== 'refs/heads/develop' || process.env.GITHUB_REPOSITORY !== 'charukun/soul-lineage') throw new Error('DEVELOP_DELIVERY_ONLY');
  const [stage, reportPath] = process.argv.slice(2);
  const report = reportPath && existsSync(reportPath) ? JSON.parse(readFileSync(reportPath, 'utf8')) : null;
  const message = deliveryMessage(stage, { report, sha: process.env.FINAL_SHA,
    repository: process.env.GITHUB_REPOSITORY,
    runUrl: `https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}` });
  if (!message) return;
  const channel = await notifyStage(message, { url: process.env.NTFY_TOPIC_URL, token: process.env.NTFY_TOKEN });
  console.log(message);
  if (channel === 'not-configured') console.warn('::warning::NTFY_TOPIC_URL not configured; GitHub is authoritative, smartphone delivery unconfirmed.');
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
