import { execFileSync, spawn } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';

const ROOT_TEST = /^(?:ops|pulse)-.*\.test\.mjs$/;
const SOURCE = /\.(?:js|mjs)$/;
const PORT = Number(process.env.PULSE_PREFLIGHT_PORT || 8765);
const URL = `http://127.0.0.1:${PORT}/`;
const REPORT = process.env.OPS_REPORT_DIR || 'ops-review-results/preflight';

function run(command, args, options = {}) {
  console.log(`PULSE_PREFLIGHT ${command} ${args.join(' ')}`);
  execFileSync(command, args, { stdio: 'inherit', ...options });
}

function sourceFiles() {
  const files = [];
  for (const dir of ['apps/pulse', 'apps/pulse/public']) {
    for (const name of readdirSync(dir)) {
      const path = `${dir}/${name}`;
      if (SOURCE.test(name)) files.push(path);
    }
  }
  return files.sort();
}

function testFiles() {
  return readdirSync('tests')
    .filter(name => ROOT_TEST.test(name))
    .map(name => `tests/${name}`)
    .sort();
}

async function waitForServer() {
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      const response = await fetch(URL, { signal: AbortSignal.timeout(1000) });
      if (response.ok) return;
    } catch {}
    await delay(250);
  }
  throw new Error(`PULSE preflight server did not start at ${URL}`);
}

async function browserFixture() {
  if (!existsSync('node_modules/@playwright/test/package.json')) {
    throw new Error('PULSE preflight requires npm ci before validation');
  }
  run('npx', ['playwright', 'install', '--with-deps', 'chromium']);

  const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1', '--directory', 'apps/pulse/public'], {
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  try {
    await waitForServer();
    run(process.execPath, ['apps/pulse/browser-check.mjs'], {
      env: { ...process.env, OPS_URL: URL, OPS_FIXTURE: '1', OPS_REPORT_DIR: REPORT },
    });
    run(process.execPath, ['apps/pulse/rescue-browser-check.mjs'], {
      env: { ...process.env, OPS_URL: URL, OPS_FIXTURE: '1', OPS_REPORT_DIR: REPORT },
    });
  } finally {
    server.kill('SIGTERM');
  }
}

for (const file of sourceFiles()) run(process.execPath, ['--check', file]);
const tests = testFiles();
if (!tests.length) throw new Error('PULSE preflight found no ops/pulse tests');
run(process.execPath, ['--test', ...tests]);
await browserFixture();
console.log(JSON.stringify({
  pulsePreflight: 'passed',
  contract: 'apps/pulse/public/pulse-contract.mjs',
  tests: tests.length,
  browserFixture: true,
}));
