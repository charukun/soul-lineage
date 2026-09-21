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
const timeValue=async()=>Number(((await page.locator('#battle-time').textContent())||'0').replace('秒',''))||0;
const hash=buf=>createHash('sha256').update(buf).digest('hex');
try{
  await page.goto(target,{waitUntil:'networkidle',timeout:90000});
  await page.waitForFunction(()=>document.querySelector('#battle-canvas')?.dataset.battleModels==='ready',null,{timeout:90000});
  await page.locator('[data-inspiration-mode="boost"]').click();
  // Deterministically force the next high-probability inspiration roll so this
  // browser probe exercises the same spontaneous inspiration path every run.
  await page.evaluate(()=>{globalThis.__inspirationProbeOriginalRandom=Math.random;Math.random=()=>0;});
  await page.waitForFunction(()=>document.querySelector('.stage')?.dataset.inspirationCinematic==='true',null,{timeout:20000});
  const t0=await timeValue();
  const before=await page.locator('#battle-canvas').screenshot({path:out+'/inspiration-start.png'});
  await page.waitForTimeout(1200);
  const t1=await timeValue();
  const during=await page.locator('#battle-canvas').screenshot({path:out+'/inspiration-during.png'});
  const activeAfter1200=await page.evaluate(()=>document.querySelector('.stage')?.dataset.inspirationCinematic==='true');
  await page.waitForFunction(()=>document.querySelector('.stage')?.dataset.inspirationCinematic!=='true',null,{timeout:8000});
  const tDone=await timeValue();
  await page.waitForTimeout(900);
  const t2=await timeValue();
  const after=await page.locator('#battle-canvas').screenshot({path:out+'/inspiration-after.png'});
  const result={
    target,
    title:await page.title(),
    t0,t1,tDone,t2,
    duringDelta:Number((t1-t0).toFixed(3)),
    afterDelta:Number((t2-tDone).toFixed(3)),
    activeAfter1200,
    canvasChangedDuring:hash(before)!==hash(during),
    canvasChangedAfter:hash(during)!==hash(after),
    events
  };
  await writeFile(out+'/result.json',JSON.stringify(result,null,2));
  console.log(JSON.stringify(result,null,2));
  if(t1-t0<0.25)throw new Error('FREEZE_REPRODUCED: battle time did not advance during inspiration');
  if(t2-tDone<0.15)throw new Error('POST_INSPIRATION_STALL: battle time did not resume after inspiration');
}finally{
  await browser.close();
}
