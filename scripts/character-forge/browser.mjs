import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';

const characterId=process.env.CHARACTER_FORGE_ID||'forge-scout';assert.match(characterId,/^[a-z0-9][a-z0-9-]{0,63}$/);
const output=resolve('test-results/character-create-forge');await mkdir(output,{recursive:true});
const head=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),errors=[];
const receipt={schemaVersion:1,head,status:'running',modelSha256:JSON.parse(await readFile('packages/assets/characters/forge/'+characterId+'/manifest.json')).model.sha256,views:{},animations:{},errors,realDevice:false};
let log='',browser,context,page;
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--config','apps/review/vite.config.js','--host','127.0.0.1','--port','5297','--strictPort'],{stdio:['ignore','pipe','pipe']});server.stdout.on('data',d=>log+=d);server.stderr.on('data',d=>log+=d);
const snapshot=()=>page.locator('#forge-stage').evaluate(c=>c.characterForgeSnapshot?.());
async function capture(name,locator=page.locator('.forge-page')){await locator.screenshot({path:join(output,name+'.png')});}
try{
  for(let i=0;i<120;i++){try{if((await fetch('http://127.0.0.1:5297/')).ok)break;}catch{}if(server.exitCode!==null)throw new Error(log);await new Promise(r=>setTimeout(r,250));}
  browser=await chromium.launch({args:['--use-angle=swiftshader','--enable-webgl','--enable-unsafe-swiftshader','--no-sandbox']});
  context=await browser.newContext({viewport:{width:1280,height:900},recordVideo:{dir:join(output,'video'),size:{width:960,height:675}}});await context.tracing.start({screenshots:true,snapshots:true});page=await context.newPage();
  await page.goto('http://127.0.0.1:5297/',{waitUntil:'domcontentloaded'});
  const link=page.locator('nav[aria-label="専用ビュー"] [data-route="forge"]');
  await expect(link).toHaveAttribute('href','http://127.0.0.1:5297/review-character-forge');
  await link.click();await expect(page).toHaveURL('http://127.0.0.1:5297/review-character-forge');
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await expect(page.locator('.forge-panel')).toHaveAttribute('data-ready','true',{timeout:60000});
  assert.ok(await snapshot(),'first candidate opens automatically');
  await expect(page.locator('.review-switcher')).toBeVisible();
  await expect(page.locator('.forge-reference-pane')).toBeHidden();
  await expect(page.locator('.review-stage-controls__button')).toHaveAttribute('aria-expanded','false');
  assert.equal((await snapshot()).comparing,false);
  const initialBox=await page.locator('#forge-stage').boundingBox();assert.ok(initialBox.y+initialBox.height<=900,'model must be visible without page scroll');
  await expect(page.locator('[data-forge-wire]')).toBeHidden();
  await expect(page.locator('[data-forge-pause]')).toBeHidden();
  assert.equal(await page.evaluate(()=>Boolean(window.masterCharacterReview)),false,'dedicated page has no legacy Character View runtime');
  await capture('overview');
  await page.locator('[data-forge-candidate="'+characterId+'"]').click();await expect(page.locator('.forge-panel')).toHaveAttribute('data-ready','true',{timeout:60000});
  await page.waitForFunction(()=>document.querySelector('.forge-readout')?.textContent.includes('comparisons'));
  await page.locator('[data-forge-compare]').click();
  for(const view of ['front','side','back']){
    await page.locator('.review-stage-controls__button').click();
    await page.locator('[data-forge-view="'+view+'"]').click();await expect(page.locator('.forge-panel')).toHaveAttribute('data-view',view);
    await page.locator('.review-stage-controls__button').click();
    await page.waitForFunction(()=>{const i=document.querySelector('[data-forge-reference]');return i.complete&&i.naturalWidth>0});
    receipt.views[view]=await snapshot();assert.equal(receipt.views[view].view,view);assert.equal(receipt.views[view].cameraPresentation.profile,'current3d');assert.equal(receipt.views[view].cameraPresentation.targetActor,characterId);const safety=receipt.views[view].screenSafety.actors[0];assert.ok(safety.screenHeight>.6&&safety.screenHeight<.99,'whole character must fit comparison');assert.ok(safety.edgeMargin>=0,'character must not be clipped');await capture(view,page.locator('.forge-comparison'));
  }
  await page.locator('.review-stage-controls__button').click();
  await page.locator('[data-forge-overlay]').check();await page.locator('[data-forge-opacity]').fill('0.35');await expect(page.locator('.forge-comparison')).toHaveAttribute('data-overlay','true');await capture('overlay',page.locator('.forge-comparison'));await page.locator('[data-forge-overlay]').uncheck();
  for(const name of ['Idle','Walk','Talk','Attack','Hit','Rest']){
    await page.locator('[data-forge-animation]').selectOption(name);const before=await snapshot();await page.waitForFunction(start=>document.querySelector('#forge-stage').characterForgeSnapshot().time>start+.1,before.time,{timeout:15000});const after=await snapshot();receipt.animations[name]={before,after};
    assert.equal(after.action,name);assert.ok(after.time>before.time);assert.notDeepEqual(after.bones,before.bones,name+' must actually animate exported bones');receipt.animations[name]={before,after};
  }
  await page.locator('[data-forge-pause]').click();const stopped=(await snapshot()).time;await page.waitForTimeout(250);assert.equal((await snapshot()).time,stopped);await page.locator('[data-forge-pause]').click();
  await page.locator('[data-forge-animation]').selectOption('Bind');await expect(page.locator('[data-forge-pause]')).toBeHidden();assert.equal((await snapshot()).action,'Bind');
  await page.locator('.review-stage-controls__button').click();
  for(const selector of ['wire','skeleton','sockets']){await page.locator('[data-forge-'+selector+']').check();await page.locator('.review-stage-controls__button').click();await capture(selector,page.locator('.canvas-wrap'));await page.locator('.review-stage-controls__button').click();await page.locator('[data-forge-'+selector+']').uncheck();}
  await page.locator('[data-forge-texture]').uncheck();await page.locator('.review-stage-controls__button').click();await capture('geometry',page.locator('.canvas-wrap'));await page.locator('.review-stage-controls__button').click();await page.locator('[data-forge-texture]').check();
  await page.locator('[data-forge-equipment]').selectOption('sword');assert.equal((await snapshot()).equipment.weapon,'sword');
  await page.locator('[data-forge-turntable]').click();await page.waitForFunction(()=>document.querySelector('#forge-stage').characterForgeSnapshot().angle>Math.PI*2,null,{timeout:30000});receipt.turntable=await snapshot();await capture('turntable',page.locator('.canvas-wrap'));await page.locator('[data-forge-turntable]').click();
  const canvas=page.locator('#forge-stage'),box=await canvas.boundingBox();const beforeOrbit=await page.locator('#forge-stage').evaluate(c=>c.characterForgeSnapshot().camera);
  await page.mouse.move(box.x+box.width*.6,box.y+box.height*.45);await page.mouse.down();await page.mouse.move(box.x+box.width*.35,box.y+box.height*.52,{steps:8});await page.mouse.up();await page.mouse.wheel(0,100);await page.waitForTimeout(200);
  receipt.camera={before:beforeOrbit,after:await page.locator('#forge-stage').evaluate(c=>c.characterForgeSnapshot().camera)};assert.notDeepEqual(receipt.camera.before,receipt.camera.after);
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(250);const columns=await page.locator('.forge-candidates').evaluate(e=>getComputedStyle(e).gridTemplateColumns.split(' ').length);assert.equal(columns,5);const mobileBox=await page.locator('#forge-stage').boundingBox();assert.ok(mobileBox.y+mobileBox.height<=844&&mobileBox.height>844*.5,'model owns the first phone viewport');await expect(page.locator('.forge-reference-pane')).toBeHidden();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'no horizontal overflow on phone');await expect(page.locator('[data-forge-wire]')).toBeHidden();await capture('mobile',page.locator('.forge-page'));
  await page.locator('[data-forge-home]').click();await expect(page).toHaveURL('http://127.0.0.1:5297/');await expect(page.locator('nav[aria-label="専用ビュー"] [data-route="forge"]')).toBeVisible();
  assert.deepEqual(errors,[]);receipt.status='passed';
}catch(error){receipt.status='failed';receipt.failure=error.stack;receipt.lastUI=await Promise.race([page?.evaluate(()=>({phase:document.querySelector('.forge-panel')?.dataset.capturePhase,view:document.querySelector('.forge-panel')?.dataset.view})).catch(()=>null),new Promise(r=>setTimeout(()=>r('unresponsive'),2000))]);throw error;}
finally{
  await writeFile(join(output,'playtest-receipt.json'),JSON.stringify(receipt,null,2));
  await context?.tracing.stop({path:join(output,'trace.zip')}).catch(()=>{});await context?.close();await browser?.close();server.kill('SIGTERM');await writeFile(join(output,'preview.log'),log);
  console.log('FORGE_BROWSER_RECEIPT '+JSON.stringify(receipt));
  for(const name of ['overview','front','side','back','geometry','turntable','mobile']){try{const bytes=await readFile(join(output,name+'.png'));if(bytes.length<200000)console.log('FORGE_BROWSER_MEDIA '+JSON.stringify({name:name+'.png',sha256:createHash('sha256').update(bytes).digest('hex'),base64:bytes.toString('base64')}));}catch{}}
}


