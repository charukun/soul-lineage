import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { chromium } from '@playwright/test';
import { rescueFixture } from '../tests/fixtures/integration-rescue-state.mjs';
import { rescueView } from './rescue.mjs';
import { event } from '../scripts/integration-rescue-policy.mjs';

const out=resolve(process.env.OPS_RESCUE_REPORT_DIR || 'ops-review-results/rescue');await mkdir(out,{recursive:true});
let fixture=rescueFixture(), errors=[];
const publicRoot=resolve('ops-board/public');
const server=createServer(async(req,res)=>{
  try {
    const path=new URL(req.url,'http://localhost').pathname;
    if(path==='/api/state') {res.setHeader('content-type','application/json');res.end(JSON.stringify({repository:'charukun/soul-lineage',generatedAt:new Date().toISOString(),syncStatus:'ok',environments:[],applications:[],integration:{},pullRequests:{normal:[],visualReview:[]},integrationRescue:rescueView(fixture)}));return;}
    const file=resolve(publicRoot,'.'+(path==='/'?'/index.html':path));if(!file.startsWith(publicRoot+'/'))throw new Error('path');
    res.setHeader('content-type',({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.svg':'image/svg+xml'})[extname(file)]||'application/octet-stream');res.end(await readFile(file));
  }catch{res.statusCode=404;res.end('not found');}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}: {})});
const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,locale:'ja-JP',timezoneId:'Asia/Tokyo'});
page.on('pageerror',e=>errors.push(e.message));
page.on('request',r=>{if(new URL(r.url()).hostname==='api.github.com')errors.push('Browser called GitHub API');});
const checks=[]; const check=(name)=>{checks.push(name);console.log('PASS '+name);};
const openDisclosure=async key=>{
  const details=page.locator(`details[data-disclosure="${key}"]`);
  if(await details.count() && await details.getAttribute('open')===null) await details.locator(':scope > summary').click();
  return details;
};
try{
  await page.goto(base);await page.waitForSelector('.rs-summary');
  assert.equal(await page.locator('#rescue-section h2').textContent(),'INTEGRATION RESCUE');
  assert.match(await page.locator('.rs-summary').innerText(),/4 \/ 6/);
  assert.equal(await page.locator('.rs-summary-live-item').count(),3);check('summary-first status and bounded NOW list');

  const drilldown=await openDisclosure('rescue:details');
  assert.equal(await drilldown.getAttribute('open'),'');
  await openDisclosure('rescue:metrics');
  await openDisclosure('rescue:workers');
  await page.waitForSelector('.rs-worker-pool .rs-card',{state:'visible'});
  assert.match(await page.locator('.rs-workers-total').innerText(),/4 \/ 6 ACTIVE/);check('full metrics disclosure');
  assert.equal(await page.locator('.rs-worker-pool .rs-card').count(),5);
  const validatingCard=await page.locator('.rs-card[data-pr="124"]').innerText();
  assert.match(validatingCard,/1400\/pr-124\/a1/);
  assert.match(validatingCard,/検証中[\s\S]*VALIDATE/);check('real worker IDs and validation stage');

  await openDisclosure('rescue:waves');
  assert.match(await page.locator('.rs-wave-list').innerText(),/wave-14[\s\S]*#125.*#120/);check('wave and dependency order');
  await openDisclosure('rescue:queue');
  const queueText=await page.locator('details[data-disclosure="rescue:queue"] .rs-queue').innerText();
  assert.match(queueText,/#125 WAITING FOR #120/);
  assert.match(queueText,/#140[\s\S]*再試行待ち/);check('queue, blocked reason and retry');

  const human=page.locator('details[data-disclosure="rescue:human"]');
  const hold=page.locator('details[data-disclosure="rescue:manual-hold"]');
  if(await human.count()) await openDisclosure('rescue:human');
  if(await hold.count()) await openDisclosure('rescue:manual-hold');
  assert.match(await page.locator('.rs-manual-list').first().innerText(),/save schema[\s\S]*(?:Human decision required|Manual hold|人の判断が必要)/);check('manual failure visible');
  assert.match(await page.locator('.rs-stale').innerText(),/WORKER STALE[\s\S]*Heartbeat 12m/);check('stale heartbeat visible');
  assert.equal(await page.locator('.rs-card[data-pr="120"] .rs-card-head a').getAttribute('href'),'https://github.com/charukun/soul-lineage/pull/120');

  await openDisclosure('rescue:recent');
  assert.equal(await page.locator('.rs-recent .rs-card[data-pr="119"] a[href*="/commit/"]').getAttribute('href'),'https://github.com/charukun/soul-lineage/commit/'+'d'.repeat(40));check('PR and resolution commit links');
  await openDisclosure('rescue:throughput');
  assert.match(await page.locator('.rs-throughput').innerText(),/Rescued 2.*Merged 1/);check('throughput and post-Rescue merge tracking');
  await openDisclosure('rescue:activity');
  assert.match(await page.locator('.rs-activity').innerText(),/Recovered by/);check('recovery activity');

  const cardDetails=page.locator('.rs-card[data-pr="120"] details');await cardDetails.locator('summary').click();
  await page.locator('#reload').click();await page.waitForFunction(()=>!document.querySelector('#reload').disabled);
  assert.equal(await page.locator('details[data-disclosure="rescue:details"]').getAttribute('open'),'');
  assert.equal(await page.locator('details[data-disclosure="rescue:workers"]').getAttribute('open'),'');
  assert.equal(await page.locator('.rs-card[data-pr="120"] details').getAttribute('open'),'');check('drilldown and card disclosure survive snapshot refresh');

  for(const width of [320,390,673,1100]){
    await page.setViewportSize({width,height:844});await page.locator('a[href="#rescue-section"]').click();await page.waitForTimeout(200);
    const dimensions=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
    assert.ok(dimensions.scroll<=width+1,JSON.stringify(dimensions));
    await page.screenshot({path:`${out}/rescue-${width}.png`});check(`mobile/desktop no overflow ${width}px`);
  }

  fixture.records[119].mode='reevaluate';
  Object.assign(fixture.records[118],{attempt:0,rescueId:null,claimedBy:null,returnedAt:null,state:'DEV',currentStep:'DEV'});
  event(fixture,fixture.records[118],'DEV','DEV observed without Rescue repair',Date.now());
  fixture.records[199]={...fixture.records[119],pr:199,state:'AWAITING_PUSH',currentStep:'AWAITING_PUSH',returnedAt:null,pushedSha:null,pushedAt:null,stagedSha:'a'.repeat(40)};
  await page.locator('#reload').click();await page.waitForFunction(()=>!document.querySelector('#reload').disabled);
  assert.match(await page.locator('.rs-throughput').innerText(),/Rescued 0.*Merged 0/);
  assert.match(await page.locator('.rs-throughput').innerText(),/merge 1.*DEV 1/);
  assert.match(await page.locator('.rs-card[data-pr="119"]').innerText(),/再評価のみ・修復pushなし/);
  assert.doesNotMatch(await page.locator('.rs-card[data-pr="119"] .rs-rail').innerText(),/PUSH/);
  assert.match(await page.locator('.rs-card[data-pr="118"]').innerText(),/統合状況の観測・修復証跡なし/);
  assert.doesNotMatch(await page.locator('.rs-card[data-pr="118"] .rs-rail').innerText(),/PUSH|RETURN/);
  assert.match(await page.locator('.rs-card[data-pr="199"]').innerText(),/commit準備済み・push待ち/);
  check('observed delivery, reevaluation and staged commits do not imply repair success');

  fixture=rescueFixture(Date.now(),true);await page.locator('#reload').click();await page.waitForFunction(()=>document.querySelector('.rs-summary-status strong')?.textContent==='ALL CLEAR');
  assert.match(await page.locator('.rs-summary').innerText(),/0 \/ 6/);assert.equal(await page.locator('.rs-worker-pool .rs-card').count(),0);check('normal empty ALL CLEAR');
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:`${out}/empty-390.png`});
  assert.deepEqual(errors,[]);
  await writeFile(`${out}/report.json`,JSON.stringify({result:'success',checks,errors},null,2));
}catch(error){await page.screenshot({path:`${out}/failure.png`,fullPage:true});await writeFile(`${out}/report.json`,JSON.stringify({result:'failure',checks,errors,failure:error.stack},null,2));throw error;}
finally{await browser.close();server.close();}
