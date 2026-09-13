// Focused main-game smoke; opt in separately from the fast domain tests.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,readFile} from 'node:fs/promises';
import {basename,join} from 'node:path';
import {createServer} from 'vite';
const server=process.env.RINNE_STORY_URL?null:await createServer({configFile:'apps/rinne/vite.config.js',server:{host:'127.0.0.1',port:5193,strictPort:true,watch:null,hmr:false}});
await server?.listen();
const url=process.env.RINNE_STORY_URL||'http://127.0.0.1:5193/';
const output=process.env.RINNE_STORY_ARTIFACTS||'/tmp/rinne-story-browser';await mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE||undefined,headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const context=await browser.newContext({viewport:{width:800,height:600},hasTouch:true,reducedMotion:'reduce'}),page=await context.newPage(),errors=[];
page.setDefaultTimeout(15000);
if(process.env.RINNE_STORY_FONT_DIR){
 const fontDir=process.env.RINNE_STORY_FONT_DIR,css=(await readFile(join(fontDir,'400.css'),'utf8')).replace(/url\(\.\/files\//g,'url(/__test-font/');
 await context.route('**/__test-font/*',async route=>route.fulfill({contentType:'font/woff2',body:await readFile(join(fontDir,'files',basename(new URL(route.request().url()).pathname)))}));
 await context.addInitScript(css=>document.addEventListener('DOMContentLoaded',()=>{const style=document.createElement('style');style.textContent=css+'\n*{font-family:"Noto Sans JP",sans-serif!important}';document.head.append(style);}),css);
}
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')console.error('BROWSER:',m.text().slice(0,400));});
let frame;
async function boot(hash='#story'){
  await page.goto(url+hash);await page.waitForFunction(()=>['playing','error'].includes(window.__RINNE_TITLE__?.snapshot().state),null,{timeout:150000});
  const status=await page.evaluate(()=>window.__RINNE_TITLE__.snapshot());
  if(status.state==='error')throw Error(await page.locator('#loading-technical').innerText());
  frame=page.frames().find(f=>f.url().includes('/simulator/index.html'));assert.ok(frame);
}
async function save(){return frame.evaluate(()=>{document.getElementById('story-records').click();document.getElementById('story-close').click();return JSON.parse(localStorage.getItem('soul.local.rinne.story.v1'));});}
async function loadFixture(change){const data=await save();change(data);await frame.locator('#story-records').click();await frame.locator('#story-file').setInputFiles({name:'fixture.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});await frame.waitForFunction(()=>document.getElementById('story-file').files.length===0);if(await frame.locator('#story-dialog[open]').count())await frame.locator('#story-close').click();}
async function walkWithTouch(dx=58){
  const cdp=await context.newCDPSession(page),box=await frame.locator('#game').boundingBox(),x=box.x+90,y=box.y+box.height*.54;
  const before=await frame.evaluate(()=>window.__RINNE_GAME_PORT__.snapshot().hero.x);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+dx,y}]});
  await frame.waitForFunction(({before,dx})=>Math.sign(dx)*(window.__RINNE_GAME_PORT__.snapshot().hero.x-before)>.6,{before,dx},{timeout:6000});
  await page.waitForTimeout(400); // A held swipe must never become a flick on release.
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();
  assert.equal(await frame.evaluate(()=>window.__RINNE_GAME_PORT__.snapshot().controls.moving),false);
}
try{
  await boot();console.log('story booted');
  await frame.locator('[data-action="gift:bell"]').click();await frame.locator('[data-action="gift:stone"]').click();assert.equal(await frame.locator('[data-action="gift:feather"]').isEnabled(),false);
  const birth=await save();assert.deepEqual(birth.story.gifts,['bell','stone']);assert.equal(birth.runtime.enemies.length,0);
  await page.screenshot({path:output+'/birth-desktop.png'});
  await frame.locator('[data-action="release"]').click();await frame.locator('[data-action="activity:care:home"]').click();
  await frame.waitForFunction(()=>JSON.parse(localStorage.getItem('soul.local.rinne.story.v1')).story.experiences.care===1,null,{timeout:15000});
  // Real touch input through the exposed playfield, not a position setter.
  await page.setViewportSize({width:390,height:844});
  assert.equal((await frame.locator('#game').boundingBox()).height,844);
  for(const selector of ['#story-map','#settingsBtn','#story-records','#story-rest','#story-stop','#story-menu-button']){
    const b=await frame.locator(selector).boundingBox();assert.ok(b.width>=44&&b.height>=44,selector+' touch target');
  }
  assert.equal(await frame.evaluate(()=>document.elementFromPoint(90,440)?.id),'game');
  await walkWithTouch();
  await frame.locator('#story-rest').tap();assert.equal(await frame.locator('#story-rest').getAttribute('aria-pressed'),'true');
  await walkWithTouch(-58);assert.equal(await frame.locator('#story-rest').getAttribute('aria-pressed'),'false');
  await frame.locator('#story-map').tap();assert.equal(await frame.evaluate(()=>window.__RINNE_GAME_PORT__.snapshot().paused),true);
  const heldAge=await frame.evaluate(()=>window.__RINNE_GAME_PORT__.snapshot().life.ageSeconds);
  await page.waitForTimeout(250);assert.equal(await frame.evaluate(()=>window.__RINNE_GAME_PORT__.snapshot().life.ageSeconds),heldAge);
  await page.screenshot({path:output+'/map-mobile.png'});
  await frame.locator('[data-destination="garden"]').tap();await frame.waitForFunction(()=>!window.__RINNE_GAME_PORT__.snapshot().paused);
  await frame.locator('#story-menu-button').tap();await frame.locator('[data-tool="cameraBtn"]').tap();
  assert.equal(await frame.locator('#cameraDialog').isVisible(),true);assert.equal(await frame.evaluate(()=>window.__RINNE_GAME_PORT__.snapshot().paused),true);
  await frame.locator('#closeCamera').tap();await frame.waitForFunction(()=>!window.__RINNE_GAME_PORT__.snapshot().paused);
  await frame.locator('#settingsBtn').tap();assert.equal(await frame.evaluate(()=>window.__RINNE_GAME_PORT__.snapshot().paused),true);
  await frame.locator('#tab-character').tap();await page.screenshot({path:output+'/equipment-mobile.png'});
  assert.ok(await frame.locator('[data-weapon]:disabled').count());
  await frame.locator('#closeSettings').tap();await frame.waitForFunction(()=>!window.__RINNE_GAME_PORT__.snapshot().paused);
  await walkWithTouch();
  await frame.locator('#story-menu-button').tap();await frame.locator('[data-tool="pauseBtn"]').tap();
  await frame.locator('#story-resume').tap();await frame.waitForFunction(()=>!window.__RINNE_GAME_PORT__.snapshot().paused);
  await page.screenshot({path:output+'/play-mobile.png'});
  console.log('touch movement, rest recovery, map, camera, notebook and pause restoration passed');
  const living=await save();await boot();const restored=await save();assert.deepEqual(restored.story.gifts,living.story.gifts);assert.equal(restored.story.experiences.care,1);assert.deepEqual(restored.runtime.notebook,living.runtime.notebook);
  // A village-authoritative layout update moves a building over the old position.
  const sender=await context.newPage();await sender.goto(url);const updated=structuredClone(restored.world);updated.revision++;Object.assign(updated.objects[0],{x:restored.runtime.hero.x,z:restored.runtime.hero.z});
  await sender.evaluate(world=>localStorage.setItem('soul.local.world.mura.v1',JSON.stringify(world)),updated);
  await frame.waitForFunction(revision=>JSON.parse(localStorage.getItem('soul.local.rinne.story.v1')).world.revision===revision,updated.revision);
  await sender.close();await page.bringToFront();const updatedSave=await save();assert.deepEqual(updatedSave.runtime.notebook,restored.runtime.notebook);assert.deepEqual(updatedSave.story.gifts,restored.story.gifts);assert.ok(Math.hypot(updatedSave.runtime.hero.x-updated.objects[0].x,updatedSave.runtime.hero.z-updated.objects[0].z)>2);
  console.log('birth, activity and save reload passed');
  await loadFixture(data=>{data.runtime.life.ageSeconds=900;data.runtime.life.worldSeconds=data.story.bornAt+900;data.story.lastWorld=data.runtime.life.worldSeconds;data.runtime.hero.x=166;data.runtime.hero.z=0;});
  await frame.locator('[data-action="travel"]').click();await frame.waitForFunction(()=>window.__RINNE_GAME_PORT__.snapshot().enemies.length>0);
  const combat=await save();assert.equal(combat.story.zone,'frontier');await page.screenshot({path:output+'/frontier-desktop.png'});
  // Persist a rescue already being carried; check delivery through the real action.
  await loadFixture(data=>{data.runtime.hero.x=-5;data.runtime.hero.z=3;data.story.rescue.status='carried';data.runtime.hero.hp=data.runtime.hero.maxhp;data.runtime.hero.dead=false;});
  await frame.locator('[data-action="rescue"]').click();assert.equal((await save()).story.rescued,1);
  await frame.locator('[data-action="travel"]').click();assert.equal((await save()).story.zone,'village');
  // Enter the final second through a valid envelope, then let the actual clock expire.
  await loadFixture(data=>{data.runtime.life.ageSeconds=5399;data.runtime.life.worldSeconds=data.story.bornAt+5399;data.story.lastWorld=data.runtime.life.worldSeconds;data.runtime.life.rate=20;});
  await frame.locator('#story-ended[open]').waitFor();const before=await frame.evaluate(()=>window.__RINNE_GAME_PORT__.notebook());await frame.locator('#story-rebirth').click();
  const reborn=await save();assert.equal(reborn.story.generation,2);assert.equal(reborn.story.history.length,1);assert.equal(reborn.runtime.life.lives,2);assert.ok(reborn.runtime.life.ageSeconds<30);assert.deepEqual(reborn.runtime.notebook,before);
  console.log('expedition, rescue, death and inheritance passed');
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:output+'/birth-mobile.png'});
  assert.equal(await frame.locator('#settingsBtn').isVisible(),true);
  const overflow=await frame.evaluate(()=>document.documentElement.scrollWidth>innerWidth);assert.equal(overflow,false);
  const keyCount=await frame.evaluate(()=>Object.keys(localStorage).filter(k=>k.includes('tidebreak')||k.includes('rinne.tidebreak.life')));assert.deepEqual(keyCount,[]);
  await frame.locator('#story-menu-button').tap();await frame.locator('#story-exit').tap();await page.locator('#title-screen:not([hidden])').waitFor();await page.screenshot({path:output+'/title-mobile.png'});
  await page.locator('#start-simulator').click();await page.waitForFunction(()=>window.__RINNE_TITLE__?.snapshot().state==='playing',null,{timeout:120000});
  frame=page.frames().find(f=>f.url().includes('/simulator/index.html'));assert.equal(await frame.evaluate(()=>!!window.__RINNE_GAME_PORT__),false);assert.equal(await frame.locator('#story-hud').count(),0);assert.ok(await frame.evaluate(()=>window.__ATELIER__.snapshot().enemies.length>0));
  assert.deepEqual(errors,[]);console.log('mobile layout, isolated persistence and standalone simulator passed');
}catch(error){await page.screenshot({path:output+'/failure.png'}).catch(()=>{});console.error('Page errors:',errors);console.error('Game state:',await frame?.evaluate(()=>({runtime:window.__RINNE_GAME_PORT__?.snapshot(),dialogs:[...document.querySelectorAll('dialog[open]')].map(d=>d.id),save:JSON.parse(localStorage.getItem('soul.local.rinne.story.v1'))?.story,record:document.getElementById('story-dialog-content')?.textContent})).catch(()=>null));throw error;}
finally{await browser.close();await server?.close();}
