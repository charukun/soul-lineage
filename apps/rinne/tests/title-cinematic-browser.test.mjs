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
    assert.ok(opening.phase==='pending'||opening.phase==='cinematic');
    assert.ok(opening.media==='fallback'||opening.media==='realtime');
    assert.ok(opening.lockup<0.08,'title text must stay hidden during the opening movie');
    assert.ok(opening.actions<0.08,'primary action must not cover the first cinematic beat');
    assert.ok(opening.phase==='pending'||opening.introTime>=0,'realtime world may still be preparing during the opening beat');
    await page.screenshot({path:resolve(evidenceDir,'01-opening-mobile.png'),fullPage:true});

    await page.waitForFunction(()=>document.getElementById('title-screen')?.dataset.media==='realtime'&&document.getElementById('title-screen')?.dataset.skip==='ready',{timeout:12000});
    const realtime=await page.evaluate(()=>({phase:document.getElementById('title-screen')?.dataset.intro,actions:Number(getComputedStyle(document.querySelector('.title-actions')).opacity),lockup:Number(getComputedStyle(document.querySelector('.title-lockup')).opacity),cameraMode:document.getElementById('game')?.dataset.cameraMode,renderQuality:document.getElementById('game')?.dataset.renderQuality}));
    assert.equal(realtime.phase,'cinematic');assert.ok(realtime.actions<.08&&realtime.lockup<.12,'realtime cinematic must stay free of title UI');assert.equal(realtime.cameraMode,'title-cinematic');assert.equal(realtime.renderQuality,'title-poc-low');
    await page.screenshot({path:resolve(evidenceDir,'02-realtime-poc-mobile.png'),fullPage:true});
    await page.mouse.click(206,457);
    await page.waitForFunction(()=>document.getElementById('title-screen')?.dataset.intro!=='cinematic'&&document.getElementById('game')?.dataset.cameraMode==='title-living-still',{timeout:3000});
    const skipped=await page.evaluate(()=>({phase:document.getElementById('title-screen')?.dataset.intro,cameraMode:document.getElementById('game')?.dataset.cameraMode,titleHidden:document.getElementById('title-screen')?.hidden}));
    assert.equal(skipped.titleHidden,false);assert.equal(skipped.cameraMode,'title-living-still');
    await page.screenshot({path:resolve(evidenceDir,'03-realtime-skip-mobile.png'),fullPage:true});
    console.log('RINNE_BROWSER_EVIDENCE',JSON.stringify({opening,realtime,skipped,evidenceDir}));
    await context.close();
  }catch(error){
    console.error('RINNE browser server log tail:\n'+serverLog);
    throw error;
  }finally{
    await browser?.close().catch(()=>{});
    if(process.platform==='win32')server.kill('SIGTERM');else{try{process.kill(-server.pid,'SIGTERM');}catch{}}
  }
});
