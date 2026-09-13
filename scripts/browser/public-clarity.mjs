import {verifySoloClarity, verifyHuntClarity} from './play-clarity.mjs';
import {capturePlayedAudio,mediaDiagnostics} from './media-diagnostics.mjs';

/** Independent contexts prevent UI review steps from changing a gameplay fixture. */
export function clarityScenarios(targets) {
  return targets.filter(t => !t.legacy && t.version.environment !== 'prod' && ['rinne', 'demon', 'village'].includes(t.app))
    .flatMap(t => t.app === 'village' ? [{...t, scenario:'build'}, {...t, scenario:'director'}] : [t]);
}
export function registerClarityTests({test, expect, targets, base}) {
  for (const target of clarityScenarios(targets)) {
    test(`${target.path} preserves ${target.scenario === 'director' ? 'resident observation' : 'native play clarity'} on the deployed commit`, async ({page}, testInfo) => {
      // Same per-app deadlines as the original smoke, with no retries or relaxed assertions.
      test.setTimeout(target.app === 'rinne' ? 180000 : 60000);
      const errors = [], rawRequests = [], playedSources = new Set();
      let media = {};
      page.on('pageerror', e => errors.push(e.message));
      page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
      page.on('requestfailed', r => rawRequests.push(r));
      const url = new URL(`${target.path}/`, base).href;
      await page.setViewportSize({width:390, height:844});
      const response = await page.goto(url, {waitUntil:'domcontentloaded'});
      expect(response.status()).toBe(200);
      const canvas = page.locator('#game');
      await expect(canvas).toHaveAttribute('data-renderer', 'ready');
      await expect(canvas).toHaveAttribute('data-commit', target.version.commit);
      await expect(canvas).toHaveAttribute('data-environment', target.version.environment);
      try {
        if (target.app === 'rinne') {
          await page.locator('#start-simulator').click();
          await expect.poll(() => page.evaluate(() => window.__RINNE_TITLE__?.snapshot().state), {timeout:100000}).toBe('playing');
          const frame = page.frames().find(f => f.url().includes('/simulator/index.html'));
          expect(frame).toBeTruthy();
          await verifySoloClarity(page, frame, expect, testInfo);
        } else if (target.app === 'village') {
          const {verifyVillageFirstBuild, enterVillageForBrowser} = await import('../../apps/village/tests/first-build.browser.mjs');
          // Intermediate screenshots took 17s in the #145 trace. Keep every
          // interaction/persistence assertion and the same 60s budget, with the
          // final screenshot and automatic failure screenshot/trace retained.
          if (target.scenario === 'director') {
            // New resident-camera coverage has its own context and unchanged
            // per-scenario deadline, independent of construction/save/reload.
            await enterVillageForBrowser(page, expect);
            const {verifyVillageDirectorPolish} = await import('../../apps/village/tests/director-polish.browser.mjs');
            await verifyVillageDirectorPolish(page, expect, testInfo);
          } else {
            await verifyVillageFirstBuild(page, expect, testInfo, () => capturePlayedAudio(page, playedSources), { captureMilestones: false, verifyDirector: false });
          }
        } else {
          await page.locator('#begin').click();
          await page.locator('[data-village]').first().click();
          await expect(page.locator('#hud')).toBeVisible();
          await verifyHuntClarity(page, expect, testInfo);
        }
        await capturePlayedAudio(page, playedSources);
        media = await mediaDiagnostics(rawRequests, playedSources, new URL(url).origin);
        expect(errors).toEqual([]);
        expect(media.failedRequests).toEqual([]);
      } finally {
        await testInfo.attach('clarity-diagnostics.json', {body:JSON.stringify({url, commit:target.version.commit, errors, ...media}, null, 2), contentType:'application/json'});
      }
    });
  }
}
