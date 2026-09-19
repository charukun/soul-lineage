import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
const base=process.argv[2],isPublic=process.argv.includes('--public');
if(!base)throw Error('URL is required');
const folder=isPublic?'evidence/public':'public/qa';fs.mkdirSync(folder,{recursive:true});
const report={url:base,sourceSha:process.env.GITHUB_SHA,public:isPublic,startedAt:new Date().toISOString(),environment:'GitHub Actions Chromium with SwiftShader; mobile viewport emulation, not a physical phone',checks:[],screens:[],errors:[]};
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
let current;
try{
 for(const config of [{name:'desktop',width:1280,height:800,mobile:false},{name:'mobile',width:412,height:915,mobile:true}]){
  const context=await browser.newContext({viewport:{width:config.width,height:config.height},deviceScaleFactor:1,isMobile:config.mobile,hasTouch:config.mobile});
  const page=await context.newPage();current=page;page.setDefaultTimeout(120000);
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
  const response=await page.goto(base,{waitUntil:'domcontentloaded',timeout:120000});assert.equal(response.status(),200);
  await page.waitForFunction(()=>window.__NOCTURNE__?.metrics.ready&&document.getElementById('loader').classList.contains('hidden'),{},{timeout:120000});
  await page.waitForTimeout(1000);
  const initial=await page.evaluate(()=>window.__NOCTURNE__.metrics);
  assert.equal(initial.webgl2,true);assert.equal(initial.unattributed,0);assert.equal(initial.generatedModels,0);assert.ok(initial.skinned>0);assert.equal(initial.models.length,28);
  await page.screenshot({path:`${folder}/${config.name}-title.png`});report.screens.push(`${config.name}-title.png`);
  const manifest=await page.request.get(new URL('assets-manifest.json',base+'/').href);assert.equal(manifest.status(),200);
  const build=await(await page.request.get(new URL('build.json',base+'/').href)).json();assert.equal(build.sourceSha,process.env.GITHUB_SHA);
  await page.click('#start');
  await page.waitForFunction(()=>window.__NOCTURNE__.metrics.kills>0&&window.__NOCTURNE__.metrics.damage>0,{},{timeout:120000});
  const realtime=await page.evaluate(()=>window.__NOCTURNE__.metrics);assert.ok(realtime.time>0);assert.ok(realtime.triangles>100);
  await page.screenshot({path:`${folder}/${config.name}-battle.png`});report.screens.push(`${config.name}-battle.png`);
  await page.click('#pause');const stopped=await page.evaluate(()=>window.__NOCTURNE__.metrics.time);await page.waitForTimeout(700);
  assert.equal(await page.evaluate(()=>window.__NOCTURNE__.game.phase),'paused');assert.equal(await page.evaluate(()=>window.__NOCTURNE__.metrics.time),stopped);
  await page.click('#resume');await page.waitForFunction(t=>window.__NOCTURNE__.metrics.time>t,stopped);
  await page.click('[data-stance="guard"]');assert.equal(await page.evaluate(()=>window.__NOCTURNE__.game.stance),'guard');
  await page.click('#speed');assert.equal(await page.evaluate(()=>window.__NOCTURNE__.game.speed),2);await page.click('#speed');
  await page.click('#sound');assert.match(await page.locator('#sound').innerText(),/ON/);await page.click('#sound');
  report.checks.push({viewport:config.name,http:200,webgl2:true,allMeshesAttributed:true,realtimeCombat:realtime,pauseResume:true,stance:true,speed:true,audioControl:true});
  if(config.name==='desktop'&&!isPublic){
   await page.evaluate(()=>{window.__NOCTURNE__.start();window.__NOCTURNE__.game.stance='guard';});
   for(let i=0;i<16;i++){
    await page.evaluate(()=>window.__NOCTURNE__.advance(30));
    const state=await page.evaluate(()=>window.__NOCTURNE__.metrics);
    if(['victory','defeat'].includes(state.phase))break;
   }
   const final=await page.evaluate(()=>({metrics:window.__NOCTURNE__.metrics,trace:window.__NOCTURNE__.trace}));
   report.simulationSoak=final;console.log('SOAK',JSON.stringify(final));
   await page.screenshot({path:`${folder}/ending.png`});
   assert.equal(final.metrics.wave,5,'Full encounter progression must reach the fifth wave');
   assert.equal(final.metrics.phase,'victory','Guard strategy should clear all five waves');assert.equal(final.metrics.kills,46);
   assert.ok(final.trace.some(e=>e.type==='boss-spawn'));assert.ok(final.metrics.bursts>0);
   await page.click('#restart');assert.equal(await page.evaluate(()=>window.__NOCTURNE__.game.wave),1);assert.equal(await page.locator('#level-label').innerText(),'LV. 1');
  }
  assert.deepEqual(errors,[]);report.checks.at(-1).consoleErrors=errors;
  await context.close();current=null;
 }
 report.success=true;console.log('BROWSER_VERIFIED',JSON.stringify(report));
}catch(error){
 report.success=false;report.errors.push(String(error));console.error('BROWSER_FAILURE',String(error));
 if(current){console.log('BODY',await current.locator('body').innerText().catch(()=>''));console.log('STATE',await current.evaluate(()=>window.__NOCTURNE__?.metrics).catch(()=>null));await current.screenshot({path:`${folder}/failure.png`}).catch(()=>{});}
 process.exitCode=1;
}finally{
 report.finishedAt=new Date().toISOString();fs.writeFileSync(`${folder}/report.json`,JSON.stringify(report,null,2));await browser.close();
}
