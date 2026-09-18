import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {chromium} from '@playwright/test';

const reviewUrl=new URL(process.argv[2]||process.env.REVIEW_URL||'https://rinne-visual-review.c-okamoto.workers.dev/');
const expectedSha=process.argv[3]||process.env.SOURCE_SHA||'';
assert.match(expectedSha,/^[0-9a-f]{40}$/,'Visual Review smoke requires the exact 40-character source SHA');
const reportDir=resolve(process.env.VISUAL_REVIEW_REPORT_DIR||'test-results/visual-review');mkdirSync(reportDir,{recursive:true});
const versionUrl=new URL('version.json',reviewUrl);versionUrl.searchParams.set('source',expectedSha);
const versionResponse=await fetch(versionUrl,{signal:AbortSignal.timeout(20000)});assert.equal(versionResponse.status,200);
const version=await versionResponse.json();assert.equal(version.commit,expectedSha);assert.equal(version.app,'rinne');assert.equal(version.environment,'dev');

const profiles=[{name:'desktop',viewport:{width:1280,height:900},isMobile:false,hasTouch:false},{name:'mobile',viewport:{width:390,height:844},isMobile:true,hasTouch:true}];
const results=[];let browser;

async function verifyProfile(profile){
  const pageErrors=[],requestFailures=[];
  const context=await browser.newContext({viewport:profile.viewport,isMobile:profile.isMobile,hasTouch:profile.hasTouch,deviceScaleFactor:1});
  const page=await context.newPage();
  page.on('pageerror',error=>pageErrors.push(String(error?.stack||error)));
  page.on('requestfailed',request=>{try{const url=new URL(request.url());if(url.origin===reviewUrl.origin&&['document','script','stylesheet'].includes(request.resourceType()))requestFailures.push(`${request.resourceType()} ${url.pathname}: ${request.failure()?.errorText||'failed'}`);}catch{}});
  const activate=locator=>profile.hasTouch?locator.tap():locator.click();
  const home=async()=>{await page.goBack({waitUntil:'domcontentloaded'});await page.locator('.review-launcher').waitFor({state:'visible',timeout:15000});};
  try{
    const directEntry=new URL('review.html',reviewUrl);directEntry.searchParams.set('source',expectedSha);directEntry.searchParams.set('profile',profile.name);
    const directResponse=await page.goto(directEntry.toString(),{waitUntil:'domcontentloaded',timeout:30000});assert.ok(directResponse?.ok());
    assert.equal(await page.title(),'輪廻転焦 Visual Review');await page.locator('.review-launcher').waitFor({state:'visible',timeout:15000});

    const entry=new URL(reviewUrl);entry.searchParams.set('source',expectedSha);entry.searchParams.set('profile',profile.name);
    const response=await page.goto(entry.toString(),{waitUntil:'domcontentloaded',timeout:30000});assert.ok(response?.ok());
    assert.equal(await page.title(),'輪廻転焦 Visual Review');await page.locator('.review-launcher').waitFor({state:'visible',timeout:15000});
    assert.equal(await page.locator('[data-review-target]').count(),5);assert.equal(await page.locator('iframe').count(),0);
    const widthOk=await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1);assert.equal(widthOk,true);

    await activate(page.locator('[data-review-target="motion"]'));await page.waitForURL(/characters\.html\?review=motion/,{waitUntil:'domcontentloaded',timeout:15000});await page.locator('main.review-app').waitFor({state:'visible',timeout:45000});await home();
    await activate(page.locator('[data-review-target="characters"]'));await page.waitForURL(/characters\.html/,{waitUntil:'domcontentloaded',timeout:15000});await page.locator('main.review-app').waitFor({state:'visible',timeout:45000});await home();
    await activate(page.locator('[data-review-target="assets"]'));await page.waitForURL(/review-assets\.html/,{waitUntil:'domcontentloaded',timeout:15000});await page.locator('body').waitFor({state:'visible'});await home();

    await activate(page.locator('[data-review-target="effects"]'));await page.waitForURL(/review-effects\.html/,{waitUntil:'domcontentloaded',timeout:15000});
    await page.locator('#fx-stage').waitFor({state:'visible',timeout:30000});
    await page.locator('#fx-status').evaluate(node=>new Promise((ok,fail)=>{const done=()=>{if(node.textContent?.includes('原本再生可能')){observer.disconnect();ok();}};const observer=new MutationObserver(done);observer.observe(node,{childList:true,subtree:true,characterData:true});done();setTimeout(()=>{observer.disconnect();fail(new Error(`VFX not ready: ${node.textContent}`));},60000);}));
    await activate(page.locator('[data-preset="finisher"]'));const effectStatus=await page.locator('#fx-status').textContent();const effectScreenshot=`effects-${profile.name}.png`;await page.screenshot({path:resolve(reportDir,effectScreenshot),fullPage:true});await home();

    await activate(page.locator('[data-review-target="battle"]'));await page.waitForURL(/review-battle\.html/,{waitUntil:'domcontentloaded',timeout:15000});
    await page.waitForFunction(()=>document.querySelector('#battle-canvas')?.dataset.battleGeometry==='runtime-models',null,{timeout:45000});
    await page.waitForFunction(()=>document.querySelector('#battle-canvas')?.dataset.battleModels==='ready',null,{timeout:90000});
    await page.waitForFunction(()=>Number.parseFloat(document.querySelector('#battle-time')?.textContent||'0')>=.2,null,{timeout:15000});
    const hero=page.locator('#battle-hero-model'),enemy=page.locator('#battle-enemy-model');assert.ok(await hero.locator('option').count()>=5);assert.ok(await enemy.locator('option').count()>=5);
    await hero.selectOption('kaykit.mage.v1');await enemy.selectOption('kaykit.barbarian.v1');
    await page.waitForFunction(()=>{const c=document.querySelector('#battle-canvas');return c?.dataset.heroModel==='kaykit.mage.v1'&&c?.dataset.enemyModel==='kaykit.barbarian.v1'&&c?.dataset.battleModels==='ready';},null,{timeout:90000});
    const modelStatus=await page.locator('#battle-model-status').textContent();assert.match(modelStatus,/Mage.*Barbarian|Barbarian.*Mage/);
    await activate(page.locator('#battle-toggle'));const pausedAt=Number.parseFloat(await page.locator('#battle-time').textContent());await page.waitForTimeout(450);const pausedAfter=Number.parseFloat(await page.locator('#battle-time').textContent());assert.ok(Math.abs(pausedAfter-pausedAt)<.11);
    await activate(page.locator('#battle-toggle'));await activate(page.locator('#battle-restart'));await page.waitForFunction(()=>Number.parseFloat(document.querySelector('#battle-time')?.textContent||'9')<.6,null,{timeout:3000});
    const battleTime=await page.locator('#battle-time').textContent(),battleResult=await page.locator('#battle-result').textContent();const heroModel=await page.locator('#battle-canvas').getAttribute('data-hero-model'),enemyModel=await page.locator('#battle-canvas').getAttribute('data-enemy-model');
    const battleScreenshot=`battle-${profile.name}.png`;await page.screenshot({path:resolve(reportDir,battleScreenshot),fullPage:true});await home();

    assert.deepEqual(pageErrors,[]);assert.deepEqual(requestFailures,[]);
    const screenshot=profile.name==='desktop'?'public.png':`public-${profile.name}.png`;await page.screenshot({path:resolve(reportDir,screenshot),fullPage:true});
    return{name:profile.name,viewport:profile.viewport,isMobile:profile.isMobile,hasTouch:profile.hasTouch,widthOk,reviewHtmlDirect:true,effectStatus,effectScreenshot,battleTime,battleResult,heroModel,enemyModel,modelStatus,battleScreenshot,pageErrors,requestFailures,screenshot};
  }catch(error){await page.screenshot({path:resolve(reportDir,`failure-${profile.name}.png`),fullPage:true}).catch(()=>{});writeFileSync(resolve(reportDir,'failure.json'),JSON.stringify({sourceSha:expectedSha,url:reviewUrl.toString(),version,profile,completedProfiles:results,pageErrors,requestFailures,failures:[String(error?.stack||error)],checkedAt:new Date().toISOString()},null,2));throw error;}finally{await context.close().catch(()=>{});}
}

try{browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-webgl','--enable-unsafe-swiftshader']});for(const profile of profiles)results.push(await verifyProfile(profile));writeFileSync(resolve(reportDir,'receipt.json'),JSON.stringify({sourceSha:expectedSha,url:reviewUrl.toString(),version,profiles:results,checkedAt:new Date().toISOString()},null,2));}finally{if(browser)await browser.close().catch(()=>{});}
console.log('VISUAL REVIEW BROWSER VERIFIED',JSON.stringify({sourceSha:expectedSha,url:reviewUrl.toString(),profiles:results.map(row=>row.name),directNavigation:true,reviewHtmlDirect:true,runtimeModels:true}));
