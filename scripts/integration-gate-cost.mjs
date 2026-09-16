import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const JS = /\.(?:c?js|mjs)$/i;
const CONTROL = /^(?:\.github\/|scripts\/|ops-board\/|docs\/(?:INTEGRATION|DEVELOPMENT|RINNE_PROJECT_EXECUTION_POLICY))/;
const BROWSER = /(?:browser|ops-board\/public|apps\/[^/]+\/src\/web|\.css$|\.html$)/i;
const SHARED = /^packages\//;

export function gateCostPlan(paths = [], knowledge = {}) {
  const control = paths.filter(path => CONTROL.test(path)).length;
  const browser = paths.filter(path => BROWSER.test(path)).length;
  const shared = paths.filter(path => SHARED.test(path)).length;
  const kinds = Object.values(knowledge?.fingerprints || {}).sort((a, b) => (b.count || 0) - (a.count || 0)).slice(0, 8).map(entry => entry.kind);
  const historicalBrowser = kinds.some(kind => /browser-selector|browser-gate/.test(kind));
  const historicalValidation = kinds.some(kind => /validation-gate|git-tree/.test(kind));
  const profile = control >= Math.max(1, paths.length / 2) ? 'control' : browser ? 'browser' : shared ? 'shared' : 'code';
  const order = ['diff-check', 'syntax'];
  if (profile === 'control' || historicalValidation) order.push('focused-contract');
  order.push('fast');
  if (profile === 'browser' || historicalBrowser) order.push('browser');
  else order.push('build', 'browser');
  return {
    profile,
    order: [...new Set(order)],
    paths: paths.length,
    reason: `cheap deterministic checks first; profile=${profile}; historical=${kinds.join(',') || 'none'}`,
  };
}

function gitPaths(work, base, head) {
  // The Fast Gate receives an exact validation base and exact head. A direct tree diff
  // avoids requiring a full ancestry graph just to classify the changed responsibility.
  const output = execFileSync('git', ['diff', '--name-only', base, head], { cwd: work, encoding: 'utf8' });
  return output.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
}

export function runCheapPreflight(work, base, head, paths) {
  execFileSync('git', ['diff', '--check', base, head], { cwd: work, stdio: 'inherit' });
  const syntax = paths.filter(path => JS.test(path) && !path.includes('/node_modules/') && !path.endsWith('.min.js')).slice(0, 80);
  const failures = [];
  for (const path of syntax) {
    const result = spawnSync(process.execPath, ['--check', path], { cwd: work, encoding: 'utf8' });
    if (result.status !== 0) failures.push({ path, stderr: String(result.stderr || result.stdout || '').slice(0, 500) });
  }
  if (failures.length) throw new Error(`CHEAP_SYNTAX_PREFLIGHT_FAILED:${JSON.stringify(failures)}`);
  return { diffCheck: true, syntaxChecked: syntax.length };
}

async function loadKnowledge() {
  const file = process.env.FAILURE_KNOWLEDGE_FILE;
  if (file) {
    try { return JSON.parse(readFileSync(file, 'utf8')).failureKnowledge || {}; }
    catch { return {}; }
  }
  return {};
}

async function main() {
  const work = resolve(process.argv[2] || '.');
  const base = process.argv[3];
  const head = process.argv[4];
  if (!/^[0-9a-f]{40}$/.test(base || '') || !/^[0-9a-f]{40}$/.test(head || '')) throw new Error('gate cost optimizer requires exact base/head SHAs');
  const paths = gitPaths(work, base, head);
  const knowledge = await loadKnowledge();
  const plan = gateCostPlan(paths, knowledge);
  const preflight = runCheapPreflight(work, base, head, paths);
  const result = { ...plan, preflight };
  if (process.env.GITHUB_OUTPUT) {
    const { appendFileSync } = await import('node:fs');
    appendFileSync(process.env.GITHUB_OUTPUT, `profile=${plan.profile}\norder=${plan.order.join(',')}\nsyntax_checked=${preflight.syntaxChecked}\n`);
  }
  console.log(JSON.stringify(result));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
