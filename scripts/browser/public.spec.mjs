import { test, expect } from '@playwright/test';
import { appendFileSync } from 'node:fs';
const base = process.env.BROWSER_SITE_URL?.replace(/\/?$/, '/');
const targets = JSON.parse(process.env.BROWSER_TARGETS || '[]');
if (!base || !targets.length) throw new Error('Pass a published URL and exact manifest targets');
for (const target of targets) {
  test(`${target.path} starts WebGL2 from the deployed commit`, async ({ page }, testInfo) => {
    const errors = [], failedRequests = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('requestfailed', request => failedRequests.push(request.url()));
    const url = new URL(`${target.path}/`, base).href;
    const response = await page.goto(url, { waitUntil: 'networkidle' });
    expect(response.status()).toBe(200);
    const canvas = page.locator('#game');
    await expect(canvas).toHaveAttribute('data-renderer', 'ready');
    await expect(canvas).toHaveAttribute('data-commit', target.version.commit);
    await expect(canvas).toHaveAttribute('data-environment', target.version.environment);
    const gpu = await canvas.evaluate(canvas => {
      const gl = canvas.getContext('webgl2');
      if (!gl || gl.isContextLost()) return null;
      return { version: gl.getParameter(gl.VERSION), width: gl.drawingBufferWidth, height: gl.drawingBufferHeight };
    });
    expect(gpu?.version).toContain('WebGL 2.0'); expect(gpu.width).toBeGreaterThan(0); expect(gpu.height).toBeGreaterThan(0);
    if (target.app === 'demon' && !target.legacy) {
      await expect(canvas).toHaveAttribute('data-app', 'demon');
      await expect(canvas).toHaveAttribute('data-world', 'night-hunt.v2');
      await expect(canvas).toHaveAttribute('data-asset', 'kaykit.floor_tile_small');
      await expect(canvas).toHaveAttribute('data-platform', 'web');
      await expect(page.getByRole('heading', { level: 1 })).toContainText('暗い');
      expect(await page.locator('#emblem').evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
      await page.setViewportSize({ width: 390, height: 844 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath('demon-title-mobile.png') });
      await page.locator('#begin').click();
      await expect(page.locator('[data-village]')).toHaveCount(3);
      await page.locator('[data-village]').first().click();
      await expect(page.locator('#hud')).toBeVisible();
      const started = await page.evaluate(() => window.__NIGHT_HUNT__.snapshot());
      expect(started.profile.visits[started.village].status).toBe('entered');
      expect(started.metrics.assets.floor).toBeGreaterThan(0);
      await page.mouse.click(195, 510);
      await page.waitForTimeout(150);
      const tapped = await page.evaluate(() => window.__NIGHT_HUNT__.snapshot());
      expect(tapped.input.amount).toBe(0);
      expect(tapped.input.dash).toBe(false);
      expect(tapped.player.x).toBeCloseTo(started.player.x, 3);
      expect(tapped.player.z).toBeCloseTo(started.player.z, 3);
      await page.mouse.move(195, 510); await page.mouse.down();
      await page.mouse.move(270, 510, { steps: 8 });
      await page.waitForTimeout(600);
      const moved = await page.evaluate(() => window.__NIGHT_HUNT__.snapshot());
      console.log('Demon input diagnostics', JSON.stringify({
        started: { mode:started.mode, paused:started.paused, player:started.player, time:started.time },
        moved: { mode:moved.mode, paused:moved.paused, player:moved.player, input:moved.input, time:moved.time },
        screen:await page.evaluate(() => ({ hidden:document.hidden, target:document.elementFromPoint(270,510)?.outerHTML, notice:document.querySelector('#boot-detail').textContent })),
        errors,
      }));
      expect(errors).toEqual([]);
      expect(moved.input.amount).toBeGreaterThan(0);
      expect(moved.player.x).toBeGreaterThan(started.player.x);
      await page.mouse.up();
      await expect.poll(() => page.evaluate(() => window.__NIGHT_HUNT__.snapshot().input.amount)).toBe(0);
      await page.screenshot({ path: testInfo.outputPath('demon-hunt-mobile.png') });
      // A second tab must not be able to write over the first tab's visit ledger.
      const other = await page.context().newPage();
      await other.goto(url);
      await expect(other.locator('#boot-detail')).toContainText('別のタブ');
      await other.close();
      await page.reload();
      await expect(canvas).toHaveAttribute('data-renderer', 'ready');
      const resumed = await page.evaluate(() => window.__NIGHT_HUNT__.snapshot());
      expect(resumed.profile.visits[started.village].status).toBe('abandoned');
      await page.locator('#begin').click();
      const nextIDs = await page.locator('[data-village]').evaluateAll(nodes => nodes.map(n => n.dataset.village));
      expect(nextIDs).not.toContain(started.village);
      await page.locator('#sheet-close').click();
      await page.setViewportSize({ width: 1280, height: 800 });
    } else if (target.app === 'village' && !target.legacy && await page.locator('#build').count()) {
      await expect(canvas).toHaveAttribute('data-game-world', 'hoshitsugi.life-and-guard.v5');
      await expect(page.locator('#loading')).toBeHidden();
      await expect(page.getByRole('heading', {level: 1})).toHaveText('星継ぎの庭');
      await page.setViewportSize({width:390,height:844});
      await page.locator('#build').click();
      await expect(page.locator('#catalog')).toBeVisible();
      await page.locator('#more').click();
      await page.locator('#onlineOpen').click();
      await expect(page.locator('#make-offer')).toBeVisible();
      await page.locator('#onlineDialog form button').click();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({path:testInfo.outputPath('village-mobile.png')});
    } else if (!target.legacy) {
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(target.version.name);
      await expect(canvas).toHaveAttribute('data-app', target.app);
      await expect(canvas).toHaveAttribute('data-world', 'village.foundation.v1');
      await expect(canvas).toHaveAttribute('data-asset', 'furniture.bench.oak.v1');
      await expect(canvas).toHaveAttribute('data-platform', 'web');
      await expect(page.getByRole('status')).toHaveAttribute('data-state', 'ready');
      expect(await page.locator('#emblem').evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
      // Mobile-sized browser viewport as a lightweight layout/resize regression check.
      await page.setViewportSize({ width: 390, height: 844 });
      await expect(canvas).toHaveAttribute('data-renderer', 'ready');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath('mobile.png'), fullPage: true });
      await page.setViewportSize({ width: 1280, height: 800 });
    }
    expect(errors).toEqual([]); expect(failedRequests).toEqual([]);
    const record = { url, commit: target.version.commit, inputHash: target.version.inputHash, webgl: gpu, errors, failedRequests };
    await testInfo.attach('verified-browser.json', { body: JSON.stringify(record, null, 2), contentType: 'application/json' });
    console.log('BROWSER VERIFIED', JSON.stringify(record));
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `\n- Browser OK: ${url} — ${target.version.commit} — WebGL2\n`);
  });
}
