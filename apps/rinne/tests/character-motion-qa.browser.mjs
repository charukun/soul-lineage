import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** Actual software-WebGL behavior and evidence, not a physical device art/FPS gate. */
export async function verifyCharacterMotionQA(browser,baseURL,output) {
  const context=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true});
  const page=await context.newPage(),errors=[],network=[],checks=[],snapshots=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  page.on('requestfailed',r=>network.push({url:r.url(),error:r.failure()?.errorText}));
  page.on('response',r=>{if(r.status()>=400)network.push({url:r.url(),status:r.status()});});
  const qa=()=>page.evaluate(()=>window.masterCharacterReview.motionQA.snapshot());
  const seek=t=>page.evaluate(t=>window.masterCharacterReview.motionQA.seek(t),t);
  try{
    await page.goto(new URL('./characters.html',baseURL).href,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.characterStudio?.review.ready,null,{timeout:60000});
    await page.locator('[data-tab="qa"]').click();await page.locator('#qa-start').click();
    await page.waitForFunction(()=>window.masterCharacterReview.motionQA.active,null,{timeout:60000});
    const started=await qa();await page.waitForFunction(t=>window.masterCharacterReview.motionQA.time>t+.05,started.time);
    assert.deepEqual(await page.evaluate(()=>window.masterCharacterReview.motionQA.sources),['idle-01','walk','run-slow','runtime.weaponDraw','runtime.guard','authored-slash']);
    checks.push('one-tap review starts actual source animation');
    for(const t of [2.97,6.97,10.97,13.97,16.97,22.97,26.97]){
      await seek(t);await page.locator('#qa-play').click();await page.waitForFunction(t=>window.masterCharacterReview.motionQA.time>t+.1,t);
      snapshots.push(await qa());
    }
    checks.push('automatic playback crosses all source-motion boundaries');
    await seek(17.475);const sourceBefore=await page.evaluate(()=>window.masterCharacterReview.records);
    const cameraNames=await page.locator('[data-qa-camera]').evaluateAll(nodes=>nodes.map(n=>n.dataset.qaCamera));
    const cameras={};for(const id of cameraNames){await page.locator(`[data-qa-camera="${id}"]`).click();cameras[id]=(await qa()).cameraPosition;}
    assert.equal(new Set(Object.values(cameras).map(p=>p.join(','))).size,8);
    await page.locator('[data-qa-camera="front"]').click();assert.deepEqual((await qa()).cameraPosition,cameras.front);
    await page.locator('#qa-tour').check();await seek(10);await page.locator('#qa-play').click();await page.waitForFunction(()=>window.masterCharacterReview.motionQA.camera==='left');
    await page.locator('#qa-tour').uncheck();checks.push('eight repeatable camera presets and clock-driven tour');
    await page.setViewportSize({width:900,height:900});await seek(17.475);await page.locator('[data-qa-camera="front-left"]').click();
    await page.locator('#qa-before').click();const before=await qa();
    await page.screenshot({path:resolve(output,'motion-qa-before.png')});
    await page.locator('#qa-before').click();const after=await qa();
    await page.screenshot({path:resolve(output,'motion-qa-after.png')});
    assert.equal(before.frame,after.frame);assert.deepEqual(before.cameraPosition,after.cameraPosition);
    const penetration=s=>s.diagnostics.filter(i=>i.category==='self intersection').reduce((m,i)=>Math.max(m,i.penetration??0),0);
    assert.ok(penetration(after)<penetration(before),'source arm penetration case must improve');
    snapshots.push({before,after});checks.push('same frame before/after visible arm clearance improvement');
    for(const count of [6,12]){
      await page.locator(`[data-qa-count="${count}"]`).click();await seek(17.475);
      assert.equal(await page.evaluate(()=>window.masterCharacterReview.actors.length),count);
      assert.deepEqual(await page.evaluate(()=>window.masterCharacterReview.records),sourceBefore);
      await page.screenshot({path:resolve(output,`motion-qa-${count}.png`)});
    }
    await page.locator('[data-qa-count="1"]').click();
    for(const [index,age,body]of [[0,22,'balanced'],[1,7,'sturdy'],[2,75,'compact']]){
      await page.evaluate(({index,age,body})=>{const w=window.characterStudio.workspace;w.configure({selected:index});window.masterCharacterReview.editSelected({age,height:index?0:1,build:index?1:0});w.change('body',body);},{index,age,body});
      await seek(17.475);snapshots.push(await qa());await page.screenshot({path:resolve(output,`motion-qa-variant-${index}.png`)});
    }
    checks.push('6/12 cohort preserves records; body, height and child/elder presentation shown');
    await page.locator('#motion-qa details summary').click();
    await page.locator('#qa-category').selectOption('self intersection');await page.locator('#qa-bones').fill('rightUpperArm rightLowerArm');await page.locator('#qa-note').fill('検証用の指摘。Visual Approvalとは別。');
    await page.locator('#qa-record').click();const downloadPromise=page.waitForEvent('download');await page.locator('#qa-export').click();
    const download=await downloadPromise,path=resolve(output,'character-motion-qa.json');await download.saveAs(path);
    await page.locator('#qa-import').setInputFiles(path);await page.waitForFunction(()=>document.querySelector('#qa-status').textContent.includes('読み込みました'));
    const report=await page.evaluate(()=>window.masterCharacterReview.motionQA.report);assert.equal(report.issues.length,1);assert.equal(report.visualApproval,'pending');assert.equal(report.issues[0].frame,1049);
    await page.locator('#qa-import').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{bad')});
    await page.waitForFunction(()=>document.querySelector('#qa-status').textContent.includes('読込失敗'));
    assert.equal(await page.evaluate(()=>window.masterCharacterReview.motionQA.report.issues.length),1);
    checks.push('QA JSON export/import roundtrip and malformed import retention');
    for(const [width,height]of [[320,568],[390,844],[412,892],[844,390]]){
      await page.setViewportSize({width,height});await seek(14);
      const bounds=await page.evaluate(()=>{const r=document.querySelector('#stage').getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,bottom:r.bottom,docWidth:document.documentElement.scrollWidth,docHeight:document.documentElement.scrollHeight};});
      assert.ok(bounds.h>=150&&bounds.x>=0&&bounds.x+bounds.w<=width+1&&bounds.bottom<=height+1&&bounds.docWidth<=width+1&&bounds.docHeight<=height+1,JSON.stringify(bounds));
      await page.screenshot({path:resolve(output,`motion-qa-${width}x${height}.png`)});
    }
    await page.locator('#qa-stop').click();assert.equal(await page.evaluate(()=>window.masterCharacterReview.motionQA.active),false);
    assert.deepEqual(errors,[]);assert.deepEqual(network,[]);assert.equal(await page.evaluate(()=>window.masterCharacterReview.ready),true);
    checks.push('portrait/landscape UI bounds and clean console/network');
    writeFileSync(resolve(output,'motion-qa-browser.json'),JSON.stringify({success:true,checks,snapshots,errors,network},null,2));
  }catch(error){await page.screenshot({path:resolve(output,'motion-qa-failure.png')}).catch(()=>{});writeFileSync(resolve(output,'motion-qa-browser.json'),JSON.stringify({success:false,error:String(error),checks,errors,network},null,2));throw error;}
  finally{await context.close();}
}
