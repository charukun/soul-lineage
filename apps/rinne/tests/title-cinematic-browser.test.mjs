import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync,spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';

const root=resolve(new URL('../../..',import.meta.url).pathname);
const cinematicChanged=()=>{
  if(process.env.GITHUB_ACTIONS!=='true'||!process.env.HEAD_SHA)return false;
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
  const server=spawn('npm',['run','dev','--workspace','@soul/rinne'],{cwd:root,env:{...process.env,NO_COLOR:'1'},stdio:['ignore','pipe','pipe']});
  let serverLog='';
  server.stdout.on('data',chunk=>{serverLog=(serverLog+chunk.toString()).slice(-12000);});
  server.stderr.on('data',chunk=>{serverLog=(serverLog+chunk.toString()).slice(-12000);});
  let browser=null;
  try{
    await waitForServer('http://127.0.0.1:5173/');
    browser=await chromium.launch({headless:true,executablePath,args:['--no-sandbox','--disable-dev-shm-usage']});
    const context=await browser.newContext({viewport:{width:412,height:915},deviceScaleFactor:1,reducedMotion:'no-preference'});
    const page=await context.newPage();
    await page.goto('http://127.0.0.1:5173/',{waitUntil:'domcontentloaded'});
    const title=page.locator('#title-screen');
    await title.waitFor({state:'visible',timeout:12000});
    await page.waitForTimeout(450);

    const opening=await page.evaluate(()=>({
      phase:document.getElementById('title-screen')?.dataset.intro,
      media:document.getElementById('title-screen')?.dataset.media,
      lockup:Number(getComputedStyle(document.querySelector('.title-lockup')).opacity),
      actions:Number(getComputedStyle(document.querySelector('.title-actions')).opacity),
      introTime:document.getElementById('title-cinematic-intro')?.currentTime||0,
      introReady:document.getElementById('title-cinematic-intro')?.readyState||0,
    }));
    assert.equal(opening.phase,'cinematic');
    assert.equal(opening.media,'intro');
    assert.ok(opening.lockup<0.08,'title text must stay hidden during the opening movie');
    assert.ok(opening.actions<0.08,'title menu must stay hidden during the opening movie');
    assert.ok(opening.introTime>0||opening.introReady>=2,'real intro video must be decoding or playing');
    await page.screenshot({path:resolve(evidenceDir,'01-opening-mobile.png'),fullPage:true});

    await page.waitForFunction(()=>document.getElementById('title-screen')?.dataset.intro==='settling',{timeout:14000});
    const settling=await page.evaluate(()=>({
      lockup:Number(getComputedStyle(document.querySelector('.title-lockup')).opacity),
      actions:Number(getComputedStyle(document.querySelector('.title-actions')).opacity),
      media:document.getElementById('title-screen')?.dataset.media,
      livingTime:document.getElementById('title-living-still')?.currentTime||0,
    }));
    assert.equal(settling.media,'living');
    assert.ok(settling.actions<0.12,'menu must wait while title mark appears');
    await page.screenshot({path:resolve(evidenceDir,'02-settling-mobile.png'),fullPage:true});

    await page.waitForFunction(()=>document.getElementById('title-screen')?.dataset.intro==='idle',{timeout:5000});
    await page.waitForFunction(()=>!document.getElementById('new-life')?.disabled,{timeout:12000});
    const idle=await page.evaluate(()=>({
      lockup:Number(getComputedStyle(document.querySelector('.title-lockup')).opacity),
      actions:Number(getComputedStyle(document.querySelector('.title-actions')).opacity),
      livingPaused:document.getElementById('title-living-still')?.paused,
      livingTime:document.getElementById('title-living-still')?.currentTime||0,
    }));
    assert.ok(idle.lockup>0.9&&idle.actions>0.9,'title and menu must finish visible');
    assert.equal(idle.livingPaused,false);
    await page.screenshot({path:resolve(evidenceDir,'03-idle-mobile.png'),fullPage:true});

    const introEnd=await page.locator('#title-cinematic-intro').evaluate(video=>video.currentTime);
    await page.locator('#new-life').click();
    await page.waitForFunction(()=>document.getElementById('title-screen')?.hidden===true,{timeout:12000});
    await page.waitForFunction(()=>!document.getElementById('back-title')?.hidden,{timeout:12000});
    await page.locator('#back-title').click();
    await title.waitFor({state:'visible',timeout:12000});
    await page.waitForFunction(()=>document.getElementById('title-screen')?.dataset.intro==='idle',{timeout:4000});
    const returned=await page.evaluate(()=>({
      introTime:document.getElementById('title-cinematic-intro')?.currentTime||0,
      media:document.getElementById('title-screen')?.dataset.media,
      livingPaused:document.getElementById('title-living-still')?.paused,
    }));
    assert.equal(returned.media,'living');
    assert.ok(returned.introTime>=introEnd-0.2,'returning to title must not replay the long intro');
    assert.equal(returned.livingPaused,false);
    await page.screenshot({path:resolve(evidenceDir,'04-return-mobile.png'),fullPage:true});
    console.log('RINNE_BROWSER_EVIDENCE',JSON.stringify({opening,settling,idle,returned,evidenceDir}));
    await context.close();
  }catch(error){
    console.error('RINNE browser server log tail:\n'+serverLog);
    throw error;
  }finally{
    await browser?.close().catch(()=>{});
    server.kill('SIGTERM');
  }
});
