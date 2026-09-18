import {chromium, expect} from '@playwright/test';
import {nativeTap} from '@soul/platform-web/testing/native-input';
import {mkdirSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';

const root=resolve(new URL('../../..',import.meta.url).pathname);
const out=resolve(root,process.env.DEMON_GUIDE_EVIDENCE_DIR||'test-results/demon-angled-guide');
mkdirSync(out,{recursive:true});
const viteBin=resolve(root,'node_modules/vite/bin/vite.js');
const server=spawn(process.execPath,[viteBin,'--host','127.0.0.1','--port','5175','--strictPort'],{
  cwd:resolve(root,'apps/demon'),
  stdio:['ignore','pipe','pipe'],
  env:{...process.env,APP_ENV:'dev'}
});
const serverLog=[];
server.stdout.on('data',c=>serverLog.push(c.toString()));
server.stderr.on('data',c=>serverLog.push(c.toString()));

async function waitForServer(){
  for(let i=0;i<100;i++){
    if(server.exitCode!==null)throw new Error('Demon dev server exited before ready');
    try{
      const response=await fetch('http://127.0.0.1:5175/',{signal:AbortSignal.timeout(1000)});
      if(response.ok)return;
    }catch{}
    await delay(200);
  }
  throw new Error('Demon dev server did not become ready');
}
async function stopServer(){
  if(server.exitCode!==null)return;
  server.kill('SIGTERM');
  for(let i=0;i<20&&server.exitCode===null;i++)await delay(50);
  if(server.exitCode===null)server.kill('SIGKILL');
}
async function guideCopy(page){
  return page.locator('#angled-guide').evaluate(node=>({
    side:node.dataset.side,
    variant:node.dataset.variant,
    kicker:node.querySelector('[data-guide-kicker]')?.textContent?.trim()||'',
    title:node.querySelector('[data-guide-title]')?.textContent?.trim()||'',
    body:node.querySelector('[data-guide-body]')?.textContent?.trim()||''
  }));
}
async function assertGuideInsideViewport(page){
  const viewport=await page.evaluate(()=>({width:innerWidth,height:innerHeight}));
  const box=await page.locator('#angled-guide').boundingBox();
  expect(box).not.toBeNull();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x+box.width).toBeLessThanOrEqual(viewport.width+1);
  expect(box.y+box.height).toBeLessThanOrEqual(viewport.height+1);
}
async function stepUntil(page,predicate,maxSteps=1800,stride=6){
  return page.evaluate(({predicate,maxSteps,stride})=>{
    const match=new Function('s',`return (${predicate})(s)`);
    for(let i=0;i<maxSteps;i+=stride){
      window.__NIGHT_REVIEW__.step(Math.min(stride,maxSteps-i));
      const state=window.__NIGHT_HUNT__.snapshot();
      if(match(state))return state;
      if(state.finished)return {finished:true,state};
    }
    return null;
  },{predicate:predicate.toString(),maxSteps,stride});
}

let browser,context,page;
const evidence={head:process.env.GITHUB_SHA||null,viewport:{portrait:[390,844],landscape:[844,390]},checks:[]};
try{
  await waitForServer();
  browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-webgl','--enable-unsafe-swiftshader']});
  context=await browser.newContext({
    viewport:{width:390,height:844},
    recordVideo:{dir:resolve(out,'video'),size:{width:390,height:844}}
  });
  await context.tracing.start({screenshots:true,snapshots:true,sources:true});
  page=await context.newPage();
  const errors=[],failedRequests=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  page.on('requestfailed',r=>failedRequests.push({url:r.url(),error:r.failure()?.errorText||'failed'}));

  const response=await page.goto('http://127.0.0.1:5175/',{waitUntil:'domcontentloaded',timeout:30000});
  expect(response?.ok()).toBe(true);
  await page.locator('#game').waitFor({state:'visible',timeout:45000});
  await page.waitForFunction(()=>document.querySelector('#game')?.dataset.renderer==='ready',null,{timeout:45000});
  await page.waitForFunction(()=>window.__NIGHT_REVIEW__?.ready?.()===true,null,{timeout:45000});

  await nativeTap(page,expect,page.locator('#begin'));
  await expect(page.locator('#hud')).toBeVisible();
  await expect(page.locator('#angled-guide')).toBeVisible();
  let copy=await guideCopy(page);
  expect(copy.kicker).toBe('最初の狩り');
  expect(copy.title).toContain('指を滑らせる');
  await assertGuideInsideViewport(page);
  evidence.checks.push({name:'first-hunt-guide',copy});
  await page.screenshot({path:resolve(out,'angled-guide-first-portrait.png')});
  await nativeTap(page,expect,page.locator('[data-guide-close]'));

  const help=page.locator('#swipe-hint');
  await expect(help).toBeVisible();
  const helpBox=await help.boundingBox();
  expect(helpBox.width).toBeGreaterThanOrEqual(44);
  expect(helpBox.height).toBeGreaterThanOrEqual(44);
  await nativeTap(page,expect,help);
  await expect(page.locator('#angled-guide')).toBeVisible();
  await expect(page.locator('#sheet')).toBeHidden();
  copy=await guideCopy(page);
  expect(copy.kicker).toBe('動きかた');
  expect(copy.body).toContain('自動戦闘');
  await assertGuideInsideViewport(page);
  evidence.checks.push({name:'movement-help-portrait',copy});
  await page.screenshot({path:resolve(out,'angled-guide-help-portrait.png')});
  await nativeTap(page,expect,page.locator('[data-guide-close]'));

  await page.setViewportSize({width:844,height:390});
  await nativeTap(page,expect,help);
  await expect(page.locator('#angled-guide')).toBeVisible();
  await assertGuideInsideViewport(page);
  copy=await guideCopy(page);
  evidence.checks.push({name:'movement-help-landscape',copy});
  await page.screenshot({path:resolve(out,'angled-guide-help-landscape.png')});
  await nativeTap(page,expect,page.locator('[data-guide-close]'));
  await page.setViewportSize({width:390,height:844});

  await nativeTap(page,expect,page.locator('#pause'));
  await expect(page.locator('#sheet')).toBeVisible();
  await expect(page.locator('#angled-guide')).toBeHidden();
  evidence.checks.push({name:'sheet-separation',kind:await page.locator('#sheet').getAttribute('data-kind')});
  await page.screenshot({path:resolve(out,'angled-guide-sheet-separation.png')});
  await nativeTap(page,expect,page.locator('#sheet-close'));
  await expect(page.locator('#sheet')).toBeHidden();

  const before=await page.evaluate(()=>window.__NIGHT_HUNT__.snapshot());
  const preyIndex=before.npcs.findIndex(n=>!n.dead&&!n.eaten&&n.role==='traveller');
  const targetIndex=preyIndex>=0?preyIndex:before.npcs.findIndex(n=>!n.dead&&!n.eaten);
  expect(targetIndex).toBeGreaterThanOrEqual(0);
  await page.evaluate(i=>window.__NIGHT_REVIEW__.nearHuman(i),targetIndex);

  const combat=await stepUntil(page,s=>!!s.combat,900,3);
  expect(combat).not.toBeNull();
  expect(combat.finished).not.toBe(true);
  await page.evaluate(()=>window.__NIGHT_REVIEW__.screenshot());
  await expect(page.locator('#battle')).toHaveCSS('opacity','1');
  await expect(page.locator('#angled-guide')).toBeVisible();
  copy=await guideCopy(page);
  expect(copy.kicker).toBe('戦いかた');
  evidence.checks.push({name:'combat-guide',copy});
  await page.screenshot({path:resolve(out,'angled-guide-combat.png')});
  await nativeTap(page,expect,page.locator('[data-guide-close]'));

  let feeding=await stepUntil(page,s=>!!s.devouring,1800,6);
  if(!feeding||feeding.finished===true){
    const fallen=await page.evaluate(()=>window.__NIGHT_HUNT__.snapshot());
    const target=fallen.npcs.find(n=>n.dead&&!n.eaten);
    if(target){
      await page.evaluate(({x,z})=>window.__NIGHT_REVIEW__.setPosition(x,z+0.4),target);
      feeding=await stepUntil(page,s=>!!s.devouring,600,4);
    }
  }
  expect(feeding).not.toBeNull();
  expect(feeding.finished).not.toBe(true);
  await page.evaluate(()=>window.__NIGHT_REVIEW__.screenshot());
  await expect(page.locator('#angled-guide')).toBeVisible();
  copy=await guideCopy(page);
  expect(copy.kicker).toBe('捕食');
  evidence.checks.push({name:'devour-guide',copy});
  await page.screenshot({path:resolve(out,'angled-guide-devour.png')});
  await nativeTap(page,expect,page.locator('[data-guide-close]'));

  const consumed=await stepUntil(page,s=>s.eaten>0,1200,6);
  expect(consumed).not.toBeNull();
  expect(consumed.finished).not.toBe(true);
  await page.evaluate(()=>window.__NIGHT_REVIEW__.screenshot());
  await expect(page.locator('#return-hint')).toBeVisible();
  await expect(page.locator('#angled-guide')).toBeVisible();
  copy=await guideCopy(page);
  expect(copy.kicker).toBe('帰りかた');
  expect(copy.body).toContain('帰還口');
  evidence.checks.push({name:'return-ready-guide',copy,eaten:consumed.eaten});
  await page.screenshot({path:resolve(out,'angled-guide-return.png')});

  expect(errors).toEqual([]);
  expect(failedRequests).toEqual([]);
  evidence.errors=errors;
  evidence.failedRequests=failedRequests;
  evidence.success=true;
  writeFileSync(resolve(out,'angled-guide-playtest.json'),JSON.stringify(evidence,null,2));
}catch(error){
  evidence.success=false;
  evidence.error=error instanceof Error?error.stack||error.message:String(error);
  if(page)await page.screenshot({path:resolve(out,'angled-guide-failure.png'),fullPage:true}).catch(()=>{});
  writeFileSync(resolve(out,'angled-guide-playtest.json'),JSON.stringify(evidence,null,2));
  throw error;
}finally{
  if(context){
    await context.tracing.stop({path:resolve(out,'angled-guide-trace.zip')}).catch(()=>{});
    await context.close().catch(()=>{});
  }
  if(browser)await browser.close().catch(()=>{});
  writeFileSync(resolve(out,'dev-server.log'),serverLog.join(''));
  await stopServer();
}
