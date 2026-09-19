import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const commandPath=resolve(process.argv[2]||'.browser-review/command.json');
const command=JSON.parse(readFileSync(commandPath,'utf8'));
if(!/^https:\/\//.test(command.url||''))throw new Error('command.url must be https');
const out=resolve('test-results/browser-review');mkdirSync(out,{recursive:true});
const viewport={width:Math.max(320,Math.min(2560,Number(command.viewport?.width)||673)),height:Math.max(480,Math.min(2560,Number(command.viewport?.height)||841))};
const browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-webgl','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
const context=await browser.newContext({viewport,deviceScaleFactor:Math.max(1,Math.min(3,Number(command.deviceScaleFactor)||1)),recordVideo:command.video?{dir:out,size:viewport}:undefined});
const page=await context.newPage(),cdp=await context.newCDPSession(page),consoleRows=[],pageErrors=[],requestFailures=[];
page.on('console',m=>consoleRows.push({type:m.type(),text:m.text().slice(0,2000)}));
page.on('pageerror',e=>pageErrors.push(String(e).slice(0,2000)));
page.on('requestfailed',r=>requestFailures.push({url:r.url().slice(0,1000),error:r.failure()?.errorText||''}));
await page.addInitScript(()=>{window.__ASTRA_REVIEW__={frames:[],longTasks:[],inputs:[]};let last=performance.now();const tick=now=>{window.__ASTRA_REVIEW__.frames.push(now-last);if(window.__ASTRA_REVIEW__.frames.length>3600)window.__ASTRA_REVIEW__.frames.shift();last=now;requestAnimationFrame(tick)};requestAnimationFrame(tick);try{new PerformanceObserver(list=>{for(const e of list.getEntries())window.__ASTRA_REVIEW__.longTasks.push({start:e.startTime,duration:e.duration})}).observe({type:'longtask',buffered:true})}catch{};for(const type of ['pointerdown','pointerup','click','keydown'])addEventListener(type,e=>window.__ASTRA_REVIEW__.inputs.push({type,t:performance.now(),target:e.target?.id||e.target?.getAttribute?.('aria-label')||e.target?.tagName||''}),true)});
const steps=[],snap=async(label)=>{const file=`${String(steps.length).padStart(2,'0')}-${String(label||'shot').replace(/[^a-z0-9_-]+/gi,'-').slice(0,50)}.png`;const shot=await cdp.send('Page.captureScreenshot',{format:'png',fromSurface:true,captureBeyondViewport:false});writeFileSync(resolve(out,file),Buffer.from(shot.data,'base64'));return file;};
try{
  const started=Date.now();await page.goto(command.url,{waitUntil:'domcontentloaded',timeout:45000});
  if(command.waitForNetworkIdle!==false)await page.waitForLoadState('networkidle',{timeout:15000}).catch(()=>{});
  steps.push({op:'open',url:page.url(),ms:Date.now()-started,screenshot:await snap('open')});
  for(const [index,action] of (command.actions||[]).entries()){
    const t=Date.now(),op=action.op||'wait';let detail={};
    if(op==='wait')await page.waitForTimeout(Math.min(15000,Math.max(0,Number(action.ms)||500)));
    else if(op==='clickText'){const loc=page.getByText(String(action.text),{exact:Boolean(action.exact)}).first();await loc.click({timeout:10000});detail.text=action.text;}
    else if(op==='clickRole'){const loc=page.getByRole(String(action.role||'button'),{name:action.name,exact:Boolean(action.exact)}).first();await loc.click({timeout:10000});detail.name=action.name;}
    else if(op==='clickSelector'){await page.locator(String(action.selector)).first().click({timeout:10000});detail.selector=action.selector;}
    else if(op==='tap'){await page.mouse.click(Number(action.x),Number(action.y));detail={x:action.x,y:action.y};}
    else if(op==='drag'){await page.mouse.move(Number(action.from?.x),Number(action.from?.y));await page.mouse.down();await page.mouse.move(Number(action.to?.x),Number(action.to?.y),{steps:Math.max(2,Number(action.steps)||12)});await page.mouse.up();detail={from:action.from,to:action.to};}
    else if(op==='key'){await page.keyboard.press(String(action.key));detail.key=action.key;}
    else if(op==='scroll'){await page.mouse.wheel(Number(action.x)||0,Number(action.y)||500);detail={x:action.x||0,y:action.y||500};}
    else if(op==='evaluate'){detail.value=await page.evaluate(String(action.expression));}
    else if(op==='screenshot'){}
    else throw new Error(`unsupported op ${op}`);
    if(action.afterMs)await page.waitForTimeout(Math.min(10000,Math.max(0,Number(action.afterMs))));
    steps.push({index,op,ms:Date.now()-t,...detail,screenshot:action.screenshot===false?null:await snap(action.label||op)});
  }
  const metrics=await page.evaluate(()=>{const r=window.__ASTRA_REVIEW__||{frames:[],longTasks:[],inputs:[]},frames=r.frames.filter(n=>n>0).sort((a,b)=>a-b),pct=p=>frames[Math.min(frames.length-1,Math.floor(frames.length*p))]||0,nav=performance.getEntriesByType('navigation')[0];const canvas=document.querySelector('canvas');let webgl=null;try{const gl=canvas?.getContext('webgl2')||canvas?.getContext('webgl');webgl=gl?{version:gl.getParameter(gl.VERSION),renderer:gl.getParameter(gl.RENDERER)}:null}catch{}return{title:document.title,url:location.href,viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},frames:{samples:frames.length,p50Ms:pct(.5),p95Ms:pct(.95),p99Ms:pct(.99),over50ms:frames.filter(n=>n>50).length},longTasks:r.longTasks.slice(-100),inputs:r.inputs.slice(-200),navigation:nav?{domContentLoaded:nav.domContentLoadedEventEnd,responseEnd:nav.responseEnd,load:nav.loadEventEnd}:null,webgl,visibleText:(document.body?.innerText||'').slice(0,20000)}});
  writeFileSync(resolve(out,'review.json'),JSON.stringify({command,steps,metrics,console:consoleRows,pageErrors,requestFailures},null,2));
  console.log('BROWSER_REVIEW',JSON.stringify({url:metrics.url,title:metrics.title,frames:metrics.frames,longTasks:metrics.longTasks.length,webgl:metrics.webgl,errors:pageErrors.length,requestFailures:requestFailures.length}));
}catch(error){writeFileSync(resolve(out,'failure.json'),JSON.stringify({command,steps,error:String(error?.stack||error),console:consoleRows,pageErrors,requestFailures},null,2));throw error;}finally{await context.close().catch(()=>{});await browser.close().catch(()=>{});}
