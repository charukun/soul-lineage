import {verifyVillageDirectorPolish} from './director-polish.browser.mjs';

/** User-facing placement help is exercised with native input, never world mutation. */
const STARTUP_TIMEOUT_MS = 15_000;
async function expectVillageReady(page, expect) {
  await expect(page.locator('#loading')).toBeHidden({timeout:STARTUP_TIMEOUT_MS});
  await expect(page.locator('#game')).toHaveAttribute('data-renderer','ready',{timeout:STARTUP_TIMEOUT_MS});
}

export async function verifyVillageFirstBuild(page, expect, testInfo, beforeReload = async () => {}) {
  await expectVillageReady(page, expect);
  await page.locator('#muraEnterVillage').click();
  await expect(page.locator('#muraEntry')).toBeHidden();
  const settings=await page.locator('#muraSettingsButton').boundingBox();
  expect(settings.width).toBeGreaterThanOrEqual(44);expect(settings.height).toBeGreaterThanOrEqual(44);
  const before=await page.evaluate(()=>({count:window.village.world.objects.length,beds:window.village.world.population().openBeds}));
  await page.locator('#build').click();
  await page.locator('[data-kind="tent"]').click();
  await expect(page.locator('#placement')).toBeVisible();
  await expect(page.locator('#cancelPlace')).toHaveText('ここに建てる');
  await page.locator('#muraFindPlacement').click();
  expect(await page.evaluate(()=>window.village.world.objects.length)).toBe(before.count);
  await expect(page.locator('#cancelPlace')).toBeEnabled();
  await page.locator('#cancelPlace').click();
  await expect(page.locator('#placement')).toBeHidden();
  const tent=await page.evaluate(()=>window.village.world.objects.find(o=>o.kind==='tent'));
  expect(tent).toBeTruthy();expect(tent.phase).toBe('built');
  expect(await page.evaluate(()=>window.village.world.population().openBeds)).toBe(before.beds+2);
  await expect(page.locator('#toastText')).toContainText('寝床が2床増えました');
  await page.screenshot({path:testInfo.outputPath('first-tent-built.png')});

  // NPC homes are intentionally not player-editable. Select the existing storehouse
  // through a genuinely visible screen-space part of its rendered footprint.
  await page.locator('#deselect').click();
  const facility=await page.evaluate(()=>window.village.world.objects.find(o=>o.kind==='storage'));
  expect(facility?.phase).toBe('built');
  // The placement guide focuses the tent, not the storehouse. Bring the latter
  // into view through the same drag gesture as a player before attempting a pick.
  // Projection and picking are reads only; camera/world setters are never called.
  for (let step=0;step<8;step++) {
    const drag=await page.evaluate(id=>{
      const {world,view}=window.village,host=world.object(id),rect=view.canvas.getBoundingClientRect();
      const p=view.project(host.x,1,host.z);
      const x=rect.left+rect.width/2,y=rect.top+rect.height/2;
      const dx=x-(rect.left+p.x),dy=y-(rect.top+p.y);
      return {x,y,dx:Math.max(-rect.width*.32,Math.min(rect.width*.32,dx)),dy:Math.max(-rect.height*.23,Math.min(rect.height*.23,dy)),distance:Math.hypot(dx,dy)};
    },facility.id);
    if(drag.distance<12)break;
    await page.mouse.move(drag.x,drag.y);
    await page.mouse.down();
    await page.mouse.move(drag.x+drag.dx,drag.y+drag.dy,{steps:12});
    await page.mouse.up();
    await page.waitForTimeout(150);
  }
  await page.screenshot({path:testInfo.outputPath('first-storehouse-in-view.png')});
  let point;
  await expect.poll(async()=>{
    point=await page.evaluate(id=>{
      const {world,view}=window.village,host=world.object(id),rect=view.canvas.getBoundingClientRect();
      const center=view.project(host.x,1.4,host.z),cx=rect.left+center.x,cy=rect.top+center.y;
      const offsets=[];
      for(let dy=-108;dy<=108;dy+=12)for(let dx=-144;dx<=144;dx+=12)offsets.push({dx,dy,d:dx*dx+dy*dy});
      offsets.sort((a,b)=>a.d-b.d);
      for(const {dx,dy} of offsets){
        const x=cx+dx,y=cy+dy;
        if(x<=10||x>=innerWidth-10||y<=100||y>=innerHeight-140)continue;
        const element=document.elementFromPoint(x,y);
        if(element===view.canvas&&view.pick(x,y)===id&&!view.pickPerson(x,y))return{x,y};
      }
      return null;
    },facility.id);
    return !!point;
  },{timeout:5000}).toBe(true);
  await page.mouse.click(point.x,point.y);
  await page.locator('#enter').click();
  await expect.poll(()=>page.evaluate(()=>window.village.view.roomId)).toBe(facility.id);
  await page.locator('#build').click();
  // Planks and cloth have not been discovered. Use the authored starter furniture.
  await page.locator('[data-kind="dirtbed"]').click();
  await page.locator('#muraFindPlacement').click();
  await expect(page.locator('#cancelPlace')).toHaveText('ここに置く');
  await page.locator('#cancelPlace').click();
  await expect(page.locator('#placement')).toBeHidden();
  const furnished=await page.evaluate(id=>window.village.world.object(id),facility.id);
  const bed=furnished.room.find(o=>o.kind==='dirtbed');expect(bed).toBeTruthy();
  await expect.poll(()=>page.evaluate(()=>window.village.storageOK)).toBe(true);
  const exit=page.locator('#leaveRoom');
  await expect(exit).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>{
    const button=document.getElementById('leaveRoom'),r=button.getBoundingClientRect();
    const header=document.getElementById('idleStatus').getBoundingClientRect();
    return r.width>=44&&r.height>=44&&r.top>=header.bottom&&r.left>=0&&r.right<=innerWidth&&
      r.bottom<=innerHeight&&button.contains(document.elementFromPoint(r.left+r.width/2,r.top+r.height/2));
  })).toBe(true);
  await page.screenshot({path:testInfo.outputPath('first-furniture-exit-visible.png')});
  await exit.click();
  await expect.poll(()=>page.evaluate(()=>window.village.view.roomId)).toBe(null);
  await beforeReload();
  await page.reload({waitUntil:'domcontentloaded'});
  await expectVillageReady(page, expect);
  await page.locator('#muraEnterVillage').click();
  const restored=await page.evaluate(id=>window.village.world.object(id),tent.id);
  for(const key of ['id','kind','x','z','rot','phase'])expect(restored[key]).toBe(tent[key]);
  const restoredFacility=await page.evaluate(id=>window.village.world.object(id),facility.id);
  expect(restoredFacility.room.find(o=>o.id===bed.id)).toEqual(bed);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:testInfo.outputPath('first-build-reloaded.png')});

  await verifyVillageDirectorPolish(page, expect, testInfo);
}
