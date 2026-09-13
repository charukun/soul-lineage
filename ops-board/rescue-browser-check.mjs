import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { chromium } from '@playwright/test';
import { rescueFixture } from '../tests/fixtures/integration-rescue-state.mjs';
import { rescueView } from './rescue.mjs';

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
try{
  await page.goto(base);await page.waitForSelector('.rs-worker-pool .rs-card');
  assert.equal(await page.locator('#rescue-section h2').textContent(),'INTEGRATION RESCUE');
  assert.match(await page.locator('.rs-workers-total').innerText(),/4 \/ 6 ACTIVE/);check('section and active count');
  assert.equal(await page.locator('.rs-worker-pool .rs-card').count(),5);
  assert.match(await page.locator('.rs-card[data-pr="124"]').innerText(),/1400\/pr-124\/a1[\s\S]*VALIDATING/);check('real worker IDs and validation stage');
  assert.match(await page.locator('.rs-wave-list').innerText(),/wave-14[\s\S]*#125.*#120/);check('wave and dependency order');
  assert.match(await page.locator('.rs-queue').innerText(),/#125 WAITING FOR #120[\s\S]*FAILED_RETRYABLE/);check('queue, blocked reason and retry');
  assert.match(await page.locator('.rs-manual-list').innerText(),/save schema[\s\S]*Human review required/);check('manual failure visible');
  assert.match(await page.locator('.rs-stale').innerText(),/WORKER STALE[\s\S]*Heartbeat 12m/);check('stale heartbeat visible');
  assert.equal(await page.locator('.rs-card[data-pr="120"] .rs-card-head a').getAttribute('href'),'https://github.com/charukun/soul-lineage/pull/120');
  assert.equal(await page.locator('.rs-recent .rs-card[data-pr="119"] a[href*="/commit/"]').getAttribute('href'),'https://github.com/charukun/soul-lineage/commit/'+'d'.repeat(40));check('PR and resolution commit links');
  assert.match(await page.locator('.rs-throughput').innerText(),/Rescued 2.*Merged 1/);check('throughput and post-Rescue merge tracking');
  assert.match(await page.locator('.rs-activity').innerText(),/Recovered by/);check('recovery activity');
  const details=page.locator('.rs-card[data-pr="120"] details');await details.locator('summary').click();
  await page.locator('#reload').click();await page.waitForFunction(()=>!document.querySelector('#reload').disabled);
  assert.equal(await page.locator('.rs-card[data-pr="120"] details').getAttribute('open'),'');check('disclosure survives snapshot refresh');
  for(const width of [320,390,673,1100]){
    await page.setViewportSize({width,height:844});await page.locator('a[href="#rescue-section"]').click();await page.waitForTimeout(200);
    const dimensions=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
    assert.ok(dimensions.scroll<=width+1,JSON.stringify(dimensions));
    await page.screenshot({path:`${out}/rescue-${width}.png`});check(`mobile/desktop no overflow ${width}px`);
  }
  fixture=rescueFixture(Date.now(),true);await page.locator('#reload').click();await page.waitForFunction(()=>document.querySelector('.rs-status')?.textContent==='ALL CLEAR');
  assert.match(await page.locator('.rs-workers-total').innerText(),/0 \/ 6 ACTIVE/);assert.equal(await page.locator('.rs-worker-pool .rs-card').count(),0);check('normal empty ALL CLEAR');
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:`${out}/empty-390.png`});
  assert.deepEqual(errors,[]);
  await writeFile(`${out}/report.json`,JSON.stringify({result:'success',checks,errors},null,2));
}catch(error){await page.screenshot({path:`${out}/failure.png`,fullPage:true});await writeFile(`${out}/report.json`,JSON.stringify({result:'failure',checks,errors,failure:error.stack},null,2));throw error;}
finally{await browser.close();server.close();}
