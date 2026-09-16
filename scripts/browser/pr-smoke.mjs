import { chromium, expect } from '@playwright/test';
import {verifyHuntClarity} from './play-clarity.mjs';
import {capturePlayedAudio,mediaDiagnostics} from './media-diagnostics.mjs';
import {parseBrowserPlaytest,parseBrowserPlaytestValue,resolveBrowserPlaytestTargets} from './playtest-routing.mjs';
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const root = resolve(new URL('../..', import.meta.url).pathname);
const base = process.argv[2];
const head = process.argv[3] || 'HEAD';
const plan = JSON.parse(execFileSync(process.execPath, ['scripts/affected.mjs', base, head], { cwd: root, encoding: 'utf8' }));
const changedFiles = execFileSync('git', ['diff', '--name-only', base, head], { cwd: root, encoding: 'utf8' });
const wantsPeerHostMigration = /^(?:apps\/village\/src\/(?:online\.js|friend-visit\.js|peer-|runtime-scale-stack\.js)|apps\/rinne\/src\/online\.js|apps\/demon\/src\/(?:web\/online\.js|peer-authority-pause\.js)|packages\/network\/src\/(?:peer(?:-|\.)|village-|friend-visit-authority|raid-host)|packages\/shared-ui\/src\/world-darkness\.js|scripts\/peer-host-chaos\.mjs|scripts\/browser\/peer-(?:host-migration-smoke|network-harness)\.mjs|tests\/peer-host)/m.test(changedFiles);
const plannedApps = plan.infrastructure ? plan.allApps : plan.apps;

function eventPullRequestBody() {
  if (process.env.PR_BODY) return process.env.PR_BODY;
  if (!process.env.GITHUB_EVENT_PATH) return '';
  const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
  return event?.pull_request?.body || '';
}

const request = process.env.BROWSER_PLAYTEST
  ? parseBrowserPlaytestValue(process.env.BROWSER_PLAYTEST)
  : parseBrowserPlaytest(eventPullRequestBody());
const affectedApps = [...new Set([...plannedApps, ...(wantsPeerHostMigration ? ['village'] : [])])];
const apps = resolveBrowserPlaytestTargets(affectedApps, request);
const ports = { rinne: 5273, village: 5274, demon: 5275 };
const viteBin = resolve(root, 'node_modules/vite/bin/vite.js');
const resultDir = resolve(root, 'test-results/pr-browser');
const receiptPath = resolve(resultDir, 'playtest-receipt.json');
mkdirSync(resultDir, { recursive: true });

const receipt = {
  schema: 1,
  base,
  head,
  request: {
    declared: request.declared,
    mode: request.mode,
    raw: request.raw,
    apps: request.apps,
    source: process.env.BROWSER_PLAYTEST ? 'workflow-input' : request.declared ? 'pr-body' : 'affected-diff',
  },
  affectedApps,
  executedApps: apps,
  completedApps: [],
  failed: null,
  viewport: { width: 390, height: 844 },
};
const writeReceipt = () => writeFileSync(receiptPath, JSON.stringify(receipt, null, 2));
writeReceipt();

// PULSE Rescue has a dedicated fixture-rich browser contract that is stricter than the
// generic game smoke below. Run it on the PR head whenever the Rescue cockpit or its
// state adapters change so failures cannot first appear only after Integration.
if (/^(ops-board\/|scripts\/integration-rescue-(?:pulse|policy)\.mjs|tests\/fixtures\/integration-rescue-state\.mjs)/m.test(changedFiles)) {
  execFileSync(process.execPath, ['ops-board/rescue-browser-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, OPS_RESCUE_REPORT_DIR: resolve(root, 'test-results/pr-browser/rescue') },
  });
}

if (!apps.length) {
  console.log('No affected or requested app browser targets.');
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

async function captureProtagonistVisualReview(browser, baseURL) {
  const context = await browser.newContext({ viewport: { width: 1100, height: 900 } });
  const page = await context.newPage();
  const errors = [], failedRequests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('requestfailed', request => failedRequests.push({ url: request.url(), failure: request.failure()?.errorText || 'failed' }));
  try {
    const reviewURL = new URL('./review.html', baseURL).href;
    const response = await page.goto(reviewURL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    if (!response?.ok()) throw new Error(`Visual Review returned HTTP ${response?.status()}`);
    await page.locator('[data-view="motion"]').click();
    const iframe = page.locator('[data-panel="motion"] iframe');
    await iframe.waitFor({ state: 'visible', timeout: 30000 });
    const handle = await iframe.elementHandle();
    const frame = await handle?.contentFrame();
    if (!frame) throw new Error('Visual Review motion iframe did not attach');
    await frame.waitForFunction(() => window.characterStudio?.workspace?.modelId === 'protagonist.villager.v1', null, { timeout: 90000 });
    await frame.waitForFunction(() => window.masterCharacterReview?.ready === true && document.querySelector('#capabilities')?.textContent?.includes('4f95570f'), null, { timeout: 90000 });
    await frame.locator('#qa-start').click();
    await frame.waitForFunction(() => window.masterCharacterReview?.motionQA?.active === true, null, { timeout: 90000 });
    await frame.evaluate(() => window.masterCharacterReview.motionQA.seek(13.97));
    await page.waitForTimeout(200);
    await page.screenshot({ path: resolve(resultDir, 'rinne-visual-review-protagonist-draw.png'), fullPage: true });
    await frame.locator('.canvas-wrap').screenshot({ path: resolve(resultDir, 'rinne-protagonist-motion-draw.png') });
    await frame.evaluate(() => window.masterCharacterReview.motionQA.seek(17.475));
    await page.waitForTimeout(200);
    await frame.locator('.canvas-wrap').screenshot({ path: resolve(resultDir, 'rinne-protagonist-motion-slash.png') });
    const state = await frame.evaluate(() => ({
      modelId: window.characterStudio.workspace.modelId,
      motion: window.masterCharacterReview.motionQA.snapshot(),
      status: document.querySelector('#qa-status')?.textContent || '',
      capabilities: document.querySelector('#capabilities')?.textContent || '',
    }));
    writeFileSync(resolve(resultDir, 'rinne-protagonist-motion-review.json'), JSON.stringify({ success: true, reviewURL, state, errors, failedRequests }, null, 2));
    if (errors.length || failedRequests.length) throw new Error(`Protagonist Visual Review browser errors: ${JSON.stringify({ errors, failedRequests })}`);
    console.log('PROTAGONIST VISUAL REVIEW CAPTURED', JSON.stringify({ modelId: state.modelId, frame: state.motion.frame }));
  } catch (error) {
    await page.screenshot({ path: resolve(resultDir, 'rinne-protagonist-motion-failure.png'), fullPage: true }).catch(() => {});
    writeFileSync(resolve(resultDir, 'rinne-protagonist-motion-review.json'), JSON.stringify({ success: false, error: String(error), errors, failedRequests }, null, 2));
    throw error;
  } finally {
    await context.close();
  }
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
    if (app === 'rinne') {
      // The current Rinne entry is a title screen. Start the real 100-year-life runtime before
      // applying the common canvas/WebGL gate instead of probing the retired simulator launcher.
      await page.locator('#new-life').click();
      await page.locator('#game-screen').waitFor({ state: 'visible', timeout: 45000 });
      await page.locator('#loading-card').waitFor({ state: 'hidden', timeout: 45000 });
    }
    const canvas = page.locator('#game');
    await canvas.waitFor({ state: 'visible', timeout: 45000 });
    if (app !== 'rinne') await page.waitForFunction(() => document.querySelector('#game')?.dataset.renderer === 'ready', null, { timeout: 45000 });
    const renderer = app === 'rinne' ? 'rebuild-runtime' : await canvas.getAttribute('data-renderer');
    const appId = app === 'rinne' ? 'rinne' : await canvas.getAttribute('data-app');
    const rendererOk = app === 'rinne' ? await page.locator('#loading-card').isHidden() : renderer === 'ready';
    const widthOk = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
    const webgl = await canvas.evaluate(element => {
      const gl = element.getContext('webgl2');
      return gl && !gl.isContextLost() ? { version: gl.getParameter(gl.VERSION), width: gl.drawingBufferWidth, height: gl.drawingBufferHeight } : null;
    });
    await page.screenshot({ path: resolve(root, `test-results/pr-browser/${app}.png`), fullPage: true });
    const report = { app, url, renderer, appId, rendererOk, widthOk, webgl, errors, failedRequests };
    writeFileSync(resolve(root, `test-results/pr-browser/${app}.json`), JSON.stringify(report, null, 2));
    if (!rendererOk || appId !== app || !widthOk || !webgl?.version?.includes('WebGL 2.0') || errors.length || failedRequests.length) {
      throw new Error(`Browser smoke failed for ${app}: ${JSON.stringify(report)}`);
    }

    const finishProbe = async () => {
      await capturePlayedAudio(page, playedSources);
      const media = await mediaDiagnostics(rawRequests, playedSources, new URL(url).origin);
      writeFileSync(resolve(root, `test-results/pr-browser/${app}-media.json`), JSON.stringify(media, null, 2));
      if (errors.length || media.failedRequests.length) throw new Error(`Play clarity failed: ${JSON.stringify({errors,...media})}`);
      await context.tracing.stop({ path: resolve(root, `test-results/pr-browser/${app}-trace.zip`) });
      await context.close();
    };

    // Exercise changed or explicitly requested controls before Integration, using the same assertions as public DEV.
    const evidence = { outputPath: name => resolve(root, `test-results/pr-browser/${app}-${name}`) };
    if (app === 'rinne') {
      // The probe above owns a live Rinne runtime. Dispose that complete BrowserContext before
      // launching the independent title-to-rebirth playthrough so two heavyweight runtimes do
      // not contend for renderer/startup resources or lifecycle state.
      await finishProbe();
      const {verifyRebuildPlaythrough}=await import('../../apps/rinne/tests/rebuild-playthrough.browser.mjs');
      await verifyRebuildPlaythrough(browser,url,resolve(root,'test-results/pr-browser/rinne-playthrough'));
    } else if (app === 'demon') {
      await page.locator('#begin').click();
      await page.locator('[data-village]').first().click();
      await expect(page.locator('#hud')).toBeVisible();
      await verifyHuntClarity(page, expect, evidence);
    } else if (app === 'village') {
      const {verifyVillageFirstBuild} = await import('../../apps/village/tests/first-build.browser.mjs');
      // PR smoke already preserves a full-page screenshot and a screenshot-rich
      // Playwright trace. Keep every gameplay/Director assertion, but avoid the
      // extra milestone captures here; deployed DEV/public verification still
      // uses the default captureMilestones=true evidence path.
      await verifyVillageFirstBuild(page, expect, evidence, () => capturePlayedAudio(page, playedSources), {captureMilestones:false});
      if (wantsPeerHostMigration) {
        const {verifyPeerHostMigration} = await import('./peer-host-migration-smoke.mjs');
        await verifyPeerHostMigration(browser, url, evidence);
      }
    }
    if (app !== 'rinne') await finishProbe();
    console.log('PR BROWSER VERIFIED', JSON.stringify(report));
    // Additional targeted editor/motion gates. They supplement, never replace, the game smoke above.
    const changed = execFileSync('git', ['diff', '--name-only', base, head], { cwd: root, encoding: 'utf8' });
    if (app === 'village' && (/apps\/village\/|scripts\/browser\/pr-smoke/.test(changed) || request.apps.includes('village'))) {
      const { verifyVillagePlaythrough } = await import('../../apps/village/tests/playthrough.browser.mjs');
      await verifyVillagePlaythrough(browser, url, resolve(root, 'test-results/pr-browser/village-playthrough'));
    }
    if (app === 'rinne' && /apps\/rinne\/(characters|src\/character-|tests\/character-)|scripts\/browser\/pr-smoke/.test(changed)) {
      const { verifyCharacterStudio } = await import('../../apps/rinne/tests/character-studio.browser.mjs');
      await verifyCharacterStudio(browser, url, resolve(root, 'test-results/pr-browser'));
    }
    if (app === 'rinne' && /^(apps\/rinne\/public\/simulator\/src\/(?:authored-slash|game-hooks|humanoid|motion-)|apps\/rinne\/tests\/humanoid-|packages\/animations\/src\/(?:gameplay-motion-quality|motion-)|packages\/animations\/tests\/motion-)/m.test(changed)) {
      const { verifyCharacterMotionQA } = await import('../../apps/rinne/tests/character-motion-qa.browser.mjs');
      await verifyCharacterMotionQA(browser, url, resolve(root, 'test-results/pr-browser'));
    }
    if (app === 'rinne' && /(?:PROTAGONIST_VILLAGER_V1|protagonist-villager-v1|motion-review-entrypoint|reference-model-catalog)/.test(changed)) {
      await captureProtagonistVisualReview(browser, url);
    }
    receipt.completedApps.push(app);
    writeReceipt();
  } catch (error) {
    receipt.failed = { app, message: error instanceof Error ? error.message : String(error) };
    writeReceipt();
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