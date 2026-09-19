import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
  BROWSER_PLAYTEST_APPS,
  parseBrowserPlaytest,
  parseBrowserPlaytestValue,
  resolveBrowserPlaytestTargets,
} from '../scripts/browser/playtest-routing.mjs';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('Browser-Playtest all expands to every game', () => {
  const request = parseBrowserPlaytest('Title\nBrowser-Playtest: all\nDepends-On: none');
  assert.equal(request.declared, true);
  assert.equal(request.mode, 'all');
  assert.deepEqual(request.apps, BROWSER_PLAYTEST_APPS);
});

test('Browser-Playtest app list is normalized into canonical order', () => {
  const request = parseBrowserPlaytestValue('demon, rinne');
  assert.equal(request.mode, 'apps');
  assert.deepEqual(request.apps, ['rinne', 'demon']);
});

test('affected mode preserves normal diff-driven targeting', () => {
  const request = parseBrowserPlaytestValue('affected');
  assert.deepEqual(resolveBrowserPlaytestTargets(['village'], request), ['village']);
});

test('explicit playtest apps are added even when the diff targets another app', () => {
  const request = parseBrowserPlaytestValue('rinne,demon');
  assert.deepEqual(resolveBrowserPlaytestTargets(['village'], request), ['rinne', 'village', 'demon']);
});

test('invalid or ambiguous Browser-Playtest declarations fail closed', () => {
  assert.throws(() => parseBrowserPlaytestValue('rinne,unknown'), /unknown apps/);
  assert.throws(() => parseBrowserPlaytestValue('rinne,rinne'), /duplicate app tokens/);
  assert.throws(() => parseBrowserPlaytestValue(''), /must not be empty/);
  assert.throws(
    () => parseBrowserPlaytest('Browser-Playtest: rinne\nBrowser-Playtest: demon'),
    /exactly one Browser-Playtest line/,
  );
});

test('PR smoke reads explicit intent and writes a machine-readable receipt', async () => {
  const source = await read('scripts/browser/pr-smoke.mjs');
  assert.match(source, /GITHUB_EVENT_PATH/);
  assert.match(source, /parseBrowserPlaytest\(eventPullRequestBody\(\)\)/);
  assert.match(source, /playtest-receipt\.json/);
  assert.match(source, /resolveBrowserPlaytestTargets\(affectedApps, request\)/);
});

test('Rinne closes the probe context before the independent full playthrough', async () => {
  const source = await read('scripts/browser/pr-smoke.mjs');
  const rinneBranch = source.match(/if \(app === 'rinne'\) \{[\s\S]*?\} else if \(app === 'demon'\)/)?.[0] || '';
  assert.match(rinneBranch, /await finishProbe\(\);/);
  assert.match(rinneBranch, /verifyRebuildPlaythrough/);
  assert.ok(
    rinneBranch.indexOf('await finishProbe();') < rinneBranch.indexOf('verifyRebuildPlaythrough'),
    'Rinne probe must close before the full playthrough begins',
  );
  assert.match(source, /if \(app !== 'rinne'\) await finishProbe\(\);/);
});

test('no-code develop playtest reuses the existing full verification route', {timeout:240000}, async () => {
  const [deploy, verify, targets] = await Promise.all([
    read('.github/workflows/deploy.yml'),
    read('scripts/verify-browser.mjs'),
    read('scripts/browser/target-contract.mjs'),
  ]);
  assert.match(deploy, /full_verification:/);
  assert.match(deploy, /INTEGRATION_FULL: 'true'/);
  assert.match(deploy, /node scripts\/verify-browser\.mjs/);
  assert.match(verify, /full:process\.env\.INTEGRATION_FULL === 'true'/);
  assert.match(targets, /const selected=available\.filter\(e=>full\|\|changed\.includes\(e\.path\)\)/);

  const {chromium}=await import('@playwright/test');
  const {spawn,execFileSync}=await import('node:child_process');
  const {resolve}=await import('node:path');
  const root=resolve(new URL('..',import.meta.url).pathname);
  execFileSync(process.execPath,['scripts/prepare-kaykit-foundation.mjs','character-studio'],{cwd:root,stdio:'inherit'});
  const vite=resolve(root,'node_modules/vite/bin/vite.js');
  const start=(cwd,port)=>spawn(process.execPath,[vite,'--host','127.0.0.1','--port',String(port),'--strictPort'],{cwd,stdio:'ignore',env:{...process.env,APP_ENV:'dev'}});
  const character=start(resolve(root,'apps/character-studio'),5277),rinne=start(resolve(root,'apps/rinne'),5278);
  const wait=async url=>{for(let i=0;i<100;i++){try{if((await fetch(url)).ok)return}catch{}await new Promise(r=>setTimeout(r,250))}throw Error('preview timeout '+url)};
  let browser;
  try{
    await Promise.all([wait('http://127.0.0.1:5277/'),wait('http://127.0.0.1:5278/review-motion')]);
    const chrome=execFileSync('bash',['-lc','command -v google-chrome || command -v google-chrome-stable || command -v chromium'],{encoding:'utf8'}).trim();
    browser=await chromium.launch({executablePath:chrome,headless:true,args:['--use-angle=swiftshader','--enable-webgl','--enable-unsafe-swiftshader','--no-sandbox']});
    const check=async({url,ready,selector})=>{
      const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage();
      await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});await page.waitForFunction(ready,null,{timeout:120000});
      const rows=[];
      for(const [width,height] of [[390,844],[844,390],[390,844]]){
        await page.setViewportSize({width,height});await page.waitForTimeout(220);
        const row=await page.evaluate(sel=>{const canvas=document.querySelector(sel),box=canvas.getBoundingClientRect(),gl=canvas.getContext('webgl2')||canvas.getContext('webgl'),back=document.querySelector('.review-surface__back[data-review-back]');return{viewport:[innerWidth,innerHeight],rect:[box.x,box.y,box.width,box.height],buffer:gl?[gl.drawingBufferWidth,gl.drawingBufferHeight]:null,back:back?.textContent||''}},selector);
        assert.ok(row.rect[2]>1&&row.rect[3]>1,JSON.stringify(row));assert.ok(row.buffer?.[0]>1&&row.buffer?.[1]>1,JSON.stringify(row));assert.equal(row.back,'‹ 戻る');rows.push(row);
      }
      await context.close();return rows;
    };
    const characterRows=await check({url:'http://127.0.0.1:5277/',ready:()=>window.characterStudio?.review?.ready===true&&document.body.classList.contains('character-grid-ready'),selector:'#stage'});
    const motionRows=await check({url:'http://127.0.0.1:5278/review-motion',ready:()=>Number(document.querySelector('#motion-load')?.value)===1,selector:'#motion-stage'});
    console.log('REVIEW_RESIZE_EVIDENCE',JSON.stringify({character:characterRows,motion:motionRows}));
  }finally{
    await browser?.close().catch(()=>{});
    for(const p of [character,rinne])if(p.exitCode===null)p.kill('SIGTERM');
  }
});
