import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

// Review-only: browser UI input and read-only diagnostics. No game-state injection,
// no server mutations, no authenticated context, no deployment or code changes.
const root = 'director-evidence';
await mkdir(root, {recursive:true});
const browser = await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const reports=[];
for (const app of ['rinne','village','demon']) {
  const dir=join(root,app); await mkdir(dir,{recursive:true});
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true,locale:'ja-JP',timezoneId:'Asia/Tokyo',recordVideo:{dir:join(dir,'video'),size:{width:390,height:844}}});
  await context.tracing.start({screenshots:true,snapshots:true,sources:true});
  const page=await context.newPage(); page.setDefaultTimeout(4500);
  const cdp=await context.newCDPSession(page);
  const report={app,url:`https://charukun.github.io/soul-lineage/dev/${app}/`,startedAt:new Date().toISOString(),steps:[],console:[],pageErrors:[],requests:[],notes:['Fresh isolated browser context; touch-emulated Chromium/SwiftShader, not physical Pixel Fold.']};
  reports.push(report);
  page.on('console',m=>{if(['error','warning'].includes(m.type())&&report.console.length<250)report.console.push({type:m.type(),text:m.text()});});
  page.on('pageerror',e=>report.pageErrors.push(e.message));
  page.on('requestfailed',r=>{if(report.requests.length<250)report.requests.push({url:r.url(),method:r.method(),failure:r.failure()});});
  let seq=0;
  async function capture(label) {
    const id=String(++seq).padStart(2,'0')+'-'+label;
    const step={id,at:new Date().toISOString(),url:page.url(),frames:[]};
    for(const frame of page.frames()) {
      try {step.frames.push(await frame.evaluate(()=>{
        const visible=el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden';};
        const controls=[...document.querySelectorAll('button,a,input,select,[role="button"],summary')].filter(visible).map(el=>{
          const r=el.getBoundingClientRect();return {tag:el.tagName,id:el.id,text:(el.innerText||el.textContent||'').trim().slice(0,220),aria:el.getAttribute('aria-label'),title:el.getAttribute('title'),disabled:el.disabled,value:el.value,type:el.type,href:el.getAttribute('href'),data:{...el.dataset},rect:{x:r.x,y:r.y,w:r.width,h:r.height},options:el.tagName==='SELECT'?[...el.options].map(o=>({value:o.value,text:o.text})):undefined};
        });
        const diagnostics={};
        for(const [name,key,method] of [['title','__RINNE_TITLE__','snapshot'],['life','__LIFE_LAB__','snapshot'],['atelier','__ATELIER__','snapshot'],['demon','__NIGHT_HUNT__','snapshot']]){try{if(window[key]?.[method])diagnostics[name]=window[key][method]();}catch(e){diagnostics[name]={error:String(e)};}}
        return {url:location.href,title:document.title,text:document.body.innerText,viewport:{w:innerWidth,h:innerHeight,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight},controls,diagnostics,audio:[...document.querySelectorAll('audio')].map(a=>({src:a.currentSrc,paused:a.paused,currentTime:a.currentTime,readyState:a.readyState,error:a.error?.code})),canvas:[...document.querySelectorAll('canvas')].map(c=>({id:c.id,width:c.width,height:c.height,data:{...c.dataset}}))};
      }));} catch(e){step.frames.push({url:frame.url(),error:String(e)});}
    }
    try{await page.screenshot({path:join(dir,id+'.png'),timeout:12000});}catch(e){step.screenshotError=String(e);}
    report.steps.push(step);
    await writeFile(join(dir,'report.json'),JSON.stringify(report,null,2));
    console.log(app,id,step.frames.map(f=>f.text?.slice(0,350)).join('\n'));
  }
  async function act(label,fn,wait=800){
    try{await fn();await page.waitForTimeout(wait);report.steps.push({action:label,result:'performed',at:new Date().toISOString()});}
    catch(e){report.steps.push({action:label,result:'not-performed-or-incomplete',error:String(e).slice(0,900),at:new Date().toISOString()});}
    await capture(label);
  }
  async function tap(locator){await locator.first().tap({timeout:4500});}
  async function swipe(x,y,dx,dy,hold=1800){
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
    for(let i=1;i<=8;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+dx*i/8,y:y+dy*i/8}]});await page.waitForTimeout(40);}
    await page.waitForTimeout(hold);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  }
  try {
    const vr=await context.request.get(report.url+'version.json');report.version=await vr.json();
    const start=Date.now();const response=await page.goto(report.url,{waitUntil:'domcontentloaded',timeout:60000});report.httpStatus=response.status();
    await page.locator('#game[data-renderer="ready"]').waitFor({timeout:90000});report.rendererReadyMs=Date.now()-start;
    await page.waitForTimeout(1500); await capture('initial');
    if(app==='rinne') {
      await act('enter-simulator',()=>tap(page.locator('#start-simulator')),1500);
      const frame=page.frames().find(f=>f.url().includes('/simulator/index.html'));
      if(!frame)throw new Error('Simulator frame not reached');
      await frame.waitForFunction(()=>window.__ATELIER__?.snapshot().ready,{},{timeout:90000});
      await capture('simulator-ready');
      await act('life-menu',()=>tap(frame.locator('#lifeBadge')));
      await act('life-rate-20',()=>tap(frame.locator('[data-life-rate="20"]')));
      await act('life-resume',()=>tap(frame.locator('#lifeResume')));
      await act('touch-move-right',()=>swipe(185,445,65,0,1800));
      await act('touch-move-forward',()=>swipe(185,445,0,-65,1800));
      await act('settings',()=>tap(frame.getByRole('button',{name:'設定',exact:true})));
      await act('close-settings',()=>tap(frame.getByRole('button',{name:/閉じる|戻る|再開|適用/})));
      await act('view-options',()=>tap(frame.getByRole('button',{name:'視点',exact:true})));
      await act('close-view',()=>tap(frame.getByRole('button',{name:/閉じる|戻る|再開|適用/})));
      await page.waitForTimeout(55000);await capture('growth-and-play-observation');
      await act('return-title',()=>tap(page.locator('#back-title')));
      await act('reenter-simulator',()=>tap(page.locator('#start-simulator')),5000);
      await capture('reentry');
    } else if(app==='village') {
      await act('enter-village',()=>tap(page.locator('#muraEnterVillage')));
      await act('build-catalog',()=>tap(page.locator('#build')));
      await act('select-tent',()=>tap(page.getByRole('button',{name:/テント/})));
      await act('place-preview',()=>page.touchscreen.tap(200,485));
      await act('confirm-placement',()=>tap(page.getByRole('button',{name:/ここに|配置する|確定|建てる|置く/})));
      await act('build-again',()=>tap(page.locator('#build')));
      await act('select-bench',()=>tap(page.getByRole('button',{name:/ベンチ/})));
      await act('bench-location',()=>page.touchscreen.tap(245,450));
      await act('confirm-bench',()=>tap(page.getByRole('button',{name:/ここに|配置する|確定|建てる|置く/})));
      await act('settings',()=>tap(page.getByRole('button',{name:'設定',exact:true})));
      await act('close-settings',()=>tap(page.getByRole('button',{name:/閉じる|村に戻る|再開/})));
      await act('pan-village',()=>swipe(200,470,-70,25,200));
      await act('select-building',()=>page.touchscreen.tap(160,390));
      report.storageBeforeReload=await page.evaluate(()=>({...localStorage}));
      await act('reload',()=>page.reload({waitUntil:'domcontentloaded',timeout:60000}),3000);
      await act('reenter-village',()=>tap(page.locator('#muraEnterVillage')));
      report.storageAfterReload=await page.evaluate(()=>({...localStorage}));
    } else {
      await act('hunt-destinations',()=>tap(page.locator('#begin')));
      await act('choose-first-destination',()=>tap(page.locator('[data-village]')),2000);
      await act('single-tap',()=>page.touchscreen.tap(195,510));
      await act('move-towards-first-prey',()=>swipe(195,510,0,-100,3300));
      await act('devour-attempt',()=>tap(page.getByRole('button',{name:/喰|捕食/})),2000);
      await act('continue-forward',()=>swipe(195,510,0,-90,2700));
      await act('devour-again',()=>tap(page.getByRole('button',{name:/喰|捕食/})),2200);
      await act('move-left',()=>swipe(195,510,-80,0,2500));
      await act('body-memory',()=>tap(page.getByRole('button',{name:/憶|肉体/})));
      await act('close-body-memory',()=>tap(page.locator('#sheet-close')));
      await act('move-right',()=>swipe(195,510,90,0,3300));
      await act('devour-third',()=>tap(page.getByRole('button',{name:/喰|捕食/})),2500);
      await act('retreat',()=>tap(page.getByRole('button',{name:/帰|戻|退|撤/})));
      await act('close-sheet',()=>tap(page.locator('#sheet-close')));
      report.storageBeforeReload=await page.evaluate(()=>({...localStorage}));
      await act('reload',()=>page.reload({waitUntil:'domcontentloaded',timeout:60000}),3000);
      await act('destinations-after-reload',()=>tap(page.locator('#begin')));
      await act('close-destinations',()=>tap(page.locator('#sheet-close')));
    }
    if(app!=='village') {
      await act('music-open',()=>tap(page.locator('.soul-music [data-open]')));
      await act('music-stop',()=>tap(page.locator('.soul-music [data-stop]')));
      await act('music-close',()=>tap(page.locator('.soul-music form button')));
    }
    await page.setViewportSize({width:412,height:915});await capture('mobile-412');
    await page.setViewportSize({width:1280,height:800});await capture('wide-1280');
  } catch(e){report.fatal=String(e);await capture('interrupted');}
  finally{
    report.finishedAt=new Date().toISOString();
    await writeFile(join(dir,'report.json'),JSON.stringify(report,null,2));
    await context.tracing.stop({path:join(dir,'trace.zip')});
    await context.close();
  }
}
await browser.close();
await writeFile(join(root,'summary.json'),JSON.stringify(reports.map(r=>({app:r.app,version:r.version,startedAt:r.startedAt,finishedAt:r.finishedAt,httpStatus:r.httpStatus,rendererReadyMs:r.rendererReadyMs,fatal:r.fatal,steps:r.steps.filter(s=>s.action).map(s=>({action:s.action,result:s.result,error:s.error})),pageErrors:r.pageErrors})),null,2));
