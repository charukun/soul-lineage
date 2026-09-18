import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { graph, affected, affectedForDev, apps, toolingPath, workspaceManifestPath, devGlobalBuildPath } from './workspaces.mjs';

const nodes = graph();
const base = process.argv[2];
const head = process.argv[3] || 'HEAD';
const devMinimal = process.argv[4] === 'dev' || process.env.GITHUB_BASE_REF === 'develop';
let paths;
try {
  if (!base || /^0+$/.test(base)) throw new Error('No usable base');
  // --no-renames includes both old and new paths, so moved assets affect both owners.
  paths = execFileSync('git', ['diff', '--no-renames', '--name-only', '-z', base, head], { encoding: 'utf8' }).split('\0').filter(Boolean);
} catch { paths = ['package.json']; }
const selected = devMinimal ? affectedForDev(nodes, paths) : affected(nodes, paths);
const globalInfrastructure = paths.some(toolingPath);
const dependencyGraphChanged = paths.some(workspaceManifestPath);
const rootBuildChanged = paths.some(devGlobalBuildPath);
const infrastructure = devMinimal ? dependencyGraphChanged || rootBuildChanged : globalInfrastructure || dependencyGraphChanged;
const packages = [...nodes.values()].filter(n => n.group === 'packages' && (
  (!devMinimal && globalInfrastructure) || paths.some(p => p.startsWith(`${n.dir}/`) && !p.endsWith('/README.md'))
)).map(n => n.name);
const plan = {
  apps: selected,
  packages,
  allApps: apps(nodes).map(n => n.id),
  infrastructure,
  controlPlane: devMinimal && globalInfrastructure && !infrastructure,
  dependencyGraphChanged,
  devMinimal,
  paths,
};
console.log(JSON.stringify(plan, null, 2));
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT,
  `apps=${JSON.stringify(selected)}\nhas_apps=${selected.length > 0}\npackages=${JSON.stringify(packages)}\nhas_packages=${packages.length > 0}\ninfrastructure=${plan.infrastructure}\ncontrol_plane=${plan.controlPlane}\ndev_minimal=${plan.devMinimal}\n`);
