// Explicit specialist playtest. Never selected automatically by routine Fast DEV.
import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {mkdir,writeFile,readFile,readdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {chooseFamilyOrigin} from '../../apps/rinne/tests/family-origin.browser.mjs';
const root=resolve(new URL('../..',import.meta.url).pathname),output=resolve(root,'test-results/character25d-forge');
const head=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
assert.match(head,/^[a-f0-9]{40}$/);await mkdir(output,{recursive:true});
const ports={review:5276,rinne:5273},servers=[],logs={};
const receipt={schema:1,head,status:'running',source:'docs/characters/references/shino/shino-character-reference-sheet-v2.png',actions:{},views:{},mobile:null,rinne:null,errors:[],realDevice:false};
let browser,context,page,reviewVideo;
async function start(app){let log='';const p=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--config',`apps/${app}/vite.config.js`,'--host','127.0.0.1','--port',String(ports[app]),'--strictPort'],{cwd:root,env:process.env,stdio:['ignore','pipe','pipe']});servers.push(p);p.stdout.on('data',d=>{log+=d;});p.stderr.on('data',d=>{log+=d;});logs[app]=()=>log;for(let i=0;i<120;i++){if(p.exitCode!==null)throw new Error(log);try{if((await fetch(`http://127.0.0.1:${ports[app]}/`)).ok)return;}catch{}await new Promise(r=>setTimeout(r,250));}throw new Error('Server timeout '+app+log);}
const snapshot=()=>page.locator('.hybrid25d-stage canvas').evaluate(c=>c.character25dSnapshot?.());
async function action(name){await page.locator('[data-motion]').selectOption(name);await page.locator('[data-play-motion]').click();await page.waitForTimeout(120);const before=await snapshot();await page.waitForTimeout(180);const after=await snapshot();assert.equal(before.action,name);assert.equal(after.action,name);assert.ok(after.time>before.time);assert.ok(after.rotations.some((v,i)=>Math.abs(v-before.rotations[i])>1e-6)||name==='rest');receipt.actions[name]={before,after};await page.locator('.hybrid25d-stage').screenshot({path:join(output,name+'.png')});}
try{
  await Promise.all([start('review'),start('rinne')]);
  browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-webgl','--enable-unsafe-swiftshader','--no-sandbox']});
  context=await browser.newContext({viewport:{width:1100,height:900},recordVideo:{dir:join(output,'video'),size:{width:660,height:540}}});await context.tracing.start({screenshots:true,snapshots:true,sources:true});page=await context.newPage();reviewVideo=page.video();
  const observe=p=>{p.on('pageerror',e=>receipt.errors.push(e.message));p.on('console',m=>{if(m.type()==='error')receipt.errors.push(m.text());});};observe(page);
  await page.goto('http://127.0.0.1:5276/review-hybrid-25d',{waitUntil:'domcontentloaded'});
  const reference=await readFile(join(root,receipt.source));receipt.sourceSha256=createHash('sha256').update(reference).digest('hex');
  await page.locator('[data-character-image]').setInputFiles({name:'shino-reference.png',mimeType:'image/png',buffer:reference});
  await expect(page.locator('.character25d-forge')).toHaveAttribute('data-actor-ready','true',{timeout:60000});
  await page.waitForFunction(()=>document.querySelector('.hybrid25d-stage canvas')?.character25dSnapshot?.()?.transition===1);
  let first=await snapshot();assert.ok(first.bodyBones>=18&&first.layerMeshes>=6);assert.ok(first.availableViews.includes('front')&&first.availableViews.includes('side')&&first.availableViews.includes('back'),'One three-view reference must compile all views');
  for(const name of ['front','side','back']){await page.locator(`[data-view="${name}"]`).click();await page.waitForTimeout(500);const s=await snapshot();assert.equal(s.view,name);assert.equal(s.mirror,false);receipt.views[name]=s;await page.locator('.hybrid25d-stage').screenshot({path:join(output,'view-'+name+'.png')});}
  await page.locator('[data-view="front"]').click();await page.locator('[data-home]').click();await page.locator('[data-resume]').click();
  const beforeMove=await snapshot();await page.keyboard.down('KeyW');await page.waitForTimeout(450);const walking=await snapshot();assert.equal(walking.action,'walk');assert.ok(Math.hypot(walking.position.x-beforeMove.position.x,walking.position.z-beforeMove.position.z)>.12);
  await page.keyboard.down('ShiftLeft');await page.waitForTimeout(500);const running=await snapshot();assert.equal(running.action,'run');await page.keyboard.up('KeyW');await page.keyboard.up('ShiftLeft');await page.waitForTimeout(450);
  receipt.movement={before:beforeMove,walking,running,stopped:await snapshot()};assert.ok(Object.values(running.secondary).some(v=>Math.abs(v)>.0001));assert.ok(Object.values(running.secondary).every(v=>Math.abs(v)<=.12));
  // Use real pointer drag for continuous camera rotation, in addition to fixed views.
  const canvas=page.locator('.hybrid25d-stage canvas'),box=await canvas.boundingBox();await page.mouse.move(box.x+box.width*.6,box.y+box.height*.5);await page.mouse.down();await page.mouse.move(box.x+box.width*.2,box.y+box.height*.5,{steps:12});await page.mouse.up();await page.waitForTimeout(300);receipt.cameraDrag=await snapshot();
  await page.locator('[data-view="front"]').click();await page.locator('[data-home]').click();
  for(const name of ['idle','walk','run','turn','attack','hit','talk','pickup','rest'])await action(name);
  assert.notDeepEqual(receipt.actions.attack.after.rotations,receipt.actions.hit.after.rotations);
  // Deterministic arena ramp remains reachable using the same movement input.
  await page.locator('[data-home]').click();await page.locator('[data-view="front"]').click();await page.locator('[data-resume]').click();await page.keyboard.down('KeyD');await page.waitForTimeout(650);await page.keyboard.up('KeyD');await page.keyboard.down('KeyW');await page.waitForTimeout(300);await page.keyboard.up('KeyW');await page.waitForTimeout(300);receipt.slope=await snapshot();assert.ok(receipt.slope.grounded);assert.ok(receipt.slope.position.y>=0);
  await page.setViewportSize({width:390,height:844});await page.locator('[data-home]').click();const stick=page.locator('[data-stick]');await stick.scrollIntoViewIfNeeded();const sb=await stick.boundingBox(),mobileBefore=await snapshot();await page.mouse.move(sb.x+sb.width/2,sb.y+sb.height/2);await page.mouse.down();await page.mouse.move(sb.x+sb.width*.8,sb.y+sb.height*.5,{steps:4});await page.waitForTimeout(500);await page.mouse.up();const mobileAfter=await snapshot();assert.ok(Math.hypot(mobileAfter.position.x-mobileBefore.position.x,mobileAfter.position.z-mobileBefore.position.z)>.1);receipt.mobile={viewport:{width:390,height:844},before:mobileBefore,after:mobileAfter,input:'pointer joystick'};await page.screenshot({path:join(output,'mobile.png'),fullPage:true});
  await page.setViewportSize({width:1100,height:900});await page.locator('[data-rinne]').scrollIntoViewIfNeeded();const popupPromise=context.waitForEvent('page');await page.locator('[data-rinne]').click();const rinne=await popupPromise;observe(rinne);rinne.setDefaultTimeout(60000);
  await rinne.waitForFunction(()=>document.getElementById('game')?.character25dSnapshot?.(),null,{timeout:90000});
  await expect(rinne.locator('#title-screen')).toHaveAttribute('data-ready','true',{timeout:90000});
  // Skip only the actual title cinematic through its normal input, never force a hidden button.
  if(await rinne.locator('#title-screen').getAttribute('data-intro')==='cinematic')await rinne.locator('#title-screen').click({position:{x:80,y:80}});
  await rinne.locator('#new-life').click();await chooseFamilyOrigin(rinne,{checkCancel:false});await expect(rinne.locator('#game')).toHaveAttribute('data-runtime','active',{timeout:60000});
  const guest=()=>rinne.locator('#game').evaluate(c=>c.character25dSnapshot?.());const a=await guest();await rinne.waitForTimeout(500);const b=await guest();
  const game=rinne.locator('#game'),gb=await game.boundingBox();await rinne.mouse.move(gb.x+gb.width*.48,gb.y+gb.height*.6);await rinne.mouse.down();await rinne.mouse.move(gb.x+gb.width*.65,gb.y+gb.height*.45,{steps:8});await rinne.waitForTimeout(650);await rinne.mouse.up();await rinne.waitForTimeout(300);const c=await guest();
  assert.ok(Math.hypot(c.position.x-a.position.x,c.position.z-a.position.z)>.05||Math.hypot(b.position.x-a.position.x,b.position.z-a.position.z)>.05,'Companion must move in the real game');assert.ok(c.grounded);
  assert.equal(await rinne.locator('input[type=file],.shino25d-panel,.character25d-forge,[data-rinne-auto]').count(),0,'No guest debug panel in RINNE');
  const saves=await rinne.evaluate(()=>Object.entries(localStorage).filter(([k])=>k.includes('life-v2')).map(([key,value])=>({key,containsDraft:/rinne.character25d|sourceSha256|data:image/.test(value)})));assert.ok(saves.every(s=>!s.containsDraft));receipt.rinne={before:a,middle:b,after:c,saveIsolation:saves};await rinne.screenshot({path:join(output,'rinne.png')});
  assert.deepEqual(receipt.errors,[],'No console errors');receipt.status='passed';
} catch(error){receipt.status='failed';receipt.failure=error.stack;throw error;}
finally{
  await writeFile(join(output,'playtest-receipt.json'),JSON.stringify(receipt,null,2));
  if(context){await context.tracing.stop({path:join(output,'trace.zip')}).catch(()=>{});await context.close().catch(()=>{});}await browser?.close().catch(()=>{});
  for(const server of servers)server.kill('SIGTERM');for(const [app,getLog] of Object.entries(logs))await writeFile(join(output,app+'-preview.log'),getLog());
  console.log('CHARACTER25D_RECEIPT '+JSON.stringify(receipt));
  // A bounded media receipt travels with this explicit hosted test's logs.
  // The worker extracts it into the usual evidence files; it is not another
  // workflow or a repository asset, and never changes the validated source.
  if(reviewVideo){
    try{
      const input=await reviewVideo.path(),mp4=join(output,'playground-motion.mp4');
      execFileSync('ffmpeg',['-y','-i',input,'-t','36','-vf','scale=440:-2','-r','12','-an','-c:v','libx264','-preset','veryfast','-crf','36','-movflags','+faststart',mp4],{stdio:'ignore',timeout:30000});
      const bytes=await readFile(mp4);
      if(bytes.length<=700000)console.log('CHARACTER25D_MEDIA '+JSON.stringify({name:'playground-motion.mp4',sha256:createHash('sha256').update(bytes).digest('hex'),data:bytes.toString('base64')}));
    }catch(error){console.log('Character25D video packaging: '+error.message);}
  }
  for(const name of ['view-front','view-side','view-back','attack','hit','rinne']){
    try{const png=join(output,name+'.png'),jpg=join(output,name+'.jpg');execFileSync('ffmpeg',['-y','-i',png,'-vf','scale=640:-2','-q:v','6',jpg],{stdio:'ignore',timeout:10000});const bytes=await readFile(jpg);if(bytes.length<90000)console.log('CHARACTER25D_MEDIA '+JSON.stringify({name:name+'.jpg',sha256:createHash('sha256').update(bytes).digest('hex'),data:bytes.toString('base64')}));}catch{}
  }
}
