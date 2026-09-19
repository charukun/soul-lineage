import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';
import browserConfig from './config.mjs';
import { validateMotionManifest } from '../../apps/rinne/src/review-motion-manifest.js';

const root = path.resolve('dist/rinne'), evidence = path.resolve('artifacts/motion-browser');
await mkdir(path.join(evidence, 'poses'), { recursive: true });
const manifest = validateMotionManifest(JSON.parse(await readFile(path.join(root, 'simulator/assets/motion-library/catalog.json'), 'utf8')));
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (pathname === '/favicon.ico') { response.writeHead(204); response.end(); return; }
    let file = path.resolve(root, '.' + pathname);
    if (file !== root && !file.startsWith(root + path.sep)) { response.writeHead(403); response.end(); return; }
    if ((await stat(file)).isDirectory()) file = path.join(file, 'index.html');
    response.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' }); createReadStream(file).pipe(response);
  } catch { response.writeHead(404); response.end('Not found'); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ ...browserConfig.use.launchOptions, headless: true });
const context = await browser.newContext({ viewport: { width: 960, height: 820 }, deviceScaleFactor: 1 });
await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
const page = await context.newPage(), errors = [], requests = [], failures = [];
const receipt = { head: process.env.HEAD_SHA || process.env.GITHUB_SHA, summary: manifest.summary, selections: [], screenshots: [], controls: {}, failures, errors };
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error' || /THREE.PropertyBinding/.test(message.text())) errors.push(message.text()); });
page.on('request', request => { if (/\.glb(?:\?|$)/.test(request.url())) requests.push(new URL(request.url()).pathname); });
page.on('response', response => { if (response.status() >= 400 && new URL(response.url()).origin === base) errors.push(`HTTP ${response.status()}: ${response.url()}`); });
const state = () => page.evaluate(() => window.__MOTION_REVIEW__.inspect());
const motionButtons = '#motion-grid button[data-motion-id]';
async function selected(id) {
  await page.waitForFunction(id => document.getElementById('motion-stage').dataset.motionId === id && document.getElementById('motion-stage').dataset.motionState === 'ready', id, { timeout: 60000 });
}
async function sample(time) {
  await page.locator('#motion-time').evaluate((element, time) => { element.value = String(time); element.dispatchEvent(new Event('input', { bubbles: true })); }, time);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => resolve())));
  return state();
}
async function countUnobscured() {
  return page.locator('#motion-count').evaluate(element => {
    const rect = element.getBoundingClientRect();
    return [[rect.left + 1, rect.top + 1], [rect.right - 1, rect.bottom - 1]].every(([x, y]) => element.contains(document.elementFromPoint(x, y)));
  });
}
function checkSample(row, model, data) {
  const values = [...(data.bounds?.min || []), ...(data.bounds?.max || [])];
  if (values.length !== 6 || !values.every(Number.isFinite) || !data.rig?.finite) failures.push({ id: row.id, model, issue: 'non-finite rendered geometry', data });
  if (values.some(value => Math.abs(value) > 10)) failures.push({ id: row.id, model, issue: 'unbounded rendered geometry', data });
  if (data.bounds?.min[1] < -.15) failures.push({ id: row.id, model, issue: 'rendered mesh penetrates floor', minY: data.bounds.min[1], time: data.time });
  if (data.count !== manifest.records.length) failures.push({ id: row.id, model, issue: 'model switch changed source count' });
}
try {
  await page.goto(base + '/review-motion.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__MOTION_REVIEW__?.ready, null, { timeout: 60000 });
  assert.equal(await page.locator('#motion-count').textContent(), `MOTION CLIPS ${manifest.records.length}`);
  assert.equal(await countUnobscured(), true, 'Source count must not be covered by navigation');
  assert.deepEqual((await state()).loadedSources, [], 'Initial view must not preload the animation library');
  assert.equal(requests.length, 1, 'Only the initial selected character binary should load');
  receipt.initialRequests = [...requests];
  await page.locator('[data-motion-filter="all"]').click();
  assert.equal(await page.locator(motionButtons).count(), manifest.records.length);
  const modelIds = await page.locator('[data-motion-model]').evaluateAll(elements => elements.map(element => element.dataset.motionModel));
  assert.equal(modelIds.length, manifest.qa.targetModels);
  for (const [modelIndex, model] of modelIds.entries()) {
    if (modelIndex) {
      await page.locator(`[data-motion-model="${model}"]`).click();
      await page.waitForFunction(model => document.getElementById('motion-stage').dataset.motionModel === model && document.getElementById('motion-stage').dataset.motionState === 'ready', model);
    }
    for (const row of manifest.records) {
      await page.locator(`${motionButtons}[data-motion-id="${row.id}"]`).click(); await selected(row.id);
      const times = modelIndex === 0 ? [row.duration * .3, row.duration * .7] : [row.duration * .55];
      const samples = [];
      for (const [index, time] of times.entries()) {
        const data = await sample(time); checkSample(row, model, data);
        samples.push({ time: data.time, bounds: data.bounds, minJointY: data.rig.minY, lift: data.lift });
        if (!row.baseline && modelIndex === 0) {
          const file = `poses/${row.id.replace(/[^a-zA-Z0-9_-]/g, '-')}-${index}.png`;
          await page.locator('#motion-stage').screenshot({ path: path.join(evidence, file) });
          receipt.screenshots.push({ id: row.id, name: row.name, model, time: data.time, file });
        }
      }
      receipt.selections.push({ id: row.id, sourceIdentity: row.sourceIdentity, model, samples });
    }
  }
  assert.equal(receipt.selections.length, manifest.records.length * modelIds.length);
  const row = manifest.records.find(row => row.name === 'Idle') || manifest.records[0];
  await page.locator(`${motionButtons}[data-motion-id="${row.id}"]`).click(); await selected(row.id);
  const before = await sample(row.duration * .4);
  await page.locator('#motion-next-frame').click(); const next = await state();
  assert.ok(Math.abs(next.time - before.time - 1 / 60) < .001); assert.equal(next.playing, false);
  await page.locator('#motion-prev-frame').click(); assert.ok(Math.abs((await state()).time - before.time) < .001);
  await page.locator('#motion-speed').selectOption('0.5'); assert.equal((await state()).speed, .5);
  await page.locator('#motion-loop').uncheck(); assert.equal((await state()).loop, false);
  await page.locator('#motion-loop').check();
  await page.locator('#motion-restart').click(); assert.equal((await state()).playing, true);
  await page.locator('#motion-play').click(); assert.equal((await state()).playing, false);
  for (const id of ['front', 'three-quarter', 'side', 'back', 'face']) {
    await page.locator(`[data-motion-camera="${id}"]`).click(); assert.equal(await page.locator(`[data-motion-camera="${id}"]`).getAttribute('aria-pressed'), 'true');
  }
  for (const category of ['life', 'move', 'combat', 'reaction', 'other', 'recommended', 'all']) {
    await page.locator(`[data-motion-filter="${category}"]`).click();
    if (category === 'all') assert.equal(await page.locator(motionButtons).count(), manifest.records.length);
  }
  assert.equal(await page.locator('#motion-legacy option').count() - 1, manifest.legacy.length);
  await page.locator('#motion-legacy').locator('..').locator('summary').click();
  await page.locator('#motion-legacy').selectOption(String(manifest.legacy.at(-1).index)); await selected('legacy:' + manifest.legacy.at(-1).index);
  assert.equal((await state()).count, manifest.records.length);
  receipt.controls = { playback: true, restart: true, speed: true, loop: true, timeline: true, frameStepping: true, cameras: true, categories: true, legacyPreserved: true, models: modelIds };
  receipt.binaryRequests = requests.reduce((counts, url) => { counts[url] = (counts[url] || 0) + 1; return counts; }, {});
  for (const count of Object.values(receipt.binaryRequests)) assert.equal(count, 1, 'Source/model cache must prevent repeated GLB fetches');
  await page.setViewportSize({ width: 412, height: 915 });
  await page.locator('[data-motion-camera="three-quarter"]').click();
  assert.equal(await countUnobscured(), true, 'Source count must remain visible on mobile');
  await page.screenshot({ path: path.join(evidence, 'motion-library-mobile.png'), fullPage: true });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Mobile horizontal overflow');

  // Close the first rendering context before testing the canonical workshop.
  await page.goto('about:blank');
  await page.goto(base + '/characters.html?review=motion', { waitUntil: 'domcontentloaded' });
  await page.locator('#tab-qa').click();
  await page.waitForFunction(() => document.getElementById('workshop-motion-count')?.textContent?.match(/MOTION CLIPS \d+/), null, { timeout: 60000 });
  const qaBefore = await page.evaluate(() => localStorage.getItem('rinne.motion-qa.v1'));
  assert.equal(await page.locator('#workshop-motion-count').textContent(), `MOTION CLIPS ${manifest.records.length}`);
  await page.locator('#workshop-motion-open').click({ timeout: 60000 });
  const frame = page.frameLocator('#workshop-motion-viewer');
  await frame.locator('#motion-stage[data-motion-state="ready"]').waitFor({ timeout: 60000 });
  assert.equal(await frame.locator('#motion-count').textContent(), `MOTION CLIPS ${manifest.records.length}`);
  await frame.locator('[data-motion-filter="all"]').click(); assert.equal(await frame.locator(motionButtons).count(), manifest.records.length);
  await frame.locator('#motion-tour').click();
  await frame.locator('#motion-stage[data-motion-state="ready"]').waitFor();
  await page.screenshot({ path: path.join(evidence, 'canonical-workshop-motion.png'), fullPage: true });
  await page.locator('#workshop-motion-close').click();
  assert.equal(await page.evaluate(() => localStorage.getItem('rinne.motion-qa.v1')), qaBefore);
  receipt.canonicalEntrypoint = { path: 'characters.html?review=motion', fullCatalogSelectable: true, tourStarted: true, qaRecordUnchanged: true };
  assert.deepEqual(errors, []); assert.deepEqual(failures, []);
  receipt.success = true;
} catch (error) {
  receipt.success = false; receipt.error = String(error.stack || error); process.exitCode = 1;
  await page.screenshot({ path: path.join(evidence, 'failure.png'), fullPage: true }).catch(() => {});
} finally {
  await writeFile(path.join(evidence, 'playtest-receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
  await context.tracing.stop({ path: path.join(evidence, 'trace.zip') }); await browser.close(); await new Promise(resolve => server.close(resolve));
  console.log('MOTION_BROWSER_RECEIPT ' + JSON.stringify({ success: receipt.success, selections: receipt.selections.length, counts: manifest.summary, errors, failures: failures.length, error: receipt.error }));
}
