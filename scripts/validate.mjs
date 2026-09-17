import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { graph, closure, appNode } from './workspaces.mjs';
import { gateCostPlan } from './integration-gate-cost.mjs';
import { fastGateScope, splitFastTests, summarizeFastGate } from './fast-gate-v2.mjs';

const run = (command, args) => execFileSync(command, args, { stdio: 'inherit' });
const mode = process.argv[2];
const full = mode === 'full';
const deploy = mode === 'deploy';
const dev = mode === 'dev';
const fast = mode === 'fast';
if (!full && !deploy && !dev && !fast) throw new Error('Use dev <base> <head>, fast <base> <head>, deploy [apps...] or full');
const nodes = graph();
const affectedArgs = dev ? [...process.argv.slice(3), 'dev'] : process.argv.slice(3);
const plan = full ? null : deploy ? { apps: process.argv.slice(3), packages: [], infrastructure: true, paths: [] } : JSON.parse(execFileSync(process.execPath,
  ['scripts/affected.mjs', ...affectedArgs], { encoding: 'utf8' }));
const closureSelected = full ? [...nodes.keys()] : [...new Set([
  ...plan.apps.flatMap(id => [...closure(nodes, appNode(nodes, id).name)]),
  ...plan.packages.flatMap(name => [...closure(nodes, name)]),
])];
const profile = full || deploy ? '' : gateCostPlan(plan.paths || []).profile;
const scope = full ? 'full' : deploy ? 'deploy' : fastGateScope(plan, profile);
const narrowFast = !full && !deploy && scope !== 'broad';
const directSelected = full ? [] : [...new Set([
  ...plan.apps.map(id => appNode(nodes, id).name),
  ...plan.packages,
])];
const selected = dev ? directSelected : narrowFast ? directSelected : closureSelected;
console.log(JSON.stringify({ mode, scope, profile, workspaces: selected, transitiveWorkspaces: (dev || narrowFast) ? closureSelected : undefined, plan }, null, 2));
if (!full && !deploy) run(process.execPath, ['scripts/visual-budget.mjs', 'guard', process.argv[3], process.argv[4]]);
if (full) run(process.execPath, ['scripts/visual-budget.mjs', 'audit']);

if (dev && !selected.length && !plan.infrastructure) {
  run(process.execPath, ['scripts/code-health.mjs', 'guard', process.argv[3], process.argv[4]]);
  console.log(JSON.stringify({ devGate: { scope, profile, checkedWorkspaces: [], tests: 0, builds: 0, controlPlane: !!plan.controlPlane } }, null, 2));
  process.exit(0);
}
if (!selected.length && !plan?.infrastructure) process.exit(0);
run(process.execPath, (dev || narrowFast) ? ['scripts/check.mjs', '--direct', ...selected] : ['scripts/check.mjs', ...selected]);
if (full || selected.includes('@soul/characters')) run(process.execPath, ['scripts/check-character-production.mjs']);
if (!full && !deploy) run(process.execPath, ['scripts/code-health.mjs', 'guard', process.argv[3], process.argv[4]]);

if (dev || deploy) {
  console.log(JSON.stringify({ devGate: { mode, scope, profile, checkedWorkspaces: selected, tests: 0, builds: dev ? plan.apps.length : 0, controlPlane: !!plan.controlPlane } }, null, 2));
} else {
  const tests = selected.flatMap(name => {
    const dir = `${nodes.get(name).dir}/tests`;
    return existsSync(dir) ? readdirSync(dir).filter(f => f.endsWith('.test.mjs')).map(f => `${dir}/${f}`) : [];
  });
  if (full || plan.infrastructure) tests.push(...readdirSync('tests').filter(f => f.endsWith('.test.mjs')).map(f => `tests/${f}`));
  const uniqueTests = [...new Set(tests)];
  const split = narrowFast ? splitFastTests(uniqueTests, plan.paths || []) : { light: uniqueTests, heavy: [], skippedHeavy: [] };
  console.log(JSON.stringify({ fastGate: summarizeFastGate({ scope, profile, checkedWorkspaces: selected, ...split }) }, null, 2));
  if (split.light.length) run(process.execPath, ['--test', ...split.light]);
  if (split.heavy.length) run(process.execPath, ['--test', ...split.heavy]);
}

if (!full && !deploy) for (const app of plan.apps) run('npm', ['run', 'build', '--workspace', `@soul/${app}`]);
