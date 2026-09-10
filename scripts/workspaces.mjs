import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

export const toolingPath = path => /^(scripts\/|templates\/|tests\/|\.github\/workflows\/|package(?:-lock)?\.json$|\.nvmrc$|\.npmrc$)/.test(path);
export const documentationPath = path => /^(docs\/|README\.md$|LICENSE(?:\..*)?$)/.test(path) || /\/README\.md$/.test(path);

export function graph(root = process.cwd()) {
  const nodes = new Map();
  for (const group of ['apps', 'packages']) {
    for (const entry of readdirSync(resolve(root, group), { withFileTypes: true })) {
      const dir = `${group}/${entry.name}`;
      if (!entry.isDirectory() || !existsSync(resolve(root, dir, 'package.json'))) continue;
      const pkg = JSON.parse(readFileSync(resolve(root, dir, 'package.json'), 'utf8'));
      if (nodes.has(pkg.name)) throw new Error(`Duplicate workspace ${pkg.name}`);
      nodes.set(pkg.name, { name: pkg.name, id: entry.name, dir, group, pkg,
        dependencies: Object.keys({ ...pkg.dependencies, ...pkg.devDependencies, ...pkg.peerDependencies }) });
    }
  }
  for (const node of nodes.values()) {
    for (const name of node.dependencies) {
      if (name.startsWith('@soul/') && !nodes.has(name)) throw new Error(`Missing workspace ${name} in ${node.name}`);
      if (node.group === 'packages' && nodes.get(name)?.group === 'apps') throw new Error('Packages cannot depend on apps');
      if (node.group === 'apps' && nodes.get(name)?.group === 'apps') throw new Error('Apps cannot depend on other apps');
    }
  }
  for (const name of nodes.keys()) closure(nodes, name);
  return nodes;
}

export function closure(nodes, name, visiting = new Set(), result = new Set()) {
  if (visiting.has(name)) throw new Error(`Workspace cycle at ${name}`);
  if (result.has(name)) return result;
  const node = nodes.get(name);
  if (!node) throw new Error(`Unknown workspace ${name}`);
  visiting.add(name);
  for (const dep of node.dependencies) if (nodes.has(dep)) closure(nodes, dep, visiting, result);
  visiting.delete(name);
  result.add(name);
  return result;
}

export function apps(nodes) {
  return [...nodes.values()].filter(n => n.group === 'apps').sort((a, b) => a.id.localeCompare(b.id));
}

export function appNode(nodes, id) {
  const node = apps(nodes).find(n => n.id === id);
  if (!node) throw new Error(`Unknown app: ${id}`);
  return node;
}

export function affected(nodes, paths) {
  const all = apps(nodes).map(n => n.id);
  const changed = new Set();
  for (const path of paths) {
    if (toolingPath(path)) return all;
    if (documentationPath(path)) continue;
    const owner = [...nodes.values()].find(n => path.startsWith(`${n.dir}/`));
    // Unknown/deleted workspaces and configuration fail closed to all apps.
    if (!owner) return all;
    changed.add(owner.name);
  }
  return apps(nodes).filter(n => [...closure(nodes, n.name)].some(name => changed.has(name))).map(n => n.id);
}

export function inputFiles(root, nodes, id) {
  const dirs = [...closure(nodes, appNode(nodes, id).name)].map(name => `${nodes.get(name).dir}/`);
  return execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8' })
    .split('\0').filter(Boolean).filter(path => existsSync(resolve(root, path)))
    .filter(path => toolingPath(path) || (!documentationPath(path) && (dirs.some(dir => path.startsWith(dir)) || !/^(apps|packages)\//.test(path))))
    .sort();
}

export function inputHash(root, nodes, id, environment) {
  const hash = createHash('sha256').update(`monorepo-v1\0${environment}\0${id}\0`);
  for (const file of [...new Set(inputFiles(root, nodes, id))]) {
    hash.update(file).update('\0').update(readFileSync(resolve(root, file))).update('\0');
  }
  return hash.digest('hex');
}
