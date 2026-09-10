import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { graph, affected, apps, toolingPath } from './workspaces.mjs';

const nodes = graph();
const base = process.argv[2];
const head = process.argv[3] || 'HEAD';
let paths;
try {
  if (!base || /^0+$/.test(base)) throw new Error('No usable base');
  // --no-renames includes both old and new paths, so moved assets affect both owners.
  paths = execFileSync('git', ['diff', '--no-renames', '--name-only', '-z', base, head], { encoding: 'utf8' }).split('\0').filter(Boolean);
} catch { paths = ['package.json']; }
const selected = affected(nodes, paths);
const infrastructure = paths.some(toolingPath);
const packages = [...nodes.values()].filter(n => n.group === 'packages' && (infrastructure || paths.some(p => p.startsWith(`${n.dir}/`) && !p.endsWith('/README.md')))).map(n => n.name);
const plan = { apps: selected, packages, allApps: apps(nodes).map(n => n.id), infrastructure, paths };
console.log(JSON.stringify(plan, null, 2));
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT,
  `apps=${JSON.stringify(selected)}\nhas_apps=${selected.length > 0}\npackages=${JSON.stringify(packages)}\nhas_packages=${packages.length > 0}\ninfrastructure=${plan.infrastructure}\n`);
