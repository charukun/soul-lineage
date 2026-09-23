import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import path from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {chromium,expect} from '@playwright/test';

const root=path.resolve(new URL('../../..',import.meta.url).pathname);
test('phone loadout keeps slots, candidates and apply action usable together', {timeout:150000}, async()=>{
  const server=spawn(process.execPath,[path.join(root,'node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port','5176','--strictPort'],{cwd:path.join(root,'apps/review'),stdio:'pipe'});
  let browser;
  try {
    let ready=false;
    for(let i=0;i<80;i++){try{if((await fetch('http://127.0.0.1:5176/battle2')).ok){ready=true;break;}}catch{}await delay(250);}
    assert(ready,'Review server started');
    browser=await chromium.launch(existsSync('/usr/bin/google-chrome')?{executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--use-angle=swiftshader']}: {});
    const page=await browser.newPage({viewport:{width:396,height:572},deviceScaleFactor:1,hasTouch:true,isMobile:true});
    await page.goto('http://127.0.0.1:5176/battle2',{waitUntil:'domcontentloaded'});
    const nav=page.locator('.battle2-loadout-nav'),panel=page.locator('.rinne-core-menu'),library=panel.locator('.loadout-library'),apply=panel.locator('[data-detail-apply]');
    await expect(nav).toBeVisible({timeout:30000});
    const inside=async(locator,container=panel)=>{
      const a=await locator.boundingBox(),b=await container.boundingBox();
      assert(a&&b&&a.x>=b.x-1&&a.y>=b.y-1&&a.x+a.width<=b.x+b.width+1&&a.y+a.height<=b.y+b.height+1,'Control stays within its visible panel');
      const hit=await locator.evaluate(el=>{const r=el.getBoundingClientRect();const target=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return target===el||el.contains(target);});
      assert(hit,'Control can receive real pointer input');
    };
    for(const viewport of [{width:396,height:572},{width:360,height:640}]){
      await page.setViewportSize(viewport);
      await nav.locator('[data-heart]').click();
      await expect(panel).toBeVisible();
      await inside(panel.locator('.loadout-slot').nth(1));
      await inside(apply);
      const candidates=library.locator('.loadout-grid-item');
      assert(await candidates.count()>5,'Heart library has choices to browse');
      const geometry=await library.evaluate(el=>{const r=el.getBoundingClientRect();return {height:r.height,width:el.clientWidth,scrollWidth:el.scrollWidth,cols:getComputedStyle(el.querySelector('.loadout-grid')).gridTemplateColumns.split(' ').length};});
      assert(geometry.height>=78,'At least one readable choice row plus its heading remains available');
      assert.equal(geometry.cols,5);
      assert(geometry.scrollWidth<=geometry.width+1,'No sideways clipping');
      await panel.locator('.loadout-slot').nth(1).click();
      const last=library.locator('.loadout-grid-item[data-active="false"]').last(),label=await last.locator('strong').innerText();
      await last.click();
      await expect(panel.locator('[data-detail-title]')).toHaveText(label);
      await inside(apply);
      const scrolled=await library.evaluate(el=>el.scrollTop);assert(scrolled>0,'Candidate scroll position survives selecting a lower row');
      const dims=await candidates.last().boundingBox();assert(dims.width>=44&&dims.height>=44,'Choices retain touch-size hit targets');
      await apply.click();
      await expect(panel.locator('.loadout-slot').nth(1).locator('strong')).toHaveText(label);
      await expect(apply).toBeDisabled();
      await panel.locator('details.heart-portrait>summary').click();
      await expect(panel.locator('details.heart-portrait')).toHaveAttribute('open','');
      await inside(apply);
      await panel.locator('details.heart-portrait>summary').click();
      if(viewport.width===396)console.log('MENU_EVIDENCE_JPEG '+(await page.screenshot({type:'jpeg',quality:65})).toString('base64'));
      await nav.locator('[data-body]').click();
      const stance=library.locator('.loadout-grid-item').filter({hasText:'攻勢'});await stance.click();
      await inside(apply);if(await apply.isEnabled())await apply.click();
      await expect(panel.locator('.loadout-slot').first().locator('strong')).toHaveText('攻勢');
      await nav.locator('[data-items]').click();
      await library.locator('.loadout-grid-item').filter({hasText:'大剣'}).click();
      await inside(apply);await apply.click();
      await expect(panel.locator('.loadout-slot').first().locator('strong')).toHaveText('大剣');
      await nav.locator('[data-techniques]').click();
      await inside(apply);
      await panel.getByRole('button',{name:'閃いた連技',exact:true}).click();
      await expect(library).toContainText('戦闘で閃いた連技がここに並びます');
      await panel.locator('[data-close]').click();await expect(panel).toBeHidden();
      await page.reload();await expect(nav).toBeVisible();
    }
    console.log('LOADOUT_PLAYTEST_SUCCESS: 396x572 and 360x640, heart replacement/scroll/apply, body/equipment/tabs/close');
  }finally{await browser?.close();server.kill('SIGTERM');}
});
