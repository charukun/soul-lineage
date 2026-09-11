import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
const root = fileURLToPath(new URL('..', import.meta.url));
const manifest = JSON.parse(readFileSync(resolve(process.argv[3], 'deployment-manifest.json'), 'utf8'));
const changed = JSON.parse(readFileSync(resolve(process.argv[4]), 'utf8'));
const targets = manifest.entries.filter(entry => process.env.INTEGRATION_FULL === 'true' ? entry.environment === 'dev' : changed.includes(entry.path));
if (!targets.length) { console.log('No changed app browser targets.'); process.exit(0); }
const run = args => execFileSync('npm', args, { cwd: root, stdio: 'inherit', env: { ...process.env,
  BROWSER_SITE_URL: process.argv[2], BROWSER_TARGETS: JSON.stringify(targets.map(({ app, path, legacy, version }) => ({ app, path, legacy, version }))),
} });
if (!existsSync(resolve(root, 'node_modules/.bin/playwright'))) run(['ci']);
run(['exec', '--', 'playwright', 'install', '--with-deps', 'chromium']);
run(['exec', '--', 'playwright', 'test', '--config', 'scripts/browser/config.mjs']);
