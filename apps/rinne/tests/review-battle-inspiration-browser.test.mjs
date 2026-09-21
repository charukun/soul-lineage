import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync,spawn} from 'node:child_process';

const root=process.cwd();
const browserRequested=String(process.env.ASTRA_COMMIT_MESSAGE||'').split(/\r?\n/).some(line=>line.trim()==='Astra-Test: apps/rinne/tests/review-battle-inspiration-browser.test.mjs');
const browserPath=()=>{for(const name of ['google-chrome','google-chrome-stable','chromium','chromium-browser'])try{return execFileSync('which',[name],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();}catch{}throw Error('Chromium is required for the selected browser test');};
const waitForServer=async url=>{for(let i=0;i<450;i++){try{if((await fetch(url)).ok)return;}catch{}await new Promise(r=>setTimeout(r,200));}throw Error('RINNE Vite server did not start');};
const seconds=text=>Number(String(text||'').replace('秒',''))||0;

test('high-probability inspiration completes without freezing battle progression',{skip:!browserRequested,timeout:240000},async()=>{
  const {chromium}=await import('playwright');
  const server=spawn('npm',['run','dev','--workspace','@soul/rinne'],{cwd:root,env:{...process.env,NO_COLOR:'1'},stdio:['ignore','pipe','pipe'],detached:process.platform!=='win32'});
  let log='',browser;
  for(const stream of [server.stdout,server.stderr])stream.on('data',chunk=>{log=(log+chunk).slice(-12000);});
  try{
    await waitForServer('http://127.0.0.1:5173/review-battle');
    browser=await chromium.launch({headless:true,executablePath:browserPath(),args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
    const context=await browser.newContext({viewport:{width:412,height:915},deviceScaleFactor:1,hasTouch:true});
    await context.addInitScript(()=>{const original=Math.random;let forced=600;Math.random=()=>forced-->0?0:original();});
    const page=await context.newPage(),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
    await page.goto('http://127.0.0.1:5173/review-battle',{waitUntil:'domcontentloaded'});
    await page.waitForSelector('#battle-canvas');
    await page.waitForFunction(()=>document.querySelector('#battle-canvas')?.dataset.battleModels==='ready',null,{timeout:90000});
    await page.locator('[data-inspiration-mode="boost"]').click();
    await page.waitForFunction(()=>Number(document.querySelector('#battle-history-count')?.textContent||0)>0,null,{timeout:30000});
    await page.waitForFunction(()=>document.querySelector('.stage')?.dataset.inspirationCinematic==='true',null,{timeout:10000});
    const start=seconds(await page.locator('#battle-time').textContent());
    await page.waitForTimeout(900);
    const during=seconds(await page.locator('#battle-time').textContent());
    const duringAdvance=during-start;
    assert.ok(duringAdvance>=.55,`battle simulation stalled during inspiration: ${start} -> ${during} in 900ms`);
    console.log('RINNE_INSPIRATION_DURING '+JSON.stringify({start,during,duringAdvance}));
    await page.waitForFunction(()=>document.querySelector('.stage')?.dataset.inspirationCinematic!=='true',null,{timeout:10000});
    const afterCinematic=seconds(await page.locator('#battle-time').textContent());
    const resultAfterCinematic=await page.locator('#battle-result').textContent();
    assert.ok(afterCinematic>=during,'battle time moved backwards after inspiration');
    assert.deepEqual(errors,[]);
    console.log('RINNE_INSPIRATION_PLAYTEST '+JSON.stringify({start,during,duringAdvance,afterCinematic,resultAfterCinematic,history:await page.locator('#battle-history-count').textContent()}));
    await context.close();
  }catch(error){console.error(log);throw error;}finally{
    await browser?.close();
    if(process.platform==='win32')server.kill('SIGTERM');else try{process.kill(-server.pid,'SIGTERM');}catch{}
  }
});
