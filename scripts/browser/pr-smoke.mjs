import { chromium, expect } from '@playwright/test';
import {verifySoloClarity, verifyHuntClarity} from './play-clarity.mjs';
import {capturePlayedAudio,mediaDiagnostics} from './media-diagnostics.mjs';
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
const viteBin = resolve(root, 'node_modules/vite/bin/vite.js');
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

async function stopPreview(preview) {
  if (preview.exitCode !== null) return;
  preview.kill('SIGTERM');
  for (let attempt = 0; attempt < 20 && preview.exitCode === null; attempt++) await delay(50);
  if (preview.exitCode === null) preview.kill('SIGKILL');
  for (let attempt = 0; attempt < 20 && preview.exitCode === null; attempt++) await delay(50);
}

for (const app of apps) {
  const port = ports[app];
  if (!port) throw new Error(`Missing preview port for ${app}`);
  execFileSync('npm', ['run', 'build', '--workspace', `@soul/${app}`], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, APP_ENV: 'dev', APP_BRANCH: process.env.GITHUB_HEAD_REF || 'pr' },
  });
  // Spawn Vite directly rather than through npm. Killing npm can orphan its Vite child and
  // leave inherited stdio handles open, which makes the CI step appear to hang after success.
  const preview = spawn(process.execPath, [viteBin, 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
    cwd: resolve(root, 'apps', app),
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
    const failedRequests = [], rawRequests = [], playedSources = new Set();
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('requestfailed', request => { rawRequests.push(request); failedRequests.push({ url: request.url(), failure: request.failure()?.errorText || 'failed' }); });
    // Games can keep media/WebRTC/network activity alive indefinitely. DOM readiness plus the
    // renderer contract below is the deterministic gate; waiting for networkidle only adds stalls.
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    if (!response?.ok()) throw new Error(`${app} returned HTTP ${response?.status()}`);
    const canvas = page.locator('#game');
    await canvas.waitFor({ state: 'visible', timeout: 45000 });
    await page.waitForFunction(() => document.querySelector('#game')?.dataset.renderer === 'ready', null, { timeout: 45000 });
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
    // Exercise changed controls before Integration, using the same assertions as public DEV.
    const evidence = { outputPath: name => resolve(root, `test-results/pr-browser/${app}-${name}`) };
    if (app === 'rinne') {
      await page.locator('#start-simulator').click();
      await page.waitForFunction(() => window.__RINNE_TITLE__?.snapshot().state === 'playing', null, {timeout:100000});
      const frame = page.frames().find(item => item.url().includes('/simulator/index.html'));
      if (!frame) throw new Error('Simulator iframe did not become ready');
      await verifySoloClarity(page, frame, expect, evidence);
    } else if (app === 'demon') {
      await page.locator('#begin').click();
      await page.locator('[data-village]').first().click();
      await expect(page.locator('#hud')).toBeVisible();
      await verifyHuntClarity(page, expect, evidence);
    }
    await capturePlayedAudio(page, playedSources);
    const media = await mediaDiagnostics(rawRequests, playedSources, new URL(url).origin);
    writeFileSync(resolve(root, `test-results/pr-browser/${app}-media.json`), JSON.stringify(media, null, 2));
    if (errors.length || media.failedRequests.length) throw new Error(`Play clarity failed: ${JSON.stringify({errors,...media})}`);
    await context.tracing.stop({ path: resolve(root, `test-results/pr-browser/${app}-trace.zip`) });
    await context.close();
    console.log('PR BROWSER VERIFIED', JSON.stringify(report));
    // Additional targeted editor gate. It does not replace or weaken the game smoke above.
    const changed = execFileSync('git', ['diff', '--name-only', base, head], { cwd: root, encoding: 'utf8' });
    if (app === 'village' && /apps\/village\/|scripts\/browser\/pr-smoke/.test(changed)) {
      const { verifyVillagePlaythrough } = await import('../../apps/village/tests/playthrough.browser.mjs');
      await verifyVillagePlaythrough(browser, url, resolve(root, 'test-results/pr-browser/village-playthrough'));
    }
    if (app === 'rinne' && /apps\/rinne\/(characters|src\/character-|tests\/character-)|scripts\/browser\/pr-smoke/.test(changed)) {
      const { verifyCharacterStudio } = await import('../../apps/rinne/tests/character-studio.browser.mjs');
      await verifyCharacterStudio(browser, url, resolve(root, 'test-results/pr-browser'));
    }
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
    await stopPreview(preview);
  }
}
