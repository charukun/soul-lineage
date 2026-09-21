import assert from 'node:assert/strict';

// Real UI input shared by the existing smoke and life playthrough. No save injection or onboarding bypass.
export async function chooseFamilyOrigin(page, {capture = null, checkCancel = false} = {}) {
  const dialog = page.locator('.family-origin[open]');
  await dialog.waitFor({state:'visible', timeout:30000});
  if (checkCancel) {
    await dialog.locator('[data-answer="wa"]').click();
    await dialog.locator('[data-origin-cancel]').click();
    await dialog.waitFor({state:'hidden'});
    await page.locator('#new-life').click();
    await dialog.waitFor({state:'visible'});
    assert.equal(await dialog.getAttribute('data-step'), '0');
  }
  if (capture) await capture('family-origin-water.png');
  const choose = async (id, nextStep) => {
    await dialog.locator(`[data-answer="${id}"]`).click();
    await page.waitForFunction(step => document.querySelector('.family-origin[open]')?.dataset.step === String(step), nextStep);
  };
  await choose('wa', 1);
  await choose('discern', 2);
  await choose('katana', 3);
  assert.match(await dialog.textContent(), /霧山の一族/);
  assert.match(await dialog.textContent(), /刀の家伝/);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  const replace = dialog.locator('[data-replace-family]');
  if (await replace.count()) {
    assert.equal(await dialog.locator('[data-origin-confirm]').isDisabled(), true);
    await dialog.locator('.family-story-replace').click();
    assert.equal(await replace.isChecked(), true);
  }
  if (capture) await capture('family-origin-home.png');
  await dialog.locator('[data-origin-confirm]').click();
  await dialog.waitFor({state:'hidden'});
}
