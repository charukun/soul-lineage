/** Native hit-tested input shared by browser scenarios. No forced or synthetic DOM clicks. */
const NATIVE_TAP_TIMEOUT_MS = 8_000;
async function sampleNativeTapPoint(locator) {
  return locator.evaluate(element=>{
    const r=element.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2;
    return{x,y,width:r.width,height:r.height,hit:element.contains(document.elementFromPoint(x,y))};
  });
}
async function nativeTapPointStillHits(locator, point) {
  return locator.evaluate((element,{x,y})=>element.contains(document.elementFromPoint(x,y)),point);
}
export async function nativeTap(page, expect, locator) {
  await expect(locator).toBeVisible({timeout:NATIVE_TAP_TIMEOUT_MS});
  await expect(locator).toBeEnabled({timeout:NATIVE_TAP_TIMEOUT_MS});
  await locator.scrollIntoViewIfNeeded({timeout:NATIVE_TAP_TIMEOUT_MS});
  let point;
  await expect.poll(async()=>{
    const candidate=await sampleNativeTapPoint(locator);
    if(!(candidate.width>0&&candidate.height>0&&candidate.hit))return false;
    await page.mouse.move(candidate.x,candidate.y);
    if(!(await nativeTapPointStillHits(locator,candidate)))return false;
    point=candidate;
    return true;
  },{timeout:NATIVE_TAP_TIMEOUT_MS}).toBe(true);
  expect(point.width).toBeGreaterThan(0);expect(point.height).toBeGreaterThan(0);expect(point.hit).toBe(true);
  await page.mouse.down();
  await page.mouse.up();
}
