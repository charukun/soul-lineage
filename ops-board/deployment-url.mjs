import { readFileSync, appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function opsDeploymentUrl(log) {
  const matches = [...new Set(log.match(/https:\/\/rinne-ops\.[a-z0-9-]+\.workers\.dev\b/g) || [])];
  if (matches.length !== 1) throw new Error(`Expected one stable rinne-ops workers.dev URL, found ${matches.length}`);
  return `${matches[0]}/`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const url = opsDeploymentUrl(readFileSync(process.argv[2], 'utf8'));
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `url=${url}\n`);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `Rinne Ops Board: [Open dashboard](${url})\n`);
  console.log(url);
}
