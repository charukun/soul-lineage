import { defineConfig } from 'vite';
import { execFileSync } from 'node:child_process';

const environment = process.env.APP_ENV || 'local';
if (!['local', 'dev', 'prod'].includes(environment)) throw new Error('Invalid APP_ENV');
const git = (args) => {
  try { return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
  catch { return 'local'; }
};
const info = {
  name: '魂の系譜',
  environment,
  commit: git(['rev-parse', 'HEAD']),
  branch: process.env.APP_BRANCH || git(['branch', '--show-current']),
  builtAt: new Date().toISOString(),
  runId: process.env.GITHUB_RUN_ID || null,
};
if (process.env.CI && (!/^[a-f0-9]{40}$/.test(info.commit) || environment === 'local')) {
  throw new Error('CI requires a source commit and APP_ENV=dev or prod');
}

export default defineConfig({
  base: './',
  define: { __BUILD_INFO__: JSON.stringify(info) },
  plugins: [{
    name: 'build-version',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify(info, null, 2) + '\n' });
    },
  }],
});
