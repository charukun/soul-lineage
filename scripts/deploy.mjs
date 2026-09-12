import assert from 'node:assert/strict';
import { readFileSync, appendFileSync } from 'node:fs';
import { mkdir, rm, cp, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { graph, apps, inputHash, documentationPath } from './workspaces.mjs';
import { inventory, restoreEntry } from './deployment-files.mjs';
const run = (root, command, args, env = {}) => execFileSync(command, args, { cwd: root, stdio: 'inherit', env: { ...process.env, ...env } });
const git = (root, args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
export function desiredEntries(sources) {
  const entries = [];
  for (const [environment, root] of Object.entries(sources)) {
    const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
    const branch = environment === 'dev' ? 'develop' : 'main';
    if (pkg.workspaces) {
      const nodes = graph(root);
      for (const node of apps(nodes)) entries.push({ root, app: node.id, environment, branch, path: `${environment}/${node.id}`, inputHash: inputHash(root, nodes, node.id, environment), legacy: false });
    } else {
      // Transitional compatibility: main keeps its existing implementation until promotion.
      const hash = createHash('sha256').update(`legacy-v1:${environment}`);
      for (const path of git(root, ['ls-files']).split('\n').filter(p => !documentationPath(p))) hash.update(path).update(readFileSync(resolve(root, path)));
      entries.push({ root, app: 'rinne', environment, branch, path: environment, inputHash: hash.digest('hex'), legacy: true });
    }
  }
  return entries;
}
export function preserveProduction(desired, previous, devOnly) {
  if (!devOnly) return desired;
  const production = previous.entries.filter(entry => entry.environment === 'prod');
  assert.ok(production.length, 'DEV-only Integration requires an existing Production manifest');
  return [...desired.filter(entry => entry.environment === 'dev'), ...production];
}
export function needsBuild(entry, previous) {
  return !previous || previous.inputHash !== entry.inputHash || previous.legacy !== entry.legacy;
}
export function uniqueEnvironmentCommit(entries, environment) {
  const commits = [...new Set(entries.filter(entry => entry.environment === environment).map(entry => entry?.version?.commit).filter(Boolean))];
  return commits.length === 1 ? commits[0] : null;
}
export function buildEnvironmentSnapshots(previous, entries, { developSha, productionSha, devOnly, deployedAt, workflowRunId }) {
  const snapshots = {
    dev: { branch: 'develop', commit: developSha, deployedAt, workflowRunId },
  };
  if (!devOnly) {
    snapshots.prod = { branch: 'main', commit: productionSha, deployedAt, workflowRunId };
  } else if (previous?.environmentSnapshots?.prod?.commit) {
    snapshots.prod = previous.environmentSnapshots.prod;
  } else {
    const legacyProd = uniqueEnvironmentCommit(entries, 'prod');
    if (legacyProd) snapshots.prod = { branch: 'main', commit: legacyProd, deployedAt: null, workflowRunId: null, source: 'legacy-entry-set' };
  }
  return snapshots;
}
async function main() {
  const sources = { dev: resolve(process.argv[2]), prod: resolve(process.argv[3]) };
  const output = resolve(process.argv[4] || '_site');
  const base = new URL(process.argv[5]);
  if (!base.pathname.endsWith('/')) base.pathname += '/';
  assert.equal(base.protocol, 'https:');
  let previous = { schemaVersion: 1, entries: [] };
  const manifestUrl = new URL('deployment-manifest.json', base);
  manifestUrl.searchParams.set('run', process.env.GITHUB_RUN_ID || Date.now());
  const response = await fetch(manifestUrl, { signal: AbortSignal.timeout(30000), cache: 'no-store' });
  if (response.status === 200) { previous = await response.json(); assert.equal(previous.schemaVersion, 1); }
  else assert.equal(response.status, 404, 'Cannot establish current deployment; refusing a blind replacement');
  const full = process.env.INTEGRATION_FULL === 'true';
  const devOnly = process.env.DEPLOY_DEV_ONLY === 'true';
  const developSha = git(sources.dev, ['rev-parse', 'HEAD']);
  const productionSha = git(sources.prod, ['rev-parse', 'HEAD']);
  const desired = preserveProduction(desiredEntries(devOnly ? { dev: sources.dev } : sources), previous, devOnly);
  const old = new Map(previous.entries.map(entry => [entry.path, entry]));
  const changed = desired.filter(entry => needsBuild(entry, old.get(entry.path)));
  const removed = previous.entries.some(entry => !desired.some(next => next.path === entry.path));
  const publish = changed.length > 0 || removed || full || devOnly;
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `changed=${publish}\n`);
  console.log(`Changed apps: ${changed.map(e => e.path).join(', ') || 'none'}`);
  if (!publish) { console.log('All app inputs unchanged; no build, test or Pages deployment needed.'); return; }
  await rm(output, { recursive: true, force: true }); await mkdir(output, { recursive: true });
  const installed = new Set();
  if (full || devOnly) {
    run(sources.dev, 'npm', ['ci']); installed.add(sources.dev);
    run(sources.dev, 'node', ['scripts/validate.mjs', ...(full ? ['full'] :
      ['deploy', ...changed.filter(e => e.environment === 'dev').map(e => e.app)])]);
  }
  const entries = [];
  for (const entry of desired) {
    const former = old.get(entry.path);
    if (!needsBuild(entry, former)) {
      await restoreEntry(former, output, base); entries.push(former);
      console.log(`RETAIN ${entry.path} / ${former.version.commit}`); continue;
    }
    const env = { APP_ENV: entry.environment, APP_BRANCH: entry.branch };
    if (!installed.has(entry.root)) {
      run(entry.root, 'npm', ['ci'], env); installed.add(entry.root);
      if (!entry.legacy) run(entry.root, 'npm', ['test'], env);
    }
    if (!((full || devOnly) && entry.environment === 'dev')) {
      run(entry.root, 'npm', ['run', 'check', ...(entry.legacy ? [] : ['--', entry.app])], env);
      if (!entry.legacy) run(entry.root, 'npm', ['run', 'test:app', '--', entry.app], env);
    }
    run(entry.root, 'npm', ['run', 'build', ...(entry.legacy ? [] : ['--workspace', `@soul/${entry.app}`])], env);
    const dist = resolve(entry.root, 'dist', entry.legacy ? '' : entry.app);
    const version = JSON.parse(readFileSync(resolve(dist, 'version.json'), 'utf8'));
    assert.equal(version.commit, git(entry.root, ['rev-parse', 'HEAD']));
    assert.equal(version.environment, entry.environment);
    if (!entry.legacy) assert.equal(version.inputHash, entry.inputHash);
    const target = resolve(output, entry.path); await mkdir(target, { recursive: true }); await cp(dist, target, { recursive: true });
    entries.push({ app: entry.app, environment: entry.environment, path: entry.path, inputHash: entry.inputHash, legacy: entry.legacy, version, files: await inventory(dist) });
    console.log(`BUILD ${entry.path} / ${version.commit}`);
  }
  for (const environment of ['dev', 'prod']) {
    if (entries.some(e => e.path === environment)) continue;
    const envEntries = entries.filter(e => e.environment === environment);
    const rinne = envEntries.find(e => e.app === 'rinne');
    const redirect = rinne ? '<meta http-equiv="refresh" content="0;url=rinne/">' : '';
    await mkdir(resolve(output, environment), { recursive: true });
    await writeFile(resolve(output, environment, 'index.html'), `<!doctype html><html lang="ja"><head><meta charset="utf-8">${redirect}<title>ゲーム開発</title></head><body>${envEntries.map(e => `<p><a href="${e.app}/">${e.version.name}</a></p>`).join('')}</body></html>`);
    if (rinne) await writeFile(resolve(output, environment, 'version.json'), JSON.stringify(rinne.version, null, 2));
  }
  await writeFile(resolve(output, 'index.html'), '<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=prod/"><title>輪廻転焦</title></head><body><a href="prod/">輪廻転焦</a></body></html>');
  await writeFile(resolve(output, '.nojekyll'), '');
  const deployedAt = new Date().toISOString();
  const workflowRunId = process.env.GITHUB_RUN_ID || null;
  const environmentSnapshots = buildEnvironmentSnapshots(previous, entries, { developSha, productionSha, devOnly, deployedAt, workflowRunId });
  await writeFile(resolve(output, 'deployment-manifest.json'), JSON.stringify({ schemaVersion: 1, ...((full || devOnly) ? { validatedDevelop: developSha } : {}), environmentSnapshots, entries }, null, 2));
  await mkdir('.deploy-state', { recursive: true });
  await writeFile('.deploy-state/changed.json', JSON.stringify(changed.map(entry => entry.path)));
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY,
    '| App | Action | URL | Built source |\n| --- | --- | --- | --- |\n' + entries.map(e => `| ${e.path} | ${changed.some(c => c.path === e.path) ? 'build' : 'retain'} | ${new URL(e.path + '/', base)} | ${e.version.commit} |\n`).join(''));
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();