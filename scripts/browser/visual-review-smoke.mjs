import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {chromium} from '@playwright/test';

const reviewUrl=new URL(process.argv[2]||process.env.REVIEW_URL||'https://rinne-visual-review.c-okamoto.workers.dev/');
const expectedSha=process.argv[3]||process.env.SOURCE_SHA||'';
assert.match(expectedSha,/^[0-9a-f]{40}$/,'Visual Review smoke requires the exact 40-character source SHA');

const reportDir=resolve(process.env.VISUAL_REVIEW_REPORT_DIR||'test-results/visual-review');
mkdirSync(reportDir,{recursive:true});
const versionUrl=new URL('version.json',reviewUrl);versionUrl.searchParams.set('source',expectedSha);
const versionResponse=await fetch(versionUrl,{signal:AbortSignal.timeout(20000)});
assert.equal(versionResponse.status,200,`Visual Review version.json returned HTTP ${versionResponse.status}`);
const version=await versionResponse.json();
assert.equal(version.commit,expectedSha,`Visual Review is stale: expected ${expectedSha}, got ${version.commit||'missing'}`);
assert.equal(version.app,'rinne','Visual Review version.json is not the RINNE bundle');
assert.equal(version.environment,'dev','Visual Review must be built from the DEV environment');

const profiles=[
  {name:'desktop',viewport:{width:1280,height:900},isMobile:false,hasTouch:false},
  {name:'mobile',viewport:{width:390,height:844},isMobile:true,hasTouch:true},
];
const results=[];let browser;

async function verifyProfile(profile){
  const pageErrors=[],requestFailures=[];
  const context=await browser.newContext({viewport:profile.viewport,isMobile:profile.isMobile,hasTouch:profile.hasTouch,deviceScaleFactor:1});
  const page=await context.newPage();
  page.on('pageerror',error=>pageErrors.push(String(error?.stack||error)));
  page.on('requestfailed',request=>{try{const url=new URL(request.url());if(url.origin===reviewUrl.origin&&['document','script','stylesheet'].includes(request.resourceType()))requestFailures.push(`${request.resourceType()} ${url.pathname}: ${request.failure()?.errorText||'failed'}`);}catch{}});
  const activate=locator=>profile.hasTouch?locator.tap():locator.click();
  const back=async()=>{await activate(page.locator('#focus-back'));await page.locator('#review-home').waitFor({state:'visible',timeout:10000});assert.equal(await page.locator('body').getAttribute('data-review-mode'),'chooser');};
  try{
    const entry=new URL(reviewUrl);entry.searchParams.set('source',expectedSha);entry.searchParams.set('profile',profile.name);
    const response=await page.goto(entry.toString(),{waitUntil:'domcontentloaded',timeout:30000});
    assert.ok(response?.ok(),`Visual Review ${profile.name} entry returned HTTP ${response?.status()??'unknown'}`);
    assert.equal(await page.title(),'輪廻転焦 Visual Review');
    await page.locator('.review-shell').waitFor({state:'visible',timeout:15000});
    await page.waitForFunction(prefix=>document.querySelector('#build-source')?.textContent?.includes(prefix),expectedSha.slice(0,12),{timeout:15000});
    assert.equal(await page.locator('body').getAttribute('data-review-mode'),'chooser');
    assert.equal(await page.locator('.review-launcher [data-view]').count(),5,`Visual Review ${profile.name} chooser is incomplete`);
    const widthOk=await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1);assert.equal(widthOk,true,`Visual Review ${profile.name} layout overflows the viewport`);

    const contextButtons=page.locator('[data-app-context]');assert.equal(await contextButtons.count(),3,`Visual Review ${profile.name} app contexts are incomplete`);
    await activate(page.locator('[data-app-context="village"]'));assert.ok(await page.locator('[data-app-context="village"]').evaluate(node=>node.classList.contains('active')),`Visual Review ${profile.name} app context did not switch`);

    await activate(page.locator('[data-view="motion"]'));
    await page.locator('#focus-shell').waitFor({state:'visible',timeout:10000});
    assert.equal(await page.locator('#review-home').isHidden(),true,`Visual Review ${profile.name} chooser remained visible in focused mode`);
    assert.equal(await page.locator('body').getAttribute('data-review-target'),'motion');
    const focusHeight=await page.locator('[data-panel="motion"]').evaluate(node=>node.getBoundingClientRect().height);
    assert.ok(focusHeight>=profile.viewport.height*.72,`Visual Review ${profile.name} focused tool is too short (${focusHeight}px)`);
    const motionContent=page.frameLocator('[data-panel="motion"] iframe');await motionContent.locator('main.review-app').waitFor({state:'visible',timeout:45000});
    assert.match(await motionContent.locator('body').evaluate(()=>document.title),/キャラクター工房/);await back();

    await activate(page.locator('[data-view="characters"]'));
    const charactersContent=page.frameLocator('[data-panel="characters"] iframe');await charactersContent.locator('main.review-app').waitFor({state:'visible',timeout:45000});await back();

    await activate(page.locator('[data-view="assets"]'));
    await page.waitForFunction(()=>document.querySelector('[data-panel="assets"] iframe')?.getAttribute('src')?.includes('review-assets.html'),null,{timeout:10000});await back();

    await activate(page.locator('[data-view="effects"]'));
    const effectsContent=page.frameLocator('[data-panel="effects"] iframe');
    await effectsContent.locator('#fx-stage').waitFor({state:'visible',timeout:30000});
    await effectsContent.locator('#fx-status').evaluate(node=>new Promise((resolve,reject)=>{const done=()=>{if(node.textContent?.includes('原本再生可能')){observer.disconnect();resolve();}};const observer=new MutationObserver(done);observer.observe(node,{childList:true,subtree:true,characterData:true});done();setTimeout(()=>{observer.disconnect();reject(new Error(`Authored VFX did not become ready: ${node.textContent}`));},60000);}));
    await activate(effectsContent.locator('[data-preset="finisher"]'));
    await effectsContent.locator('#fx-metrics').evaluate(node=>new Promise((resolve,reject)=>{const done=()=>{const match=node.textContent?.match(/played (\d+)/);if(match&&Number(match[1])>0){observer.disconnect();resolve();}};const observer=new MutationObserver(done);observer.observe(node,{childList:true,subtree:true,characterData:true});done();setTimeout(()=>{observer.disconnect();reject(new Error(`Authored VFX never played: ${node.textContent}`));},15000);}));
    const effectStatus=await effectsContent.locator('#fx-status').textContent(),effectMetrics=await effectsContent.locator('#fx-metrics').textContent();
    const effectScreenshot=`effects-${profile.name}.png`;await page.screenshot({path:resolve(reportDir,effectScreenshot),fullPage:true});await back();

    await activate(page.locator('[data-view="battle"]'));
    await page.locator('[data-panel="battle"]').waitFor({state:'visible',timeout:10000});
    await page.waitForFunction(()=>document.querySelector('#battle-canvas')?.dataset.battleGeometry==='runtime-models',null,{timeout:45000});
    await page.waitForFunction(()=>document.querySelector('#battle-canvas')?.dataset.battleModels==='ready',null,{timeout:90000});
    await page.waitForFunction(()=>Number.parseFloat(document.querySelector('#battle-time')?.textContent||'0')>=.2,null,{timeout:15000});
    const heroSelect=page.locator('#battle-hero-model'),enemySelect=page.locator('#battle-enemy-model');
    assert.ok(await heroSelect.locator('option').count()>=5,`Visual Review ${profile.name} hero model choices are incomplete`);
    assert.ok(await enemySelect.locator('option').count()>=5,`Visual Review ${profile.name} enemy model choices are incomplete`);
    await heroSelect.selectOption('kaykit.mage.v1');await enemySelect.selectOption('kaykit.barbarian.v1');
    await page.waitForFunction(()=>{const canvas=document.querySelector('#battle-canvas');return canvas?.dataset.heroModel==='kaykit.mage.v1'&&canvas?.dataset.enemyModel==='kaykit.barbarian.v1'&&canvas?.dataset.battleModels==='ready';},null,{timeout:90000});
    const modelStatus=await page.locator('#battle-model-status').textContent();assert.match(modelStatus,/Mage.*Barbarian|Barbarian.*Mage/);
    await activate(page.locator('#battle-toggle'));const pausedAt=Number.parseFloat(await page.locator('#battle-time').textContent());await page.waitForTimeout(450);const pausedAfter=Number.parseFloat(await page.locator('#battle-time').textContent());assert.ok(Math.abs(pausedAfter-pausedAt)<.11,`Visual Review ${profile.name} pause did not stop battle time`);
    await activate(page.locator('#battle-toggle'));await activate(page.locator('#battle-restart'));await page.waitForFunction(()=>Number.parseFloat(document.querySelector('#battle-time')?.textContent||'9')<.6,null,{timeout:3000});
    const battleTime=await page.locator('#battle-time').textContent(),battleResult=await page.locator('#battle-result').textContent();
    const heroModel=await page.locator('#battle-canvas').getAttribute('data-hero-model'),enemyModel=await page.locator('#battle-canvas').getAttribute('data-enemy-model');

    assert.deepEqual(pageErrors,[],`Visual Review ${profile.name} page errors: ${pageErrors.join('\n')}`);
    assert.deepEqual(requestFailures,[],`Visual Review ${profile.name} critical request failures: ${requestFailures.join('\n')}`);
    const screenshot=profile.name==='desktop'?'public.png':`public-${profile.name}.png`;await page.screenshot({path:resolve(reportDir,screenshot),fullPage:true});
    return{name:profile.name,viewport:profile.viewport,isMobile:profile.isMobile,hasTouch:profile.hasTouch,input:profile.hasTouch?'tap':'click',widthOk,focusHeight,effectStatus,effectMetrics,effectScreenshot,battleTime,battleResult,heroModel,enemyModel,modelStatus,pageErrors,requestFailures,screenshot};
  }catch(error){
    const failure=String(error?.stack||error);await page.screenshot({path:resolve(reportDir,`failure-${profile.name}.png`),fullPage:true}).catch(()=>{});
    writeFileSync(resolve(reportDir,'failure.json'),JSON.stringify({sourceSha:expectedSha,url:reviewUrl.toString(),version,profile,completedProfiles:results,pageErrors,requestFailures,failures:[failure],checkedAt:new Date().toISOString()},null,2));throw error;
  }finally{await context.close().catch(()=>{});}
}

try{
  browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-webgl','--enable-unsafe-swiftshader']});
  for(const profile of profiles)results.push(await verifyProfile(profile));
  const desktop=results.find(result=>result.name==='desktop')||results[0];
  writeFileSync(resolve(reportDir,'receipt.json'),JSON.stringify({sourceSha:expectedSha,url:reviewUrl.toString(),version,authoredVfx:{status:desktop?.effectStatus||null,metrics:desktop?.effectMetrics||null},battle:{time:desktop?.battleTime||null,result:desktop?.battleResult||null,heroModel:desktop?.heroModel||null,enemyModel:desktop?.enemyModel||null,modelStatus:desktop?.modelStatus||null},pageErrors:results.flatMap(result=>result.pageErrors),requestFailures:results.flatMap(result=>result.requestFailures),profiles:results,checkedAt:new Date().toISOString()},null,2));
}finally{if(browser)await browser.close().catch(()=>{});}

console.log('VISUAL REVIEW BROWSER VERIFIED',JSON.stringify({sourceSha:expectedSha,url:reviewUrl.toString(),profiles:results.map(result=>result.name),authoredVfx:true,runtimeModels:true,focusFlow:true}));
