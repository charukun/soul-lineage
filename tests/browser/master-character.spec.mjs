import { test, expect } from '@playwright/test';

const url = process.env.MASTER_CHARACTER_URL || 'http://127.0.0.1:5273/characters.html';

test('MasterCharacter simulator renders and measures 30 audited Shino actors', async ({ page }, testInfo) => {
  test.setTimeout(180000);
  const errors = [], failedRequests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('requestfailed', request => failedRequests.push(request.url()));

  const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('量産モデルシミュレーター');
  await page.waitForFunction(() => window.masterCharacterReview?.ready === true, null, { timeout: 120000 });

  const canvas = page.locator('#stage');
  const gpu = await canvas.evaluate(node => {
    const gl = node.getContext('webgl2');
    if (!gl || gl.isContextLost()) return null;
    return { version: gl.getParameter(gl.VERSION), width: gl.drawingBufferWidth, height: gl.drawingBufferHeight };
  });
  expect(gpu?.version).toContain('WebGL 2.0');
  expect(gpu.width).toBeGreaterThan(0);
  expect(gpu.height).toBeGreaterThan(0);

  await page.locator('#count').selectOption('30');
  await page.locator('#springs').selectOption('all');
  await page.waitForFunction(() => window.masterCharacterReview?.actors?.length === 30 && window.masterCharacterReview?.settings?.count === 30, null, { timeout: 60000 });
  await page.waitForFunction(() => {
    const m = window.masterCharacterReview?.measure?.();
    return m?.sampleCount >= 30 && m.drawnActors === 30 && m.physicsActors === 30;
  }, null, { timeout: 120000 });

  const metrics = await page.evaluate(() => window.masterCharacterReview.measure());
  expect(metrics.drawnActors).toBe(30);
  expect(metrics.physicsActors).toBe(30);
  expect(metrics.pool.active).toBe(30);
  expect(metrics.pool.allocated).toBe(30);
  expect(metrics.pool.meshes).toBeGreaterThan(metrics.pool.geometries);
  expect(metrics.pool.geometries).toBeGreaterThan(0);
  expect(metrics.pool.textures).toBeGreaterThan(0);
  expect(metrics.sampleCount).toBeGreaterThanOrEqual(30);
  expect(Number.isFinite(metrics.p95Ms) && metrics.p95Ms > 0).toBe(true);
  expect(Number.isFinite(metrics.fps) && metrics.fps > 0).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);

  await page.locator('#selected').selectOption('29');
  await page.locator('[data-camera="face"]').click();
  await expect(page.locator('#subject')).toContainText('個体 30 / 30');
  await page.screenshot({ path: testInfo.outputPath('master-character-30-mobile.png'), fullPage: true });

  await page.locator('#view').selectOption('single');
  await page.waitForFunction(() => window.masterCharacterReview?.measure?.().drawnActors === 1, null, { timeout: 30000 });
  expect((await page.evaluate(() => window.masterCharacterReview.measure())).drawnActors).toBe(1);
  await page.locator('#view').selectOption('crowd');
  await page.locator('[data-camera="overview"]').click();
  await page.waitForFunction(() => window.masterCharacterReview?.measure?.().drawnActors === 30, null, { timeout: 30000 });

  await page.setViewportSize({ width: 1280, height: 800 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('master-character-30-desktop.png'), fullPage: true });

  expect(errors).toEqual([]);
  expect(failedRequests).toEqual([]);
  await testInfo.attach('master-character-metrics.json', {
    body: JSON.stringify({ url, gpu, metrics }, null, 2),
    contentType: 'application/json',
  });
  console.log('MASTER CHARACTER BROWSER VERIFIED', JSON.stringify({ gpu, metrics }));
});
