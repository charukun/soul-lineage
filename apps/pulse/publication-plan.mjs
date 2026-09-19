import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const SHA = /^[0-9a-f]{40}$/i;
const exactPaths = new Set([
  'scripts/application-catalog.mjs',
  'tests/fixtures/integration-rescue-state.mjs',
  'wrangler.rescue-watchdog.jsonc',
  'wrangler.ops.jsonc',
  '.github/workflows/ops-board.yml',
]);

export function pulsePublicationPath(path) {
  return path.startsWith('ops-board/') ||
    exactPaths.has(path) ||
    /^scripts\/integration-rescue-.*\.mjs$/.test(path) ||
    /^apps\/[^/]+\/package\.json$/.test(path) ||
    /^tests\/(?:pulse|ops)-.*\.test\.mjs$/.test(path);
}

export function pulseDeployRequired(paths = []) {
  return paths.some(pulsePublicationPath);
}

export function pulseChangedPaths(base, head, run = execFileSync) {
  if (!SHA.test(base || '') || !SHA.test(head || '')) throw new Error('PULSE_PUBLICATION_SHA_REQUIRED');
  const output = run('git', ['diff', '--name-only', '--diff-filter=ACMRT', `${base}..${head}`], { encoding: 'utf8' });
  return output.split(/\r?\n/).map(value => value.trim()).filter(Boolean);
}

async function main() {
  const [base, head] = process.argv.slice(2);
  let paths = [];
  let required = true;
  try {
    paths = pulseChangedPaths(base, head);
    required = pulseDeployRequired(paths);
  } catch (error) {
    console.warn(`PULSE publication diff unavailable; deploy conservatively: ${error.message}`);
  }
  const relevant = paths.filter(pulsePublicationPath);
  console.log(JSON.stringify({ base, head, deployRequired: required, relevant, changed: paths.length }));
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `deploy_required=${required}\n`);
    appendFileSync(process.env.GITHUB_OUTPUT, `relevant_count=${relevant.length}\n`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
