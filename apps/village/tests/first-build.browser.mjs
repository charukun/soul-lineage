import {verifyVillageDirectorPolish} from './director-polish.browser.mjs';

/** User-facing placement help is exercised with native input, never world mutation. */
const STARTUP_TIMEOUT_MS = 15_000;
async function expectVillageReady(page, expect) {
  await expect(page.locator('#loading')).toBeHidden({timeout:STARTUP_TIMEOUT_MS});
  await expect(page.locator('#game')).toHaveAttribute('data-renderer','ready',{timeout:STARTUP_TIMEOUT_MS});
}
export async function nativeTap(page, expect, locator) {
  await expect(locator).toBeVisible({timeout:8000});
  await expect(locator).toBeEnabled({timeout:8000});
  await locator.scrollIntoViewIfNeeded({timeout:8000});
  let point;
  // A drawer can be visible before its controls receive pointer input. Sample
  // fresh geometry within the existing input budget; persistent cover must fail.
  await expect.poll(async()=>{
    point=await locator.evaluate(element=>{
      const r=element.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2;
      return{x,y,width:r.width,height:r.height,hit:element.contains(document.elementFromPoint(x,y))};
    });
    return point.width>0&&point.height>0&&point.hit;
  },{timeout:8000}).toBe(true);
  expect(point.width).toBeGreaterThan(0);expect(point.height).toBeGreaterThan(0);expect(point.hit).toBe(true);
  await page.mouse.click(point.x,point.y);
}

export async function enterVillageForBrowser(page, expect) {
  await expectVillageReady(page, expect);
  const enter=page.locator('#muraEnterVillage');
  if(await enter.count()&&await enter.isVisible()){
    await nativeTap(page,expect,enter);
    await expect(page.locator('#muraEntry')).toBeHidden();
  }else{
    // Returning villages resume directly after the first acknowledged entry.
    await expect(page.locator('#muraEntry')).toHaveCount(0);
  }
}

export async function verifyVillageFirstBuild(page, expect, testInfo, beforeReload = async () => {}, { captureMilestones = true, verifyDirector = true } = {}) {
  page.setDefaultTimeout(8000);
  await enterVillageForBrowser(page, expect);
  const settings=await page.locator('#muraSettingsButton').boundingBox();
  expect(settings.width).toBeGreaterThanOrEqual(44);expect(settings.height).toBeGreaterThanOrEqual(44);
  const before=await page.evaluate(()=>({count:window.village.world.objects.length,beds:window.village.world.population().openBeds}));
  // The authored first objective now enters placement directly. The catalog is
  // still available for freeform play, but the first build no longer requires it.
  await nativeTap(page,expect,page.locator('#tutorialAction'));
  await expect(page.locator('#drawer')).toBeHidden();
  await expect(page.locator('#placement')).toBeVisible();
  await expect(page.locator('#cancelPlace')).toHaveText('ここに建てる');
  await expect(page.locator('#muraFindPlacement')).toHaveText('別の候補');
  expect(await page.evaluate(()=>window.village.world.objects.length)).toBe(before.count);
  await expect(page.locator('#cancelPlace')).toBeEnabled();
  await nativeTap(page,expect,page.locator('#cancelPlace'));
  await expect(page.locator('#placement')).toBeHidden();
  const tent=await page.evaluate(()=>window.village.world.objects.find(o=>o.kind==='tent'));
  expect(tent).toBeTruthy();expect(tent.phase).toBe('built');
  expect(await page.evaluate(()=>window.village.world.population().openBeds)).toBe(before.beds+2);
  await expect(page.locator('#toastText')).toContainText('寝床が2床増えました');
  await expect(page.locator('#muraMilestone')).toContainText('寝床が2床増えました');
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
    await page.mouse.move(drag.x+drag.dx,drag.y+drag.dy,{steps:12});await page.mouse.up();
    await page.waitForTimeout(150);
  }
  if (captureMilestones) await page.screenshot({path:testInfo.outputPath('first-storehouse-in-view.png')});
  let point;
  await expect.poll(async()=>{
    point=await page.evaluate(id=>{
      const {world,view}=window.village,host=world.object(id),rect=view.canvas.getBoundingClientRect();
      const center=view.project(host.x,1.4,host.z),cx=rect.left+center.x,cy=rect.top+center.y,offsets=[];
      // Start outside the most likely central mesh pixels. A forgiving pick is
      // expected to snap to the visible building instead of requiring pixel hunting.
      for(const [dx,dy] of [[28,8],[-28,8],[0,28],[20,-18],[-20,-18],[0,0]])offsets.push({dx,dy});
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
  await expect.poll(()=>page.evaluate(expected=>window.village.ui.selected===expected,facility.id)).toBe(true);
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
  await enterVillageForBrowser(page, expect);
  await expect(page.locator('#muraEntry')).toHaveCount(0);
  const restored=await page.evaluate(id=>window.village.world.object(id),tent.id);
  for(const key of ['id','kind','x','z','rot','phase'])expect(restored[key]).toBe(tent[key]);
  const restoredFacility=await page.evaluate(id=>window.village.world.object(id),facility.id);
  expect(restoredFacility.room.find(o=>o.id===bed.id)).toEqual(bed);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  // Public Playwright cases already capture the final page automatically.
  // Do not spend the interaction deadline taking the same final picture twice.
  if (captureMilestones) await page.screenshot({path:testInfo.outputPath('first-build-reloaded.png')});
  if (verifyDirector) await verifyVillageDirectorPolish(page, expect, testInfo);
}
