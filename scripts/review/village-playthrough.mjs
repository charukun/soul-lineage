import { chromium } from 'playwright';
import fs from 'node:fs/promises';
const out = process.env.REVIEW_OUT || 'playthrough';
await fs.mkdir(out,{recursive:true});
const browser = await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
const context = await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
await context.tracing.start({screenshots:true,snapshots:true,sources:true});
const page=await context.newPage();page.setDefaultTimeout(6500);
const result={url:'https://charukun.github.io/soul-lineage/dev/village/',started:new Date().toISOString(),viewport:{width:390,height:844},steps:[],errors:[],networkFailures:[],nativeDialogs:[]};
page.on('pageerror',e=>result.errors.push(String(e)));
page.on('requestfailed',r=>result.networkFailures.push({url:r.url(),error:r.failure()}));
page.on('dialog',async d=>{result.nativeDialogs.push({type:d.type(),message:d.message()});await d.dismiss();});
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function state(){return page.evaluate(()=>{const v=window.village;if(!v)return{body:document.body.innerText};const rect=e=>{const b=e.getBoundingClientRect(),s=getComputedStyle(e);return{x:b.x,y:b.y,width:b.width,height:b.height,opacity:s.opacity,display:s.display,fontSize:s.fontSize,visibility:s.visibility,hidden:e.hidden,background:s.backgroundColor,pointerEvents:s.pointerEvents};};return{body:document.body.innerText,commit:document.querySelector('#game')?.dataset.commit,ui:{pending:v.ui.pending,drawer:v.ui.drawer,selected:v.ui.selected,idle:v.ui.idle},camera:{target:v.view.target.toArray(),span:v.view.span,pitch:v.view.pitch,yaw:v.view.yaw,followId:v.view.followId,roomId:v.view.roomId,cameraGoal:v.view.cameraGoal},clock:v.world.state.clock,objects:v.world.objects.map(o=>({id:o.id,kind:o.kind,x:o.x,z:o.z,phase:o.phase,room:o.room?.map(f=>({id:f.id,kind:f.kind,x:f.x,z:f.z,rot:f.rot}))})),people:v.world.people.slice(0,12).map(p=>{const root=v.view.actorNodes.get(p.id);let meshes=0,visible=0;root?.traverse(n=>{if(n.isMesh){meshes++;if(n.visible&&(n.material?.opacity??1)>0)visible++;}});return{id:p.id,name:p.name,x:p.x,z:p.z,status:p.status,insideId:p.insideId,hidden:p.hidden,rootVisible:root?.visible,meshes,visible};}),buttons:[...document.querySelectorAll('button')].filter(e=>e.getClientRects().length&&getComputedStyle(e).display!=='none').map(e=>({id:e.id,text:e.innerText,aria:e.getAttribute('aria-label'),...rect(e)})),surfaces:[...document.querySelectorAll('#idleStatus,#tutorial,#muraIdleDetails,#muraEventLog,.muraMode,#drawer,#placement,#context,#dialog,#muraEntryCard h2')].map(e=>({id:e.id,cls:e.className,...rect(e)})),audio:{bgm:window.__MURA_BACKGROUND_BGM__?.state,music:window.__SOUL_MUSIC__?.playing}};});}
async function shot(name){await delay(300);await page.screenshot({path:`${out}/${name}.png`,timeout:10000});const s=await state();await fs.writeFile(`${out}/${name}.json`,JSON.stringify(s,null,2));return s;}
async function step(name,fn){const record={name,started:Date.now()};result.steps.push(record);try{record.data=await fn();record.ok=true;}catch(e){record.ok=false;record.error=String(e);try{await shot(name+'-error');}catch{}}await fs.writeFile(`${out}/results.json`,JSON.stringify(result,null,2));}
const tap=selector=>page.locator(selector).first().tap();
async function closeDialog(){if(await page.locator('#dialog').evaluate(e=>e.open))await tap('#dialog .dialogClose');}
async function spot(){return page.evaluate(()=>{const{view,world,ui}=window.village,p=ui.pending;if(!p)return null;const choices=[];for(let y=innerHeight*.24;y<innerHeight*.69;y+=22)for(let x=24;x<innerWidth-24;x+=22){if(document.elementFromPoint(x,y)?.id!=='game')continue;const q=view.ground(x,y);if(!q)continue;let a=q;if(p.roomId){const h=world.object(p.roomId),dx=q.x-h.x,dz=q.z-h.z;a={x:dx*Math.cos(h.rot)-dz*Math.sin(h.rot),z:dx*Math.sin(h.rot)+dz*Math.cos(h.rot)};}if(!world.canPlace(p.kind,a.x,a.z,p.rot,p.roomId,p.moveId))choices.push({x,y,world:a,d:Math.hypot(x-innerWidth/2,y-innerHeight*.40)});}return choices.sort((a,b)=>a.d-b.d)[0]||null;});}
async function selectObject(id){const q=await page.evaluate(id=>{const{world,view}=window.village,o=world.object(id);return view.project(o.x,1.5,o.z);},id);await page.touchscreen.tap(q.x,q.y);await delay(300);}
async function enter(){await tap('#muraEnterVillage');await page.waitForSelector('#muraEntry',{state:'detached',timeout:10000});}
async function drag(x1,y1,x2,y2){const cdp=await context.newCDPSession(page);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:x1,y:y1,id:1}]});for(let i=1;i<=8;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x1+(x2-x1)*i/8,y:y1+(y2-y1)*i/8,id:1}]});await delay(50);}const before=await state();await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await delay(400);const after=await state();await cdp.detach();return{before:before.ui.pending,after:after.ui.pending,cameraBefore:before.camera,cameraAfter:after.camera};}
try{
await step('01-title',async()=>{await page.goto(result.url,{waitUntil:'networkidle',timeout:60000});await page.waitForFunction(()=>window.village&&document.querySelector('#game').dataset.renderer==='ready',{},{timeout:60000});return shot('01-title');});
await step('02-title-320',async()=>{await page.setViewportSize({width:320,height:740});return shot('02-title-320');});
await step('03-enter',async()=>{await page.setViewportSize({width:390,height:844});await enter();return shot('03-enter');});
await step('04-idle',async()=>{await delay(9500);return shot('04-idle');});
await step('05-header-toggle',async()=>{const before=await state();await tap('.muraHudTop');const after=await shot('05-header-toggle');return{before:before.surfaces,after:after.surfaces};});
await step('06-tutorial',async()=>{await tap('#tutorialAction');return shot('06-tutorial');});
await step('07-tent-preview',async()=>{await tap('#catalog [data-kind="tent"]');const q=await spot();if(!q)throw Error('No visible valid placement spot');await page.touchscreen.tap(q.x,q.y);return{spot:q,state:await shot('07-tent-preview')};});
await step('08-tent-confirm',async()=>{const before=await state();await tap('#cancelPlace');return{before:before.ui,objectCountBefore:before.objects.length,after:await shot('08-tent-confirm')};});
await step('09-catalog-work',async()=>{await tap('#build');const work=page.locator('#tabs [data-category="仕事"]');if(await work.count())await work.tap();return shot('09-catalog-work');});
await step('10-logging-preview',async()=>{await tap('#catalog [data-kind="logging"]');return shot('10-logging-preview');});
await step('11-placement-drag',async()=>{const d=await drag(170,350,245,410);await shot('11-placement-drag');return d;});
await step('12-cancel',async()=>{await tap('#muraCancelPlacement');return shot('12-cancel');});
await step('13-resident',async()=>{const p=await page.evaluate(()=>{const{world,view}=window.village;return world.people.map(p=>({id:p.id,name:p.name,point:view.project(p.x,1.2,p.z)})).find(p=>p.point.x>35&&p.point.x<355&&p.point.y>170&&p.point.y<650);});if(!p)throw Error('No resident currently visible in the unobstructed viewport');await page.touchscreen.tap(p.point.x,p.point.y);return{selected:p,state:await shot('13-resident')};});
await step('14-resident-camera-front',async()=>{const before=await state();await tap('[data-camera="front"]');return{before:before.camera,after:await shot('14-resident-camera-front')};});
await step('15-settings',async()=>{await closeDialog();await tap('#muraSettingsButton');return shot('15-settings');});
await step('16-help',async()=>{await tap('#help');return shot('16-help');});
await step('17-help-back',async()=>{await tap('#muraHelpBack');return shot('17-help-back');});
await step('18-developer',async()=>{await tap('#muraDeveloperOpen');return shot('18-developer');});
await step('19-developer-back',async()=>{await tap('#muraDeveloperDialog [data-back]');await closeDialog();return shot('19-developer-back');});
await step('20-events',async()=>{await tap('#muraEventButton');const s=await shot('20-events');await tap('#muraEventButton');return s;});
// Restore overview via the existing mayor-follow button, then enter his house through UI.
await step('21-mayor-house',async()=>{await tap('#muraFollowMayor');await delay(1200);await selectObject('b1');const s=await shot('21-mayor-house');return s;});
await step('22-interior',async()=>{await tap('#enter');return shot('22-interior');});
await step('23-furniture-catalog',async()=>{await tap('#build');return shot('23-furniture-catalog');});
await step('24-chair-preview',async()=>{await tap('#catalog [data-kind="chair"]');const q=await spot();if(!q)throw Error('No visible valid chair placement spot');await page.touchscreen.tap(q.x,q.y);return{spot:q,state:await shot('24-chair-preview')};});
await step('25-chair-drag-release',async()=>{const d=await drag(180,335,222,376);await shot('25-chair-drag-release');return d;});
await step('26-chair-confirm',async()=>{const before=await state();await tap('#cancelPlace');return{before:before.ui,after:await shot('26-chair-confirm')};});
await step('27-furniture-details',async()=>{await tap('#details');return shot('27-furniture-details');});
await step('28-return-village',async()=>{await closeDialog();await tap('#leaveRoom');return shot('28-return-village');});
await step('29-title-return',async()=>{await tap('#muraSettingsButton');await tap('.muraTitleAction');await page.waitForSelector('#muraEnterVillage',{timeout:30000});return shot('29-title-return');});
await step('30-reset-cancel',async()=>{await tap('#muraResetVillage');const s=await shot('30-reset-cancel');await tap('#muraResetConfirm [data-cancel]');return s;});
await step('31-reset-confirm',async()=>{const before=await state();await tap('#muraResetVillage');await tap('#muraResetConfirm [data-reset]');await page.waitForTimeout(2200);await page.waitForSelector('#muraEnterVillage',{timeout:30000});return{before,after:await shot('31-reset-confirm')};});
await step('32-reset-reload',async()=>{await page.reload({waitUntil:'networkidle',timeout:30000});await page.waitForSelector('#muraEnterVillage',{timeout:30000});return shot('32-reset-reload');});
await step('33-entry-wide',async()=>{await page.setViewportSize({width:820,height:740});return shot('33-entry-wide');});
}finally{result.finished=new Date().toISOString();await fs.writeFile(`${out}/results.json`,JSON.stringify(result,null,2));await context.tracing.stop({path:`${out}/playthrough-trace.zip`});await browser.close();}
