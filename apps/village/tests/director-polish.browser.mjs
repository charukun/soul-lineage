const angleError=(value,target)=>Math.abs(Math.atan2(Math.sin(value-target),Math.cos(value-target)));

export async function verifyVillageDirectorPolish(page, expect, testInfo) {
  await expect.poll(()=>page.evaluate(()=>!!window.__MURA_DIRECTOR_POLISH__)).toBe(true);

  // The normal HUD action brings the mayor into view. We then tap the rendered
  // resident, rather than opening the person sheet through a test-only hook.
  const follow=page.locator('#muraFollowMayor');
  await expect(follow).toBeVisible();
  await follow.click();
  await page.waitForTimeout(700);
  const point=await page.evaluate(()=>{
    const {world,view}=window.village,p=world.people.find(person=>person.role==='mayor');
    if(!p)return null;
    const q=view.project(p.x,1.2,p.z),r=view.canvas.getBoundingClientRect();
    return{x:r.left+q.x,y:r.top+q.y,id:p.id};
  });
  expect(point).toBeTruthy();
  await page.mouse.click(point.x,point.y);
  const dialog=page.locator('#dialog');
  await expect(dialog).toBeVisible();
  await expect(page.locator('.muraPersonCamera [data-camera="front"]')).toBeVisible();

  await page.locator('.muraPersonCamera [data-camera="front"]').click();
  const bar=page.locator('#muraObservationBar');
  await expect(bar).toBeVisible();
  await expect(bar.locator('[data-observe="front"]')).toHaveAttribute('aria-pressed','true');
  for(const button of await bar.locator('button').all()){
    const box=await button.boundingBox();
    expect(box.width).toBeGreaterThanOrEqual(43);
    expect(box.height).toBeGreaterThanOrEqual(43);
  }

  // The old camera resumed auto-orbit after 2.6 s. Keep this view open beyond
  // that threshold and verify the camera still faces the resident from front.
  await page.waitForTimeout(3400);
  const front=await page.evaluate(()=>{
    const {world,view}=window.village,p=world.people.find(person=>person.role==='mayor');
    const q=view.project(p.x,1.1,p.z);
    return{yaw:view.yaw,pitch:view.pitch,span:view.span,angle:p.angle||0,x:q.x,y:q.y,w:view.w,h:view.h,active:window.__MURA_DIRECTOR_POLISH__.observation.active};
  });
  expect(front.active).toBe(true);
  expect(angleError(front.yaw,front.angle+Math.PI)).toBeLessThan(.08);
  expect(Math.abs(front.pitch-.22)).toBeLessThan(.05);
  expect(front.span).toBeLessThan(11);
  expect(Math.abs(front.x-front.w/2)).toBeLessThan(26);
  expect(Math.abs(front.y-front.h/2)).toBeLessThan(70);
  await page.screenshot({path:testInfo.outputPath('director-resident-front-stable.png')});

  await bar.locator('[data-observe="side"]').click();
  await expect(bar.locator('[data-observe="side"]')).toHaveAttribute('aria-pressed','true');
  await expect.poll(()=>page.evaluate(()=>{
    const {world,view}=window.village,p=world.people.find(person=>person.role==='mayor');
    return Math.abs(Math.atan2(Math.sin(view.yaw-((p.angle||0)+Math.PI/2)),Math.cos(view.yaw-((p.angle||0)+Math.PI/2))));
  })).toBeLessThan(.08);
  await page.screenshot({path:testInfo.outputPath('director-resident-side.png')});

  // A native camera drag exits the deliberate observation mode instead of
  // fighting a hidden follow/orbit state.
  const canvas=page.locator('#game'),box=await canvas.boundingBox();
  await page.mouse.move(box.x+box.width*.52,box.y+box.height*.52);
  await page.mouse.down();
  await page.mouse.move(box.x+box.width*.63,box.y+box.height*.58,{steps:8});
  await page.mouse.up();
  await expect(bar).toBeHidden();
  expect(await page.evaluate(()=>window.__MURA_DIRECTOR_POLISH__.observation.active)).toBe(false);

  // Once the authored tutorial is dismissed, the village should still explain
  // the next meaningful systemic step without inventing a new quest system.
  const dismiss=page.locator('#dismissTutorial');
  if(await dismiss.isVisible())await dismiss.click();
  const goal=page.locator('#muraVillageGoal');
  await expect(goal).toBeVisible();
  await expect(goal.locator('span')).not.toHaveText('');
  await page.screenshot({path:testInfo.outputPath('director-village-next-step.png')});
}
