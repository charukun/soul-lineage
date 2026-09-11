import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { graph, closure, appNode } from './workspaces.mjs';

// One install, one syntax pass and one execution of each shared test per run.
const run = (command, args) => execFileSync(command, args, { stdio: 'inherit' });
const full = process.argv[2] === 'full';
if (!full && process.argv[2] !== 'fast') throw new Error('Use fast <base> <head> or full');
const nodes = graph();
const plan = full ? null : JSON.parse(execFileSync(process.execPath,
  ['scripts/affected.mjs', ...process.argv.slice(3)], { encoding: 'utf8' }));
const selected = full ? [...nodes.keys()] : [...new Set([
  ...plan.apps.flatMap(id => [...closure(nodes, appNode(nodes, id).name)]),
  ...plan.packages.flatMap(name => [...closure(nodes, name)]),
])];
console.log(JSON.stringify({ mode: full ? 'full' : 'fast', workspaces: selected, plan }, null, 2));
if (!selected.length && !plan?.infrastructure) process.exit(0);
run(process.execPath, ['scripts/check.mjs', ...selected]);
const tests = selected.flatMap(name => {
  const dir = `${nodes.get(name).dir}/tests`;
  return existsSync(dir) ? readdirSync(dir).filter(f => f.endsWith('.test.mjs')).map(f => `${dir}/${f}`) : [];
});
if (full || plan.infrastructure) tests.push(...readdirSync('tests').filter(f => f.endsWith('.test.mjs')).map(f => `tests/${f}`));
if (tests.length) run(process.execPath, ['--test', ...new Set(tests)]);
if (!full) for (const app of plan.apps) run('npm', ['run', 'build', '--workspace', `@soul/${app}`]);
// The full gate's builds are performed once by deploy.mjs and reused for Pages.
