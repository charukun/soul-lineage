import {capturePlayedAudio,mediaDiagnostics} from './media-diagnostics.mjs';

/** The original music assertions, isolated from world traversal and reload timing. */
export function registerMusicTests({test,expect,targets,base}) {
  for (const target of targets.filter(t=>!t.legacy)) test(`${target.path} validates its music policy and playback`,async({page},testInfo)=>{
    test.setTimeout(60000);
    const errors=[],rawRequests=[],playedSources=new Set();let diagnostics={};
    page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('requestfailed',r=>rawRequests.push(r));
    const url=new URL(`${target.path}/`,base).href;
    const response=await page.goto(url,{waitUntil:'domcontentloaded'});expect(response.status()).toBe(200);
    const canvas=page.locator('#game');await expect(canvas).toHaveAttribute('data-renderer','ready');await expect(canvas).toHaveAttribute('data-commit',target.version.commit);await expect(canvas).toHaveAttribute('data-environment',target.version.environment);
    try {
      if(target.version.environment==='prod') {
        await expect(page.locator('.soul-music')).toHaveCount(0);
        expect(await page.evaluate(()=>typeof window.__SOUL_MUSIC__)).toBe('undefined');
      } else {
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
      await capturePlayedAudio(page,playedSources);diagnostics=await mediaDiagnostics(rawRequests,playedSources,new URL(url).origin);
      expect(errors).toEqual([]);expect(diagnostics.failedRequests).toEqual([]);
    } finally { await testInfo.attach('music-diagnostics.json',{body:JSON.stringify({url,commit:target.version.commit,errors,...diagnostics},null,2),contentType:'application/json'}); }
  });
}
