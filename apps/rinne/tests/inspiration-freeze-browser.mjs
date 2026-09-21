import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const target=process.env.TARGET_URL||'https://soul-lineage-rinne-dev.c-okamoto.workers.dev/review-battle';
const out='.tmp/inspiration-freeze-evidence';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:793,height:1536},deviceScaleFactor:1});
const events=[];
page.on('console',msg=>{if(['error','warning'].includes(msg.type()))events.push({type:'console-'+msg.type(),text:msg.text()});});
page.on('pageerror',err=>events.push({type:'pageerror',text:String(err?.stack||err)}));
page.on('requestfailed',req=>events.push({type:'requestfailed',text:req.url()+' '+String(req.failure()?.errorText||'')}));
const hash=buf=>createHash('sha256').update(buf).digest('hex');
const state=async()=>page.evaluate(()=>({
  time:Number((document.querySelector('#battle-time')?.textContent||'0').replace('秒',''))||0,
  phase:document.querySelector('#battle-phase')?.dataset.phase||'',
  result:document.querySelector('#battle-result')?.textContent||'',
  mode:document.body.dataset.inspirationMode||'',
  cinematic:document.querySelector('.stage')?.dataset.inspirationCinematic==='true',
  bannerHidden:document.querySelector('#battle-inspiration')?.hidden,
  bulbHidden:document.querySelector('#battle-lightbulb')?.hidden,
  boostPressed:document.querySelector('[data-inspiration-mode="boost"]')?.getAttribute('aria-pressed')
}));
let result={target,events};
try{
  await page.goto(target,{waitUntil:'networkidle',timeout:90000});
  await page.waitForFunction(()=>document.querySelector('#battle-canvas')?.dataset.battleModels==='ready',null,{timeout:90000});
  result.ready=await state();
  await page.locator('[data-inspiration-mode="boost"]').click();
  await page.evaluate(()=>{globalThis.__inspirationProbeOriginalRandom=Math.random;Math.random=()=>0;});
  result.afterBoost=await state();

  await page.waitForFunction(()=>document.querySelector('.stage')?.dataset.inspirationCinematic==='true',null,{timeout:15000});
  result.trigger='spontaneous';
  const start=await state();
  const before=await page.locator('#battle-canvas').screenshot({path:out+'/inspiration-start.png'});
  await page.waitForTimeout(1200);
  const duringState=await state();
  const during=await page.locator('#battle-canvas').screenshot({path:out+'/inspiration-during.png'});
  await page.waitForFunction(()=>document.querySelector('.stage')?.dataset.inspirationCinematic!=='true',null,{timeout:8000});
  const done=await state();
  await page.waitForTimeout(900);
  const afterState=await state();
  const after=await page.locator('#battle-canvas').screenshot({path:out+'/inspiration-after.png'});
  result={...result,start,during:duringState,done,after:afterState,
    duringDelta:Number((duringState.time-start.time).toFixed(3)),
    afterDelta:Number((afterState.time-done.time).toFixed(3)),
    canvasChangedDuring:hash(before)!==hash(during),
    canvasChangedAfter:hash(during)!==hash(after)
  };
  await writeFile(out+'/result.json',JSON.stringify(result,null,2));
  console.log(JSON.stringify(result,null,2));
  if(duringState.time-start.time<0.25)throw new Error('FREEZE_REPRODUCED: battle time did not advance during inspiration');
  if(afterState.time-done.time<0.15)throw new Error('POST_INSPIRATION_STALL: battle time did not resume after inspiration');
  const pageErrors=events.filter(row=>row.type==='pageerror');
  if(pageErrors.length)throw new Error('PAGE_ERROR_DURING_INSPIRATION: '+pageErrors.map(row=>row.text).join(' | '));
}catch(error){
  result={...result,error:String(error?.stack||error),finalState:await state().catch(()=>null)};
  await writeFile(out+'/result.json',JSON.stringify(result,null,2));
  console.error(JSON.stringify(result,null,2));
  throw error;
}finally{
  await browser.close();
}
