// Focused main-game smoke; opt in separately from the fast domain tests.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,readFile} from 'node:fs/promises';
import {basename,join} from 'node:path';
import {createServer} from 'vite';
const server=process.env.RINNE_STORY_URL?null:await createServer({configFile:'apps/rinne/vite.config.js',server:{host:'127.0.0.1',port:5198,strictPort:true,watch:null,hmr:false}});
await server?.listen();
const url=process.env.RINNE_STORY_URL||'http://127.0.0.1:5198/';
const output=process.env.RINNE_STORY_ARTIFACTS||'/tmp/rinne-story-loop';await mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE||undefined,headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,reducedMotion:'reduce'}),page=await context.newPage(),errors=[];
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
async function turnTo(selector){
  await frame.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const item=frame.locator(selector);if(await item.isVisible())return;
  const select=item.locator('xpath=ancestor::*[contains(concat(" ",normalize-space(@class)," ")," page-book ")][1]').locator(':scope > .book-pages > select');
  const values=await select.locator('option').evaluateAll(options=>options.map(o=>o.value));
  for(const value of values){await select.selectOption(value);if(await item.isVisible())return;}
  throw Error('Control is not reachable by page turns: '+selector);
}
// No fixture imports, age jumps, position setters or test-only engine hooks.
const runtime=()=>frame.evaluate(()=>window.__RINNE_GAME_PORT__.snapshot());
const stored=()=>frame.evaluate(()=>JSON.parse(localStorage.getItem('soul.local.rinne.story.v1')).story);
async function journal(){await frame.locator('#story-journey-open').tap();}
async function click(selector){await turnTo(selector);await frame.locator(selector).tap();}
async function close(){await frame.locator('#story-journey .sheet-close').tap();}
async function rate(n){await turnTo('#journey-rate');await frame.locator('#journey-rate').selectOption(String(n));}
async function audit(){
 const failures=await frame.evaluate(async()=>{await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));const d=document.getElementById('story-journey'),v=d.querySelector('.book-viewport'),s=d.querySelector('.book-pages select'),out=[];
 for(const o of s.options){s.value=o.value;s.dispatchEvent(new Event('change'));if(v.scrollHeight>v.clientHeight+2||v.scrollWidth>v.clientWidth+2)out.push({page:o.textContent,height:v.clientHeight,scroll:v.scrollHeight,width:v.clientWidth,scrollWidth:v.scrollWidth});}
 return out;});assert.deepEqual(failures,[]);
}
async function walk(target=null){
 const cdp=await context.newCDPSession(page),x=145,y=455;let held=false;const started=Date.now();
 try{for(let i=0;i<800;i++){
  const f=await runtime();if(target&&await frame.evaluate(()=>!!window.__RINNE_GAME_PORT__.activeLearnedSkill()))break;if(f.hero.dead)throw Error('Actor fell while walking');
  const path=target?[target]:JSON.parse(await frame.locator('#story-waypoint').getAttribute('data-route'));assert.ok(path?.length,'a safe route is available');
  const final=path.at(-1);if(Math.hypot(final.x-f.hero.x,final.z-f.hero.z)<1.8)break;
  const p=path[0],dx=p.x-f.hero.x,dz=p.z-f.hero.z,len=Math.hypot(dx,dz),amount=Math.min(58,len*20);
  if(!held){await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});held=true;}
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+dx/len*amount,y:y+dz/len*amount}]});
  await page.waitForTimeout(200);
  if(i%100===0)console.log('walking',Math.round(f.hero.x),Math.round(f.hero.z),'toward',p);
  if(Date.now()-started>360000)throw Error('Walking did not reach destination');
 }
 }finally{if(held){await page.waitForTimeout(300);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}await cdp.detach();}
 await frame.locator('#story-stop').tap();
}
try{
 await boot();console.log('Fresh story booted');await frame.locator('[data-action="gift:bell"]').tap();await frame.locator('[data-action="release"]').tap();
 await journal();await rate(20);await close();
 for(let i=0;i<4;i++){
  await journal();await turnTo('#journey-practice');const label=await frame.locator('#journey-practice').innerText();await click('#journey-practice');
  if(label.includes('向かう')){await walk();await journal();await click('#journey-practice');}
  await frame.waitForFunction(()=>document.getElementById('story-activity-progress').hidden,null,{timeout:30000});
  const state=await stored();console.log('activity completed',state.experiences);
 }
 await journal();await click('#journey-receive');await turnTo('#journey-skill');assert.equal(await frame.locator('#journey-skill option').count(),1);
 const skillId=await frame.locator('#journey-skill').inputValue();assert.equal(skillId,'story-1-attention');
 await click('#journey-assign');await turnTo('#journey-equipped');assert.match(await frame.locator('#journey-equipped').innerText(),/序 1に装備 · 選択率100%/);

 await turnTo('#journey-equipped');await page.screenshot({path:output+'/learned-equipped.png'});
 await click('#journey-travel');await frame.waitForFunction(()=>document.getElementById('story-target-name').textContent.includes('船着き場'));await walk();assert.ok(Math.hypot((await runtime()).hero.x-166,(await runtime()).hero.z)<2.2);console.log('Reached boat through MURA crossings');
 // Hold a departure year by opening the journal, then select the normal world rate.
 await frame.waitForFunction(()=>{const f=window.__RINNE_GAME_PORT__.snapshot();return f.life.ageYears>=15&&Math.floor(f.life.worldSeconds/60)%5===0;},null,{timeout:45000});
 await journal();await rate(1);await click('#journey-travel');
 await frame.waitForFunction(()=>window.__RINNE_GAME_PORT__.snapshot().enemies.length>0);assert.equal((await stored()).zone,'frontier');console.log('Boarded through normal UI');
 const initialEnemy=(await runtime()).enemies[0].hp;
 await walk({x:1,z:1});
 await frame.waitForFunction(()=>JSON.parse(localStorage.getItem('soul.local.rinne.story.v1')).story.skillUses.includes('story-1-attention'),null,{timeout:45000});
 assert.ok((await runtime()).enemies.some(e=>e.hp<initialEnemy));console.log('Learned skill used in live combat, enemy damaged');
 await page.screenshot({path:output+'/learned-in-combat.png'});
 await journal();await click('#journey-travel');await walk();
 await journal();await click('#journey-travel');
 await frame.waitForFunction(()=>JSON.parse(localStorage.getItem('soul.local.rinne.story.v1')).story.returns===1,null,{timeout:8000});
 await journal();await turnTo('#journey-trip .journey-lead');assert.match(await frame.locator('#journey-trip .journey-lead').innerText(),/おかえり/);await click('#journey-rest');
 await frame.waitForFunction(()=>window.__RINNE_GAME_PORT__.snapshot().hero.hp>=window.__RINNE_GAME_PORT__.snapshot().hero.maxhp,null,{timeout:50000});
 await frame.locator('#story-rest').tap();await journal();
 for(const size of [{width:360,height:640},{width:844,height:390},{width:390,height:844}]){await page.setViewportSize(size);await page.waitForTimeout(250);await audit();}
 await turnTo('#journey-trip .journey-lead');await page.screenshot({path:output+'/ready-for-next-trip.png'});await close();
 await page.reload();await page.waitForFunction(()=>window.__RINNE_TITLE__?.snapshot().state==='playing',null,{timeout:150000});frame=page.frames().find(f=>f.url().includes('/simulator/index.html'));
 const state=await stored();assert.equal(state.returns,1);assert.ok(state.skillUses.includes(skillId));assert.equal(state.experiences.study,2);
 assert.ok(await frame.evaluate(id=>window.__RINNE_GAME_PORT__.learnedSkills().find(r=>r.id===id).slots.some(v=>v.stage==='jo'&&v.index===0&&v.weight===100),skillId));
 assert.deepEqual(errors,[]);console.log('PASS: village → timed learning → explicit equipment → departure → combat use → return → rest → reload; responsive journal has no scroll');
}catch(error){await context.storageState({path:output+'/earned-state.json'});await page.screenshot({path:output+'/failure.png'}).catch(()=>{});console.error('Page errors',errors);console.error('State',await runtime().catch(()=>null),await stored().catch(()=>null));throw error;}
finally{await browser.close();await server?.close();}
