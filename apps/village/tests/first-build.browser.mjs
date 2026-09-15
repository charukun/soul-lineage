import {nativeTap} from '@soul/platform-web/testing/native-input';
export {nativeTap};
import {verifyVillageDirectorPolish} from './director-polish.browser.mjs';

/** User-facing placement help is exercised with native input, never world mutation. */
const STARTUP_TIMEOUT_MS = 15_000;
const CAMERA_DRAG_STEPS = 3;
async function expectVillageReady(page, expect) {
  await expect(page.locator('#loading')).toBeHidden({timeout:STARTUP_TIMEOUT_MS});
  await expect(page.locator('#game')).toHaveAttribute('data-renderer','ready',{timeout:STARTUP_TIMEOUT_MS});
}

async function finishFirstRunAutoplay(page, expect) {
  const intro=page.locator('#muraFirstRunTutorial');
  if(!(await intro.count())||!(await intro.isVisible()))return false;
  await expect(page.locator('#game')).toHaveAttribute('data-first-run-tutorial','running');
  await nativeTap(page,expect,page.locator('#muraFirstRunSkip'));
  await expect(intro).toHaveCount(0);
  await expect(page.locator('#game')).toHaveAttribute('data-first-run-tutorial','seen');
  return true;
}

export async function enterVillageForBrowser(page, expect) {
  await expectVillageReady(page, expect);
  await finishFirstRunAutoplay(page,expect);
  const entry=page.locator('#muraEntry'),enter=page.locator('#muraEnterVillage');
  if(await enter.count()&&await enter.isVisible()){
    await nativeTap(page,expect,enter);
    await expect(entry).toBeHidden();
  }else{
    await expect(entry).toHaveCount(0);
  }
}

export async function verifyVillageFirstBuild(page, expect, testInfo, beforeReload = async () => {}, { captureMilestones = true, verifyDirector = true } = {}) {
  page.setDefaultTimeout(8000);
  await enterVillageForBrowser(page, expect);
  const settings=await page.locator('#muraSettingsButton').boundingBox();
  expect(settings.width).toBeGreaterThanOrEqual(44);expect(settings.height).toBeGreaterThanOrEqual(44);
  const before=await page.evaluate(()=>({count:window.village.world.objects.length,beds:window.village.world.population().openBeds}));

  // Latest playability contract: the first tutorial action enters placement directly,
  // without detouring through the build catalogue.
  await expect(page.locator('#tutorialAction')).toBeVisible();
  await nativeTap(page,expect,page.locator('#tutorialAction'));
  await expect(page.locator('#drawer')).toBeHidden();
  await expect(page.locator('#placement')).toBeVisible();
  await expect(page.locator('#cancelPlace')).toHaveText('ここに建てる');
  if(!(await page.locator('#cancelPlace').isEnabled()))await nativeTap(page,expect,page.locator('#muraFindPlacement'));
  expect(await page.evaluate(()=>window.village.world.objects.length)).toBe(before.count);
  await expect(page.locator('#cancelPlace')).toBeEnabled();
  await nativeTap(page,expect,page.locator('#cancelPlace'));
  await expect(page.locator('#placement')).toBeHidden();
  const tent=await page.evaluate(()=>window.village.world.objects.find(o=>o.kind==='tent'));
  expect(tent).toBeTruthy();expect(tent.phase).toBe('built');
  expect(await page.evaluate(()=>window.village.world.population().openBeds)).toBe(before.beds+2);
  await expect(page.locator('#toastText')).toContainText('寝床が2床増えました');
  await expect(page.locator('#muraMilestone')).toHaveClass(/visible/);
  if (captureMilestones) await page.screenshot({path:testInfo.outputPath('first-tent-built.png')});

  await nativeTap(page,expect,page.locator('#deselect'));
  const facility=await page.evaluate(()=>window.village.world.objects.find(o=>o.kind==='storage'));
  expect(facility?.phase).toBe('built');
  for (let step=0;step<8;step++) {
    const drag=await page.evaluate(id=>{
      const {world,view}=window.village,host=world.object(id),rect=view.canvas.getBoundingClientRect();
      const p=view.project(host.x,1,host.z);
      const x=rect.left+rect.width/2,y=rect.top+rect.height/2;
      const dx=x-(rect.left+p.x),dy=y-(rect.top+p.y);
      return {x,y,dx:Math.max(-rect.width*.32,Math.min(rect.width*.32,dx)),dy:Math.max(-rect.height*.23,Math.min(rect.height*.23,dy)),distance:Math.hypot(dx,dy)};
    },facility.id);
    if(drag.distance<12)break;
    await page.mouse.move(drag.x,drag.y);await page.mouse.down();
    await page.mouse.move(drag.x+drag.dx,drag.y+drag.dy,{steps:CAMERA_DRAG_STEPS});await page.mouse.up();
    await page.waitForTimeout(150);
  }
  if (captureMilestones) await page.screenshot({path:testInfo.outputPath('first-storehouse-in-view.png')});
  let point;
  await expect.poll(async()=>{
    point=await page.evaluate(id=>{
      const {world,view}=window.village,host=world.object(id),rect=view.canvas.getBoundingClientRect();
      const center=view.project(host.x,1.4,host.z),cx=rect.left+center.x,cy=rect.top+center.y,offsets=[];
      for(let dy=-108;dy<=108;dy+=12)for(let dx=-144;dx<=144;dx+=12)offsets.push({dx,dy,d:dx*dx+dy*dy});
      offsets.sort((a,b)=>a.d-b.d);
      for(const {dx,dy} of offsets){
        const x=cx+dx,y=cy+dy;
        if(x<=10||x>=innerWidth-10||y<=100||y>=innerHeight-140)continue;
        if(document.elementFromPoint(x,y)===view.canvas&&view.pick(x,y)===id&&!view.pickPerson(x,y))return{x,y};
      }
      return null;
    },facility.id);
    return !!point;
  },{timeout:5000}).toBe(true);
  await page.mouse.click(point.x,point.y);
  await nativeTap(page,expect,page.locator('#enter'));
  await expect.poll(()=>page.evaluate(()=>window.village.view.roomId)).toBe(facility.id);
  await nativeTap(page,expect,page.locator('#build'));
  await nativeTap(page,expect,page.locator('[data-kind="dirtbed"]'));
  await nativeTap(page,expect,page.locator('#muraFindPlacement'));
  await expect(page.locator('#cancelPlace')).toHaveText('ここに置く');
  await nativeTap(page,expect,page.locator('#cancelPlace'));
  await expect(page.locator('#placement')).toBeHidden();
  const furnished=await page.evaluate(id=>window.village.world.object(id),facility.id);
  const bed=furnished.room.find(o=>o.kind==='dirtbed');expect(bed).toBeTruthy();
  await expect.poll(()=>page.evaluate(()=>window.village.storageOK)).toBe(true);
  const exit=page.locator('#leaveRoom');
  await expect(exit).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>{
    const button=document.getElementById('leaveRoom'),r=button.getBoundingClientRect();
    const header=document.getElementById('idleStatus').getBoundingClientRect();
    return r.width>=44&&r.height>=44&&r.top>=header.bottom&&r.left>=0&&r.right<=innerWidth&&r.bottom<=innerHeight&&button.contains(document.elementFromPoint(r.left+r.width/2,r.top+r.height/2));
  })).toBe(true);
  if (captureMilestones) await page.screenshot({path:testInfo.outputPath('first-furniture-exit-visible.png')});
  await nativeTap(page,expect,exit);
  await expect.poll(()=>page.evaluate(()=>window.village.view.roomId)).toBe(null);
  await beforeReload();
  await page.reload({waitUntil:'domcontentloaded'});
  await expectVillageReady(page, expect);
  // Entry acknowledgement is device-local; returning play resumes directly in-world.
  await expect(page.locator('#muraEntry')).toHaveCount(0);
  const restored=await page.evaluate(id=>window.village.world.object(id),tent.id);
  for(const key of ['id','kind','x','z','rot','phase'])expect(restored[key]).toBe(tent[key]);
  const restoredFacility=await page.evaluate(id=>window.village.world.object(id),facility.id);
  expect(restoredFacility.room.find(o=>o.id===bed.id)).toEqual(bed);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  if (captureMilestones) await page.screenshot({path:testInfo.outputPath('first-build-reloaded.png')});
  if (verifyDirector) await verifyVillageDirectorPolish(page, expect, testInfo, {captureEvidence:captureMilestones});
}
