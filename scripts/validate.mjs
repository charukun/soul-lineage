import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { graph, closure, appNode } from './workspaces.mjs';
import { gateCostPlan } from './integration-gate-cost.mjs';
import { fastGateScope, splitFastTests, summarizeFastGate } from './fast-gate-v2.mjs';

// One install, one syntax pass and one execution of each required test per run.
const run = (command, args) => execFileSync(command, args, { stdio: 'inherit' });
const full = process.argv[2] === 'full';
const deploy = process.argv[2] === 'deploy';
if (!full && !deploy && process.argv[2] !== 'fast') throw new Error('Use fast <base> <head>, deploy [apps...] or full');
const nodes = graph();
const plan = full ? null : deploy ? { apps: process.argv.slice(3), packages: [], infrastructure: true, paths: [] } : JSON.parse(execFileSync(process.execPath,
  ['scripts/affected.mjs', ...process.argv.slice(3)], { encoding: 'utf8' }));
const closureSelected = full ? [...nodes.keys()] : [...new Set([
  ...plan.apps.flatMap(id => [...closure(nodes, appNode(nodes, id).name)]),
  ...plan.packages.flatMap(name => [...closure(nodes, name)]),
])];
const profile = full || deploy ? '' : gateCostPlan(plan.paths || []).profile;
const scope = full ? 'full' : deploy ? 'deploy' : fastGateScope(plan, profile);
const narrowFast = !full && !deploy && scope !== 'broad';
const selected = narrowFast ? [...new Set([
  ...plan.apps.map(id => appNode(nodes, id).name),
  ...plan.packages,
])] : closureSelected;
console.log(JSON.stringify({ mode: full ? 'full' : deploy ? 'deploy' : 'fast', scope, profile, workspaces: selected, transitiveWorkspaces: narrowFast ? closureSelected : undefined, plan }, null, 2));
if (!full && !deploy) run(process.execPath, ['scripts/visual-budget.mjs', 'guard', process.argv[3], process.argv[4]]);
if (full) run(process.execPath, ['scripts/visual-budget.mjs', 'audit']);
if (!selected.length && !plan?.infrastructure) process.exit(0);
run(process.execPath, narrowFast ? ['scripts/check.mjs', '--direct', ...selected] : ['scripts/check.mjs', ...selected]);
if (full || selected.includes('@soul/characters')) run(process.execPath, ['scripts/check-character-production.mjs']);
if (!full && !deploy) run(process.execPath, ['scripts/code-health.mjs', 'guard', process.argv[3], process.argv[4]]);
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
if (!full && !deploy) for (const app of plan.apps) run('npm', ['run', 'build', '--workspace', `@soul/${app}`]);
// The full gate's builds are performed once by deploy.mjs and reused for Pages.
