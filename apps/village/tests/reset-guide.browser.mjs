import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

/** Built-app regression. Only native touch/keyboard controls mutate the village. */
export async function verifyVillageResetGuide(browser,url,out,{expectedCommit=null,width=390,height=844}={}){
 await fs.mkdir(out,{recursive:true});
 const context=await browser.newContext({viewport:{width,height},hasTouch:true,isMobile:true,locale:'ja-JP',recordVideo:{dir:`${out}/video`,size:{width,height}}});
 const page=await context.newPage();page.setDefaultTimeout(15000);
 const report={url,expectedCommit,viewport:{width,height},checks:[],errors:[],httpFailures:[],success:false};
 page.on('pageerror',error=>report.errors.push(error.message));
 page.on('console',message=>{if(message.type()==='error')report.errors.push(message.text());});
 page.on('response',response=>{if(response.status()>=400)report.httpFailures.push({url:response.url(),status:response.status()});});
 await context.tracing.start({screenshots:true,snapshots:true,sources:true});
 const tap=selector=>page.locator(selector).first().tap();
 const snapshot=()=>page.evaluate(()=>{const v=window.village;return{objects:structuredClone(v.world.objects),pending:v.ui.pending?{...v.ui.pending}:null,onboarding:structuredClone(v.world.state.onboarding),entry:v.ui.entryOpen,placement:document.querySelector('#game').dataset.placement};});
 const shot=name=>page.screenshot({path:`${out}/${name}.png`});
 async function check(name,action){report.lastCheck=name;console.log('VILLAGE RESET CHECK',name);const result=await action();report.checks.push({name,result:result??true});await fs.writeFile(`${out}/report.json`,JSON.stringify(report,null,2));}
 async function ready(){
  await page.waitForFunction(()=>window.village&&document.querySelector('#loading')?.hidden,null,{timeout:60000});
  const gate=page.locator('#soul-brand-boot');
  assert.equal(await gate.count(),1,'shared brand gate must remain present on each reload');
  await page.locator('#soul-brand-boot.armed').waitFor({state:'visible'});
  await gate.tap();await gate.waitFor({state:'detached'});
  const commit=await page.locator('#game').getAttribute('data-commit');
  if(expectedCommit)assert.equal(commit,expectedCommit,'browser must exercise the exact source head');
  report.commit=commit;
 }
 async function enter(){
  await page.locator('#muraEnterVillage').waitFor({state:'visible'});
  await tap('#muraEnterVillage');
  await page.waitForFunction(()=>document.querySelector('#game')?.dataset.enhancements==='ready',null,{timeout:60000});
  await page.locator('#muraFirstRunGuide').waitFor({state:'visible'});
  assert.equal(await page.locator('#muraFirstRunGuide').getAttribute('data-stage'),'welcome');
 }
 async function fingerMotion(name){
  await page.waitForFunction(()=>{const n=document.querySelector('.muraFirstRunFinger'),a=n?.getAnimations()[0];return n&&!n.hidden&&a?.playState==='running'&&Number(a.currentTime)>120&&Number(a.currentTime)<700;},null,{timeout:8000});
  const sample=()=>page.locator('.muraFirstRunFinger').evaluate(n=>{const r=n.getBoundingClientRect();return{x:r.x,y:r.y,transform:getComputedStyle(n).transform,opacity:getComputedStyle(n).opacity,hidden:n.hidden};});
  const first=await sample();await page.waitForTimeout(180);const second=await sample();
  assert.equal(first.hidden,false);assert.equal(second.hidden,false);assert.notEqual(first.transform,second.transform,'finger must move, not just exist in the DOM');
  await shot(name);return{first,second};
 }
 async function drag(dx,dy,{cancel=false}={}){
  const x=width/2,y=height/2,cdp=await context.newCDPSession(page);
  try{
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});
   for(let i=1;i<=6;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+dx*i/6,y:y+dy*i/6,id:1}]});await page.waitForTimeout(35);}
   const beforeRelease=await snapshot();
   await cdp.send('Input.dispatchTouchEvent',{type:cancel?'touchCancel':'touchEnd',touchPoints:[]});
   return beforeRelease;
  }finally{await cdp.detach();}
 }
 async function canvasTap(x=width/2,y=height/2){
  assert.equal(await page.evaluate(({x,y})=>document.elementFromPoint(x,y)?.id,{x,y}),'game','tap must hit the actual canvas');
  await page.touchscreen.tap(x,y);
 }
 async function walkGuide(prefix){
  const before=await snapshot(),guide=page.locator('#muraFirstRunGuide');
  await tap('.muraFirstRunStart');
  assert.equal(await guide.getAttribute('data-stage'),'build');
  const motion=await fingerMotion(`${prefix}-finger-build`);
  await tap('#build');await page.waitForFunction(()=>document.querySelector('#muraFirstRunGuide')?.dataset.stage==='catalog');
  await tap('#catalog .card[data-kind="tent"]');
  await page.waitForFunction(()=>document.querySelector('#muraFirstRunGuide')?.dataset.stage==='drag');
  await page.waitForFunction(()=>window.village.ui.pending&&!window.village.ui.pending.error);
  await canvasTap();
  assert.equal(await guide.getAttribute('data-stage'),'drag','premature tap must not skip the movement lesson');
  assert.equal((await snapshot()).objects.length,before.objects.length);
  const start=(await snapshot()).pending,release=await drag(54,34);
  await page.waitForFunction(()=>document.querySelector('#muraFirstRunGuide')?.dataset.stage==='place');
  const adjusted=await snapshot();
  assert.ok(Math.hypot(adjusted.pending.x-start.x,adjusted.pending.z-start.z)>.2,'swipe must change the world candidate');
  assert.equal(adjusted.objects.length,before.objects.length,'releasing a swipe must not build');
  assert.equal(adjusted.pending.x,release.pending.x);assert.equal(adjusted.pending.z,release.pending.z);
  const center=await page.evaluate(()=>{const v=window.village.view,p=v.project(v.ghost.position.x,.15,v.ghost.position.z);return{dx:Math.abs(p.x-v.w/2),dy:Math.abs(p.y-v.h/2)};});
  assert.ok(center.dx<4&&center.dy<4,JSON.stringify(center));
  if(adjusted.pending.error)await drag(-54,-34);
  await page.waitForFunction(()=>window.village.ui.pending&&!window.village.ui.pending.error);
  await shot(`${prefix}-finger-placement`);
  const candidate={...(await snapshot()).pending};
  // An off-centre tap must confirm what was shown, not jump to the tap's raycast.
  await canvasTap(width*.18,height*.66);
  await page.waitForFunction(()=>document.querySelector('#muraFirstRunGuide')?.dataset.stage==='done');
  const after=await snapshot(),added=after.objects.filter(o=>!before.objects.some(old=>old.id===o.id));
  assert.equal(added.length,1);assert.equal(added[0].kind,'tent');assert.equal(after.pending,null);
  for(const key of ['x','z','rot'])assert.equal(added[0][key],candidate[key],key);
  await shot(`${prefix}-tent-built`);
  await tap('.muraFirstRunFinish');await guide.waitFor({state:'detached'});
  assert.equal(await page.locator('#game').getAttribute('data-first-run-tutorial'),'seen');
  return{motion,center,candidate,placed:added[0]};
 }
 try{
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});await ready();
  await check('first entry loads the full enhancement graph and animated guide',enter);
  let first;
  await check('four-step finger guide: swipe adjustment then one tap at the displayed position',async()=>first=await walkGuide('first'));
  await check('ordinary reload preserves the tent and does not replay the completed guide',async()=>{
   await page.reload({waitUntil:'domcontentloaded'});await ready();
   await page.waitForFunction(()=>document.querySelector('#game')?.dataset.enhancements==='ready',null,{timeout:60000});
   assert.equal(await page.locator('#muraEntry').count(),0);
   assert.equal(await page.locator('#muraFirstRunGuide').count(),0);
   const restored=(await snapshot()).objects.find(o=>o.id===first.placed.id);
   for(const key of ['kind','x','z','rot','phase'])assert.equal(restored[key],first.placed[key],key);
  });
  await check('cancelled touch and two-finger gestures cannot place a building',async()=>{
   await tap('#build');await tap('#catalog .card[data-kind="tent"]');
   const count=(await snapshot()).objects.length;
   await drag(42,28,{cancel:true});assert.equal((await snapshot()).objects.length,count);assert.ok((await snapshot()).pending);
   const cdp=await context.newCDPSession(page);
   try{
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:width*.4,y:height*.52,id:1}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:width*.4,y:height*.52,id:1},{x:width*.65,y:height*.52,id:2}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:width*.35,y:height*.51,id:1},{x:width*.7,y:height*.53,id:2}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[{x:width*.7,y:height*.53,id:2}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
   }finally{await cdp.detach();}
   assert.equal((await snapshot()).objects.length,count);assert.ok((await snapshot()).pending);
   await tap('#muraCancelPlacement');assert.equal((await snapshot()).pending,null);
  });
  await check('title reset cancellation preserves the existing village',async()=>{
   const objects=(await snapshot()).objects;
   await tap('#muraSettingsButton');await tap('#muraTitleAction');await tap('#muraResetVillage');
   await tap('#muraResetConfirm [data-cancel]');assert.deepEqual((await snapshot()).objects,objects);
  });
  await check('successful reset reloads through the retained brand gate and starts the guide again',async()=>{
   await tap('#muraResetVillage');
   await Promise.all([page.waitForEvent('domcontentloaded'),tap('#muraResetConfirm [data-reset]')]);
   await ready();await enter();
   assert.equal((await snapshot()).objects.some(o=>o.kind==='tent'),false);
   await shot('reset-welcome');
  });
  await check('after reset the finger moves and the full four-step placement completes again',()=>walkGuide('reset'));
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.httpFailures,[]);
  report.success=true;return report;
 }catch(error){report.failure=String(error);await shot('failure').catch(()=>{});throw error;}
 finally{
  await fs.writeFile(`${out}/report.json`,JSON.stringify(report,null,2));
  await context.tracing.stop({path:`${out}/trace.zip`});await context.close();
 }
}
