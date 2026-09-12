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
  await page.locator('#pause').click();
  await assertHuntGuideState(page, expect, false);
  // Friend visits use Village invitations; normal hunts expose no player-village entry.
  await expect(page.locator('#online-settings')).toHaveCount(0);
  await expect(page.locator('#online-box')).toHaveCount(0);
  await expect(page.locator('#sheet')).toBeVisible();
  await page.locator('#music-library').click();
  const time=await page.evaluate(()=>window.__NIGHT_HUNT__.snapshot().time);
  await page.waitForTimeout(350);expect(await page.evaluate(()=>window.__NIGHT_HUNT__.snapshot().time)).toBe(time);
  await page.locator('.soul-music form button').click();
  await expect(page.locator('#sheet')).toBeVisible();
  await page.locator('#sheet-close').click();
  await page.locator('#scent').click();
  await expect(page.locator('#scent')).toBeDisabled();
  await page.locator('#pause').click();
  await assertHuntGuideState(page, expect, true);
  await page.locator('#sheet-close').click();
  await page.screenshot({path:testInfo.outputPath('first-hunt-guide.png')});
}

// The village is generated, so a real encounter may start before the first click.
// Inspect the paused engine, not the guide itself, to determine the exact instruction.
async function assertHuntGuideState(page, expect, sensed) {
  const state = await page.evaluate(() => window.__NIGHT_HUNT__.snapshot());
  expect(state.paused).toBe(true);
  expect(state.finished).toBe(false);
  expect(typeof state.devouring).toBe('boolean');
  const nearPrey = state.npcs.some(n => n.dead && !n.eaten && Math.hypot(n.x-state.player.x,n.z-state.player.z)<2.5);
  const expected = state.devouring ? 'devour' : state.combat ? 'combat' : state.eaten>0 ? 'memory' : nearPrey ? 'stop' : sensed ? 'approach' : 'sense';
  await expect(page.locator('#first-hunt-guide')).toHaveAttribute('data-step', expected);
  await expect(page.locator('#first-hunt-guide')).toBeVisible();
}
