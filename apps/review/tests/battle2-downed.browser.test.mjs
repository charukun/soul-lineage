import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import path from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {chromium,expect} from '@playwright/test';

const root=path.resolve(new URL('../../..',import.meta.url).pathname);

test('downed enemy is visibly lying before, during and after finisher contact', {timeout:330000}, async()=>{
 const server=spawn(process.execPath,[path.join(root,'node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port','5176','--strictPort'],{cwd:path.join(root,'apps/review'),stdio:'pipe'});
 let browser;
 try{
  let ready=false;for(let i=0;i<80;i++){try{if((await fetch('http://127.0.0.1:5176/battle2?evidence=1&exchangeFixture=downed')).ok){ready=true;break;}}catch{}await delay(250);}assert.ok(ready,'Review server started');
  browser=await chromium.launch(existsSync('/usr/bin/google-chrome')?{executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--use-angle=swiftshader']}: {});
  const page=await browser.newPage({viewport:{width:1100,height:760}});
  await page.goto('http://127.0.0.1:5176/battle2?evidence=1&exchangeFixture=downed',{waitUntil:'domcontentloaded'});
  await expect(page.locator('#battle2-start')).toBeEnabled({timeout:90000});await page.locator('#battle2-start').click();
  await page.evaluate(()=>window.__BATTLE2__.advance(1.9));
  const settled=await page.evaluate(()=>({canonical:window.__BATTLE2__.actors.find(a=>a.side==='enemy'),rendered:window.__BATTLE2__.renderedActors.find(a=>a.kind==='enemy')}));
  assert.equal(settled.canonical?.downed,true);assert.equal(settled.canonical?.downedState?.phase,'settled');assert.equal(settled.rendered?.animation,'Lie_Down');assert.equal(settled.rendered?.downed,true);
  assert.ok(settled.rendered.pose.headHipHorizontal>settled.rendered.pose.headHipVertical*3,'rendered skeleton must actually be lying');
  const contact=await page.evaluate(()=>{for(let i=0;i<30;i++){window.__BATTLE2__.advance(.1);const canonical=window.__BATTLE2__.actors.find(a=>a.side==='enemy');if(canonical?.dead)return{canonical,rendered:window.__BATTLE2__.renderedActors.find(a=>a.kind==='enemy')};}return null;});
  assert.ok(contact,'finisher reaches contact');assert.equal(contact.canonical.dead,true);assert.equal(contact.canonical.downed,true);assert.equal(contact.rendered?.animation,'Lie_Down');assert.ok(contact.rendered.pose.headHipHorizontal>contact.rendered.pose.headHipVertical*3);
  await page.evaluate(()=>window.__BATTLE2__.advance(3.2));
  const corpse=await page.evaluate(()=>({canonical:window.__BATTLE2__.actors.find(a=>a.side==='enemy'),rendered:window.__BATTLE2__.renderedActors.find(a=>a.kind==='enemy')}));
  assert.equal(corpse.canonical?.dead,true);assert.equal(corpse.canonical?.downed,true);assert.ok(corpse.rendered,'canonical corpse must not be removed by the legacy 3-second renderer timer');assert.equal(corpse.rendered.animation,'Lie_Down');
  assert.ok(corpse.rendered.pose.headHipHorizontal>corpse.rendered.pose.headHipVertical*3);
  console.log('DOWNED_BROWSER_EVIDENCE',JSON.stringify({settled:settled.rendered,contact:contact.rendered,corpse:corpse.rendered}));
 }finally{await browser?.close();server.kill('SIGTERM');}
});
