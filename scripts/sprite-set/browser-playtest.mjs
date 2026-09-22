import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createWriteStream} from 'node:fs';
import {spawn,execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {chromium} from '@playwright/test';

const sha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),out=`.deploy-state/sprite-set-browser-${sha}`;
await mkdir(out,{recursive:true});
const receipt={schema:'rinne.sprite-set-browser-evidence/v1',sourceSha:sha,execution:'headed-equivalent Chromium / software WebGL, real UI inputs',physicalDevice:false,steps:[],errors:[],pass:false};
const servers=[],logs=[],videos=[];let browser,context,review,rinne;
async function start(app,port){
  const log=createWriteStream(`${out}/${app}-server.log`),server=spawn('npm',['run','preview','--workspace','@soul/'+app],{env:{...process.env,APP_ENV:'dev'},detached:true,stdio:['ignore','pipe','pipe']});server.stdout.pipe(log);server.stderr.pipe(log);servers.push(server);logs.push(log);
  for(let i=0;i<120;i++){try{const response=await fetch(`http://127.0.0.1:${port}/version.json`);if(response.ok){const version=await response.json();assert.equal(version.commit,sha);receipt[app+'Version']=version;return;}}catch(error){if(error.code==='ERR_ASSERTION')throw error;}await new Promise(r=>setTimeout(r,500));}throw new Error(app+' preview did not start');
}
const stage=()=>review.locator('.sprite-set-stage canvas');
const state=()=>stage().evaluate(canvas=>canvas.spriteSetSnapshot());
const gameState=()=>rinne.locator('#game').evaluate(canvas=>canvas.spriteSetSnapshot?.()||null);
const note=(label,snapshot)=>receipt.steps.push({label,snapshot,at:new Date().toISOString()});
async function screenshot(page,name,selector){await (selector?page.locator(selector):page).screenshot({path:`${out}/${name}.png`});}
async function cameraInput(degrees){const input=review.locator('[data-sprite-camera]');await input.scrollIntoViewIfNeeded();const box=await input.boundingBox();await review.mouse.click(box.x+8+(box.width-16)*(degrees+180)/360,box.y+box.height/2);await review.waitForTimeout(200);}
async function actionInReview(action){
  await review.locator(`[data-sprite-action="${action}"]`).click();
  await review.waitForFunction(a=>document.querySelector('.sprite-set-stage canvas')?.spriteSetSnapshot().actor?.action===a,action);
  if(['jump','fall','vault'].includes(action))await review.waitForFunction(()=>document.querySelector('.sprite-set-stage canvas').spriteSetSnapshot().sandbox.airHeight>.05);
  else await review.waitForFunction(()=>document.querySelector('.sprite-set-stage canvas').spriteSetSnapshot().actor.frame>=2);
  const snapshot=await state();note('review:'+action,snapshot);await screenshot(review,'review-'+action,'.sprite-set-stage canvas');
}
try{
  for(const app of ['review','rinne'])assert.equal(JSON.parse(await readFile(`dist/${app}/version.json`,'utf8')).commit,sha);
  await start('review',5276);await start('rinne',5273);
  browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  context=await browser.newContext({viewport:{width:1280,height:900},reducedMotion:'reduce',recordVideo:{dir:out+'/video',size:{width:1280,height:900}}});
  context.on('page',page=>{page.on('pageerror',error=>receipt.errors.push({url:page.url(),kind:'pageerror',message:error.message}));page.on('console',message=>{if(message.type()==='error')receipt.errors.push({url:page.url(),kind:'console',message:message.text()});});});
  await context.tracing.start({screenshots:true,snapshots:true,sources:true});
  review=await context.newPage();review.setDefaultTimeout(30000);videos.push(['review-motion',review.video()]);
  await review.goto('http://127.0.0.1:5276/review-hybrid-25d',{waitUntil:'networkidle'});
  await review.locator('[data-sprite-sample]').click();await review.waitForFunction(()=>document.querySelector('.sprite-set-playground')?.dataset.spriteReady==='true');
  assert.equal((await state()).actor.decodedImages,13);note('static sample loaded',await state());
  const fixture='apps/review/public/sprite-sets/kaykit-knight/',manifest=JSON.parse(await readFile(fixture+'manifest.json','utf8'));
  const files=[fixture+'manifest.json',...Object.values(manifest.assets).map(a=>fixture+a.file)];
  await review.locator('[data-sprite-import]').setInputFiles(files);await review.waitForFunction(()=>document.querySelector('.sprite-set-playground').dataset.busy==='false');assert.equal((await state()).actor.id,manifest.id);note('manifest + 13 PNG file import',await state());
  const downloadPromise=review.waitForEvent('download');await review.locator('[data-sprite-export]').click();const download=await downloadPromise;const bundlePath=await download.path();
  await review.locator('[data-sprite-import]').setInputFiles({name:'round-trip.sprite-set.json',mimeType:'application/json',buffer:await readFile(bundlePath)});await review.waitForFunction(()=>document.querySelector('.sprite-set-playground').dataset.busy==='false');assert.equal((await state()).actor.decodedImages,13);note('bundle round trip',await state());
  const corrupt=JSON.parse(await readFile(bundlePath,'utf8'));corrupt.manifest.assets.idle.sha256='0'.repeat(64);corrupt.manifest.assets.idle.provenance.importedFileSha256='0'.repeat(64);
  await review.locator('[data-sprite-import]').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(corrupt))});await review.waitForFunction(()=>document.querySelector('.sprite-set-playground').dataset.busy==='false');assert.match(await review.locator('[data-sprite-status]').textContent(),/hash/);assert.equal((await state()).actor.id,manifest.id);note('corrupt image hash rejected without replacing live actor',await state());
  await review.locator('[data-sprite-reset]').click();await review.locator('[data-sprite-direction]').selectOption('auto');
  const views=[];for(const degrees of [0,45,90,135,180,-135,-90,-45]){await cameraInput(degrees);const snapshot=await state();views.push(snapshot.actor.view);note('camera '+degrees,snapshot);await screenshot(review,'view-'+snapshot.actor.view,'.sprite-set-stage canvas');}
  assert.equal(new Set(views).size,8);await cameraInput(0);
  for(const action of Object.keys(manifest.actions))await actionInReview(action);
  assert.ok(receipt.steps.find(s=>s.label==='review:walk').snapshot.sandbox.distanceTravelled>0);
  assert.ok(receipt.steps.find(s=>s.label==='review:jump').snapshot.sandbox.airHeight>.05);
  await review.locator('[data-sprite-action="rest"]').click();await review.locator('[data-sprite-pause]').click();const paused=await state();await review.waitForTimeout(350);assert.equal((await state()).actor.time,paused.actor.time);await review.locator('[data-sprite-pause]').click();note('pause/resume froze the animation clock',paused);
  await review.locator('[data-sprite-loop]').selectOption('once');await review.locator('[data-sprite-action="attack"]').click();await review.waitForFunction(()=>document.querySelector('.sprite-set-stage canvas').spriteSetSnapshot().actor.completed);const ended=await state();await review.waitForTimeout(200);assert.equal((await state()).actor.frame,ended.actor.frame);note('one-shot end hold',ended);
  await review.locator('[data-sprite-loop]').selectOption('loop');await review.locator('[data-sprite-action="attack"]').click();await review.waitForFunction(()=>document.querySelector('.sprite-set-stage canvas').spriteSetSnapshot().actor.cycle>=1);assert.equal((await state()).actor.completed,false);note('explicit loop override',await state());await review.locator('[data-sprite-loop]').selectOption('default');
  const popup=review.waitForEvent('popup');await review.locator('[data-sprite-rinne]').click();rinne=await popup;rinne.setDefaultTimeout(60000);videos.push(['rinne-motion',rinne.video()]);await rinne.waitForLoadState('domcontentloaded');await rinne.bringToFront();
  await rinne.mouse.click(640,350);await rinne.waitForTimeout(500);
  await rinne.locator('#title-screen[data-ready="true"]').waitFor({timeout:120000});
  if(await rinne.locator('#title-screen').getAttribute('data-intro')!=='idle'){await rinne.mouse.click(640,350);await rinne.waitForTimeout(500);}
  await rinne.locator('#new-life').click();
  for(let step=0;step<3;step++){await rinne.locator(`.family-origin[data-step="${step}"][data-answering="false"] [data-memory-current]`).click();}
  await rinne.locator('[data-origin-confirm]').click();await rinne.locator('#game-screen[data-runtime="active"]').waitFor({timeout:120000});
  await rinne.waitForFunction(()=>document.querySelector('#game')?.spriteSetSnapshot?.()?.visible===true,null,{timeout:120000});
  await screenshot(rinne,'rinne-village-entry');note('RINNE entered through normal family/new-life controls',await gameState());
  // Real pointer movement input, not a synthetic state teleport or mocked runtime.
  const box=await rinne.locator('#game').boundingBox();await rinne.mouse.move(box.x+box.width*.48,box.y+box.height*.42);await rinne.mouse.down();await rinne.mouse.move(box.x+box.width*.63,box.y+box.height*.35,{steps:12});await rinne.waitForTimeout(300);await rinne.mouse.up();
  for(const action of ['idle','walk','run','turn','attack','hit','talk','pickup','rest','jump','fall','vault','climb']){
    await review.locator(`[data-sprite-action="${action}"]`).click();await rinne.bringToFront();
    await rinne.waitForFunction(a=>document.querySelector('#game')?.spriteSetSnapshot?.()?.actor.action===a,action);
    if(['jump','fall','vault'].includes(action))await rinne.waitForFunction(()=>document.querySelector('#game').spriteSetSnapshot().sandbox.airHeight>.05);
    else await rinne.waitForFunction(()=>document.querySelector('#game').spriteSetSnapshot().actor.frame>=2);
    const snapshot=await gameState();assert.equal(snapshot.visible,true);assert.ok([snapshot.actor.position.x,snapshot.actor.position.y,snapshot.actor.position.z].every(Number.isFinite));note('rinne:'+action,snapshot);await screenshot(rinne,'rinne-'+action,'#game');
  }
  const moving=receipt.steps.filter(s=>['rinne:walk','rinne:run'].includes(s.label));assert.ok(moving.every(s=>s.snapshot.sandbox.distanceTravelled>0));
  await review.locator('[data-sprite-action="rest"]').click();await rinne.bringToFront();await rinne.waitForFunction(()=>document.querySelector('#game').spriteSetSnapshot().actor.action==='rest');
  await rinne.evaluate(()=>window.postMessage({type:'rinne.sprite-set.command',token:new URLSearchParams(location.search).get('spriteTransfer'),command:'action',action:'attack'},location.origin));await rinne.waitForTimeout(350);assert.equal((await gameState()).actor.action,'rest');note('self-window command rejected',await gameState());
  assert.equal(await rinne.evaluate(id=>Object.keys(localStorage).some(key=>String(localStorage.getItem(key)).includes(id)),manifest.id),false);
  const legacy=await context.newPage();await legacy.goto('http://127.0.0.1:5276/review-hybrid-25d?legacy25d=1',{waitUntil:'networkidle'});await legacy.locator('.character25d-forge').waitFor();await legacy.locator('.hybrid25d-lab').waitFor();await screenshot(legacy,'legacy-route');note('legacy Forge/coexistence route mounts',true);await legacy.close();
  const mobile=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,reducedMotion:'reduce'}),phone=await mobile.newPage();phone.on('pageerror',error=>receipt.errors.push({kind:'mobile-pageerror',message:error.message}));
  await phone.goto('http://127.0.0.1:5276/review-hybrid-25d');await phone.locator('[data-sprite-sample]').click();await phone.waitForFunction(()=>document.querySelector('.sprite-set-playground')?.dataset.spriteReady==='true');
  assert.equal(await phone.locator('.sprite-set-actions').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length),5);await phone.screenshot({path:out+'/review-mobile.png',fullPage:true});note('390px viewport retains five-column controls',true);await mobile.close();
  const actionHashes=[];for(const action of ['attack','hit','talk','pickup','rest'])actionHashes.push(createHash('sha256').update(await readFile(out+'/review-'+action+'.png')).digest('hex'));assert.equal(new Set(actionHashes).size,5);
  assert.deepEqual(receipt.errors,[]);receipt.pass=true;
}catch(error){receipt.failure={message:error.message,stack:error.stack};for(const [label,page] of [['review',review],['rinne',rinne]])if(page&&!page.isClosed()){try{await screenshot(page,label+'-failure');await writeFile(out+'/'+label+'-failure-dom.txt',await page.locator('body').innerText());}catch{}}process.exitCode=1;}
finally{
  try{await context?.tracing.stop({path:out+'/trace.zip'});}catch{}await context?.close();
  for(const [name,video] of videos)if(video)try{await video.saveAs(out+'/'+name+'.webm');}catch{}
  await browser?.close();for(const server of servers)try{process.kill(-server.pid,'SIGTERM');}catch{}for(const log of logs)log.end();
  await writeFile(out+'/receipt.json',JSON.stringify(receipt,null,2)+'\n');console.log('SPRITE_SET_BROWSER '+JSON.stringify({sourceSha:sha,pass:receipt.pass,steps:receipt.steps.length,errors:receipt.errors,failure:receipt.failure?.message,out}));
}
