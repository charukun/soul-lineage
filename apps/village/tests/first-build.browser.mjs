/** User-facing placement help is exercised with native input, never world mutation. */
export async function verifyVillageFirstBuild(page, expect, testInfo, beforeReload = async () => {}) {
  await expect(page.locator('#loading')).toBeHidden();
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
  // through its visible rendered mesh; projection and picking only read the scene.
  await page.locator('#deselect').click();
  const facility=await page.evaluate(()=>window.village.world.objects.find(o=>o.kind==='storage'));
  expect(facility?.phase).toBe('built');
  let point;
  await expect.poll(async()=>{
    point=await page.evaluate(id=>{
      const {world,view}=window.village,host=world.object(id),rect=view.canvas.getBoundingClientRect();
      for(const y of [2,1,.5,3]) for(const dx of [0,-1,1,-2,2]) for(const dz of [0,-1,1]) {
        const p=view.project(host.x+dx,y,host.z+dz),x=p.x+rect.left,z=p.y+rect.top;
        const element=document.elementFromPoint(x,z);
        if(x>10&&x<innerWidth-10&&z>100&&z<innerHeight-140&&element?.closest('#scene')&&view.pick(x,z)===id&&!view.pickPerson(x,z))return{x,y:z};
      }
      return null;
    },facility.id);
    return !!point;
  }).toBe(true);
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
  await page.locator('#leaveRoom').click();
  await expect.poll(()=>page.evaluate(()=>window.village.view.roomId)).toBe(null);
  await beforeReload();
  await page.reload({waitUntil:'domcontentloaded'});
  await expect(page.locator('#loading')).toBeHidden();
  await page.locator('#muraEnterVillage').click();
  const restored=await page.evaluate(id=>window.village.world.object(id),tent.id);
  for(const key of ['id','kind','x','z','rot','phase'])expect(restored[key]).toBe(tent[key]);
  const restoredFacility=await page.evaluate(id=>window.village.world.object(id),facility.id);
  expect(restoredFacility.room.find(o=>o.id===bed.id)).toEqual(bed);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:testInfo.outputPath('first-build-reloaded.png')});
}
