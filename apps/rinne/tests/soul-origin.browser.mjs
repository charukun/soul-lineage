import assert from 'node:assert/strict';
import {join} from 'node:path';

const answers=['wa','discern','katana'];
export async function completeSoulOrigin(page,{choices=answers,confirm=true}={}){
  const dialog=page.locator('#soul-origin');await dialog.waitFor({state:'visible'});
  let step=Number(await dialog.getAttribute('data-step'));
  while(step<3){await dialog.locator(`[data-origin-choice="${choices[step]}"]`).click();await dialog.locator('[data-origin-next]').click();step++;assert.equal(Number(await dialog.getAttribute('data-step')),step);}
  if(!confirm)return;
  const replace=dialog.locator('[data-origin-replace]');if(await replace.count())await replace.check();
  await dialog.locator('[data-origin-confirm]').click();await dialog.waitFor({state:'hidden'});
}

/** Supplement the existing title-to-rebirth path; do not bypass a live game gate. */
export async function verifySoulOriginPrelude(page,output,key,errors){
  const dialog=page.locator('#soul-origin'),read=()=>page.evaluate(key=>localStorage.getItem(key),key);
  await dialog.waitFor({state:'visible'});assert.equal(await dialog.getAttribute('data-step'),'0');assert.equal(await read(),null);
  assert.equal(await dialog.getAttribute('data-motion'),'off','reduced-motion preference must stop the water animation');
  assert.equal(await dialog.locator('[data-origin-next]').isDisabled(),true,'a memory must be chosen deliberately');
  await page.screenshot({path:join(output,'origin-01-water-mobile.png')});
  await dialog.locator('[data-origin-choice="wa"]').click();await dialog.locator('[data-origin-next]').click();
  assert.equal(await read(),null,'answering must not create a life');
  await page.reload({waitUntil:'domcontentloaded'});await page.locator('#new-life').click();
  await dialog.waitFor({state:'visible'});assert.equal(await dialog.getAttribute('data-step'),'1','interrupted questions must resume');
  await dialog.locator('[data-origin-choice="discern"]').focus();await page.keyboard.press('Enter');
  await dialog.locator('[data-origin-next]').focus();await page.keyboard.press('Enter');assert.equal(await dialog.getAttribute('data-step'),'2');
  await dialog.locator('[data-origin-choice="katana"]').click();await dialog.locator('[data-origin-next]').click();
  assert.match(await dialog.locator('.origin-family').textContent(),/水鏡の一族/);assert.match(await dialog.locator('.origin-family').textContent(),/刀の家伝/);
  await dialog.locator('[data-origin-back]').click();assert.equal(await dialog.locator('[data-origin-choice="katana"]').getAttribute('aria-pressed'),'true');await dialog.locator('[data-origin-next]').click();
  await page.screenshot({path:join(output,'origin-02-family-mobile.png')});
  await page.setViewportSize({width:1200,height:850});
  assert.equal(await dialog.evaluate(node=>node.scrollWidth<=node.clientWidth),true);await page.screenshot({path:join(output,'origin-03-family-desktop.png')});await page.setViewportSize({width:390,height:844});
  await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});assert.equal(await read(),null,'cancel must not save a new family');
  await page.locator('#new-life').click();assert.equal(await dialog.getAttribute('data-step'),'3');

  // One deliberately injected storage error must be surfaced, not swallowed. Only
  // that asserted synthetic console event is removed from the outer error ledger.
  const marker='ORIGIN_TEST_STORAGE_FULL';
  await page.evaluate(({key,marker})=>{const original=Storage.prototype.setItem;window.__restoreOriginStorage=()=>{Storage.prototype.setItem=original;delete window.__restoreOriginStorage;};Storage.prototype.setItem=function(k,v){if(k===key)throw Error(marker);return original.call(this,k,v);};},{key,marker});
  try{
    await dialog.locator('[data-origin-confirm]').click();await page.waitForFunction(marker=>document.querySelector('.origin-status')?.textContent.includes(marker),marker);
    assert.equal(await read(),null);assert.equal(await dialog.isVisible(),true);assert.equal(await page.locator('#game').getAttribute('data-runtime'),'prepared');
    assert.equal(errors.filter(message=>message.includes(marker)).length,1,'the expected write failure must really occur');
    errors.splice(errors.findIndex(message=>message.includes(marker)),1);
    await page.screenshot({path:join(output,'origin-04-storage-retry.png')});
  }finally{await page.evaluate(()=>window.__restoreOriginStorage?.());}
  await dialog.locator('[data-origin-confirm]').click();await dialog.waitFor({state:'hidden'});
  const saved=JSON.parse(await read());assert.deepEqual(saved.clanOrigin,{version:1,culture:'wa',ethos:'discern',art:'katana'});assert.equal(saved.generation,1);assert.ok(saved.ageSeconds<60);
  assert.equal(await page.evaluate(key=>localStorage.getItem(key.replace(/life-v2$/,'origin-draft-v1')),key),null);
}

export async function verifySoulOriginContinue(page,key){
  const dialog=page.locator('#soul-origin');
  await page.locator('#back-title').click();await page.locator('#title-screen').waitFor({state:'visible'});
  const before=await page.evaluate(key=>localStorage.getItem(key),key);assert.ok(before);
  await page.locator('#new-life').click();await completeSoulOrigin(page,{choices:['grove','seek','staff'],confirm:false});
  assert.equal(await dialog.locator('[data-origin-confirm]').isDisabled(),true,'replacement requires explicit acknowledgement');
  assert.equal(await dialog.locator('[data-origin-replace]').isChecked(),false);
  await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});
  assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),before,'abandoning another family leaves the previous save byte-for-byte intact');
  assert.match(await page.locator('.title-clan-caption').textContent(),/水鏡の一族/);
  await page.locator('#continue-life').click();await page.waitForFunction(()=>document.getElementById('game')?.dataset.runtime==='active');
  assert.equal(await dialog.isVisible(),false,'continue must never enter questions');
  const after=JSON.parse(await page.evaluate(key=>localStorage.getItem(key),key)),previous=JSON.parse(before);
  assert.equal(after.id,previous.id);assert.equal(after.generation,previous.generation);assert.deepEqual(after.clanOrigin,previous.clanOrigin);assert.ok(after.ageSeconds>=previous.ageSeconds);
}
