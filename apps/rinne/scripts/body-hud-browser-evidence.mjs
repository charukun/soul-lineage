import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {chromium,expect} from '@playwright/test';

const [base,sha,phase='after',output='.artifacts/body-hud']=process.argv.slice(2);
assert.match(new URL(base).host,/^[a-f0-9]{8}-soul-lineage-rinne-dev\./,'Immutable Worker Version Preview is required');
const {verifyPublishedApp}=await import(pathToFileURL(path.resolve('scripts/verify-published-app.mjs')));
const source=await verifyPublishedApp({url:base,app:'rinne',sha});
fs.mkdirSync(output,{recursive:true});
const receipt={phase,source,immutableUrl:base,route:'/review-battle',screenshots:[],checks:[],consoleErrors:[],networkFailures:[],nativeHits:[]};
const browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-webgl','--enable-unsafe-swiftshader']});
const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,hasTouch:true,recordVideo:{dir:path.join(output,'video'),size:{width:390,height:844}}});
await context.tracing.start({screenshots:true,snapshots:true,sources:true});
const page=await context.newPage();
page.on('pageerror',error=>receipt.consoleErrors.push(error.message));
page.on('requestfailed',request=>receipt.networkFailures.push({url:request.url(),failure:request.failure()?.errorText}));
async function screenshot(name){const file=`${phase}-${name}.png`;await page.screenshot({path:path.join(output,file)});receipt.screenshots.push(file);}
async function controls(open){
  const button=page.getByRole('button',{name:'表示・再生コントロール',exact:true});
  await expect(button).toBeVisible();
  if((await button.getAttribute('aria-expanded')==='true')!==open)await button.click();
}
async function preset(value){
  await controls(true);
  const settings=page.locator('details.review-settings');
  if(await settings.evaluate(node=>!node.open))await settings.locator(':scope > summary').click();
  await page.locator('#battle-injury-preset').selectOption(value);
  await controls(false);
}
async function bounds(label){
  const result=await page.evaluate(()=>{
    const root=document.querySelector('#battle-body-hud'),stage=root.closest('.stage'),detail=root.querySelector('.combat-body-hud__detail');
    const rect=node=>{const r=node.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
    return{viewport:{width:innerWidth,height:innerHeight},hud:rect(root),stage:rect(stage),detail:detail.hidden?null:rect(detail),parts:[...root.querySelectorAll('[data-body-part]')].map(node=>({id:node.dataset.bodyPart,...rect(node)})),documentOverflow:document.documentElement.scrollWidth>innerWidth+1};
  });
  if(phase!=='before'){
    assert.ok(result.hud.x>=result.stage.x&&result.hud.x-result.stage.x<28,'HUD is not in upper-left');
    assert.ok(result.hud.y>=result.stage.y&&result.hud.y-result.stage.y<28,'HUD top offset');
    assert.ok(result.parts.every(p=>p.width>=24&&p.height>=24),'Small touch target');
    if(result.detail){const r=result.detail;assert.ok(r.x>=-1&&r.y>=-1&&r.right<=result.viewport.width+1&&r.bottom<=result.viewport.height+1,'Detail leaves viewport');assert.ok(r.right<=result.stage.right+1&&r.bottom<=result.stage.bottom+1,'Detail leaves stage');}
    assert.equal(result.documentOverflow,false,'Horizontal page overflow');
  }
  receipt.checks.push({label,...result});
}
try{
  await page.goto(new URL('/review-battle',base).href,{waitUntil:'domcontentloaded'});
  const start=page.getByRole('button',{name:/タップ.*開始|開始.*タップ/});
  if(await start.count()&&await start.first().isVisible())await start.first().click();
  await expect(page.locator('#battle-body-hud [data-body-part]')).toHaveCount(6,{timeout:90000});
  await page.waitForFunction(()=>{
    const canvas=document.querySelector('#battle-canvas'),text=document.querySelector('#battle-model-status')?.textContent||'';
    return canvas?.dataset.battleModels==='failed'||(canvas?.width>0&&!/準備中|読込中|読み込み/.test(text)&&text.length>0);
  },null,{timeout:120000});
  assert.notEqual(await page.locator('#battle-canvas').getAttribute('data-battle-models'),'failed','Native models failed');
  receipt.modelStatus=await page.locator('#battle-model-status').textContent();
  receipt.canvas=await page.locator('#battle-canvas').evaluate(node=>({width:node.width,height:node.height,dataset:{...node.dataset}}));
  for(const viewport of [{width:390,height:844},{width:320,height:740},{width:844,height:390},{width:1280,height:800}]){
    await page.setViewportSize(viewport);await preset('none');
    await expect(page.locator('#battle-body-hud [data-body-part="head"]')).toHaveAttribute('data-stage','正常');
    await bounds(`normal-${viewport.width}`);await screenshot(`normal-${viewport.width}`);
    if(phase==='before'&&viewport.width!==390)continue;
    await preset(phase==='before'?'rightArm':'body-stages');
    const selector=phase==='before'?'rightArm':'leftLeg';
    await page.locator(`#battle-body-hud [data-body-part="${selector}"]`).click();
    await expect(page.locator('.combat-body-hud__detail')).toBeVisible();
    await bounds(`detail-${viewport.width}`);await screenshot(`detail-${viewport.width}`);
    await page.getByRole('button',{name:'身体部位詳細を閉じる',exact:true}).click();
    await expect(page.locator('.combat-body-hud__detail')).toBeHidden();
  }
  if(phase!=='before'){
    await page.setViewportSize({width:390,height:844});await preset('body-stages');
    const expected={head:'正常',torso:'軽傷',leftArm:'負傷',rightArm:'重傷',leftLeg:'機能不全',rightLeg:'正常'};
    for(const [part,stage] of Object.entries(expected)){
      const button=page.locator(`#battle-body-hud [data-body-part="${part}"]`);
      await expect(button).toHaveAttribute('data-stage',stage);await button.click();
      await expect(page.locator('.combat-body-hud__stage')).toContainText(stage);
      await bounds(`part-${part}`);await screenshot(`part-${part}`);
      await page.keyboard.press('Escape');await expect(page.locator('.combat-body-hud__detail')).toBeHidden();
    }
    await page.locator('.combat-body-hud__summary').click();await expect(page.locator('.combat-body-hud__title')).toHaveText('左脚');
    await page.locator('#battle-canvas').click({position:{x:250,y:360}});await expect(page.locator('.combat-body-hud__detail')).toBeHidden();
    await screenshot('mixed-closed');
    await preset('none');
    await page.evaluate(()=>{
      window.__nativeHudHits=[];
      const root=document.querySelector('#battle-body-hud');
      new MutationObserver(records=>{for(const record of records){const n=record.target;if(record.attributeName==='data-hit'&&n.dataset.hit==='true')window.__nativeHudHits.push({part:n.dataset.bodyPart,stage:n.dataset.stage,at:performance.now()});}}).observe(root,{subtree:true,attributes:true,attributeFilter:['data-hit']});
    });
    await page.waitForFunction(()=>window.__nativeHudHits.length>0,null,{timeout:90000});
    await screenshot('native-hit');
    await page.waitForFunction(()=>!document.querySelector('#battle-body-hud [data-hit="true"]'),null,{timeout:10000});
    await screenshot('native-hit-settled');receipt.nativeHits=await page.evaluate(()=>window.__nativeHudHits);
    await page.emulateMedia({reducedMotion:'reduce'});await preset('body-stages');await screenshot('reduced-motion');
    receipt.checks.push({label:'all-six-selection-close-escape-outside',passed:true},{label:'native-combat-hit-and-settle',passed:true});
  }
  assert.equal(receipt.consoleErrors.length,0,`Runtime errors: ${receipt.consoleErrors.join('; ')}`);
  receipt.result='passed';
}catch(error){receipt.result='failed';receipt.error=error.stack;await screenshot('failure');throw error;}
finally{
  fs.writeFileSync(path.join(output,'receipt.json'),JSON.stringify(receipt,null,2));
  await context.tracing.stop({path:path.join(output,'trace.zip')});await context.close();await browser.close();
}
