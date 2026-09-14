import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';

const baseURL = process.argv[2];
const output = resolve(process.argv[3] || 'test-results/shino-runtime-ready');
if (!baseURL) throw new Error('Usage: node scripts/browser/shino-runtime-ready.mjs <baseURL> [output]');
mkdirSync(output, { recursive: true });

const launchArgs = ['--use-angle=swiftshader','--enable-webgl','--enable-unsafe-swiftshader'];
const browser = await chromium.launch({ headless: true, args: launchArgs });
const cameraIds = ['front','front-left','left','back-left','back','back-right','right','front-right'];
const sharedClips = [
  ['relaxed-idle', 1.5, 'idle-01'],
  ['walk', 4.5, 'walk'],
  ['run', 8.5, 'run-slow'],
  ['weapon-draw', 12.5, 'runtime.weaponDraw'],
  ['combat-idle', 15.5, 'runtime.guard'],
  ['attack', 19.0, 'authored-slash'],
  ['weapon-sheathe', 24.5, 'runtime.weaponDraw'],
  ['relaxed-to-combat', 13.9, 'runtime.weaponDraw'],
];

async function runProfile({ name, viewport, deviceScaleFactor, isMobile = false, hasTouch = false, cpuThrottleRate = 1 }) {
  const context = await browser.newContext({ viewport, deviceScaleFactor, isMobile, hasTouch });
  const page = await context.newPage();
  const errors = [], network = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('requestfailed', request => network.push({ url: request.url(), error: request.failure()?.errorText }));
  page.on('response', response => { if (response.status() >= 400) network.push({ url: response.url(), status: response.status() }); });
  const cdp = await context.newCDPSession(page);
  if (cpuThrottleRate > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpuThrottleRate });
  try {
    const response = await page.goto(new URL('./characters.html', baseURL).href, { waitUntil: 'domcontentloaded', timeout: 60000 });
    assert.equal(response.status(), 200);
    await page.waitForFunction(() => window.characterStudio?.review?.ready === true && window.characterStudio?.workspace, null, { timeout: 120000 });
    await page.evaluate(() => window.characterStudio.workspace.selectModel('shino.reference.v2'));
    await page.waitForFunction(() => window.masterCharacterReview?.ready === true && window.masterCharacterReview?.audit?.id === 'shino.reference.v2', null, { timeout: 120000 });
    const audit = await page.evaluate(() => window.masterCharacterReview.audit);
    assert.equal(audit.approved, true, JSON.stringify(audit.errors));
    const gpu = await page.locator('#stage').evaluate(canvas => {
      const gl = canvas.getContext('webgl2');
      return gl && !gl.isContextLost() ? { version: gl.getParameter(gl.VERSION), renderer: gl.getParameter(gl.RENDERER), width: gl.drawingBufferWidth, height: gl.drawingBufferHeight } : null;
    });
    assert.ok(gpu?.version.includes('WebGL 2.0'), JSON.stringify(gpu));
    const expressions = await page.evaluate(() => window.masterCharacterReview.capabilities?.expressionNames ?? []);
    for (const expression of ['blink','smile','mouth-open']) assert.ok(expressions.includes(expression), `missing ${expression}`);

    await page.evaluate(() => window.masterCharacterReview.configure({ view: 'single', count: 1, paused: false, rotate: false }));
    await page.waitForTimeout(3500);
    const metrics = await page.evaluate(() => window.masterCharacterReview.measure());
    assert.ok(Number.isFinite(metrics.p95Ms) && metrics.sampleCount >= 30, JSON.stringify(metrics));
    assert.ok(metrics.info.triangles > 0 && metrics.info.calls > 0, JSON.stringify(metrics.info));

    await page.locator('[data-tab="qa"]').click();
    await page.locator('#qa-start').click();
    await page.waitForFunction(() => window.masterCharacterReview.motionQA?.active === true, null, { timeout: 120000 });
    const initialTime = await page.evaluate(() => window.masterCharacterReview.motionQA.time);
    await page.waitForTimeout(650);
    const advancedTime = await page.evaluate(() => window.masterCharacterReview.motionQA.time);
    assert.ok(advancedTime > initialTime + .30, `${initialTime} -> ${advancedTime}`);
    const sources = await page.evaluate(() => window.masterCharacterReview.motionQA.sources);
    for (const [, , source] of sharedClips) assert.ok(sources.includes(source), `missing motion source ${source}`);

    const clipEvidence = [];
    for (const [clip, time, source] of sharedClips) {
      await page.evaluate(t => window.masterCharacterReview.motionQA.seek(t), time);
      await page.locator('[data-qa-camera="front-left"]').click();
      await page.waitForTimeout(40);
      const snapshot = await page.evaluate(() => window.masterCharacterReview.motionQA.snapshot());
      await page.screenshot({ path: resolve(output, `${name}-motion-${clip}.png`) });
      clipEvidence.push({ clip, time, source, frame: snapshot.frame, camera: snapshot.camera, diagnostics: snapshot.diagnostics.length });
    }

    await page.evaluate(t => window.masterCharacterReview.motionQA.seek(t), 15.5);
    const finalViews = [];
    for (const camera of cameraIds) {
      await page.locator(`[data-qa-camera="${camera}"]`).click();
      await page.waitForTimeout(35);
      const snap = await page.evaluate(() => window.masterCharacterReview.motionQA.snapshot());
      await page.screenshot({ path: resolve(output, `${name}-final-${camera}.png`) });
      finalViews.push({ camera, position: snap.cameraPosition, diagnostics: snap.diagnostics.length });
    }
    assert.equal(new Set(finalViews.map(row => row.position.join(','))).size, 8);
    await page.locator('#qa-stop').click();

    assert.deepEqual(errors, []);
    assert.deepEqual(network, []);
    return {
      name, viewport, deviceScaleFactor, isMobile, hasTouch, cpuThrottleRate,
      gpu, audit, expressions, metrics,
      normalSpeed: { start: initialTime, after650ms: advancedTime, advancedSeconds: advancedTime - initialTime },
      sharedMotionClips: clipEvidence,
      finalViews, consoleErrors: errors, networkErrors: network,
    };
  } finally {
    await context.close();
  }
}

try {
  const desktop = await runProfile({ name: 'desktop', viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const mobile = await runProfile({ name: 'pixel-fold-class-ci-v1', viewport: { width: 420, height: 920 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, cpuThrottleRate: 4 });
  const result = {
    schema: 'shino-runtime-browser-evidence', version: 1, success: true,
    mobileProfile: {
      id: 'pixel-fold-class-ci-v1', type: 'ci-profile', viewport: mobile.viewport,
      deviceScaleFactor: mobile.deviceScaleFactor, cpuThrottleRate: mobile.cpuThrottleRate,
      note: 'Repeatable conservative Chromium/WebGL2 class profile; not a claim of physical Pixel Fold hardware execution.'
    },
    desktop, mobile,
    reviewViewCount: Math.min(desktop.finalViews.length, mobile.finalViews.length),
    webgl2: desktop.gpu.version.includes('WebGL 2.0') && mobile.gpu.version.includes('WebGL 2.0')
  };
  writeFileSync(resolve(output, 'shino-runtime-browser.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ success: true, desktopP95Ms: desktop.metrics.p95Ms, mobileP95Ms: mobile.metrics.p95Ms, drawCalls: desktop.metrics.info.calls, triangles: desktop.metrics.info.triangles, views: result.reviewViewCount }, null, 2));
} catch (error) {
  writeFileSync(resolve(output, 'shino-runtime-browser.json'), JSON.stringify({ schema:'shino-runtime-browser-evidence', version:1, success:false, error:String(error) }, null, 2));
  throw error;
} finally {
  await browser.close();
}
