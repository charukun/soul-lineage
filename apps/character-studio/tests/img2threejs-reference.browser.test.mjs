import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { spawn, execFileSync } from 'node:child_process';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const app = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const repo = path.resolve(app, '../..');
const evidence = path.resolve(repo, 'test-results/img2threejs-reference');
const base = 'http://127.0.0.1:5179/';
async function ready() {
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(base)).ok) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error('character-studio preview did not start');
}

test('standalone turntable and real selection canvas render the same full-depth model', { timeout: 240000 }, async () => {
  await mkdir(evidence, { recursive:true });
  if (process.env.CI) execFileSync('npx', ['playwright', 'install', 'chromium'], { cwd:repo, stdio:'inherit' });
  execFileSync(process.execPath, ['scripts/prepare-kaykit-foundation.mjs', 'character-studio'], { cwd:repo, stdio:'inherit' });
  const server = spawn(process.execPath, [path.join(repo,'node_modules/vite/bin/vite.js'), '--host','127.0.0.1','--port','5179','--strictPort'], { cwd:app, stdio:'pipe' });
  let browser;
  try {
    await ready();
    browser = await chromium.launch({ headless:true, args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl'] });
    const page = await browser.newPage({ viewport:{ width:1100,height:880 }, deviceScaleFactor:1 });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(new URL('img2threejs-preview.html',base).href);
    await page.waitForFunction(() => window.img2threejsPreview?.ready);
    const geometry = await page.evaluate(() => {
      const root = window.img2threejsPreview.model;
      const head = root.getObjectByName('full-depth-projected-head');
      let meshes = 0; root.traverse(node => { if(node.isMesh) meshes++; });
      return { meshes, depth:head.scale.z / head.scale.x, width:head.scale.x*2, name:root.name };
    });
    assert.ok(geometry.meshes > 35, 'actual 3D component hierarchy present');
    assert.ok(geometry.depth > .7, 'head depth must not be a flat card');
    await page.locator('[data-view="front"]').click();
    await page.locator('#model').screenshot({ path:path.join(evidence,'standalone-front.png') });
    for (const view of ['right','back','left','three-quarter']) {
      await page.locator(`[data-view="${view}"]`).click();
      await page.locator('#model').screenshot({ path:path.join(evidence,`standalone-${view}.png`) });
    }
    await page.goto(new URL('index.html',base).href);
    await page.waitForFunction(() => window.characterStudio?.review);
    await page.locator('[data-character-model="img2threejs.bald-chibi.v1"]').first().click();
    await page.waitForFunction(() => window.masterCharacterReview?.audit?.modelId === 'img2threejs.bald-chibi.v1');
    const state = await page.evaluate(() => {
      const review=window.masterCharacterReview;
      return { ready:review.ready, modelId:review.displayModelId, oldVisible:review.actors.some(a=>a.root.visible), errors:review.errors };
    });
    assert.deepEqual(state.errors, []);
    assert.equal(state.ready, true);
    assert.equal(state.oldVisible, false, 'old model must not obscure new model');
    await page.locator('[data-camera="front"]').first().click();
    await page.locator('#stage').screenshot({ path:path.join(evidence,'selection-front.png') });
    await page.locator('[data-camera="side"]').first().click();
    await page.locator('#stage').screenshot({ path:path.join(evidence,'selection-side.png') });
    assert.deepEqual(errors, []);
    console.log('IMG2THREEJS_BROWSER_EVIDENCE', JSON.stringify({ geometry,state,files:['standalone-front.png','standalone-right.png','standalone-back.png','standalone-left.png','standalone-three-quarter.png','selection-front.png','selection-side.png'] }));
    // The existing runner has no artifact-upload step. Put two small visual proofs
    // in the job log so the exact-head screenshots remain recoverable by run ID.
    for (const name of ['standalone-right.png','selection-front.png']) {
      const bytes=await readFile(path.join(evidence,name));
      console.log(`IMG2THREEJS_PNG_${name}=${bytes.toString('base64')}`);
    }
  } finally { await browser?.close(); server.kill('SIGTERM'); }
});
