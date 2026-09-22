import {chromium} from 'playwright';
import {writeFile, mkdir} from 'node:fs/promises';
const out=process.env.EVIDENCE_DIR;
await mkdir(out,{recursive:true});
const base='https://soul-lineage-rinne-dev.c-okamoto.workers.dev/';
const browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
const context=await browser.newContext({viewport:{width:1280,height:800},locale:'ja-JP',recordVideo:{dir:out+'/video',size:{width:1280,height:800}}});
await context.tracing.start({screenshots:true,snapshots:true,sources:false});
const page=await context.newPage();page.setDefaultTimeout(4500);
const events=[],notes=[],actions=[];
page.on('pageerror',e=>events.push({type:'pageerror',text:String(e)}));
page.on('console',m=>{if(['error','warning'].includes(m.type()))events.push({type:m.type(),text:m.text()});});
page.on('requestfailed',r=>events.push({type:'requestfailed',url:r.url(),error:r.failure()}));
page.on('response',r=>{if(r.status()>=400)events.push({type:'http',status:r.status(),url:r.url()});});
async function shot(name){
 const data=await page.evaluate(()=>({url:location.href,title:document.title,text:document.body.innerText,at:new Date().toISOString(),buttons:[...document.querySelectorAll('button,input,select,dialog')].filter(e=>e.checkVisibility({checkVisibilityCSS:true})).map(e=>({tag:e.tagName,id:e.id,text:e.innerText,label:e.getAttribute('aria-label'),disabled:e.disabled,data:{...e.dataset},rect:e.getBoundingClientRect().toJSON()})),dataset:{...document.querySelector('#app')?.dataset},gameDataset:{...document.querySelector('#game-screen')?.dataset},canvasDataset:{...document.querySelector('#game')?.dataset},tutorial:{...document.querySelector('#rinneFirstRunGuide')?.dataset},storage:{...localStorage},scroll:{width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight,innerWidth,innerHeight},assets:[...document.images].filter(i=>!i.complete||!i.naturalWidth).map(i=>i.src)}));
 await writeFile(out+'/'+name+'.json',JSON.stringify(data,null,2));
 await page.screenshot({path:out+'/'+name+'.png',timeout:15000});
 await writeFile(out+'/'+name+'.html',await page.content());
 console.log('OBSERVATION',name,JSON.stringify({text:data.text,tutorial:data.tutorial,canvas:data.canvasDataset}));
}
async function safe(name,fn){try{await fn();}catch(e){notes.push({name,error:String(e.stack||e)});console.log('ACTION_FAILED',name,String(e));await shot('error-'+name).catch(()=>{});}}
async function click(sel){const loc=page.locator(sel).first();if(await loc.isVisible().catch(()=>false)){await loc.click();actions.push({at:Date.now(),click:sel});await page.waitForTimeout(300);return true;}return false;}
async function drag(x,y,dx,dy,hold=700){await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+dx,y+dy,{steps:18});await page.waitForTimeout(hold);await page.mouse.up();actions.push({drag:[x,y,dx,dy,hold]});await page.waitForTimeout(300);}
async function keyMove(key,ms){await page.keyboard.down(key);await page.waitForTimeout(ms);await page.keyboard.up(key);actions.push({key,ms});await page.waitForTimeout(500);}
async function closePanels(){if(await page.locator('[data-book-action="close"]').first().isVisible().catch(()=>false))await click('[data-book-action="close"]');else await click('button[data-close]');}
try{
 await writeFile(out+'/version-before.json',await (await context.request.get(base+'version.json')).text());
 await page.goto(base,{waitUntil:'domcontentloaded',timeout:60000});
 await page.locator('#soul-brand-boot').waitFor({state:'visible',timeout:45000});
 await shot('01-brand-ready');await page.locator('#soul-brand-boot').click({timeout:45000});
 await page.waitForTimeout(3500);await shot('02-title-cinematic');
 await safe('skip-title',async()=>{if(await page.locator('#soul-brand-boot').isVisible())await page.locator('#soul-brand-boot').click();await page.locator('#title-screen').click({position:{x:100,y:150},timeout:15000});});
 await page.waitForTimeout(1000);await shot('03-title');
 await safe('settings',async()=>{await click('#open-settings');await shot('04-settings');await click('#close-settings');});
 await safe('village-code',async()=>{await click('#open-village-code');await shot('05-village-code');await click('#close-village-code');});
 await page.setViewportSize({width:393,height:852});await shot('06-title-phone');await page.setViewportSize({width:1280,height:800});
 await page.locator('#new-life').click({timeout:20000});await page.waitForTimeout(700);await shot('07-question1');
 await page.waitForTimeout(3900);await shot('08-question1-autochange');
 for(let i=0;i<3;i++){await safe('answer-'+i,async()=>{const answer=page.locator('[data-memory-current]');await answer.waitFor({state:'visible',timeout:8000});await shot('09-question-'+i);await answer.click();await page.waitForTimeout(1300);});}
 await shot('10-birth-confirm');await page.locator('[data-origin-confirm]').click({timeout:8000});
 await page.locator('#game[data-runtime="active"]').waitFor({state:'attached',timeout:60000});
 await page.waitForTimeout(1200);await shot('11-newborn');
 await safe('tutorial',async()=>{await click('.rinneFirstRunStart');await drag(540,510,170,-70,1500);await shot('12-tutorial-movement');await click('[data-heart]');await shot('13-tutorial-heart');await page.waitForTimeout(2000);await shot('14-tutorial-heart-wait');await closePanels();await click('.rinneFirstRunSkip');});
 await safe('birth',async()=>{await page.waitForTimeout(7000);await shot('15-mother-tour');await click('#clock-rate');await click('#clock-rate');await click('#clock-rate');await shot('16-world-speed');await page.waitForTimeout(16000);await shot('17-childhood');await drag(540,510,170,0,1200);await shot('18-child-movement');});
 for(const [name,selector] of [['heart','[data-heart]'],['techniques','[data-techniques]'],['body','button[data-body]'],['equipment','[data-items]']]){
  await safe('menu-'+name,async()=>{await closePanels();await click(selector);await page.waitForTimeout(1200);await shot('20-'+name+'-desktop');await page.setViewportSize({width:393,height:852});await page.waitForTimeout(700);await shot('21-'+name+'-phone');await page.setViewportSize({width:852,height:393});await page.waitForTimeout(500);await shot('22-'+name+'-landscape');await page.setViewportSize({width:1280,height:800});await click('[data-book-action="help"]');await shot('23-'+name+'-help');await page.keyboard.press('Escape');await closePanels();});
 }
 await safe('search-keyboard',async()=>{await click('[data-heart]');const s=page.locator('[data-book-search]');await s.click();await page.keyboard.type('test',{delay:300});await shot('24-search-test');await page.keyboard.press('Tab');await shot('25-search-blur');await closePanels();});
 await safe('map',async()=>{await click('[data-menu]');await click('[data-map]');await shot('26-map-desktop');await page.setViewportSize({width:393,height:852});await shot('27-map-phone');await page.setViewportSize({width:1280,height:800});await closePanels();});
 await safe('record',async()=>{await click('[data-menu]');await click('[data-record]');await shot('28-record');await page.setViewportSize({width:393,height:852});await shot('29-record-phone');await page.setViewportSize({width:1280,height:800});await closePanels();});
 await safe('native-roam',async()=>{
  await shot('30-before-roam');
  for(const [i,key,ms] of [[0,'ArrowRight',5000],[1,'ArrowUp',4000],[2,'ArrowLeft',7000],[3,'ArrowDown',4500]]){await keyMove(key,ms);await shot('31-roam-'+i);}
  await page.mouse.move(640,440);await page.mouse.down();await page.waitForTimeout(1600);await page.mouse.up();await shot('32-rest');
  await page.waitForTimeout(4000);await shot('33-rest-later');
 });
 await writeFile(out+'/storage-state-before-title.json',JSON.stringify(await context.storageState(),null,2));
 await safe('save-and-continue',async()=>{await click('#back-title');await page.waitForTimeout(1000);await shot('34-return-title');await click('#continue-life');await shot('35-family-home');await click('[data-family-action="continue"]');await page.waitForTimeout(1800);await shot('36-resumed');});
 await writeFile(out+'/storage-state.json',JSON.stringify(await context.storageState(),null,2));
 await writeFile(out+'/version-after.json',await (await context.request.get(base+'version.json')).text());
}catch(e){notes.push({name:'fatal',error:String(e.stack||e)});await shot('fatal').catch(()=>{});console.log('FATAL',String(e.stack||e));}
finally{await writeFile(out+'/diagnostics.json',JSON.stringify({events,notes,actions},null,2));await context.tracing.stop({path:out+'/trace.zip'}).catch(()=>{});await context.close();await browser.close();}
