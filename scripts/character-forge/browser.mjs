import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';

const output=resolve('test-results/character-create-forge');await mkdir(output,{recursive:true});
const head=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),errors=[];
const receipt={schemaVersion:1,head,status:'running',modelSha256:JSON.parse(await readFile('packages/assets/characters/forge/forge-scout/manifest.json')).model.sha256,views:{},animations:{},errors,realDevice:false};
let log='',browser,context,page;
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--config','apps/character-studio/vite.config.js','--host','127.0.0.1','--port','5297','--strictPort'],{stdio:['ignore','pipe','pipe']});server.stdout.on('data',d=>log+=d);server.stderr.on('data',d=>log+=d);
const snapshot=()=>page.locator('#stage').evaluate(c=>c.characterForgeSnapshot?.());
async function capture(name,locator=page.locator('.forge-panel')){await locator.screenshot({path:join(output,name+'.png')});}
try{
  for(let i=0;i<120;i++){try{if((await fetch('http://127.0.0.1:5297/')).ok)break;}catch{}if(server.exitCode!==null)throw new Error(log);await new Promise(r=>setTimeout(r,250));}
  browser=await chromium.launch({args:['--use-angle=swiftshader','--enable-webgl','--enable-unsafe-swiftshader','--no-sandbox']});
  context=await browser.newContext({viewport:{width:1280,height:900},recordVideo:{dir:join(output,'video'),size:{width:960,height:675}}});await context.tracing.start({screenshots:true,snapshots:true});page=await context.newPage();
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto('http://127.0.0.1:5297/',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.masterCharacterReview?.ready,null,{timeout:90000});
  await page.locator('[data-forge-candidate="forge-scout"]').click();await expect(page.locator('.forge-panel')).toHaveAttribute('data-ready','true',{timeout:60000});
  await page.waitForFunction(()=>document.querySelector('.forge-readout')?.textContent.includes('comparisons'));
  for(const view of ['front','side','back']){
    await page.locator('[data-forge-view="'+view+'"]').click();await expect(page.locator('.forge-panel')).toHaveAttribute('data-view',view);
    await page.waitForFunction(()=>[...document.querySelectorAll('.forge-comparison img')].every(i=>i.complete&&i.naturalWidth>0));
    receipt.views[view]=await snapshot();assert.equal(receipt.views[view].view,view);assert.equal(receipt.views[view].cameraPresentation.profile,'current3d');assert.equal(receipt.views[view].cameraPresentation.targetActor,'forge-scout');await capture(view,page.locator('.forge-comparison'));
  }
  await page.locator('[data-forge-overlay]').check();await page.locator('[data-forge-opacity]').fill('.35');await expect(page.locator('.forge-comparison')).toHaveAttribute('data-overlay','true');await capture('overlay',page.locator('.forge-comparison'));await page.locator('[data-forge-overlay]').uncheck();
  for(const name of ['Idle','Walk','Talk','Attack','Hit','Rest']){
    await page.locator('[data-forge-animation]').selectOption(name);const before=await snapshot();await page.waitForTimeout(230);const after=await snapshot();
    assert.equal(after.action,name);assert.ok(after.time>before.time);assert.notDeepEqual(after.bones,before.bones,name+' must actually animate exported bones');receipt.animations[name]={before,after};
  }
  for(const selector of ['wire','skeleton','sockets']){await page.locator('[data-forge-'+selector+']').check();await capture(selector,page.locator('.canvas-wrap'));await page.locator('[data-forge-'+selector+']').uncheck();}
  await page.locator('[data-forge-texture]').uncheck();await capture('geometry',page.locator('.canvas-wrap'));await page.locator('[data-forge-texture]').check();
  await page.locator('[data-forge-equipment]').selectOption('sword');assert.equal((await snapshot()).equipment.weapon,'sword');
  await page.locator('[data-forge-turntable]').click();await page.waitForFunction(()=>document.querySelector('#stage').characterForgeSnapshot().angle>Math.PI*2,null,{timeout:30000});receipt.turntable=await snapshot();await capture('turntable',page.locator('.canvas-wrap'));await page.locator('[data-forge-turntable]').click();
  const canvas=page.locator('#stage'),box=await canvas.boundingBox();const beforeOrbit=await page.evaluate(()=>window.masterCharacterReview.presentationStage.camera.position.toArray());
  await page.mouse.move(box.x+box.width*.6,box.y+box.height*.45);await page.mouse.down();await page.mouse.move(box.x+box.width*.35,box.y+box.height*.52,{steps:8});await page.mouse.up();await page.mouse.wheel(0,100);await page.waitForTimeout(200);
  receipt.camera={before:beforeOrbit,after:await page.evaluate(()=>window.masterCharacterReview.presentationStage.camera.position.toArray())};assert.notDeepEqual(receipt.camera.before,receipt.camera.after);
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(250);const columns=await page.locator('.forge-candidates').evaluate(e=>getComputedStyle(e).gridTemplateColumns.split(' ').length);assert.equal(columns,5);await capture('mobile',page.locator('.forge-panel'));
  await page.locator('[data-forge-exit]').click();assert.equal(await snapshot(),null);await page.waitForFunction(()=>window.masterCharacterReview.actors.some(a=>a.root.visible));
  assert.deepEqual(errors,[]);receipt.status='passed';
}catch(error){receipt.status='failed';receipt.failure=error.stack;throw error;}
finally{
  await writeFile(join(output,'playtest-receipt.json'),JSON.stringify(receipt,null,2));
  await context?.tracing.stop({path:join(output,'trace.zip')}).catch(()=>{});await context?.close();await browser?.close();server.kill('SIGTERM');await writeFile(join(output,'preview.log'),log);
  console.log('FORGE_BROWSER_RECEIPT '+JSON.stringify(receipt));
  for(const name of ['front','side','back','geometry','turntable']){try{const bytes=await readFile(join(output,name+'.png'));if(bytes.length<200000)console.log('FORGE_BROWSER_MEDIA '+JSON.stringify({name:name+'.png',sha256:createHash('sha256').update(bytes).digest('hex'),base64:bytes.toString('base64')}));}catch{}}
}
