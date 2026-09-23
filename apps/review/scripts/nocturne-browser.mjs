// Explicit, specialist Playwright evidence. Not part of ordinary Fast DEV validation.
import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {execFileSync} from 'node:child_process';
import {assertBattle2Frame,exerciseBattle2Switcher} from './battle2-shell-evidence.mjs';
const root=resolve('dist/review'),out=resolve(process.env.BATTLE2_EVIDENCE_DIR||'.battle2-evidence');await mkdir(out,{recursive:true});
const mode=process.env.JOHAKYU_MODE||'native';assert.ok(['native','p2','shared'].includes(mode),'Unknown review mode');
const query=mode==='native'?'evidence=1':'evidence=1&johakyu=p2';
const report={sourceSha:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),mode,before:[],scenarios:[],passed:false};
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.glb':'model/gltf-binary','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.woff2':'font/woff2'};
function serveRoot(base){return createServer(async(req,res)=>{
  try{
    let path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(path==='/')path='/index.html';if(path==='/battle2')path='/battle2.html';
    const file=resolve(base,'.'+path);if(!file.startsWith(base+sep))throw Error('Invalid path');const info=await stat(file);if(!info.isFile())throw Error('Not a file');
    res.setHeader('Content-Type',mime[extname(file)]||'application/octet-stream');res.end(await readFile(file));
  }catch{res.statusCode=404;res.end('Not found');}
});}
const server=serveRoot(root);let baselineServer;
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
async function snapshot(page){return page.evaluate(()=>({state:window.__BATTLE2__?.state,error:window.__BATTLE2__?.lastError,metrics:window.__BATTLE2__?.metrics,actors:window.__BATTLE2__?.actors,trace:window.__BATTLE2__?.trace}));}
try{
 if(mode==='shared'){
  if(process.env.BEFORE_ROOT){baselineServer=serveRoot(resolve(process.env.BEFORE_ROOT));await new Promise(r=>baselineServer.listen(0,'127.0.0.1',r));}
  const {verifySharedBattleReview}=await import('./johakyu-shared-evidence.mjs');
  Object.assign(report,await verifySharedBattleReview(browser,origin,out,{sourceSha:report.sourceSha,beforeOrigin:baselineServer?'http://127.0.0.1:'+baselineServer.address().port:null,beforeSha:process.env.BEFORE_SOURCE_SHA}));
 }else{
  // A mutable DEV page is not a baseline. An optional Before is built from an
  // independently pinned checkout and must identify the exact requested SHA.
  if(process.env.BEFORE_ROOT){
    assert.match(process.env.BEFORE_SOURCE_SHA||'',/^[0-9a-f]{40}$/);
    baselineServer=serveRoot(resolve(process.env.BEFORE_ROOT));await new Promise(r=>baselineServer.listen(0,'127.0.0.1',r));
    const beforeOrigin='http://127.0.0.1:'+baselineServer.address().port;
    for(const [name,viewport] of [['desktop',{width:1280,height:800}],['mobile',{width:412,height:915}]]){
      const context=await browser.newContext({viewport,deviceScaleFactor:1}),page=await context.newPage(),errors=[];
      page.on('pageerror',e=>errors.push(e.message));
      await page.goto(beforeOrigin+'/battle2?evidence=1',{waitUntil:'domcontentloaded'});
      await page.waitForFunction(()=>window.__BATTLE2__?.state==='BATTLE',{},{timeout:60000});
      assert.equal(await page.evaluate(()=>window.__BATTLE2__.sourceSha),process.env.BEFORE_SOURCE_SHA);
      await page.evaluate(()=>window.__BATTLE2__.advance(8));
      const observed=await snapshot(page);assert.equal(errors.length,0);assert.ok(observed.metrics.drawCalls>0);
      report.before.push({sourceSha:process.env.BEFORE_SOURCE_SHA,name,viewport,seed:73917,advanceSeconds:8,observed,errors});
      await page.screenshot({path:out+'/before-'+name+'.png'});await context.close();
    }
  }else if(mode!=='native')throw Error('Johakyu acceptance requires a pinned Before checkout');
  for(const [name,viewport] of [['desktop',{width:1280,height:800}],['mobile',{width:412,height:915}]]){
    const context=await browser.newContext({viewport,deviceScaleFactor:1,hasTouch:name==='mobile',recordVideo:{dir:out+'/videos',size:viewport}});await context.tracing.start({screenshots:true,snapshots:true});
    const page=await context.newPage(),errors=[],requests=[],failed=[];
    page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});page.on('requestfailed',r=>failed.push({url:r.url(),error:r.failure()}));
    const result={name,viewport,errors,requests,failed};report.scenarios.push(result);
    try{
      await page.goto(origin+'/battle2?'+query,{waitUntil:'domcontentloaded'});
      await page.waitForFunction(()=>window.__BATTLE2__?.state==='BATTLE',{},{timeout:60000});
      assert.equal(await page.evaluate(()=>window.__BATTLE2__.sourceSha),report.sourceSha);
      result.initial=await snapshot(page);assert.equal(result.initial.metrics.models,28);assert.equal(result.initial.metrics.webgl2,true);
      assert.equal(await page.locator('button,input,select,iframe,dialog,[data-runtime-support]').count(),0);
      result.frame=await assertBattle2Frame(page);
      if(mode==='p2'){
        // The existing evidence clock drives the real simulation and paints each
        // sample. This is stepped diagnostic playback, not real-device FPS.
        result.playback={mode:'fixed-step-diagnostic',stepSeconds:.25,samples:[],physicalDevice:false};
        for(let step=0;step<160;step++){
          const sample=await page.evaluate(()=>{
            const metrics=window.__BATTLE2__.advance(.25);
            return {time:metrics.time,rounds:metrics.rounds,actors:metrics.actors,damage:metrics.damage,
              renderedDeaths:metrics.renderedDeaths,phase:metrics.phase,
              phases:[...new Set(window.__BATTLE2__.trace.filter(e=>e.type==='johakyu-action'&&e.kind==='hero').map(e=>e.phase))]};
          });
          result.playback.samples.push(sample);
          if(sample.actors>1&&sample.damage>0&&sample.renderedDeaths>0&&['jo','ha','kyu'].every(phase=>sample.phases.includes(phase)))break;
        }
      }
      await page.waitForFunction(()=>window.__BATTLE2__.metrics.actors>1&&window.__BATTLE2__.metrics.damage>0&&window.__BATTLE2__.metrics.renderedDeaths>0,{},{timeout:90000});
      result.combat=await snapshot(page);assert.ok(result.combat.metrics.totalKills>0);assert.ok(result.combat.metrics.drawCalls>0&&result.combat.metrics.triangles>0);assert.ok(result.combat.metrics.activeAnimations>0);
      assert.ok(result.combat.trace.some(e=>e.type==='animation'&&e.name==='Death_C_Skeletons'));
      await page.screenshot({path:out+'/'+name+'-combat.png'});
      if(mode==='p2'){
        await page.waitForFunction(()=>['jo','ha','kyu'].every(phase=>window.__BATTLE2__.trace.some(e=>e.type==='johakyu-action'&&e.kind==='hero'&&e.phase===phase)),{},{timeout:90000});
        result.johakyu=await page.evaluate(()=>({observation:window.__BATTLE2__.observation,trace:window.__BATTLE2__.trace}));
        assert.equal(result.johakyu.observation.authority,'johakyu-review');
        assert.ok(result.johakyu.trace.some(e=>e.type==='johakyu-impact'&&e.sourceId!==e.targetId&&e.damage>0));
        await page.screenshot({path:out+'/'+name+'-johakyu.png'});
      }
      await page.mouse.click(viewport.width/2,viewport.height/2);
      await page.waitForFunction(()=>window.__BATTLE2__.metrics.audio.unlocked&&window.__BATTLE2__.metrics.audio.notes>0,{},{timeout:45000});
      result.audio=await page.evaluate(()=>window.__BATTLE2__.metrics.audio);
      assert.ok(!((await snapshot(page)).trace.some(e=>e.type==='waypoint')),'Canvas gesture must not issue movement commands');
      result.menu=await exerciseBattle2Switcher(page,{origin,out,name});
      if(name==='desktop'){
        let seconds=0,rounds=1;
        while(rounds<3&&seconds<1200){const m=await page.evaluate(()=>window.__BATTLE2__.advance(10));rounds=m.rounds;seconds+=10;assert.ok(m.actors<=20,'Actor lifetime leak');}
        result.replay={fixedStepSeconds:seconds,snapshot:await snapshot(page)};assert.ok(result.replay.snapshot.metrics.rounds>=3,'Two complete automatic restarts required');
      }
      await page.setViewportSize({width:viewport.height,height:viewport.width});
      result.resizedFrame=await assertBattle2Frame(page);
      result.resized=await snapshot(page);assert.equal(result.resized.error,null);
      await page.screenshot({path:out+'/'+name+'-rotated.png'});
      if(name==='mobile'){
        await page.setViewportSize({width:320,height:568});result.compactFrame=await assertBattle2Frame(page);
        await page.screenshot({path:out+'/compact-frame.png'});
      }
      assert.equal(await page.locator('#battle2-status').isVisible(),false,'No loader/HUD after battle starts');
      assert.equal(errors.length,0,JSON.stringify(errors));assert.equal(failed.length,0,JSON.stringify(failed));
      assert.ok(requests.some(u=>u.includes('/library/model/'))&&requests.some(u=>u.includes('/library/object/')));
      assert.ok(requests.every(u=>new URL(u).origin===origin),'Unexpected external runtime request: '+requests.filter(u=>new URL(u).origin!==origin));
      // Navigation happens after runtime network checks; the Lab home owns its own prefetches.
      await page.locator('.review-surface__back').click();await page.waitForURL(origin+'/');
      assert.equal(await page.locator('[data-dev-tool="visual-review"]').isVisible(),true);result.backNavigation=true;
      result.passed=true;
    }finally{result.last=await snapshot(page).catch(()=>null);await page.screenshot({path:out+'/'+name+'-last.png'}).catch(()=>{});await context.tracing.stop({path:out+'/'+name+'-trace.zip'});await context.close();}
  }
  const broken=await browser.newContext({viewport:{width:412,height:915}}),page=await broken.newPage();let attempts=0;
  await page.route('**/library/model/**/Knight.glb',route=>{attempts++;return route.fulfill({status:503,body:'intentional missing-asset fixture'});});
  await page.goto(origin+'/battle2',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__BATTLE2__?.state==='ERROR',{},{timeout:45000});
  const failure=await snapshot(page);assert.ok(failure.error.includes('adventurers/Knight'));assert.equal(attempts,2);assert.equal(await page.locator('#battle2-status').isVisible(),true);assert.equal(failure.metrics.ready,false);
  assert.equal(await page.locator('.review-surface__back').isVisible(),true,'Error must not trap navigation');
  report.scenarios.push({name:'missing-asset',attempts,observed:failure,passed:true});await page.screenshot({path:out+'/missing-asset.png'});await broken.close();
  report.passed=true;
 }
}catch(error){report.error=error.stack||error.message;process.exitCode=1;}
finally{await writeFile(out+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify({sourceSha:report.sourceSha,passed:report.passed,error:report.error,scenarios:report.scenarios.map(s=>({name:s.name,passed:s.passed,metrics:s.combat?.metrics,replayRounds:s.replay?.snapshot.metrics.rounds,frame:s.frame,resizedFrame:s.resizedFrame,compactFrame:s.compactFrame,menu:s.menu,backNavigation:s.backNavigation}))},null,2));await browser.close();await new Promise(r=>server.close(r));if(baselineServer)await new Promise(r=>baselineServer.close(r));}
