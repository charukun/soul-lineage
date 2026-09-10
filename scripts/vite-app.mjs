import { defineConfig } from 'vite';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { graph, appNode, inputHash } from './workspaces.mjs';

export function appConfig(app, configUrl) {
  const root = fileURLToPath(new URL('../..', configUrl));
  const nodes = graph(root);
  const node = appNode(nodes, app);
  const environment = process.env.APP_ENV || 'local';
  if (!['local', 'dev', 'prod'].includes(environment)) throw new Error('Invalid APP_ENV');
  const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  const info = {
    name: node.pkg.displayName, app, environment,
    commit: git(['rev-parse', 'HEAD']),
    branch: process.env.APP_BRANCH || git(['branch', '--show-current']),
    builtAt: new Date().toISOString(), runId: process.env.GITHUB_RUN_ID || null,
    inputHash: inputHash(root, nodes, app, environment),
  };
  if (process.env.CI && (!/^[a-f0-9]{40}$/.test(info.commit) || environment === 'local')) throw new Error('CI requires a source SHA and APP_ENV');
  return defineConfig({
    root: resolve(root, node.dir), base: './',
    define: { __BUILD_INFO__: JSON.stringify(info) },
    build: { outDir: resolve(root, 'dist', app), emptyOutDir: true, assetsInlineLimit: 0 },
    plugins: [{ name: 'build-version', generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify(info, null, 2) + '\n' });
    } }],
  });
}
