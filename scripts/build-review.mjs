import { copyFileSync, mkdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
execFileSync(npm, ['run', 'build:rinne'], {
  stdio: 'inherit',
  env: { ...process.env, APP_ENV: 'dev' },
});

const out = resolve('dist', 'rinne');
const appIndex = resolve(out, 'index.html');
const review = resolve(out, 'review.html');
const backup = resolve(out, 'game.html');

mkdirSync(out, { recursive: true });
copyFileSync(appIndex, backup);
copyFileSync(review, appIndex);
rmSync(review);
console.log('Visual Review Lab preview prepared at dist/rinne/index.html');
