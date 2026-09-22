import { chromium } from 'playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import assert from 'node:assert/strict';

const out = '/tmp/female-rogue-observation';
await mkdir(out, { recursive: true });
const source = JSON.parse(await readFile('apps/review/public/library/provenance/female-protagonist-rogue-v1.json', 'utf8'));
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 }, deviceScaleFactor: 1 });
const errors = [], httpErrors = [], consoleErrors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('response', response => { if (response.status() >= 400) httpErrors.push({ url: response.url(), status: response.status() }); });
// Resolve the configured DEV asset origin against this exact checkout during
// local authored-output observation. Bytes are the real materialized originals,
// not generated geometry or a mocked character. No live publication is implied.
await page.route('https://soul-lineage-review-dev.c-okamoto.workers.dev/library/**', async route => {
  const pathname = new URL(route.request().url()).pathname;
  assert.ok(pathname.startsWith('/library/'));
  assert.ok(!pathname.includes('..'));
  await route.fulfill({ path: path.resolve('apps/review/public', pathname.slice(1)), contentType: pathname.endsWith('.glb') ? 'model/gltf-binary' : 'application/octet-stream' });
});
const receipt = { sourceSha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), assetSha256: source.sha256, evidenceKind: 'actual Character Studio build / local exact-checkout asset origin', hardwareAcceptance: 'not-measured', errors, httpErrors, consoleErrors };
try {
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForFunction(() => window.characterStudio && window.masterCharacterReview?.ready, { timeout: 60000 });
  await page.locator('[data-character-model="protagonist.villager.female.v1"]').first().evaluate(button => button.click());
  await page.waitForFunction(sha => window.masterCharacterReview?.ready && window.masterCharacterReview.displayModelId === 'protagonist.villager.female.v1' && window.masterCharacterReview.audit?.source?.sha256 === sha, source.sha256, { timeout: 60000 });
  const frame = async () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.evaluate(() => window.masterCharacterReview.configure({ count: 1, view: 'single', rotate: false, paused: true, motion: 'rest' }));
  receipt.runtime = await page.evaluate(() => {
    const r = window.masterCharacterReview, names = [];
    r.actors[0].root.traverse(node => { if (node.isMesh || node.isBone) names.push(node.name); });
    return { ready: r.ready, displayModelId: r.displayModelId, audit: r.audit, errors: r.errors, names, metrics: r.measure() };
  });
  assert.ok(receipt.runtime.names.includes('Rogue_Head'));
  assert.ok(receipt.runtime.names.includes('Rogue_Body'));
  for (const name of ['Knife_Offhand','1H_Crossbow','2H_Crossbow','Knife','Throwable']) assert.ok(!receipt.runtime.names.includes(name), name);
  assert.deepEqual(receipt.runtime.errors, []);
  for (const view of ['front', 'side', 'back', 'face']) {
    await page.evaluate(view => window.masterCharacterReview.aim(view), view);
    await frame();
    await page.locator('#stage').screenshot({ path: `${out}/${view}.png` });
  }
  await page.evaluate(() => {
    const r = window.masterCharacterReview;
    r.aim('front'); r.actors[0].root.rotation.y = Math.PI / 4;
  });
  await frame();
  await page.locator('#stage').screenshot({ path: `${out}/three-quarter.png` });
  await page.evaluate(() => {
    const r = window.masterCharacterReview, root = r.actors[0].root;
    root.rotation.y = 0;
    for (const [name, axis, amount] of [['head', 'y', .5], ['rightUpperArm', 'z', .5], ['rightLowerArm', 'x', .6], ['leftLowerLeg', 'x', -.6]]) {
      const bone = r.actors[0].bones[name];
      if (!bone?.isBone) throw new Error(`Missing deformation probe bone ${name}`);
      bone.rotation[axis] += amount;
    }
    root.updateMatrixWorld(true); r.aim('front');
  });
  await frame();
  await page.locator('#stage').screenshot({ path: `${out}/pose-front.png` });
  await page.evaluate(() => window.masterCharacterReview.aim('side'));
  await frame();
  await page.locator('#stage').screenshot({ path: `${out}/pose-side.png` });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.masterCharacterReview.aim('front'));
  await frame();
  await page.screenshot({ path: `${out}/phone.png`, fullPage: true });
  assert.deepEqual(errors, []);
  assert.deepEqual(httpErrors, []);
  assert.deepEqual(consoleErrors, []);
  receipt.result = 'rendered-and-probed';
} catch (error) {
  receipt.failure = String(error.stack || error);
  await page.screenshot({ path: `${out}/failure.png`, fullPage: true }).catch(() => {});
  process.exitCode = 1;
} finally {
  await writeFile(`${out}/receipt.json`, JSON.stringify(receipt, null, 2) + '\n');
  console.log(JSON.stringify(receipt));
  await browser.close();
}
