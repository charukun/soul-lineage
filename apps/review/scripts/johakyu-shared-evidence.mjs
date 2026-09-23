// Explicit specialist scenario, called by the existing NOCTURNE browser lane.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {assertBattle2Frame} from './battle2-shell-evidence.mjs';
export async function verifySharedBattleReview(browser,origin,out,{sourceSha,beforeOrigin,beforeSha,fontUrl}={}){
 await mkdir(out,{recursive:true});const report={sourceSha,beforeSha,mode:'shared',scenarios:[],passed:false};
 async function open(url,viewport,expected){
  const context=await browser.newContext({viewport,deviceScaleFactor:1}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(url+'/battle2?evidence=1',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>['READY','ERROR'].includes(window.__BATTLE2__?.state),null,{timeout:90000});assert.equal(await page.evaluate(()=>__BATTLE2__.lastError),null);assert.equal(await page.evaluate(()=>__BATTLE2__.sourceSha),expected);
  if(fontUrl){await page.addStyleTag({content:`@font-face{font-family:EvidenceJapanese;src:url('${fontUrl}')}body,button,select,h1,strong,span{font-family:EvidenceJapanese,sans-serif!important}`});await page.evaluate(()=>document.fonts.load('16px EvidenceJapanese'));}
  await page.locator('#battle2-start').click();return {context,page,errors};
 }
 try{
  if(beforeOrigin){const {page,context,errors}=await open(beforeOrigin,{width:1100,height:760},beforeSha);await page.evaluate(()=>__BATTLE2__.advance(3));await page.screenshot({path:out+'/before-desktop.png'});report.before={sourceSha:beforeSha,metrics:await page.evaluate(()=>__BATTLE2__.metrics),errors};assert.deepEqual(errors,[]);await context.close();}
  for(const [name,viewport,seconds]of [['desktop',{width:1100,height:760},36],['mobile',{width:390,height:844},3]]){
   const {context,page,errors}=await open(origin,viewport,sourceSha),row={name,viewport,samples:[],errors};report.scenarios.push(row);
   try{
    row.frame=await assertBattle2Frame(page,{title:'序破急バトル'});
    for(let n=0;n<seconds;n++){
     const sample=await page.evaluate(()=>{__BATTLE2__.advance(1);return{review:__BATTLE2__.review,events:__BATTLE2__.exchangeTrace,metrics:__BATTLE2__.metrics,trace:__BATTLE2__.trace}});row.samples.push(sample);
     assert.equal(sample.review.sharedRuntime,'johakyu-battle');assert.equal(sample.metrics.webgl2,true);assert.ok(sample.metrics.drawCalls>0);assert.ok(sample.metrics.activeAnimations+sample.metrics.sampledAnimations>0);
     if([2,8,17,35].includes(n))await page.screenshot({path:out+'/'+name+'-'+(n+1)+'s.png'});
    }
    const events=row.samples.flatMap(s=>s.events),contacts=events.filter(e=>e.impact);row.eventTypes=[...new Set(events.map(e=>e.type))];
    if(name==='desktop'){
     assert.ok(contacts.some(e=>e.damage>0));assert.ok(events.some(e=>e.type==='parry'&&e.strongParry));assert.ok(events.some(e=>e.kind==='counter'&&e.damage>0));assert.ok(events.some(e=>e.type==='finisher'));assert.ok(['jo','ha','kyu'].every(p=>events.some(e=>e.phase===p)));
     for(const event of contacts){assert.equal(event.techniqueId,event.impact.techniqueId);assert.equal(event.stageIndex,event.impact.stageIndex);}
     assert.ok(row.samples.at(-1).metrics.audio.notes>0,'real start input must unlock synchronized sound');
     await page.locator('.review-stage-controls__button').click();await page.locator('[data-battle-mode="oneVsThree"]').click();await page.locator('.review-stage-controls__button').click();await page.waitForFunction(()=>['BATTLE','ERROR'].includes(__BATTLE2__.state)&&__BATTLE2__.mode==='oneVsThree',null,{timeout:90000});assert.equal(await page.evaluate(()=>__BATTLE2__.lastError),null);await page.evaluate(()=>__BATTLE2__.advance(3));row.multi=await page.evaluate(()=>({review:__BATTLE2__.review,metrics:__BATTLE2__.metrics}));assert.equal(row.multi.review.mode,'oneVsThree');assert.equal(row.multi.metrics.actors,4);await page.screenshot({path:out+'/desktop-1v3.png'});
    }
    await page.locator('[data-review-switcher]>summary').click();row.columns=await page.locator('.review-switcher__grid').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length);assert.equal(row.columns,5);await page.screenshot({path:out+'/'+name+'-menu.png'});await page.keyboard.press('Escape');
    assert.deepEqual(errors,[]);row.passed=true;
   }finally{await context.close();}
  }report.passed=true;
 }catch(e){report.error=e.stack;throw e;}finally{await writeFile(out+'/report.json',JSON.stringify(report,null,2));}
 return report;
}
