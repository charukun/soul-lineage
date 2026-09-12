import { test, expect } from '@playwright/test';
import { appendFileSync } from 'node:fs';
import {registerClarityTests} from './public-clarity.mjs';
import { isVerifiedAudioRangeAbort, describeFailedRequest } from './media-request-contract.mjs';
const base = process.env.BROWSER_SITE_URL?.replace(/\/?$/, '/');
const targets = JSON.parse(process.env.BROWSER_TARGETS || '[]');
if (!base || !targets.length) throw new Error('Pass a published URL and exact manifest targets');
for (const target of targets) {
  test(`${target.path} starts WebGL2 from the deployed commit`, async ({ page }, testInfo) => {
    test.setTimeout(target.app === 'rinne' && !target.legacy ? 180000 : 60000);
    const errors = [], rawFailedRequests = [], simulatorRequests = [], playedSources = new Set();
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('requestfailed', request => rawFailedRequests.push(request));
    page.on('request', request => { if (request.url().includes('/simulator/')) simulatorRequests.push(request.url()); });
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
    if (target.app === 'rinne' && !target.legacy) {
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(target.version.name);
      await expect(canvas).toHaveAttribute('data-app', 'rinne');
      await expect(canvas).toHaveAttribute('data-platform', 'web');
      await expect(page.locator('#title-screen')).toHaveAttribute('data-experience', 'rinne-title');
      await expect(page.locator('#status')).toHaveAttribute('data-state', 'ready');
      await expect(page.locator('#start-simulator')).toBeEnabled();
      expect(await page.locator('#emblem').evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
      expect(simulatorRequests).toEqual([]);
      await page.setViewportSize({ width: 390, height: 844 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath('rinne-title-mobile.png') });
      await page.locator('#start-simulator').click();
      await expect.poll(() => page.evaluate(() => window.__RINNE_TITLE__?.snapshot().state), { timeout: 100000 }).toBe('playing');
      expect(simulatorRequests.length).toBeGreaterThan(0);
      const frame = page.frames().find(item => item.url().includes('/simulator/index.html'));
      expect(frame).toBeTruthy();
      const ready = await frame.evaluate(() => ({ ready: window.__ATELIER__?.snapshot().ready, model: window.__HUMANOID_LAB__?.report().id, finite: window.__HUMANOID_LAB__?.report().finite }));
      expect(ready.ready).toBe(true); expect(ready.finite).toBe(true); expect(ready.model).toBe('SHINO');
      await frame.evaluate(() => window.__ATELIER__.stop());
      const combat = await frame.evaluate(() => {
        const app = window.__ATELIER__;
        window.__LIFE_LAB__.advance(Math.max(0, 22 - window.__LIFE_LAB__.snapshot().ageYears) * 60);
        window.__LIFE_LAB__.setEnemies(true);
        app.setup({ opponent: 'duel', distance: 2, weapon: 'sword' });
        app.step(720, false);
        app.render();
        return app.snapshot().stats;
      });
      expect(combat.hits).toBeGreaterThan(0); expect(combat.damage).toBeGreaterThan(0);
      await page.screenshot({ path: testInfo.outputPath('rinne-simulator-mobile.png') });
      const simulator = page.frameLocator('#simulator-frame');
      await simulator.locator('#lifeBadge').click();
      await simulator.locator('[data-life-rate="20"]').click();
      await simulator.locator('#lifeEnemies').uncheck();
      await simulator.locator('#lifeResume').click();
      const life = await frame.evaluate(() => window.__LIFE_LAB__.snapshot());
      expect(life.rate).toBe(20); expect(life.enemiesEnabled).toBe(false);
      await page.locator('#back-title').click();
      await expect(page.locator('#simulator-frame')).toHaveCount(0);
      await expect(page.locator('#title-screen')).toBeVisible();
      await expect(canvas).toHaveAttribute('data-renderer', 'ready');
      await testInfo.attach('simulator.json', { body: JSON.stringify({ ready, combat }, null, 2), contentType: 'application/json' });
      await page.setViewportSize({ width: 1280, height: 800 });
    } else if (target.app === 'demon' && !target.legacy) {
      await expect(canvas).toHaveAttribute('data-app', 'demon');
      await expect(canvas).toHaveAttribute('data-world', 'night-hunt.v2');
      await expect(canvas).toHaveAttribute('data-asset', 'kaykit.floor_tile_small');
      await expect(canvas).toHaveAttribute('data-platform', 'web');
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('尽喰廻遊');
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
      await expect(page.locator('#muraEntry').getByRole('heading', {level: 2})).toHaveText('MURAAAAAAA');
      // Carry forward PR #59: enter the current start screen before using the HUD.
      await expect(page.locator('#muraEntry')).toBeVisible();
      await page.locator('#muraEnterVillage').click();
      await expect(page.locator('#muraEntry')).toBeHidden();
      await page.setViewportSize({width:390,height:844});
      await page.locator('#build').click();
      await expect(page.locator('#catalog')).toBeVisible();
      await page.getByRole('button', {name: '設定', exact: true}).click();
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
    if (!target.legacy) {
      // The Village deliberately hides its old music trigger (PR #59).
      if (target.app === 'village') {
        await page.evaluate(() => window.__SOUL_MUSIC__.open());
      } else if (target.app === 'rinne') {
        await page.locator('#open-settings').click();
        await page.locator('#title-music').click();
      } else if (target.app === 'demon') {
        await page.locator('#title-settings').click();
        await page.locator('#music-library').click();
      } else await page.locator('.soul-music [data-open]').click();
      await expect(page.locator('.soul-music dialog')).toBeVisible();
      const audio = page.locator('.soul-music audio');
      const snapshotAudio = () => audio.evaluate(player => ({ src: player.currentSrc, time: player.currentTime,
        ready: player.readyState, paused: player.paused, error: player.error?.code ?? null }));
      const prior = await snapshotAudio();
      expect(prior.error).toBeNull();
      if (prior.src && prior.time > 0 && prior.ready >= 2) playedSources.add(prior.src);
      await page.locator('.soul-music [data-world]').selectOption('');
      await expect(page.locator('.soul-music [data-track]')).toHaveCount(150);
      await page.locator('.soul-music [data-track="r01"]').click();
      await expect(page.locator('.soul-music [data-state]')).toContainText('再生中：');
      await expect.poll(() => audio.evaluate(player => player.currentTime)).toBeGreaterThan(0);
      const playing = await snapshotAudio();
      expect(playing.error).toBeNull(); expect(playing.ready).toBeGreaterThanOrEqual(2); expect(playing.paused).toBe(false);
      expect(playing.src).toBeTruthy(); playedSources.add(playing.src);
      await page.locator('.soul-music [data-stop]').click();
      expect(await audio.evaluate(player => player.paused)).toBe(true);
      expect(await audio.evaluate(player => player.error)).toBeNull();
      await page.locator('.soul-music form button').click();
    }
    const requestFailures = await Promise.all(rawFailedRequests.map(describeFailedRequest));
    const expectedMediaAborts = requestFailures.filter(record => isVerifiedAudioRangeAbort(record, playedSources, new URL(url).origin));
    const failedRequests = requestFailures.filter(record => !isVerifiedAudioRangeAbort(record, playedSources, new URL(url).origin));
    const record = { url, commit: target.version.commit, inputHash: target.version.inputHash, webgl: gpu,
      errors, failedRequests, expectedMediaAborts, requestFailures, verifiedAudioSources: [...playedSources] };
    await testInfo.attach('request-diagnostics.json', { body: JSON.stringify(record, null, 2), contentType: 'application/json' });
    expect(errors).toEqual([]); expect(failedRequests).toEqual([]);
    await testInfo.attach('verified-browser.json', { body: JSON.stringify(record, null, 2), contentType: 'application/json' });
    console.log('BROWSER VERIFIED', JSON.stringify(record));
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `\n- Browser OK: ${url} — ${target.version.commit} — WebGL2\n`);
  });
}

// Each added interaction scenario gets its own fresh page, storage and time budget.
registerClarityTests({test, expect, targets, base});
