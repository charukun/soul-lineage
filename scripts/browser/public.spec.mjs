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
    if (!target.legacy) {
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
