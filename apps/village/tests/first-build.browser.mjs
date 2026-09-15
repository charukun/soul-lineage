import {nativeTap} from '@soul/platform-web/testing/native-input';
export {nativeTap};
import {verifyVillageDirectorPolish} from './director-polish.browser.mjs';

/** User-facing placement help is exercised with pointer input, never world mutation. */
const STARTUP_TIMEOUT_MS = 15_000;
const CAMERA_DRAG_STEPS = 3;
async function expectVillageReady(page, expect) {
  await expect(page.locator('#loading')).toBeHidden({timeout:STARTUP_TIMEOUT_MS});
  await expect(page.locator('#game')).toHaveAttribute('data-renderer','ready',{timeout:STARTUP_TIMEOUT_MS});
}

async function finishFirstRunGuide(page, expect) {
  const guide=page.locator('#muraFirstRunGuide');
  if(!(await guide.count()))return false;
  const canvas=page.locator('#game');
  await expect(guide).toBeVisible();
  await expect(canvas).toHaveAttribute('data-first-run-tutorial','running');
  await expect(guide).toHaveAttribute('data-stage','welcome');

  // Walk the same path a first-time player uses. Nothing below invokes world.add,
  // placement helpers or synthetic dispatchEvent shortcuts.
  await nativeTap(page,expect,page.locator('.muraFirstRunStart'));
  await expect(guide).toHaveAttribute('data-stage','build');
  await nativeTap(page,expect,page.locator('#build'));
  await expect(guide).toHaveAttribute('data-stage','catalog');
  const tentCard=page.locator('#catalog .card[data-kind="tent"]');
  await expect(tentCard).toBeVisible();
  await expect(tentCard).toHaveClass(/mura-first-run-target/);
  await nativeTap(page,expect,tentCard);
  await expect(guide).toHaveAttribute('data-stage','drag');
  await expect(page.locator('#placement')).toBeVisible();
  await expect(canvas).toHaveAttribute('data-placement','center-follow');

  // A premature tap must be taught, not interpreted as a placement shortcut.
  await tapPlacement(page);
  await expect(guide).toHaveAttribute('data-stage','drag');
  expect(await page.evaluate(()=>window.village.world.objects.some(o=>o.kind==='tent'))).toBe(false);

  const candidateBefore=await page.evaluate(()=>({x:window.village.ui.pending.x,z:window.village.ui.pending.z}));
  await dragPlacement(page,58,38);
  await expect(guide).toHaveAttribute('data-stage','place');
  await expect.poll(()=>page.evaluate(({x,z})=>{
    const p=window.village.ui.pending;return p?Math.hypot(p.x-x,p.z-z):0;
  },candidateBefore)).toBeGreaterThan(.2);

  await tapPlacement(page);
  await expect(guide).toHaveAttribute('data-stage','done');
  await expect.poll(()=>page.evaluate(()=>window.village.world.objects.some(o=>o.kind==='tent'))).toBe(true);
  await expect(page.locator('#muraPlacementUndo')).toBeVisible();
  await nativeTap(page,expect,page.locator('.muraFirstRunFinish'));
  await expect(guide).toHaveCount(0);
  await expect(canvas).toHaveAttribute('data-first-run-tutorial','seen');

  // Restore the pristine first-build fixture through the product's own undo path
  // so the established placement suite can continue from its original baseline.
  await nativeTap(page,expect,page.locator('#muraPlacementUndo'));
  await expect(page.locator('#placement')).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>window.village.world.objects.some(o=>o.kind==='tent'))).toBe(false);
  await nativeTap(page,expect,page.locator('#muraCancelPlacement'));
  await expect(page.locator('#placement')).toBeHidden();
  return true;
}

export async function enterVillageForBrowser(page, expect) {
  await expectVillageReady(page, expect);
  const entry=page.locator('#muraEntry'),enter=page.locator('#muraEnterVillage');
  if(await enter.count()&&await enter.isVisible()){
    await nativeTap(page,expect,enter);
    await expect(entry).toBeHidden();
  }else{
    await expect(entry).toHaveCount(0);
  }
  await finishFirstRunGuide(page,expect);
}

async function placementCenter(page){
  return page.evaluate(()=>{
    const r=window.village.view.canvas.getBoundingClientRect();
    return{x:r.left+r.width/2,y:r.top+r.height/2};
  });
}
async function tapPlacement(page){
  const p=await placementCenter(page);await page.mouse.click(p.x,p.y);
}
async function dragPlacement(page,dx=54,dy=34){
  const p=await placementCenter(page);await page.mouse.move(p.x,p.y);await page.mouse.down();
  await page.mouse.move(p.x+dx,p.y+dy,{steps:CAMERA_DRAG_STEPS});await page.mouse.up();
}

export async function verifyVillageFirstBuild(page, expect, testInfo, beforeReload = async () => {}, { captureMilestones = true, verifyDirector = true } = {}) {
  page.setDefaultTimeout(8000);
  await enterVillageForBrowser(page, expect);
  const settings=await page.locator('#muraSettingsButton').boundingBox();
  expect(settings.width).toBeGreaterThanOrEqual(44);expect(settings.height).toBeGreaterThanOrEqual(44);
  const before=await page.evaluate(()=>({count:window.village.world.objects.length,beds:window.village.world.population().openBeds}));

  // The first tutorial action enters center-follow placement directly. The scene
  // moves under the ghost with one finger and a short tap commits the candidate.
  await expect(page.locator('#tutorialAction')).toBeVisible();
  await nativeTap(page,expect,page.locator('#tutorialAction'));
  await expect(page.locator('#drawer')).toBeHidden();
  await expect(page.locator('#placement')).toBeVisible();
  await expect(page.locator('#game')).toHaveAttribute('data-placement','center-follow');
  await expect(page.locator('#placementText')).toContainText('スワイプで場所を調整');
  await expect(page.locator('#placementText')).toContainText('タップで配置');
  await expect(page.locator('#muraRotateLeft')).toBeVisible();
  expect(await page.locator('#muraFindPlacement').count()).toBe(0);
  await expect.poll(()=>page.evaluate(()=>window.village.ui.pending?.error||null)).toBe(null);
  expect(await page.evaluate(()=>window.village.world.objects.length)).toBe(before.count);

  const candidateBefore=await page.evaluate(()=>({x:window.village.ui.pending.x,z:window.village.ui.pending.z}));
  await dragPlacement(page);
  await expect.poll(()=>page.evaluate(({x,z})=>{
    const p=window.village.ui.pending;return p?Math.hypot(p.x-x,p.z-z):0;
  },candidateBefore)).toBeGreaterThan(.2);
  const centered=await page.evaluate(()=>{
    const {view}=window.village,p=view.project(view.ghost.position.x,.15,view.ghost.position.z);
    return{dx:Math.abs(p.x-view.w/2),dy:Math.abs(p.y-view.h/2)};
  });
  expect(centered.dx).toBeLessThan(4);expect(centered.dy).toBeLessThan(4);
  await expect(page.locator('#placement')).toBeVisible();

  await tapPlacement(page);
  await expect(page.locator('#placement')).toBeHidden();
  await expect(page.locator('#muraPlacementUndo')).toBeVisible();
  let tent=await page.evaluate(()=>window.village.world.objects.find(o=>o.kind==='tent'));
  expect(tent).toBeTruthy();expect(tent.phase).toBe('built');
  expect(await page.evaluate(()=>window.village.world.population().openBeds)).toBe(before.beds+2);
  await expect(page.locator('#toastText')).toContainText('寝床が2床増えました');
  await expect(page.locator('#muraMilestone')).toHaveClass(/visible/);
  if (captureMilestones) await page.screenshot({path:testInfo.outputPath('first-tent-built.png')});

  // Mistakes are recoverable without a confirmation dialog: undo re-enters the
  // same center-follow placement mode so the player can correct the position.
  await nativeTap(page,expect,page.locator('#muraPlacementUndo'));
  await expect(page.locator('#placement')).toBeVisible();
  expect(await page.evaluate(()=>window.village.world.objects.some(o=>o.kind==='tent'))).toBe(false);
  expect(await page.evaluate(()=>window.village.world.population().openBeds)).toBe(before.beds);
  await expect(page.locator('#placementText')).toContainText('タップで配置');
  await tapPlacement(page);
  await expect(page.locator('#placement')).toBeHidden();
  tent=await page.evaluate(()=>window.village.world.objects.find(o=>o.kind==='tent'));
  expect(tent).toBeTruthy();expect(tent.phase).toBe('built');
  expect(await page.evaluate(()=>window.village.world.population().openBeds)).toBe(before.beds+2);

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
  await expect(page.locator('#placementText')).toContainText('タップで配置');
  await expect.poll(()=>page.evaluate(()=>window.village.ui.pending?.error||null)).toBe(null);
  await tapPlacement(page);
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
