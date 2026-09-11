import { readFileSync, appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

export function reviewDeploymentUrl(log) {
  const candidates = new Set(log.match(/https:\/\/rinne-visual-review\.[a-z0-9-]+\.workers\.dev\b/g));
  if (candidates.size !== 1) throw new Error('Deployment did not report one stable rinne-visual-review workers.dev URL');
  return `${[...candidates][0]}/`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const url = reviewDeploymentUrl(readFileSync(process.argv[2], 'utf8'));
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `url=${url}\n`);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `Visual Review Lab deployed: [Open preview](${url}). Public browser verification follows.\n`);
  console.log(url);
}
