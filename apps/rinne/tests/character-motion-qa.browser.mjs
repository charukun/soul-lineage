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
  const toggleBasis=()=>page.evaluate(()=>document.querySelector('#qa-before').click());
  try{
    await page.goto(new URL('./characters.html',baseURL).href,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.characterStudio?.review.ready,null,{timeout:60000});
    await page.locator('[data-tab="qa"]').click();await page.locator('#qa-start').click();
    await page.waitForFunction(()=>window.masterCharacterReview.motionQA.active,null,{timeout:60000});
    const started=await qa();await page.waitForFunction(t=>window.masterCharacterReview.motionQA.time>t+.05,started.time);
    assert.deepEqual(await page.evaluate(()=>window.masterCharacterReview.motionQA.sources),['idle-01','walk','run-slow','runtime.weaponDraw','runtime.guard','runtime.naturalWeaponStance','authored-slash']);
    assert.equal((await qa()).liveCompare,true);
    await page.waitForFunction(()=>{const layer=document.querySelector('#motion-live-compare');const panes=layer?.querySelectorAll('canvas');return layer&&!layer.hidden&&panes?.length===2&&[...panes].every(c=>c.width>0&&c.height>0);});
    assert.deepEqual(await page.locator('#motion-live-compare .live-label').allTextContents(),['基盤 OFF','基盤 ON']);
    await page.locator('.canvas-wrap').screenshot({path:resolve(output,'motion-qa-live-split.png')});
    checks.push('one-tap review starts synchronized live basis-off / basis-on split view');

    const beforeToggle=await qa();assert.equal(beforeToggle.playing,true);await toggleBasis();const toggled=await qa();assert.equal(toggled.playing,true);
    await page.waitForFunction(t=>window.masterCharacterReview.motionQA.time>t+.08,beforeToggle.time);await toggleBasis();
    checks.push('single-view basis toggle preserves playback instead of pausing');

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
    await page.locator('.qa-more > summary').click();await page.locator('#qa-tour').check();await seek(10);await page.locator('#qa-play').click();await page.waitForFunction(()=>window.masterCharacterReview.motionQA.camera==='left');
    await page.locator('#qa-tour').uncheck();checks.push('eight repeatable camera presets and clock-driven tour');

    // Preserve raw draw/guard evidence. qa-before lives under display options now,
    // but its state change must remain testable without pausing playback.
    await page.setViewportSize({width:900,height:900});
    await toggleBasis();
    for(const [time,label]of [[13.97,'draw-end'],[16.97,'guard']])for(const camera of ['front-left','left']){
      await seek(time);await page.locator(`[data-qa-camera="${camera}"]`).click();
      const stance=await qa();assert.equal(stance.frame,Math.round(time*60));snapshots.push({stance:label,camera,snapshot:stance});
      await page.screenshot({path:resolve(output,`motion-qa-${label}-raw-${camera}.png`)});
    }
    await toggleBasis();
    checks.push('raw draw-end and guard stance evidence captured from front-left and side');

    await seek(17.475);await page.locator('[data-qa-camera="front-left"]').click();
    await toggleBasis();const before=await qa();
    await page.screenshot({path:resolve(output,'motion-qa-before.png')});
    await toggleBasis();const after=await qa();
    await page.screenshot({path:resolve(output,'motion-qa-after.png')});
    assert.equal(before.frame,after.frame);assert.deepEqual(before.cameraPosition,after.cameraPosition);
    const penetration=s=>s.diagnostics.filter(i=>i.category==='self intersection').reduce((m,i)=>Math.max(m,i.penetration??0),0);
    assert.ok(penetration(after)<penetration(before),'source arm penetration case must improve');
    snapshots.push({before,after});checks.push('same frame before/after visible arm clearance improvement');

    await seek(5);await page.evaluate(()=>document.querySelector('#qa-ab-known').click());
    await page.waitForFunction(()=>window.masterCharacterReview.motionQA.comparison?.frame===1049);
    const comparison=await page.evaluate(()=>window.masterCharacterReview.motionQA.comparison);
    assert.equal(comparison.frame,1049);assert.equal(comparison.camera,'front-left');assert.equal(comparison.before.frame,comparison.after.frame);assert.equal(comparison.before.camera,comparison.after.camera);
    assert.ok(penetration(comparison.after)<penetration(comparison.before),'saved A/B panel must use the improving basis-on result');
    for(const id of ['qa-ab-before','qa-ab-after'])assert.match(await page.locator(`#${id}`).getAttribute('src'),/^data:image\/jpeg/);
    assert.match(await page.locator('#qa-ab-summary').textContent(),/合否は左右の実画像/);
    snapshots.push({comparison});checks.push('optional static A/B evidence remains aligned with the live comparison');

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
    await page.locator('.qa-diagnostics-panel > summary').click();
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
      await page.setViewportSize({width,height});await seek(14);await page.waitForTimeout(120);
      const bounds=await page.evaluate(()=>{const r=document.querySelector('#stage').getBoundingClientRect(),live=document.querySelector('#motion-live-compare').getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,bottom:r.bottom,liveW:live.width,liveH:live.height,docWidth:document.documentElement.scrollWidth,docHeight:document.documentElement.scrollHeight};});
      assert.ok(bounds.h>=150&&bounds.x>=0&&bounds.x+bounds.w<=width+1&&bounds.bottom<=height+1&&bounds.liveW===bounds.w&&bounds.liveH===bounds.h&&bounds.docWidth<=width+1&&bounds.docHeight<=height+1,JSON.stringify(bounds));
      await page.screenshot({path:resolve(output,`motion-qa-${width}x${height}.png`)});
    }
    await page.locator('#qa-stop').click();assert.equal(await page.evaluate(()=>window.masterCharacterReview.motionQA.active),false);
    await page.waitForFunction(()=>document.querySelector('#motion-live-compare').hidden===true);
    assert.deepEqual(errors,[]);assert.deepEqual(network,[]);assert.equal(await page.evaluate(()=>window.masterCharacterReview.ready),true);
    checks.push('portrait/landscape live-compare bounds and clean console/network');
    writeFileSync(resolve(output,'motion-qa-browser.json'),JSON.stringify({success:true,checks,snapshots,errors,network},null,2));
  }catch(error){await page.screenshot({path:resolve(output,'motion-qa-failure.png')}).catch(()=>{});writeFileSync(resolve(output,'motion-qa-browser.json'),JSON.stringify({success:false,error:String(error),checks,errors,network},null,2));throw error;}
  finally{await context.close();}
}
