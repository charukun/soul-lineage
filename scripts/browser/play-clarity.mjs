import {nativeTap} from '@soul/platform-web/testing/native-input';
import {firstHuntDirectorState} from '../../apps/demon/src/web/first-hunt-director.js';
/** Native UI regressions shared by candidate and deployed DEV checks. */
export async function verifySoloClarity(page, frame, expect, testInfo) {
  const snapshot = () => frame.evaluate(() => { const s=window.__ATELIER__.snapshot();return {paused:s.paused,time:s.time,age:s.life.ageYears}; });
  await expect(frame.locator('body')).toHaveAttribute('data-observation','compact');
  await expect(page.locator('.soul-music [data-open]')).toBeHidden();
  await page.locator('#simulator-music').click();
  await expect.poll(async () => (await snapshot()).paused).toBe(true);
  const before=await snapshot();expect(Number.isFinite(before.age)).toBe(true);
  await page.waitForTimeout(350);
  expect(await snapshot()).toEqual(before);
  const layout=await page.locator('.soul-music dialog').evaluate(d=>({height:d.clientHeight,scroll:d.scrollHeight,bottom:d.querySelector('[data-stop]').getBoundingClientRect().bottom,viewport:innerHeight}));
  expect(layout.scroll).toBeLessThanOrEqual(layout.height+2);expect(layout.bottom).toBeLessThanOrEqual(layout.viewport);
  await page.screenshot({path:testInfo.outputPath('music-pauses-solo.png')});
  await page.locator('.soul-music form button').click();
  await expect.poll(async () => (await snapshot()).paused).toBe(false);
  await frame.locator('#pauseBtn').click();
  await page.locator('#simulator-music').click();
  await page.locator('.soul-music form button').click();
  await page.waitForTimeout(100);expect((await snapshot()).paused).toBe(true);
  await frame.locator('#pauseBtn').click();
  await frame.locator('#settingsBtn').click();
  await frame.locator('#tab-settings').click();
  await frame.locator('#observation-details').check();
  await expect(frame.locator('body')).toHaveAttribute('data-observation','detailed');
  expect(await frame.locator('.ratio-pie').count()).toBeGreaterThan(0);
  await frame.locator('#observation-details').uncheck();
  await frame.locator('#closeSettings').click();
}
export async function verifyHuntClarity(page, expect, testInfo) {
  await expect(page.locator('#online-open')).toHaveCount(0);
  await expect(page.locator('.soul-music [data-open]')).toBeHidden();
  const bounds=await page.locator('#pause').boundingBox();expect(bounds.width).toBeGreaterThanOrEqual(44);expect(bounds.height).toBeGreaterThanOrEqual(44);
  await nativeTap(page, expect, page.locator('#pause'));
  await assertHuntGuideState(page, expect);
  // Friend visits use Village invitations; normal hunts expose no player-village entry.
  await expect(page.locator('#online-settings')).toHaveCount(0);
  await expect(page.locator('#online-box')).toHaveCount(0);
  await expect(page.locator('#sheet')).toBeVisible();
  await nativeTap(page, expect, page.locator('#music-library'));
  const time=await page.evaluate(()=>window.__NIGHT_HUNT__.snapshot().time);
  await page.waitForTimeout(350);expect(await page.evaluate(()=>window.__NIGHT_HUNT__.snapshot().time)).toBe(time);
  await nativeTap(page, expect, page.locator('.soul-music form button'));
  await expect(page.locator('#sheet')).toBeVisible();
  await nativeTap(page, expect, page.locator('#sheet-close'));
  await nativeTap(page, expect, page.locator('#scent'));
  await expect(page.locator('#scent')).toBeDisabled();
  await nativeTap(page, expect, page.locator('#pause'));
  await assertHuntGuideState(page, expect);
  await nativeTap(page, expect, page.locator('#sheet-close'));
  await page.screenshot({path:testInfo.outputPath('first-hunt-guide.png')});
}

// The village is generated, so a real encounter may start before the first click.
// Inspect the paused engine, not the guide itself, to determine the exact instruction.
async function assertHuntGuideState(page, expect) {
  const state = await page.evaluate(() => window.__NIGHT_HUNT__.snapshot());
  expect(state.paused).toBe(true);
  expect(state.finished).toBe(false);
  expect(typeof state.devouring).toBe('boolean');
  const expected = firstHuntDirectorState(state).stage;
  await expect(page.locator('#first-hunt-guide')).toHaveAttribute('data-step', expected);
  await expect(page.locator('#hud')).toHaveAttribute('data-guide', expected);
  await expect(page.locator('#first-hunt-guide')).toBeVisible();
}
