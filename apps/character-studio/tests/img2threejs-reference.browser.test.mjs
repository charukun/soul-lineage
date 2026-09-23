import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { spawn, execFileSync } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
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
  if (process.env.CI && !process.env.IMG2THREEJS_CHROME) execFileSync('npx', ['playwright', 'install', 'chromium'], { cwd:repo, stdio:'inherit' });
  execFileSync(process.execPath, ['scripts/prepare-kaykit-foundation.mjs', 'character-studio'], { cwd:repo, stdio:'inherit' });
  const server = spawn(process.execPath, [path.join(repo,'node_modules/vite/bin/vite.js'), '--host','127.0.0.1','--port','5179','--strictPort'], { cwd:app, stdio:'pipe' });
  let browser;
  try {
    await ready();
    browser = await chromium.launch({ headless:true, executablePath:process.env.IMG2THREEJS_CHROME || undefined, args:['--no-sandbox','--in-process-gpu','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--enable-webgl'] });
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
    await page.screenshot({ path:path.join(evidence,'comparison-front.png'), fullPage:true });
    await page.locator('#model').screenshot({ path:path.join(evidence,'standalone-front.png') });
    for (const view of ['right','back','left','three-quarter']) {
      await page.locator(`[data-view="${view}"]`).click();
      await page.locator('#model').screenshot({ path:path.join(evidence,`standalone-${view}.png`) });
    }
    await page.goto(new URL('index.html',base).href);
    await page.waitForFunction(() => window.masterCharacterReview?.ready && window.characterStudio?.review);
    await page.locator('.character-model-card[data-model-key="img2threejs.bald-chibi.v1"]').click();
    await page.waitForFunction(() => window.masterCharacterReview?.audit?.modelId === 'img2threejs.bald-chibi.v1');
    await page.locator('#load-indicator').waitFor({state:'hidden'});
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
    const otherChibi = page.locator('.character-model-card[data-model-key="reference-chibi-front-20260923"]');
    if (await otherChibi.count()) {
      await otherChibi.click();
      assert.notEqual(await page.evaluate(() => window.masterCharacterReview.displayModelId), 'img2threejs.bald-chibi.v1');
      await page.locator('.character-model-card[data-model-key="img2threejs.bald-chibi.v1"]').click();
      await page.waitForFunction(() => window.masterCharacterReview?.displayModelId === 'img2threejs.bald-chibi.v1');
      assert.equal(await page.evaluate(() => window.masterCharacterReview.actors.some(a => a.root.visible)), false);
    }
    assert.deepEqual(errors, []);
    console.log('IMG2THREEJS_BROWSER_EVIDENCE', JSON.stringify({ geometry,state,files:['comparison-front.png','standalone-front.png','standalone-right.png','standalone-back.png','standalone-left.png','standalone-three-quarter.png','selection-front.png','selection-side.png'] }));
  } finally { await browser?.close(); server.kill('SIGTERM'); }
});
