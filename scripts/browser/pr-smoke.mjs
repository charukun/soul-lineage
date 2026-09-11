import { chromium } from '@playwright/test';
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const root = resolve(new URL('../..', import.meta.url).pathname);
const base = process.argv[2];
const head = process.argv[3] || 'HEAD';
const plan = JSON.parse(execFileSync(process.execPath, ['scripts/affected.mjs', base, head], { cwd: root, encoding: 'utf8' }));
const apps = plan.infrastructure ? plan.allApps : plan.apps;
const ports = { rinne: 5273, village: 5274, demon: 5275 };
mkdirSync(resolve(root, 'test-results/pr-browser'), { recursive: true });
if (!apps.length) {
  console.log('No affected app browser targets.');
  process.exit(0);
}

async function waitFor(url, processRef) {
  for (let attempt = 0; attempt < 80; attempt++) {
    if (processRef.exitCode !== null) throw new Error(`Preview exited before becoming ready: ${url}`);
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1500) });
      if (response.ok) return;
    } catch {}
    await delay(250);
  }
  throw new Error(`Preview timeout: ${url}`);
}

for (const app of apps) {
  const port = ports[app];
  if (!port) throw new Error(`Missing preview port for ${app}`);
  execFileSync('npm', ['run', 'build', '--workspace', `@soul/${app}`], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, APP_ENV: 'dev', APP_BRANCH: process.env.GITHUB_HEAD_REF || 'pr' },
  });
  const preview = spawn('npm', ['run', 'preview', '--workspace', `@soul/${app}`], {
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, APP_ENV: 'dev' },
  });
  const previewLog = [];
  preview.stdout.on('data', chunk => previewLog.push(chunk.toString()));
  preview.stderr.on('data', chunk => previewLog.push(chunk.toString()));
  const url = `http://127.0.0.1:${port}/`;
  let browser;
  try {
    await waitFor(url, preview);
    browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-webgl', '--enable-unsafe-swiftshader'] });
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
    const page = await context.newPage();
    const errors = [];
    const failedRequests = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('requestfailed', request => failedRequests.push({ url: request.url(), failure: request.failure()?.errorText || 'failed' }));
    const response = await page.goto(url, { waitUntil: 'networkidle', timeout: app === 'rinne' ? 120000 : 60000 });
    if (!response?.ok()) throw new Error(`${app} returned HTTP ${response?.status()}`);
    const canvas = page.locator('#game');
    await canvas.waitFor({ state: 'visible', timeout: 60000 });
    await page.waitForFunction(() => document.querySelector('#game')?.dataset.renderer === 'ready', null, { timeout: 60000 });
    const renderer = await canvas.getAttribute('data-renderer');
    const appId = await canvas.getAttribute('data-app');
    const widthOk = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
    const webgl = await canvas.evaluate(element => {
      const gl = element.getContext('webgl2');
      return gl && !gl.isContextLost() ? { version: gl.getParameter(gl.VERSION), width: gl.drawingBufferWidth, height: gl.drawingBufferHeight } : null;
    });
    await page.screenshot({ path: resolve(root, `test-results/pr-browser/${app}.png`), fullPage: true });
    const report = { app, url, renderer, appId, widthOk, webgl, errors, failedRequests };
    writeFileSync(resolve(root, `test-results/pr-browser/${app}.json`), JSON.stringify(report, null, 2));
    if (renderer !== 'ready' || appId !== app || !widthOk || !webgl?.version?.includes('WebGL 2.0') || errors.length || failedRequests.length) {
      throw new Error(`Browser smoke failed for ${app}: ${JSON.stringify(report)}`);
    }
    await context.tracing.stop({ path: resolve(root, `test-results/pr-browser/${app}-trace.zip`) });
    await context.close();
    console.log('PR BROWSER VERIFIED', JSON.stringify(report));
  } catch (error) {
    writeFileSync(resolve(root, `test-results/pr-browser/${app}-preview.log`), previewLog.join(''));
    if (browser) {
      try {
        const contexts = browser.contexts();
        if (contexts[0]) await contexts[0].tracing.stop({ path: resolve(root, `test-results/pr-browser/${app}-trace.zip`) });
      } catch {}
    }
    throw error;
  } finally {
    if (browser) await browser.close().catch(() => {});
    preview.kill('SIGTERM');
    await delay(150).catch(() => {});
    if (preview.exitCode === null) preview.kill('SIGKILL');
  }
}
