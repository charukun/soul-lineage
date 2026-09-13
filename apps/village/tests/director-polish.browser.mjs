const angleError=(value,target)=>Math.abs(Math.atan2(Math.sin(value-target),Math.cos(value-target)));

export async function verifyVillageDirectorPolish(page, expect, testInfo) {
  page.setDefaultTimeout(8000);
  await expect.poll(()=>page.evaluate(()=>!!window.__MURA_DIRECTOR_POLISH__),{timeout:5000}).toBe(true);

  // Exercise the real top-HUD control, but use raw pointer coordinates because
  // its historical pointerdown handler intentionally changes HUD/activity state.
  const follow=page.locator('#muraFollowMayor');
  await expect(follow).toBeVisible();
  const followBox=await follow.boundingBox();
  expect(followBox.width).toBeGreaterThanOrEqual(44);
  expect(followBox.height).toBeGreaterThanOrEqual(44);
  const followHit=await page.evaluate(({x,y})=>{
    const button=document.getElementById('muraFollowMayor'),hit=document.elementFromPoint(x,y);
    return !!button&&!!hit&&button.contains(hit);
  },{x:followBox.x+followBox.width/2,y:followBox.y+followBox.height/2});
  expect(followHit).toBe(true);
  await page.mouse.click(followBox.x+followBox.width/2,followBox.y+followBox.height/2);
  await page.waitForTimeout(700);

  // Find a genuinely visible resident using projection/picking reads only, then
  // tap the rendered person. No world/camera setter or test-only dialog hook.
  let point=null;
  await expect.poll(async()=>{
    point=await page.evaluate(()=>{
      const {world,view}=window.village,r=view.canvas.getBoundingClientRect();
      const people=world.people.filter(p=>!p.dead&&!p.insideId);
      for(const p of people)for(const h of [1.6,1.2,.9]){
        const q=view.project(p.x,h,p.z),x=r.left+q.x,y=r.top+q.y;
        if(x<12||x>innerWidth-12||y<90||y>innerHeight-100)continue;
        const hit=document.elementFromPoint(x,y);
        if(hit===view.canvas&&view.pickPerson(x,y)===p.id)return{x,y,id:p.id};
      }
      return null;
    });
    return !!point;
  },{timeout:5000}).toBe(true);
  await page.mouse.click(point.x,point.y);
  const dialog=page.locator('#dialog');
  await expect(dialog).toBeVisible({timeout:5000});
  const frontButton=page.locator('.muraPersonCamera [data-camera="front"]');
  await expect(frontButton).toBeVisible({timeout:5000});
  await frontButton.click({timeout:5000});

  const bar=page.locator('#muraObservationBar');
  await expect(bar).toBeVisible({timeout:5000});
  await expect(bar.locator('[data-observe="front"]')).toHaveAttribute('aria-pressed','true');
  for(const button of await bar.locator('button').all()){
    const box=await button.boundingBox();
    expect(box.width).toBeGreaterThanOrEqual(43);
    expect(box.height).toBeGreaterThanOrEqual(43);
  }

  // Existing View.render resumed a slow orbit after 2.6 s. Remain in front view
  // beyond that threshold and require the camera to stay attached to the resident.
  await page.waitForTimeout(3400);
  const front=await page.evaluate(()=>{
    const {world,view}=window.village,id=window.__MURA_DIRECTOR_POLISH__.observation.personId;
    const p=world.people.find(person=>person.id===id),q=view.project(p.x,1.1,p.z);
    return{yaw:view.yaw,pitch:view.pitch,span:view.span,angle:p.angle||0,x:q.x,y:q.y,w:view.w,h:view.h,active:window.__MURA_DIRECTOR_POLISH__.observation.active};
  });
  expect(front.active).toBe(true);
  expect(angleError(front.yaw,front.angle+Math.PI)).toBeLessThan(.08);
  expect(Math.abs(front.pitch-.22)).toBeLessThan(.05);
  expect(front.span).toBeLessThan(11);
  expect(Math.abs(front.x-front.w/2)).toBeLessThan(26);
  expect(Math.abs(front.y-front.h/2)).toBeLessThan(70);
  await page.screenshot({path:testInfo.outputPath('director-resident-front-stable.png')});

  await bar.locator('[data-observe="side"]').click({timeout:5000});
  await expect(bar.locator('[data-observe="side"]')).toHaveAttribute('aria-pressed','true');
  await expect.poll(()=>page.evaluate(()=>{
    const {world,view}=window.village,id=window.__MURA_DIRECTOR_POLISH__.observation.personId;
    const p=world.people.find(person=>person.id===id);
    return Math.abs(Math.atan2(Math.sin(view.yaw-((p.angle||0)+Math.PI/2)),Math.cos(view.yaw-((p.angle||0)+Math.PI/2))));
  }),{timeout:5000}).toBeLessThan(.08);
  await page.screenshot({path:testInfo.outputPath('director-resident-side.png')});

  // A normal camera drag must take control back immediately.
  const canvas=page.locator('#game'),box=await canvas.boundingBox();
  await page.mouse.move(box.x+box.width*.52,box.y+box.height*.52);
  await page.mouse.down();
  await page.mouse.move(box.x+box.width*.63,box.y+box.height*.58,{steps:8});
  await page.mouse.up();
  await expect(bar).toBeHidden({timeout:5000});
  expect(await page.evaluate(()=>window.__MURA_DIRECTOR_POLISH__.observation.active)).toBe(false);

  // Once authored onboarding is dismissed, retain a small systemic next step.
  const dismiss=page.locator('#dismissTutorial');
  if(await dismiss.isVisible())await dismiss.click({timeout:5000});
  const goal=page.locator('#muraVillageGoal');
  await expect(goal).toBeVisible({timeout:5000});
  await expect(goal.locator('span')).not.toHaveText('');
  await page.screenshot({path:testInfo.outputPath('director-village-next-step.png')});
}
