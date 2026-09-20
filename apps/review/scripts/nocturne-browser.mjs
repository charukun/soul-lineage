// Explicit, specialist Playwright evidence. Not part of ordinary Fast DEV validation.
import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {execFileSync} from 'node:child_process';
const root=resolve('dist/review'),out=resolve('.battle2-evidence');await mkdir(out,{recursive:true});
const report={sourceSha:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),scenarios:[],passed:false};
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.glb':'model/gltf-binary','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.woff2':'font/woff2'};
const server=createServer(async(req,res)=>{
  try{
    let path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(path==='/')path='/index.html';if(path==='/battle2')path='/battle2.html';
    const file=resolve(root,'.'+path);if(!file.startsWith(root+sep))throw Error('Invalid path');const info=await stat(file);if(!info.isFile())throw Error('Not a file');
    res.setHeader('Content-Type',mime[extname(file)]||'application/octet-stream');res.end(await readFile(file));
  }catch{res.statusCode=404;res.end('Not found');}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
async function snapshot(page){return page.evaluate(()=>({state:window.__BATTLE2__?.state,error:window.__BATTLE2__?.lastError,metrics:window.__BATTLE2__?.metrics,actors:window.__BATTLE2__?.actors,trace:window.__BATTLE2__?.trace}));}
try{
  // Capture the failing public baseline separately; never use its mutable page as After evidence.
  const before=await browser.newContext({viewport:{width:412,height:915}}),bp=await before.newPage(),errors=[];
  bp.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  try{
    await bp.goto('https://soul-lineage-review-dev.c-okamoto.workers.dev/battle2',{waitUntil:'domcontentloaded',timeout:30000});
    await bp.waitForFunction(()=>document.getElementById('fatal-detail')?.textContent||window.__BATTLE2__?.state==='BATTLE'||window.__NOCTURNE__?.metrics?.ready,{},{timeout:25000}).catch(()=>{});
    const observed=await bp.evaluate(()=>({url:location.href,title:document.title,error:document.getElementById('fatal-detail')?.textContent,metrics:window.__NOCTURNE__?.metrics||window.__BATTLE2__?.metrics}));
    await writeFile(out+'/before-browser.json',JSON.stringify({observed,errors},null,2));await bp.screenshot({path:out+'/before-mobile.png'});
  }catch(error){await writeFile(out+'/before-browser.json',JSON.stringify({error:error.message,errors},null,2));}
  await before.close();
  for(const [name,viewport] of [['desktop',{width:1280,height:800}],['mobile',{width:412,height:915}]]){
    const context=await browser.newContext({viewport,deviceScaleFactor:1,hasTouch:name==='mobile'});await context.tracing.start({screenshots:true,snapshots:true});
    const page=await context.newPage(),errors=[],requests=[],failed=[];
    page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});page.on('requestfailed',r=>failed.push({url:r.url(),error:r.failure()}));
    const result={name,viewport,errors,requests,failed};report.scenarios.push(result);
    try{
      await page.goto(origin+'/battle2?evidence=1',{waitUntil:'domcontentloaded'});
      await page.waitForFunction(()=>window.__BATTLE2__?.state==='BATTLE',{},{timeout:60000});
      result.initial=await snapshot(page);assert.equal(result.initial.metrics.models,28);assert.equal(result.initial.metrics.webgl2,true);
      assert.equal(await page.locator('button,input,select,iframe,dialog,[data-runtime-support]').count(),0);
      await page.waitForFunction(()=>window.__BATTLE2__.metrics.actors>1&&window.__BATTLE2__.metrics.damage>0&&window.__BATTLE2__.metrics.renderedDeaths>0,{},{timeout:90000});
      result.combat=await snapshot(page);assert.ok(result.combat.metrics.totalKills>0);assert.ok(result.combat.metrics.drawCalls>0&&result.combat.metrics.triangles>0);assert.ok(result.combat.metrics.activeAnimations>0);
      assert.ok(result.combat.trace.some(e=>e.type==='animation'&&e.name==='Death_C_Skeletons'));
      await page.screenshot({path:out+'/'+name+'-combat.png'});
      await page.mouse.click(viewport.width/2,viewport.height/2);
      await page.waitForFunction(()=>window.__BATTLE2__.metrics.audio.unlocked&&window.__BATTLE2__.metrics.audio.notes>0,{},{timeout:45000});
      result.audio=await page.evaluate(()=>window.__BATTLE2__.metrics.audio);
      assert.ok(!((await snapshot(page)).trace.some(e=>e.type==='waypoint')),'Canvas gesture must not issue movement commands');
      if(name==='desktop'){
        let seconds=0,rounds=1;
        while(rounds<3&&seconds<1200){const m=await page.evaluate(()=>window.__BATTLE2__.advance(10));rounds=m.rounds;seconds+=10;assert.ok(m.actors<=20,'Actor lifetime leak');}
        result.replay={fixedStepSeconds:seconds,snapshot:await snapshot(page)};assert.ok(result.replay.snapshot.metrics.rounds>=3,'Two complete automatic restarts required');
      }
      await page.setViewportSize({width:viewport.height,height:viewport.width});
      await page.waitForFunction(()=>{const c=document.getElementById('world'),r=c.getBoundingClientRect();return r.width===innerWidth&&r.height>0&&c.width>0;});
      result.resized=await snapshot(page);assert.equal(result.resized.error,null);
      assert.equal(await page.locator('#battle2-status').isVisible(),false,'No loader/HUD after battle starts');
      assert.equal(errors.length,0,JSON.stringify(errors));assert.equal(failed.length,0,JSON.stringify(failed));
      assert.ok(requests.some(u=>u.includes('/library/model/'))&&requests.some(u=>u.includes('/library/object/')));
      assert.ok(requests.every(u=>new URL(u).origin===origin),'Unexpected external runtime request: '+requests.filter(u=>new URL(u).origin!==origin));
      result.passed=true;
    }finally{result.last=await snapshot(page).catch(()=>null);await page.screenshot({path:out+'/'+name+'-last.png'}).catch(()=>{});await context.tracing.stop({path:out+'/'+name+'-trace.zip'});await context.close();}
  }
  const broken=await browser.newContext({viewport:{width:412,height:915}}),page=await broken.newPage();let attempts=0;
  await page.route('**/library/model/**/Knight.glb',route=>{attempts++;return route.fulfill({status:503,body:'intentional missing-asset fixture'});});
  await page.goto(origin+'/battle2',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__BATTLE2__?.state==='ERROR',{},{timeout:45000});
  const failure=await snapshot(page);assert.ok(failure.error.includes('adventurers/Knight'));assert.equal(attempts,2);assert.equal(await page.locator('#battle2-status').isVisible(),true);assert.equal(failure.metrics.ready,false);
  report.scenarios.push({name:'missing-asset',attempts,observed:failure,passed:true});await page.screenshot({path:out+'/missing-asset.png'});await broken.close();
  report.passed=true;
}catch(error){report.error=error.stack||error.message;process.exitCode=1;}
finally{await writeFile(out+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify({sourceSha:report.sourceSha,passed:report.passed,error:report.error,scenarios:report.scenarios.map(s=>({name:s.name,passed:s.passed,metrics:s.combat?.metrics,replayRounds:s.replay?.snapshot.metrics.rounds}))},null,2));await browser.close();await new Promise(r=>server.close(r));}
