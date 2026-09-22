import {chromium} from 'playwright';
import {writeFile,mkdir} from 'node:fs/promises';
const out=process.env.EVIDENCE_DIR,base='https://soul-lineage-rinne-dev.c-okamoto.workers.dev/';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
const context=await browser.newContext({viewport:{width:1280,height:800},locale:'ja-JP'});
const page=await context.newPage();page.setDefaultTimeout(5000);const cdp=await context.newCDPSession(page),events=[],notes=[],actions=[];
page.on('pageerror',e=>events.push({type:'pageerror',text:String(e)}));page.on('response',r=>{if(r.status()>=400)events.push({type:'http',status:r.status(),url:r.url()});});
page.on('requestfailed',r=>events.push({type:'requestfailed',url:r.url(),error:r.failure()}));
async function shot(name){
 const data=await page.evaluate(()=>({at:new Date().toISOString(),url:location.href,text:document.body.innerText,dataset:{...document.querySelector('#app')?.dataset},gameDataset:{...document.querySelector('#game-screen')?.dataset},canvasDataset:{...document.querySelector('#game')?.dataset},tutorial:{...document.querySelector('#rinneFirstRunGuide')?.dataset},storage:{...localStorage},elements:[...document.querySelectorAll('button,input,select,dialog,.family-memory-presence,.rb-detail-copy,.rb-tile,.rb-book,.rb-page')].filter(e=>e.getBoundingClientRect().width&&e.getBoundingClientRect().height).map(e=>{const s=getComputedStyle(e);return{tag:e.tagName,id:e.id,class:e.className,text:e.innerText,value:e.value,data:{...e.dataset},disabled:e.disabled,label:e.getAttribute('aria-label'),rect:e.getBoundingClientRect().toJSON(),style:{opacity:s.opacity,visibility:s.visibility,display:s.display,fontSize:s.fontSize,animation:s.animationName,transform:s.transform}};}),scroll:{width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight,innerWidth,innerHeight},missingImages:[...document.images].filter(i=>!i.complete||!i.naturalWidth).map(i=>i.src)}));
 await writeFile(out+'/'+name+'.json',JSON.stringify(data,null,2));console.log('OBSERVATION',name,JSON.stringify({text:data.text,tutorial:data.tutorial,canvas:data.canvasDataset}));
 try{const image=await Promise.race([cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false,fromSurface:true}),new Promise((_,r)=>setTimeout(()=>r(Error('capture timeout')),6000))]);await writeFile(out+'/'+name+'.png',Buffer.from(image.data,'base64'));}catch(e){notes.push({capture:name,error:String(e)});}
}
async function tap(selector){const l=page.locator(selector).first();if(!await l.count())return false;const b=await l.boundingBox();if(!b||b.width<1||b.height<1)return false;await page.mouse.click(b.x+b.width/2,b.y+b.height/2);actions.push({tap:selector,position:[b.x+b.width/2,b.y+b.height/2]});await page.waitForTimeout(350);return true;}
async function safe(name,fn){try{await fn();}catch(e){notes.push({action:name,error:String(e)});await shot('error-'+name).catch(()=>{});}}
async function drag(dx,dy,hold=900){await page.mouse.move(550,450);await page.mouse.down();await page.mouse.move(550+dx,450+dy,{steps:12});await page.waitForTimeout(hold);await page.mouse.up();await page.waitForTimeout(400);actions.push({drag:[dx,dy,hold]});}
async function close(){if(!await tap('[data-book-action="close"]'))await tap('button[data-close]');}
async function move(key,ms){await page.keyboard.down(key);await page.waitForTimeout(ms);await page.keyboard.up(key);await page.waitForTimeout(600);actions.push({key,ms});}
try{
 await writeFile(out+'/version-before.json',await(await context.request.get(base+'version.json')).text());
 await page.goto(base,{waitUntil:'domcontentloaded',timeout:60000});await page.waitForTimeout(4500);await tap('#soul-brand-boot');await page.waitForTimeout(1500);await tap('#soul-brand-boot');await page.waitForTimeout(1500);await page.mouse.click(100,160);
 await page.waitForFunction(()=>{const a=document.querySelector('.title-actions');return a&&!a.inert;},{},{timeout:30000});await shot('01-title');
 await tap('#open-settings');await shot('02-settings');await tap('#close-settings');await tap('#open-village-code');await shot('03-village-code');await tap('#close-village-code');
 await page.setViewportSize({width:393,height:852});await shot('04-title-phone');await page.setViewportSize({width:1280,height:800});
 await tap('#new-life');await page.waitForTimeout(1400);await shot('05-question-invisible');await page.waitForTimeout(1300);await shot('06-question-invisible-later');
 for(let i=0;i<3;i++){await tap('[data-memory-current]');await page.waitForTimeout(1200);await shot('07-answer-'+i);}
 await tap('[data-origin-confirm]');await page.locator('#game[data-runtime="active"]').waitFor({state:'attached',timeout:45000});await page.waitForTimeout(700);await shot('08-newborn');
 await tap('.rinneFirstRunStart');await drag(170,-70,1800);await shot('09-tutorial-move');await tap('[data-heart]');await page.waitForTimeout(1200);await shot('10-tutorial-heart');await page.waitForTimeout(1000);await shot('11-tutorial-heart-later');await close();await tap('.rinneFirstRunSkip');
 await page.waitForTimeout(6500);await shot('12-mother-tour');await tap('#clock-rate');await tap('#clock-rate');await tap('#clock-rate');await shot('13-world-speed');await page.waitForTimeout(15500);await shot('14-child');await drag(140,0,1000);await shot('15-child-move');
 for(const [name,s]of[['heart','[data-heart]'],['technique','[data-techniques]'],['body','button[data-body]'],['items','[data-items]']]){
  await safe(name,async()=>{await close();await tap(s);await page.waitForTimeout(400);await shot('20-'+name+'-desktop');await page.setViewportSize({width:393,height:852});await page.waitForTimeout(400);await shot('21-'+name+'-phone');await page.setViewportSize({width:852,height:393});await page.waitForTimeout(400);await shot('22-'+name+'-landscape');await page.setViewportSize({width:1280,height:800});await tap('[data-book-action="help"]');await shot('23-'+name+'-help');await page.keyboard.press('Escape');await close();});
 }
 await safe('search',async()=>{await tap('[data-heart]');await tap('[data-book-search]');await page.keyboard.type('test',{delay:120});await shot('24-search');await page.keyboard.press('Tab');await shot('25-search-blur');await close();});
 await safe('map',async()=>{await tap('[data-menu]');await tap('[data-map]');await shot('26-map');await page.setViewportSize({width:393,height:852});await shot('27-map-phone');await page.setViewportSize({width:1280,height:800});await close();});
 await safe('record',async()=>{await tap('[data-menu]');await tap('[data-record]');await shot('28-record');await page.setViewportSize({width:393,height:852});await shot('29-record-phone');await page.setViewportSize({width:1280,height:800});await close();});
 await safe('conversation',async()=>{await tap('.speech-fan-toggle');await shot('30-speech');await tap('.speech-phrase');await shot('31-speech-result');});
 await safe('roam',async()=>{for(const [i,k,ms]of[[0,'ArrowRight',4500],[1,'ArrowUp',3000],[2,'ArrowLeft',5000],[3,'ArrowDown',3000]]){await move(k,ms);await shot('32-roam-'+i);}await page.mouse.move(640,440);await page.mouse.down();await page.waitForTimeout(1800);await page.mouse.up();await shot('33-rest');});
 await writeFile(out+'/storage-state-before-title.json',JSON.stringify(await context.storageState(),null,2));
 await safe('continue',async()=>{await close();await tap('#back-title');await page.waitForTimeout(1200);await shot('34-title-return');await tap('#continue-life');await shot('35-family-home');await tap('[data-family-action="continue"]');await page.waitForTimeout(1200);await shot('36-resumed');});
 await writeFile(out+'/storage-state.json',JSON.stringify(await context.storageState(),null,2));await writeFile(out+'/version-after.json',await(await context.request.get(base+'version.json')).text());
}catch(e){notes.push({fatal:String(e.stack||e)});await shot('fatal').catch(()=>{});console.log('FATAL',String(e.stack||e));}
finally{await writeFile(out+'/diagnostics.json',JSON.stringify({events,notes,actions},null,2));await context.close();await browser.close();}
