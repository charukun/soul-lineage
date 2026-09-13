// Focused geometry and real-control checks. Opt-in, separate from fast domain tests.
import {chromium} from 'playwright';
import {createServer} from 'vite';
import {readFile,mkdir} from 'node:fs/promises';
import {basename,join} from 'node:path';
import assert from 'node:assert/strict';
const server=await createServer({configFile:'apps/rinne/vite.config.js',server:{host:'127.0.0.1',port:5197,strictPort:true,watch:null,hmr:false}});await server.listen();
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE||undefined,headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,reducedMotion:'reduce'}),page=await context.newPage(),errors=[];
page.setDefaultTimeout(12000);page.on('pageerror',error=>errors.push(error.message));
const out=process.env.RINNE_STORY_ARTIFACTS||'/tmp/rinne-page-ui';await mkdir(out,{recursive:true});
if(process.env.RINNE_STORY_FONT_DIR){
 const dir=process.env.RINNE_STORY_FONT_DIR,css=(await readFile(join(dir,'400.css'),'utf8')).replace(/url\(\.\/files\//g,'url(/__font/');
 await context.route('**/__font/*',async route=>route.fulfill({contentType:'font/woff2',body:await readFile(join(dir,'files',basename(new URL(route.request().url()).pathname)))}));
 await context.addInitScript(css=>document.addEventListener('DOMContentLoaded',()=>{const style=document.createElement('style');style.textContent=css+'\n*{font-family:"Noto Sans JP",sans-serif!important}';document.head.append(style);}),css);
}
let frame,pagesChecked=0;
async function turnTo(selector,target=frame){
 await target.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 const item=target.locator(selector).first();if(await item.isVisible())return;
 const nav=item.locator('xpath=ancestor::*[contains(concat(" ",normalize-space(@class)," ")," page-book ")][1]').locator(':scope > .book-pages > select');
 for(const value of await nav.locator('option').evaluateAll(items=>items.map(i=>i.value))){await nav.selectOption(value);if(await item.isVisible())return;}
 throw Error('Unreachable control: '+selector);
}
async function audit(target,label){
 const result=await target.evaluate(async()=>{
  await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
  const failures=[],books=[...document.querySelectorAll('.page-book')].filter(e=>e.getClientRects().length);let count=0;
  for(const host of books){const select=host.querySelector(':scope > .book-pages select'),viewport=host.querySelector(':scope > .book-viewport');
   for(let i=0;i<select.options.length;i++){
    select.value=String(i);select.dispatchEvent(new Event('change'));count++;
    const r=viewport.getBoundingClientRect();
    if(viewport.scrollHeight>viewport.clientHeight+2||viewport.scrollWidth>viewport.clientWidth+2||r.left<0||r.right>innerWidth+1||r.bottom>innerHeight+1)failures.push({page:select.selectedOptions[0].text,h:viewport.clientHeight,scroll:viewport.scrollHeight,w:viewport.clientWidth,scrollW:viewport.scrollWidth});
   }
  }
  for(const dialog of document.querySelectorAll('dialog[open]'))if(dialog.scrollHeight>dialog.clientHeight+2||dialog.scrollWidth>dialog.clientWidth+2)failures.push({dialog:dialog.id,scroll:dialog.scrollHeight,h:dialog.clientHeight});
  return {failures,count};
 });pagesChecked+=result.count;assert.ok(result.count>0,label+' exposes page navigation');assert.deepEqual(result.failures,[],label);
}
try{
 await page.goto('http://127.0.0.1:5197/#story');await page.waitForFunction(()=>['playing','error'].includes(window.__RINNE_TITLE__?.snapshot().state),null,{timeout:120000});
 assert.equal(await page.evaluate(()=>window.__RINNE_TITLE__.snapshot().state),'playing');frame=page.frames().find(f=>f.url().includes('/simulator/index.html'));
 await frame.locator('#settingsBtn').tap();
 for(const size of [{width:360,height:640},{width:390,height:844},{width:844,height:390}]){
  await page.setViewportSize(size);
  await frame.locator('#helpBtn').tap();await audit(frame,'help '+size.width);await frame.locator('#closeHelp').tap();
  for(const tab of ['overview','character','saved','compose']){await frame.locator('#tab-'+tab).tap();await audit(frame,tab+' '+size.width+'×'+size.height);}
  for(const type of ['mind','uke','body']){await frame.locator('[data-creator="'+type+'"]').tap();await audit(frame,'creator '+type+' '+size.width);}
  await frame.locator('[data-creator="attack"]').tap();
  console.log('Notebook pages fit',size.width,size.height);
 }
 await page.setViewportSize({width:390,height:844});await frame.locator('#tab-overview').tap();
 await turnTo('[data-column="jo"][data-row="1"]');await frame.locator('[data-column="jo"][data-row="1"]').tap();
 await frame.locator('#catalogPicker[open]').waitFor();await audit(frame,'candidate picker');
 await turnTo('#pickerItems .picker-option:not([data-value="__none__"])');
 await frame.locator('#pickerItems .picker-option:not([data-value="__none__"])').first().tap();
 await frame.locator('#catalogPicker').waitFor({state:'hidden'});
 const ratio='[data-ratio-column="jo"][data-ratio-index="0"]';await turnTo(ratio);await frame.locator(ratio).fill('50');await frame.locator(ratio).press('Tab');
 const weights=await frame.locator('[data-ratio-column="jo"]').evaluateAll(inputs=>inputs.map(i=>Number(i.value)));assert.equal(weights.reduce((a,b)=>a+b,0),100);assert.equal(weights[0],50);
 await page.screenshot({path:out+'/ratio-mobile.png'});
 await frame.locator('#closeSettings').tap();await frame.waitForFunction(()=>!window.__RINNE_GAME_PORT__.snapshot().paused);
 const cdp=await context.newCDPSession(page),box=await frame.locator('#game').boundingBox(),x=box.x+90,y=box.y+box.height*.54;
 const before=await frame.evaluate(()=>window.__RINNE_GAME_PORT__.snapshot().hero.x);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+58,y}]});
 await frame.waitForFunction(before=>window.__RINNE_GAME_PORT__.snapshot().hero.x-before>.6,before,{timeout:6000});
 await page.waitForTimeout(400); // Hold long enough to release as a swipe, not an auto-dash flick.
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();
 assert.equal(await frame.evaluate(()=>window.__RINNE_GAME_PORT__.snapshot().controls.moving),false);
 for(const size of [{width:360,height:640},{width:844,height:390}]){
  await page.setViewportSize(size);
  for(const id of ['story-map','story-records','story-menu-button']){
   await frame.locator('#'+id).tap();await audit(frame,id+' '+size.width);await frame.locator('dialog[open] .sheet-close').tap();
  }
 }
 await frame.locator('#story-menu-button').tap();await turnTo('[data-tool="cameraBtn"]');await frame.locator('[data-tool="cameraBtn"]').tap();await audit(frame,'camera');await frame.locator('#closeCamera').tap();
 await frame.locator('#story-menu-button').tap();await turnTo('[data-tool="lifeBadge"]');await frame.locator('[data-tool="lifeBadge"]').tap();await audit(frame,'world clock');await frame.locator('#closeLife').tap();
 await frame.locator('#story-menu-button').tap();await turnTo('#story-music');await frame.locator('#story-music').tap();await audit(page,'music room');await page.locator('.soul-music form button').tap();
 await turnTo('#story-exit');const exit=await frame.locator('#story-exit').boundingBox();
 // Tap through the parent touchscreen: this action deliberately removes the game frame.
 await page.touchscreen.tap(exit.x+exit.width/2,exit.y+exit.height/2);await page.locator('#title-screen:not([hidden])').waitFor();
 for(const size of [{width:360,height:640},{width:844,height:390}]){
  await page.setViewportSize(size);await page.locator('#open-settings').tap();await audit(page,'title settings '+size.width);await page.locator('#settings-dialog form button').tap();
  await page.locator('#open-village').tap();await audit(page,'village join '+size.width);await page.locator('#village-dialog form button').tap();
 }
 assert.deepEqual(errors,[]);console.log('Page UI passed:',pagesChecked,'pages; native skill selection and ratio editing, dialog recovery, title/music/peer pages; zero page errors.');
}catch(error){await page.screenshot({path:out+'/failure.png',timeout:10000}).catch(()=>{});console.error('Page errors:',errors);throw error;}
finally{await browser.close();await server.close();}
