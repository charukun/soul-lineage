// Explicit specialist observation. Run manually; never part of routine Fast DEV.
import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {createLife,serializeLife} from '../../apps/rinne/src/rebuild/domain.js';
import {buildStations} from '../../apps/rinne/src/rebuild/locations.js';
import {defaultMuraLayout} from '@soul/world/mura';

const output=resolve('test-results/character25d');mkdirSync(output,{recursive:true});
const receipt={head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),input:'docs/characters/references/shino/shino-character-reference-sheet-v2.png',samples:[],errors:[],success:false};
const servers=[];let browser,context;let activePage=null;
const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
async function server(app,port){const process=spawn('node',[resolve('node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port',String(port),'--strictPort'],{cwd:resolve('apps',app),stdio:'inherit',env:{...globalThis.process.env,APP_ENV:'dev'}});servers.push(process);for(let i=0;i<100;i++){try{const r=await fetch(`http://127.0.0.1:${port}/`);if(r.ok)return;}catch{}if(process.exitCode!==null)throw Error(app+' server exited');await delay(250);}throw Error(app+' server timeout');}
function observe(page){page.on('pageerror',e=>receipt.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')receipt.errors.push(m.text());});}
async function sample(canvas,tag,attribute=null,expectedAction=null){
  if(expectedAction)await expect.poll(()=>canvas.evaluate(c=>c.character25dSnapshot?.()?.action),{timeout:10000}).toBe(expectedAction);
  const snapshot=await canvas.evaluate(c=>c.character25dSnapshot?.());receipt.samples.push({tag,...snapshot});assert.ok(snapshot.actualGrip,tag+' has a weapon');
  assert.ok(distance(snapshot.hand,snapshot.actualGrip)<.0001,tag+' grip separates');
  if(snapshot.twoHanded)assert.ok(distance(snapshot.offhand,snapshot.secondaryGrip)<.01,tag+' second grip separates');
  assert.ok(distance(snapshot.appearanceGrips.R,snapshot.actualGrip)<.025,tag+' appearance hand separates');
  return snapshot;
}
async function play(page,action){await page.locator('[data-motion]').selectOption(action);await page.locator('[data-play-motion]').click();}
async function capture(canvas,name){const data=await canvas.evaluate(c=>new Promise(resolve=>requestAnimationFrame(()=>resolve(c.toDataURL('image/png')))));writeFileSync(resolve(output,name+'.png'),Buffer.from(data.split(',')[1],'base64'));}

try{
  await server('review',5176);await server('rinne',5173);
  browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-webgl','--enable-unsafe-swiftshader']});
  context=await browser.newContext({viewport:{width:1280,height:980},recordVideo:{dir:resolve(output,'video'),size:{width:1280,height:980}}});
  await context.tracing.start({screenshots:true,snapshots:true,sources:true});
  const page=await context.newPage();activePage=page;page.setDefaultTimeout(30000);observe(page);
  await page.goto('http://127.0.0.1:5176/review-hybrid-25d',{waitUntil:'domcontentloaded'});
  await page.locator('[data-character-image]').setInputFiles(resolve(receipt.input));
  const canvas=page.locator('.hybrid25d-stage canvas');
  await expect(page.locator('.character25d-forge')).toHaveAttribute('data-actor-ready','true',{timeout:60000});await page.waitForFunction(()=>document.querySelector('.hybrid25d-stage canvas').character25dSnapshot()?.transition===1);
  await page.locator('[data-arrange="solo"]').click();await page.locator('[data-view="front"]').click();
  await page.locator('.hybrid25d-stage').scrollIntoViewIfNeeded();
  await page.screenshot({path:resolve(output,'forge.png'),fullPage:true});
  for(const view of ['front','quarter','side','back']){
    await page.locator(`[data-view="${view}"]`).click();await delay(250);
    const directional=await sample(canvas,`sword-${view}`);if(view!=='quarter')assert.equal(directional.view,view,'real directional source required');await capture(canvas,`sword-${view}`);
  }
  for(const action of ['idle','walk','run','turn','attack','hit','rest']){
    await play(page,action);await delay(action==='attack'?180:250);
    await sample(canvas,action,'data-actor-snapshot',action);await capture(canvas,action);
  }
  await page.locator('[data-home]').click();await page.locator('[data-view="front"]').click();await page.locator('[data-resume]').click();
  const before=await sample(canvas,'move-before');await page.keyboard.down('KeyD');await delay(650);await page.keyboard.up('KeyD');
  const after=await sample(canvas,'move-after');assert.ok(Math.hypot(before.position.x-after.position.x,before.position.z-after.position.z)>.2,'keyboard must translate actor');
  await page.keyboard.down('KeyA');await page.keyboard.down('ShiftLeft');await delay(400);const running=await sample(canvas,'running-movement',null,'run');await page.keyboard.up('ShiftLeft');await page.keyboard.up('KeyA');assert.ok(running.speed>2.5);
  await page.keyboard.down('KeyA');await page.keyboard.press(' ');const attackMove=await sample(canvas,'moving-attack','data-actor-snapshot','attack');await delay(350);await page.keyboard.up('KeyA');const attackMoveEnd=await sample(canvas,'moving-attack-end');assert.ok(Math.hypot(attackMove.position.x-attackMoveEnd.position.x,attackMove.position.z-attackMoveEnd.position.z)>.05,'movement and attack must coexist');
  for(const weapon of ['axe','spear','great','staff','sword']){
    await page.locator(`[data-weapon="${weapon}"]`).click();await play(page,'walk');await delay(300);await sample(canvas,weapon+'-walk');
    await play(page,'attack');await delay(200);await sample(canvas,weapon+'-attack','data-actor-snapshot','attack');await capture(canvas,`${weapon}-attack`);
  }
  await page.locator('[data-shield]').uncheck();await delay(200);assert.equal((await sample(canvas,'shield-off')).equipment.shield,false);
  await page.locator('[data-shield]').check();await delay(200);assert.equal((await sample(canvas,'shield-on')).equipment.shield,true);
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.locator('.character25d-options').evaluate(n=>getComputedStyle(n).gridTemplateColumns.split(/\s+/).length),5);
  await canvas.screenshot({path:resolve(output,'mobile.png')});
  await page.setViewportSize({width:1280,height:980});

  // The same real one-image draft crosses the existing opener/token bridge.
  const popupPromise=context.waitForEvent('page');await page.locator('[data-rinne]').click();let game=await popupPromise;observe(game);
  await game.waitForLoadState('domcontentloaded');await expect(page.locator('[data-forge-status]')).toContainText('転送しました',{timeout:90000});
  const dummy=buildStations(defaultMuraLayout()).find(row=>row.id==='training-dummy');
  const life=createLife({name:'Actor装備確認',seed:242,villageIds:[defaultMuraLayout().id]});life.ageYears=8;life.ageSeconds=480;life.phase='living';life.position={x:dummy.x,z:dummy.z};life.equipment.weapon='sword';life.equipment.shield=true;life.knownSkills.push('basic.sword');
  const environment=await game.evaluate(()=>document.title.split(' | ')[1]?.toLowerCase()||'prod');assert.ok(['dev','local'].includes(environment));const storageKey=`soul:v1:${environment}:rinne:local:life-v2`;
  await game.evaluate(({key,value})=>localStorage.setItem(key,value),{key:storageKey,value:serializeLife(life)});
  // Reopen an isolated runtime with the fixture save and a fresh transfer token.
  await game.close();const secondPopup=context.waitForEvent('page');await page.locator('[data-rinne]').click();game=await secondPopup;activePage=game;observe(game);
  await game.waitForLoadState('domcontentloaded');await expect(page.locator('[data-forge-status]')).toContainText('転送しました',{timeout:90000});
  await expect(game.locator('#title-screen')).toHaveAttribute('data-ready','true',{timeout:90000});
  await expect(game.locator('#soul-brand-boot')).toHaveClass(/armed/,{timeout:90000});await game.locator('#soul-brand-boot').click();await expect(game.locator('#soul-brand-boot')).toHaveCount(0);
  await game.waitForFunction(()=>{const t=document.getElementById('title-screen');return t?.dataset.intro==='idle'||t?.dataset.skip==='ready';});if(await game.locator('#title-screen').getAttribute('data-intro')==='cinematic')await game.locator('#title-screen').click({position:{x:80,y:80}});
  await game.locator('#continue-life').click();await game.getByRole('button',{name:'この人生を続ける',exact:true}).click();await expect(game.locator('#game')).toHaveAttribute('data-runtime','active',{timeout:90000});
  const gameCanvas=game.locator('#game');await expect.poll(()=>gameCanvas.evaluate(c=>c.character25dSnapshot?.()?.actualGrip),{timeout:30000}).not.toBeNull();await delay(300);
  const idle=await sample(gameCanvas,'rinne-idle',null,'idle');assert.deepEqual(idle.equipment,{weapon:'sword',shield:true});await game.screenshot({path:resolve(output,'rinne-idle.png')});
  await game.locator('[data-training-strike]').click();await delay(250);await sample(gameCanvas,'rinne-attack','data-character25d','attack');await game.screenshot({path:resolve(output,'rinne-attack.png')});
  await game.keyboard.down('ArrowRight');await delay(700);await sample(gameCanvas,'rinne-walk',null,'walk');await game.keyboard.up('ArrowRight');await game.screenshot({path:resolve(output,'rinne-walk.png')});
  assert.equal(await game.locator('[data-shino25d-panel],.shino25d-workshop,.character25d-forge,input[type=file]').count(),0);
  assert.deepEqual(receipt.errors,[]);receipt.success=true;
}catch(error){receipt.failure=error.stack;await activePage?.screenshot({path:resolve(output,'failure.png')}).catch(()=>{});console.error(error);process.exitCode=1;}
finally{console.log('CHARACTER25D_EQUIPMENT_RECEIPT '+JSON.stringify(receipt));writeFileSync(resolve(output,'receipt.json'),JSON.stringify(receipt,null,2));await context?.tracing.stop({path:resolve(output,'trace.zip')});await context?.close();await browser?.close();for(const server of servers)server.kill('SIGTERM');}
