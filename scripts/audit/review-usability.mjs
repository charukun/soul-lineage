// Explicit user-requested audit of the public UI. No deployment, source edits,
// backend writes, secrets, test-assertion relaxation or private account access.
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
const URL = 'https://rinne-visual-review.c-okamoto.workers.dev/';
const DIR = 'test-results/usability-audit';
mkdirSync(DIR, { recursive: true });
const report = { target: URL, requestedBuild: 'f31b6a901f91', startedAt: new Date().toISOString(), environment: 'GitHub Linux Chromium, 390x844 mobile touch emulation, software WebGL; not physical Pixel Fold', steps: [], errors: [], warnings: [], requests: [], responses: [], observations: [] };
const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader','--enable-webgl','--enable-unsafe-swiftshader'] });
const context = await browser.newContext({ viewport: { width:390,height:844 }, deviceScaleFactor:1, isMobile:true, hasTouch:true, acceptDownloads:true, recordVideo:{ dir:DIR+'/video',size:{width:390,height:844} } });
await context.grantPermissions(['clipboard-read','clipboard-write'], { origin:URL });
await context.tracing.start({ screenshots:true,snapshots:false,sources:false });
let page = await context.newPage();
page.setDefaultTimeout(7000);
const born = Date.now();
page.on('pageerror', e => report.errors.push({at:Date.now()-born,message:e.message}));
page.on('console', m => {if(m.type()==='error')report.errors.push({at:Date.now()-born,message:m.text()});else if(m.type()==='warning')report.warnings.push({at:Date.now()-born,message:m.text()});});
page.on('requestfailed', r => report.requests.push({url:r.url(),failure:r.failure(),type:r.resourceType()}));
page.on('response', r => { if(r.status()>=400)report.responses.push({url:r.url(),status:r.status()}); });
const snapshot = async () => page.evaluate(() => ({ ...window.__reviewLab?.snapshot(), buildLabel:document.querySelector('#build-label')?.textContent, status:document.querySelector('#review-status')?.textContent, model:document.querySelector('#preset')?.value, selectedMotion:document.querySelector('#clip')?.value, loop:document.querySelector('#loop-toggle')?.checked, weapon:document.querySelector('#weapon-select')?.value, weaponOn:document.querySelector('#weapon-toggle')?.checked, mode:[...document.querySelectorAll('[data-combat-mode]')].map(x=>({id:x.dataset.combatMode,active:x.classList.contains('active')})) }));
const save = () => writeFileSync(DIR+'/report.json', JSON.stringify(report,null,2));
async function shot(name){await page.screenshot({path:DIR+'/'+name+'.png',timeout:10000});}
async function step(name, action){
 const record={name,startMs:Date.now()-born}; report.steps.push(record);
 try{record.result=await action();record.outcome='completed';}
 catch(e){record.outcome='operation-failed';record.error=String(e);await shot('failure-'+report.steps.length).catch(()=>{});}
 record.endMs=Date.now()-born;save();console.log('AUDIT STEP',JSON.stringify(record));
}
async function tab(id){await page.locator(`[data-review-tab="${id}"]`).click();}
async function uiMotion(selectId, value){
 const trigger=page.locator(`[data-picker-for="${selectId}"]`);
 await trigger.click();
 const items=page.locator('#picker-list .picker-item');
 const index=await items.evaluateAll((nodes,v)=>nodes.findIndex(n=>n.querySelector('small')?.textContent===v),value);
 if(index<0)throw new Error('Motion absent from visible picker: '+value);
 await items.nth(index).click();
 const play=page.locator(`[data-play-select="${selectId}"]`);
 if(await play.isVisible())await play.click();
 await page.waitForTimeout(100);
 return snapshot();
}
async function seek(time){
 // Deterministic frame inspection uses the existing timeline input event only;
 // never replaces a clip or mutates the renderer's internal pose.
 await page.locator('#timeline').evaluate((node,t)=>{node.value=String(t);node.dispatchEvent(new Event('input',{bubbles:true}));},time);
 await page.waitForTimeout(80);
}
async function geometry(){return page.evaluate(()=>{
 const box=node=>{const r=node.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom};};
 const canvas=document.querySelector('#review-canvas');
 const controls=[...document.querySelectorAll('button,input,select')].filter(n=>n.getClientRects().length&&getComputedStyle(n).visibility!=='hidden').map(n=>({id:n.id,text:n.textContent?.trim().slice(0,60),type:n.type,box:box(n),font:getComputedStyle(n).fontSize}));
 return{viewport:[innerWidth,innerHeight],document:[document.documentElement.scrollWidth,document.documentElement.scrollHeight],canvas:box(canvas),scroll:scrollY,controls};
});}
try{
 await step('Open deployed build and load real Shino',async()=>{
  const r=await page.goto(URL,{waitUntil:'domcontentloaded',timeout:60000});report.httpStatus=r.status();
  await page.waitForFunction(()=>window.__reviewLab?.snapshot().loaded,null,{timeout:120000});
  report.firstModelMs=Date.now()-born;const s=await snapshot();report.initial=s;
  await shot('01-initial-mobile');writeFileSync(DIR+'/initial.html',await page.content());return s;
 });
 if(!report.initial?.loaded)throw new Error('Public real-model scene did not load. Subsequent UI inspection cannot be claimed.');
 await step('Main controls, scroll isolation and touch camera',async()=>{
  const before=await geometry();
  const panel=page.locator('.notebook-scroll');await panel.evaluate(n=>n.scrollTop=n.scrollHeight);const after=await geometry();
  await panel.evaluate(n=>n.scrollTop=0);
  const rect=await page.locator('#review-canvas').boundingBox();const x=rect.x+rect.width*.4,y=rect.y+rect.height*.56;
  const cdp=await context.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
  for(let i=1;i<=8;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+12*i,y}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await page.waitForTimeout(300);await shot('02-touch-camera');await cdp.detach();return{before,after};
 });
 await step('Motion picker and Tidebreak Attack playback',async()=>{
  await tab('skill');const s=await uiMotion('stage-ha','Tidebreak / Attack');
  const samples=[s];for(const ms of [350,400,600,900,700]){await page.waitForTimeout(ms);samples.push(await snapshot());}
  await shot('03-attack-playback');return{samples};
 });
 await step('Attack deterministic phase inspection from three camera angles',async()=>{
  await tab('advanced');if(await page.locator('#weapon-toggle').isChecked())await page.locator('#weapon-toggle').uncheck();
  await page.locator('[data-camera="front"]').click();
  const duration=await page.locator('#timeline').getAttribute('max');const poses=[];
  for(const t of [0,.18,.38,.60,.78,.86,1.03,1.25,1.65,2.05,2.3]){await seek(t);poses.push(await snapshot());await shot('attack-front-'+String(t).replace('.','_'));}
  await page.locator('[data-camera="right"]').click();
  for(const t of [.38,.78,1.03,1.65]){await seek(t);await shot('attack-side-'+String(t).replace('.','_'));}
  await page.locator('[data-camera="three"]').click();await seek(.82);await shot('04-attack-threequarter');
  return{duration,poses};
 });
 await step('Transport, exact endpoint, loop and slow playback',async()=>{
  await seek(.82);const before=await snapshot();await page.locator('#step-forward').click();const forward=await snapshot();await page.locator('#step-back').click();const back=await snapshot();
  await page.locator('#loop-toggle').uncheck();await seek(2.20);await page.locator('#play-toggle').click();await page.waitForTimeout(700);const end=await snapshot();
  await page.locator('#restart').click();const restart=await snapshot();
  await page.locator('#speed').selectOption('0.25');await page.locator('#play-toggle').click();await page.waitForTimeout(650);const slow=await snapshot();await page.locator('#play-toggle').click();await page.locator('#speed').selectOption('1');
  return{before,forward,back,end,restart,slow};
 });
 await step('Weapon quick choices and every detailed weapon including katana',async()=>{
  const quick=await page.locator('[data-weapon]').evaluateAll(ns=>ns.map(n=>({id:n.dataset.weapon,label:n.textContent})));
  const choices=await page.locator('#weapon-select option').evaluateAll(ns=>ns.map(n=>({id:n.value,label:n.textContent})));
  await page.locator('#weapon-toggle').check();await seek(.82);await page.locator('[data-camera="three"]').click();
  const checked=[];
  for(const item of choices){await page.locator('#weapon-select').selectOption(item.id);await page.waitForTimeout(1000);await shot('weapon-'+item.id);checked.push(await snapshot());}
  await page.locator('#weapon-toggle').uncheck();return{quick,choices,checked};
 });
 await step('Normal versus combat mode really changes the pose',async()=>{
  await tab('skill');await uiMotion('stage-ha','Tidebreak / Attack');
  const before=await snapshot();
  await page.locator('[data-combat-mode="normal"]').click();await page.waitForTimeout(200);const normal=await snapshot();await shot('05-normal-mode');
  await page.locator('[data-combat-mode="combat"]').click();await page.waitForTimeout(200);const combat=await snapshot();await shot('06-combat-mode');
  return{before,normal,combat};
 });
 await step('Shared flowing-slash availability and motion selection',async()=>{
  await page.waitForFunction(()=>[...document.querySelector('#clip').options].some(o=>o.value==='技 / 流し斬り'),null,{timeout:90000});
  await tab('skill');const s=await uiMotion('stage-ha','技 / 流し斬り');
  await tab('advanced');await page.locator('#weapon-select').selectOption('katana');await page.locator('#weapon-toggle').check();await page.waitForTimeout(800);await page.locator('[data-camera="three"]').click();
  const max=Number(await page.locator('#timeline').getAttribute('max'));const poses=[];
  for(const f of [0,.25,.45,.6,.8,1]){await seek(max*f);poses.push(await snapshot());await shot('slash-'+Math.round(f*100));}
  await page.locator('#weapon-toggle').uncheck();return{selected:s,duration:max,poses};
 });
 for(const [kind,selectId]of [['reaction','reaction-select'],['stance','stance-select'],['parry','parry-select'],['axis','axis-shin'],['move','move-select']]){
  await step('Tab operation: '+kind,async()=>{await tab(kind);const opts=await page.locator('#'+selectId+' option').evaluateAll(ns=>ns.map(n=>({value:n.value,label:n.textContent})));if(!opts.length)throw new Error('No choices');const s=await uiMotion(selectId,opts[0].value);await shot('tab-'+kind);return{options:opts.length,first:opts[0],result:s};});
 }
 await step('Motion labels, technique composition and keyboard picker dismissal',async()=>{
  await tab('skill');const all=await page.locator('#clip option').evaluateAll(ns=>ns.map(n=>({value:n.value,label:n.textContent,disabled:n.disabled})));
  const slots=await page.locator('#stage-jo,#stage-ha,#stage-kyu').evaluateAll(ns=>ns.map(n=>({id:n.id,value:n.value,choices:n.options.length})));
  const combined=await page.locator('#skill-fire').isVisible();
  await page.locator('[data-picker-for="stage-ha"]').click();await page.keyboard.press('Escape');const escapeClosed=!(await page.locator('#picker-backdrop').isVisible());if(!escapeClosed)await page.locator('#picker-close').click();
  return{all,slots,combinedActionVisible:combined,escapeClosed};
 });
 await step('State URL, copied review information, screenshot export and fresh-page restore',async()=>{
  await tab('advanced');await page.locator('#weapon-select').selectOption('katana');await page.locator('#weapon-toggle').check();await seek(.44);
  await page.locator('#review-note').fill('read-only usability inspection');
  const before=await snapshot();await page.locator('#copy-review').click();await page.waitForTimeout(100);const copied=await page.evaluate(()=>navigator.clipboard.readText()).catch(e=>String(e));
  await page.locator('#copy-link').click();await page.waitForTimeout(200);const link=page.url();
  const download=page.waitForEvent('download',{timeout:2500}).catch(()=>null);await page.locator('#capture').click();const d=await download;if(d)await d.saveAs(DIR+'/ui-capture.png');
  const other=await context.newPage();await other.goto(link,{waitUntil:'domcontentloaded',timeout:60000});await other.waitForFunction(()=>window.__reviewLab?.snapshot().loaded,null,{timeout:90000});await other.waitForTimeout(1000);
  const restored=await other.evaluate(()=>({snapshot:window.__reviewLab?.snapshot(),weapon:document.querySelector('#weapon-select')?.value,weaponOn:document.querySelector('#weapon-toggle')?.checked,loop:document.querySelector('#loop-toggle')?.checked,note:document.querySelector('#review-note')?.value}));
  await other.screenshot({path:DIR+'/07-shared-link-restored.png'});await other.close();
  return{before,copied,link,restored};
 });
 await step('Every preset via visible character picker',async()=>{
  const results=[];
  for(let i=0;i<8;i++){
   await page.locator('.model-select-trigger').click();const items=page.locator('.model-picker-item');const count=await items.count();if(i>=count){await page.locator('.model-picker-sheet header button').click();break;}
   const label=await items.nth(i).innerText();const started=Date.now();await items.nth(i).click();
   await page.waitForFunction(()=>window.__reviewLab?.snapshot().loaded,null,{timeout:60000});await page.waitForTimeout(500);const s=await snapshot();await shot('model-'+i);results.push({label,ms:Date.now()-started,result:s});
  }
  return results;
 });
 await step('Viewport sizes, notebook scrolling and visible target sizes',async()=>{
  const list=[];
  for(const[width,height]of[[320,568],[390,844],[412,892],[844,390],[1280,800]]){
   await page.setViewportSize({width,height});await page.waitForTimeout(200);await tab('advanced');const before=await geometry();await page.locator('.notebook-scroll').evaluate(n=>n.scrollTop=n.scrollHeight);const after=await geometry();await shot('layout-'+width+'x'+height);await page.locator('.notebook-scroll').evaluate(n=>n.scrollTop=0);list.push({before,after});
  }
  return list;
 });
 report.final=await snapshot();report.resourceTiming=await page.evaluate(()=>performance.getEntriesByType('resource').map(r=>({name:r.name,duration:r.duration,transferSize:r.transferSize,encodedBodySize:r.encodedBodySize})));
 report.auditExecuted=true;
}catch(e){report.fatal=String(e);process.exitCode=1;}
finally{report.finishedAt=new Date().toISOString();save();await context.tracing.stop({path:DIR+'/operations-trace.zip'}).catch(()=>{});await context.close();await browser.close();console.log('AUDIT SUMMARY',JSON.stringify({executed:report.auditExecuted,steps:report.steps.map(s=>({name:s.name,outcome:s.outcome})),errors:report.errors,failedRequests:report.requests,fatal:report.fatal}));}
