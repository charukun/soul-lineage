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
const servers=[];let browser,context;
const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
async function server(app,port){const process=spawn('node',[resolve('node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port',String(port),'--strictPort'],{cwd:resolve('apps',app),stdio:'inherit',env:{...globalThis.process.env,APP_ENV:'dev'}});servers.push(process);for(let i=0;i<100;i++){try{const r=await fetch(`http://127.0.0.1:${port}/`);if(r.ok)return;}catch{}if(process.exitCode!==null)throw Error(app+' server exited');await delay(250);}throw Error(app+' server timeout');}
function observe(page){page.on('pageerror',e=>receipt.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')receipt.errors.push(m.text());});}
async function sample(canvas,tag,attribute='data-actor-snapshot'){
  const snapshot=JSON.parse(await canvas.getAttribute(attribute));assert.ok(snapshot.actualGrip,tag+' has a weapon');
  assert.ok(distance(snapshot.hand,snapshot.actualGrip)<.0001,tag+' grip separates');
  if(snapshot.twoHanded)assert.ok(distance(snapshot.offhand,snapshot.secondaryGrip)<.025,tag+' second grip separates');
  receipt.samples.push({tag,...snapshot});return snapshot;
}
try{
  await server('review',5176);await server('rinne',5173);
  browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-webgl','--enable-unsafe-swiftshader']});
  context=await browser.newContext({viewport:{width:1280,height:980},recordVideo:{dir:resolve(output,'video'),size:{width:1280,height:980}}});
  await context.tracing.start({screenshots:true,snapshots:true,sources:true});
  const page=await context.newPage();observe(page);
  await page.goto('http://127.0.0.1:5176/review-hybrid-25d',{waitUntil:'domcontentloaded'});
  await page.locator('[data-auto-file]').setInputFiles(resolve(receipt.input));
  const canvas=page.locator('.hybrid25d-stage canvas');
  await expect(canvas).toHaveAttribute('data-actor-action','idle',{timeout:60000});
  await page.locator('.hybrid25d-stage').scrollIntoViewIfNeeded();
  for(const view of ['front','quarter','side','back']){
    await page.locator(`[data-view="${view}"]`).click();await delay(250);
    await sample(canvas,`sword-${view}`);await canvas.screenshot({path:resolve(output,`sword-${view}.png`)});
  }
  for(const action of ['idle','walk','run','turn','attack','hit','rest']){
    await page.locator(`[data-motion="${action}"]`).click();await delay(action==='attack'?180:250);
    await sample(canvas,action);await canvas.screenshot({path:resolve(output,`${action}.png`)});
  }
  await page.locator('[data-motion="idle"]').click();await canvas.focus();
  const before=await sample(canvas,'move-before');await page.keyboard.down('ArrowRight');await delay(650);await page.keyboard.up('ArrowRight');
  const after=await sample(canvas,'move-after');assert.ok(distance(before.position,after.position)>.2,'keyboard must translate actor');
  for(const weapon of ['axe','spear','great','staff','sword']){
    await page.locator(`[data-weapon="${weapon}"]`).click();await page.locator('[data-motion="walk"]').click();await delay(300);await sample(canvas,weapon+'-walk');
    await page.locator('[data-motion="attack"]').click();await delay(200);await sample(canvas,weapon+'-attack');await canvas.screenshot({path:resolve(output,`${weapon}-attack.png`)});
  }
  await page.locator('[data-shield]').uncheck();await delay(200);assert.equal((await sample(canvas,'shield-off')).equipment.shield,false);
  await page.locator('[data-shield]').check();await delay(200);assert.equal((await sample(canvas,'shield-on')).equipment.shield,true);
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.locator('.character25d-options').evaluate(n=>getComputedStyle(n).gridTemplateColumns.split(/\s+/).length),5);
  await canvas.screenshot({path:resolve(output,'mobile.png')});
  await page.setViewportSize({width:1280,height:980});

  // The same real one-image draft crosses the existing opener/token bridge.
  const popupPromise=context.waitForEvent('page');await page.locator('[data-rinne-auto]').click();const game=await popupPromise;observe(game);
  await game.waitForLoadState('domcontentloaded');await expect(page.locator('[data-workshop-status]')).toContainText('転送しました',{timeout:90000});
  const dummy=buildStations(defaultMuraLayout()).find(row=>row.id==='training-dummy');
  const life=createLife({name:'Actor装備確認',seed:242,villageIds:[defaultMuraLayout().id]});life.ageYears=8;life.ageSeconds=480;life.phase='living';life.position={x:dummy.x,z:dummy.z};life.equipment.weapon='sword';life.equipment.shield=true;life.knownSkills.push('basic.sword');
  const key=await game.locator('#build-label').textContent();const storageKey=`soul:v1:${key.split('·')[0].trim().toLowerCase()||'local'}:rinne:local:life-v2`;
  await game.evaluate(({key,value})=>localStorage.setItem(key,value),{key:storageKey,value:serializeLife(life)});
  // Reload reopens a handshake; click the Lab's transfer again to send the same draft.
  await game.reload({waitUntil:'domcontentloaded'});await page.locator('[data-rinne-auto]').click();
  await game.locator('#continue-life').click();await expect(game.locator('#game')).toHaveAttribute('data-runtime','active',{timeout:90000});
  const gameCanvas=game.locator('#game');await expect(gameCanvas).toHaveAttribute('data-character25d',/.+/,{timeout:30000});await delay(300);
  await sample(gameCanvas,'rinne-idle','data-character25d');await game.screenshot({path:resolve(output,'rinne-idle.png')});
  await game.locator('[data-training-strike]').click();await delay(250);await sample(gameCanvas,'rinne-attack','data-character25d');await game.screenshot({path:resolve(output,'rinne-attack.png')});
  await game.keyboard.down('ArrowRight');await delay(800);await game.keyboard.up('ArrowRight');await sample(gameCanvas,'rinne-walk','data-character25d');await game.screenshot({path:resolve(output,'rinne-walk.png')});
  assert.equal(await game.locator('[data-shino25d-panel],.shino25d-workshop').count(),0);
  assert.deepEqual(receipt.errors,[]);receipt.success=true;
}catch(error){receipt.failure=error.stack;console.error(error);process.exitCode=1;}
finally{writeFileSync(resolve(output,'receipt.json'),JSON.stringify(receipt,null,2));await context?.tracing.stop({path:resolve(output,'trace.zip')});await context?.close();await browser?.close();for(const server of servers)server.kill('SIGTERM');}
