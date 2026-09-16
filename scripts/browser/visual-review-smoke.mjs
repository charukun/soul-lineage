import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';

const reviewUrl = new URL(process.argv[2] || process.env.REVIEW_URL || 'https://rinne-visual-review.c-okamoto.workers.dev/');
const expectedSha = process.argv[3] || process.env.SOURCE_SHA || '';
assert.match(expectedSha, /^[0-9a-f]{40}$/, 'Visual Review smoke requires the exact 40-character source SHA');

const reportDir = resolve(process.env.VISUAL_REVIEW_REPORT_DIR || 'test-results/visual-review');
mkdirSync(reportDir, { recursive: true });
const failures = [];
const pageErrors = [];
const requestFailures = [];

const versionUrl = new URL('version.json', reviewUrl);
versionUrl.searchParams.set('source', expectedSha);
const versionResponse = await fetch(versionUrl, { signal: AbortSignal.timeout(20000) });
assert.equal(versionResponse.status, 200, `Visual Review version.json returned HTTP ${versionResponse.status}`);
const version = await versionResponse.json();
assert.equal(version.commit, expectedSha, `Visual Review is stale: expected ${expectedSha}, got ${version.commit || 'missing'}`);
assert.equal(version.app, 'rinne', 'Visual Review version.json is not the RINNE bundle');
assert.equal(version.environment, 'dev', 'Visual Review must be built from the DEV environment');

let browser;
let page;
try {
  browser = await chromium.launch({
    headless: true,
    args: ['--use-angle=swiftshader', '--enable-webgl', '--enable-unsafe-swiftshader'],
  });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  page = await context.newPage();
  page.on('pageerror', error => pageErrors.push(String(error?.stack || error)));
  page.on('requestfailed', request => {
    try {
      const url = new URL(request.url());
      if (url.origin === reviewUrl.origin && ['document', 'script', 'stylesheet'].includes(request.resourceType())) {
        requestFailures.push(`${request.resourceType()} ${url.pathname}: ${request.failure()?.errorText || 'failed'}`);
      }
    } catch {}
  });

  const entry = new URL(reviewUrl);
  entry.searchParams.set('source', expectedSha);
  const response = await page.goto(entry.toString(), { waitUntil: 'domcontentloaded', timeout: 30000 });
  assert.ok(response?.ok(), `Visual Review entry returned HTTP ${response?.status() ?? 'unknown'}`);
  assert.equal(await page.title(), '輪廻転焦 Visual Review');
  await page.locator('.review-shell').waitFor({ state: 'visible', timeout: 15000 });
  await page.waitForFunction(prefix => document.querySelector('#build-source')?.textContent?.includes(prefix), expectedSha.slice(0, 12), { timeout: 15000 });

  const weaponTabs = page.locator('#weapon-tabs button[data-weapon]');
  assert.ok(await weaponTabs.count() >= 2, 'Visual Review inspiration weapon tabs were not rendered');
  const secondWeapon = weaponTabs.nth(1);
  await secondWeapon.click();
  assert.ok(await secondWeapon.evaluate(node => node.classList.contains('active')), 'Visual Review weapon tab interaction did not update state');
  assert.equal(await page.locator('#inspiration-phases article').count(), 3, 'Visual Review inspiration phases did not render');

  await page.locator('[data-view="motion"]').click();
  const motionPanel = page.locator('[data-panel="motion"]');
  await motionPanel.waitFor({ state: 'visible', timeout: 10000 });
  await page.waitForFunction(() => document.querySelector('[data-panel="motion"] iframe')?.getAttribute('src')?.includes('characters.html?review=motion'), null, { timeout: 10000 });
  const motionContent = page.frameLocator('[data-panel="motion"] iframe');
  await motionContent.locator('main.review-app').waitFor({ state: 'visible', timeout: 45000 });
  assert.match(await motionContent.locator('body').evaluate(() => document.title), /キャラクター工房/);

  await page.locator('[data-view="characters"]').click();
  const charactersPanel = page.locator('[data-panel="characters"]');
  await charactersPanel.waitFor({ state: 'visible', timeout: 10000 });
  await page.waitForFunction(() => document.querySelector('[data-panel="characters"] iframe')?.getAttribute('src')?.includes('characters.html'), null, { timeout: 10000 });
  const charactersContent = page.frameLocator('[data-panel="characters"] iframe');
  await charactersContent.locator('main.review-app').waitFor({ state: 'visible', timeout: 45000 });

  await page.locator('[data-view="battle"]').click();
  await page.locator('[data-panel="battle"]').waitFor({ state: 'visible', timeout: 10000 });
  await page.waitForFunction(() => {
    const value = Number.parseFloat(document.querySelector('#battle-time')?.textContent || '0');
    const result = document.querySelector('#battle-result')?.textContent || '';
    return value >= 0.2 && (result === '戦闘中' || result.includes('勝利'));
  }, null, { timeout: 15000 });
  const battleTime = await page.locator('#battle-time').textContent();
  const battleResult = await page.locator('#battle-result').textContent();

  assert.deepEqual(pageErrors, [], `Visual Review page errors: ${pageErrors.join('\n')}`);
  assert.deepEqual(requestFailures, [], `Visual Review critical request failures: ${requestFailures.join('\n')}`);

  await page.screenshot({ path: resolve(reportDir, 'public.png'), fullPage: true });
  writeFileSync(resolve(reportDir, 'receipt.json'), JSON.stringify({
    sourceSha: expectedSha,
    url: reviewUrl.toString(),
    version,
    battleTime,
    battleResult,
    pageErrors,
    requestFailures,
    checkedAt: new Date().toISOString(),
  }, null, 2));
  await context.close();
} catch (error) {
  failures.push(String(error?.stack || error));
  if (page) await page.screenshot({ path: resolve(reportDir, 'failure.png'), fullPage: true }).catch(() => {});
  writeFileSync(resolve(reportDir, 'failure.json'), JSON.stringify({
    sourceSha: expectedSha,
    url: reviewUrl.toString(),
    pageErrors,
    requestFailures,
    failures,
    checkedAt: new Date().toISOString(),
  }, null, 2));
  throw error;
} finally {
  if (browser) await browser.close().catch(() => {});
}

console.log('VISUAL REVIEW BROWSER VERIFIED', JSON.stringify({ sourceSha: expectedSha, url: reviewUrl.toString() }));
