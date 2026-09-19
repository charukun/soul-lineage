import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync,spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';

const root=process.cwd();
const cinematicChanged=()=>{
  if(process.env.GITHUB_ACTIONS!=='true')return false;
  try{
    const changed=execFileSync('git',['diff','--name-only','origin/develop','HEAD'],{cwd:root,encoding:'utf8'});
    return /apps\/rinne\/(index\.html|src\/main\.js|src\/title-rich\.css|src\/title-cinematic-media\.js)/.test(changed);
  }catch{return false;}
};
const browserPath=()=>{
  for(const name of ['google-chrome','google-chrome-stable','chromium','chromium-browser']){
    try{return execFileSync('which',[name],{encoding:'utf8'}).trim();}catch{}
  }
  return '';
};
const waitForServer=async(url,timeoutMs=18000)=>{
  const end=Date.now()+timeoutMs;
  let lastError=null;
  while(Date.now()<end){
    try{const response=await fetch(url);if(response.ok)return;}catch(error){lastError=error;}
    await new Promise(resolve=>setTimeout(resolve,250));
  }
  throw lastError||new Error('Vite server did not become ready');
};

test('RINNE cinematic title browser flow', {skip:!cinematicChanged(),timeout:55000}, async()=>{
  const executablePath=browserPath();
  assert.ok(executablePath,'GitHub hosted runner must expose a Chromium-family browser');
  const {chromium}=await import('playwright');
  const evidenceDir=resolve(root,'artifacts/browser/rinne-title-cinematic');
  await mkdir(evidenceDir,{recursive:true});
  const viteEntry=resolve(root,'node_modules/vite/bin/vite.js');
  const server=spawn(process.execPath,[viteEntry,'--host','127.0.0.1','--port','5173','--strictPort'],{cwd:resolve(root,'apps/rinne'),env:{...process.env,NO_COLOR:'1'},stdio:['ignore','pipe','pipe'],detached:process.platform!=='win32'});
  let serverLog='';
  server.stdout.on('data',chunk=>{serverLog=(serverLog+chunk.toString()).slice(-12000);});
  server.stderr.on('data',chunk=>{serverLog=(serverLog+chunk.toString()).slice(-12000);});
  let browser=null;
  try{
    await waitForServer('http://127.0.0.1:5173/');
    browser=await chromium.launch({headless:true,executablePath,args:['--no-sandbox','--disable-dev-shm-usage']});
    const context=await browser.newContext({viewport:{width:412,height:915},deviceScaleFactor:1,reducedMotion:'no-preference'});
    const page=await context.newPage();
    await page.route('**/src/rebuild/runtime.js*',route=>route.fulfill({
      contentType:'application/javascript',
      body:"export async function prepareRuntime(){return await new Promise(()=>{});} export async function startRuntime(){throw new Error('title cinematic test must not enter the real runtime');}",
    }));
    const navigationStarted=Date.now();
    await page.goto('http://127.0.0.1:5173/',{waitUntil:'domcontentloaded'});
    const title=page.locator('#title-screen');
    await title.waitFor({state:'visible',timeout:12000});
    await page.waitForTimeout(450);

    const opening=await page.evaluate(()=>({
      phase:document.getElementById('title-screen')?.dataset.intro,
      media:document.getElementById('title-screen')?.dataset.media,
      lockup:Number(getComputedStyle(document.querySelector('.title-lockup')).opacity),
      actions:Number(getComputedStyle(document.querySelector('.title-actions')).opacity),
      introTime:document.getElementById('title-cinematic-video')?.currentTime||0,
      introReady:document.getElementById('title-cinematic-video')?.readyState||0,
    }));
    assert.equal(opening.phase,'cinematic');
    assert.equal(opening.media,'video');
    assert.ok(opening.lockup<0.08,'title text must stay hidden during the opening movie');
    assert.ok(opening.actions<0.08,'primary action must not cover the first cinematic beat');
    assert.ok(opening.introTime>0||opening.introReady>=2,'real intro video must be decoding or playing');
    await page.screenshot({path:resolve(evidenceDir,'01-opening-mobile.png'),fullPage:true});

    await page.waitForFunction(()=>document.getElementById('title-screen')?.dataset.primaryAction==='ready'&&!document.getElementById('new-life')?.disabled,{timeout:6000});
    await page.waitForFunction(()=>Number(getComputedStyle(document.querySelector('.title-actions')).opacity)>.9,{timeout:5000});
    const early=await page.evaluate(()=>({
      phase:document.getElementById('title-screen')?.dataset.intro,
      actions:Number(getComputedStyle(document.querySelector('.title-actions')).opacity),
      lockup:Number(getComputedStyle(document.querySelector('.title-lockup')).opacity),
      videoTime:document.getElementById('title-cinematic-video')?.currentTime||0,
      continueDisplay:getComputedStyle(document.getElementById('continue-life')).display,
      settingsDisplay:getComputedStyle(document.getElementById('open-settings')).display,
    }));
    assert.equal(early.phase,'cinematic');
    assert.ok(early.actions>.9,'start must become visible while the cinematic is still playing');
    assert.ok(early.lockup<.12,'the title mark may keep its authored entrance while start is already available');
    assert.ok(early.videoTime<8.3,'early start must precede the authored cinematic landing');
    assert.equal(early.continueDisplay,'none');assert.equal(early.settingsDisplay,'none');
    await page.screenshot({path:resolve(evidenceDir,'02-early-start-mobile.png'),fullPage:true});

    await page.locator('#new-life').click();
    await page.waitForFunction(()=>document.getElementById('title-screen')?.hidden===true,{timeout:2500});
    const accepted=await page.evaluate(()=>({
      screen:document.getElementById('app')?.dataset.screen,
      titleHidden:document.getElementById('title-screen')?.hidden,
      loadingHidden:document.getElementById('loading-card')?.hidden,
      loadingTitle:document.getElementById('loading-title')?.textContent,
      runtime:document.getElementById('game-screen')?.dataset.runtime||'',
    }));
    assert.equal(accepted.titleHidden,true);
    assert.ok(accepted.runtime==='active'||accepted.loadingHidden===false,'early start must either enter gameplay or visibly queue the launch');
    if(accepted.runtime!=='active')assert.equal(accepted.loadingTitle,'旅立ちを準備しています');
    await page.screenshot({path:resolve(evidenceDir,'03-accepted-mobile.png'),fullPage:true});
    console.log('RINNE_BROWSER_EVIDENCE',JSON.stringify({opening,early,accepted,evidenceDir}));
    await context.close();
  }catch(error){
    console.error('RINNE browser server log tail:\n'+serverLog);
    throw error;
  }finally{
    await browser?.close().catch(()=>{});
    if(process.platform==='win32')server.kill('SIGTERM');else{try{process.kill(-server.pid,'SIGTERM');}catch{}}
  }
});
