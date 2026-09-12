import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** Focused real-asset test called by the existing affected browser lane. */
export async function verifyCharacterStudio(browser, baseURL, output) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  const page = await context.newPage(), errors = [], network = [], checks = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('requestfailed', request => network.push({ url: request.url(), failure: request.failure()?.errorText }));
  const state = () => page.evaluate(() => ({
    profile: window.characterStudio.workspace.getProfile(), selected: window.characterStudio.review.settings.selected,
    records: window.characterStudio.review.records, view: window.characterStudio.review.settings.view
  }));
  async function ready() {
    await page.waitForFunction(() => window.characterStudio?.review?.ready === true && window.characterStudio?.workspace, null, { timeout: 120000 });
  }
  async function bounds() {
    return page.evaluate(() => {
      const r = document.querySelector('#stage').getBoundingClientRect();
      return { x:r.x,y:r.y,w:r.width,h:r.height,b:r.bottom, viewport:[innerWidth,innerHeight], document:[document.documentElement.scrollWidth,document.documentElement.scrollHeight] };
    });
  }
  try {
    const response = await page.goto(new URL('./characters.html', baseURL).href, {waitUntil:'domcontentloaded',timeout:60000});
    assert.equal(response.status(),200); await ready();
    assert.equal((await state()).view,'single');
    const gpu = await page.locator('#stage').evaluate(canvas => { const gl=canvas.getContext('webgl2'); return gl&&!gl.isContextLost() ? { version:gl.getParameter(gl.VERSION),width:gl.drawingBufferWidth,height:gl.drawingBufferHeight } : null; });
    assert.ok(gpu?.version.includes('WebGL 2.0')); assert.ok(gpu.width>0 && gpu.height>0);
    checks.push({name:'audited Shino WebGL scene',gpu});
    await page.locator('#pause').click();
    await page.locator('[data-slot="hair"]').click();
    await page.locator('[data-modular-value="bob"]').click();
    assert.equal((await state()).profile.hair,'bob');
    const bobVisible = await page.evaluate(() => {
      const actor=window.characterStudio.review.actors[0], part=actor.visual.getObjectByName('hair:bob');
      return part?.visible && part.children.every(mesh=>mesh.material.visible);
    });
    assert.equal(bobVisible,true);
    await page.locator('#undo').click(); assert.equal((await state()).profile.hair,'original');
    await page.locator('#redo').click(); assert.equal((await state()).profile.hair,'bob');
    await page.locator('#original-preview').click();
    assert.equal((await state()).profile.hair,'bob');
    await page.locator('#original-preview').click();
    const repeatedScale = await page.evaluate(() => {
      const w=window.characterStudio.workspace, actor=window.characterStudio.review.actors[0];
      w.change('body','sturdy'); const first=actor.root.scale.toArray();
      for(let i=0;i<10;i++) {w.previewOriginal();w.previewOriginal();}
      return {first,last:actor.root.scale.toArray()};
    });
    assert.deepEqual(repeatedScale.first,repeatedScale.last);
    checks.push({name:'paused part switching, visible replacement hair, undo/redo and non-cumulative original preview'});
    await page.screenshot({path:resolve(output,'studio-main-mobile.png')});
    const before = await state();
    await page.locator('[data-tab="compare"]').click();
    await page.locator('[data-count="12"]').click();
    await page.waitForFunction(()=>window.characterStudio.review.actors.length===12);
    assert.equal((await state()).profile.hair,'bob'); assert.deepEqual((await state()).records,before.records);
    await page.locator('[data-count="30"]').click();
    await page.waitForFunction(()=>window.characterStudio.review.actors.length===30);
    assert.equal((await state()).profile.hair,'bob'); assert.deepEqual((await state()).records,before.records);
    await page.screenshot({path:resolve(output,'studio-compare-mobile.png')});
    await page.locator('[data-individual="5"]').click();
    await page.locator('#edit-one').click();
    assert.equal((await state()).selected,5); assert.equal((await state()).view,'single');
    await page.locator('[data-tab="colors"]').click();
    await page.locator('[data-gene="eyes"][data-palette="2"]').click();
    await page.locator('[data-age="55"]').click();
    const colored=await state();assert.equal(colored.records[5].ageMs,55*60000);assert.deepEqual(colored.records[0],before.records[0]);
    checks.push({name:'1/12/30 comparison preserves edits and targeted color/age edits stay isolated'});
    for (const [width,height] of [[320,568],[360,640],[390,844],[412,892],[768,1024],[844,390],[1280,800]]) {
      await page.setViewportSize({width,height}); await page.waitForTimeout(80);
      const a=await bounds();
      assert.ok(a.w>0 && a.h>=150 && a.x>=0 && a.x+a.w<=width+1 && a.b<=height+1,JSON.stringify(a));
      assert.ok(a.document[0]<=width+1 && a.document[1]<=height+1,JSON.stringify(a));
      await page.locator('.review-controls').evaluate(node=>node.scrollTop=100000);
      const b=await bounds(); assert.equal(b.y,a.y);assert.equal(b.h,a.h);
      await page.locator('.review-controls').evaluate(node=>node.scrollTop=0);
      const footer=await page.locator('.editor-footer').boundingBox();assert.ok(footer.y+footer.height<=height+1);
      checks.push({name:'bounded viewport and stationary preview',...a});
    }
    await page.screenshot({path:resolve(output,'studio-desktop.png')});
    await page.setViewportSize({width:390,height:844});
    await page.locator('#advanced-link').click(); await ready();
    assert.equal((await state()).selected,5);
    assert.equal(await page.evaluate(()=>window.characterStudio.workspace.getProfile(window.characterStudio.review.records[0].id).hair),'bob');
    const advancedBefore=await bounds();
    await page.locator('.controls').evaluate(node=>node.scrollTop=node.scrollHeight);
    const advancedAfter=await bounds();assert.equal(advancedBefore.y,advancedAfter.y);assert.equal(advancedBefore.h,advancedAfter.h);
    await page.locator('.controls details').last().evaluate(node=>node.open=true);
    await page.locator('textarea#note').fill('工房往復の確認');
    const downloaded = page.waitForEvent('download'); await page.locator('#export').click();
    const download=await downloaded; assert.equal(download.suggestedFilename(),'shino-workspace.json');
    const path=resolve(output,'studio-roundtrip.json');await download.saveAs(path);
    await page.locator('#session-file').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('{broken')});
    assert.equal((await state()).selected,5);
    await page.locator('#session-file').setInputFiles(path);
    await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('顔・髪・服も引き継ぎ'));
    await page.screenshot({path:resolve(output,'studio-advanced-mobile.png')});
    await page.locator('.page-head a.back').click(); await ready();
    assert.equal((await state()).selected,5); assert.equal((await state()).records[5].ageMs,55*60000);
    await page.reload({waitUntil:'domcontentloaded'});await ready();
    assert.equal((await state()).records[5].ageMs,55*60000);
    assert.equal(await page.evaluate(()=>window.characterStudio.workspace.getProfile(window.characterStudio.review.records[0].id).hair),'bob');
    checks.push({name:'advanced/main navigation, reload, JSON round-trip and invalid import retention'});
    assert.deepEqual(errors,[]);assert.deepEqual(network,[]);
    writeFileSync(resolve(output,'studio-browser.json'),JSON.stringify({success:true,checks,errors,network},null,2));
    console.log('CHARACTER STUDIO BROWSER VERIFIED',JSON.stringify({checks:checks.length,errors,network}));
  } catch(error) {
    await page.screenshot({path:resolve(output,'studio-failure.png')}).catch(()=>{});
    writeFileSync(resolve(output,'studio-browser.json'),JSON.stringify({success:false,error:String(error),checks,errors,network},null,2));
    throw error;
  } finally {await context.close();}
}
