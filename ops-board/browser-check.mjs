import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const base = process.env.OPS_URL || 'https://rinne-ops.c-okamoto.workers.dev/';
const fixtureMode = process.env.OPS_FIXTURE === '1';
const out = process.env.OPS_REPORT_DIR || '.ops-review';
await mkdir(out, { recursive: true });
const report = { url: base, fixtureMode, startedAt: new Date().toISOString(), checks: [], errors: [], githubRequests: [] };
const rawDate = new Date().toISOString();
const fixture = {
  repository: 'charukun/soul-lineage', generatedAt: rawDate, syncStatus: 'ok', alerts: [],
  pullRequests: { normal: ['Draft', 'Ready', 'Merged', 'Closed'].map((state, i) => ({ number: i + 1, title: `検証用タスク ${i + 1}`, detail: '変更概要と対象アプリの確認', state, updatedAt: rawDate, url: `https://github.com/charukun/soul-lineage/pull/${i+1}`, targets: [{ id: 'rinne', label: '輪廻転焦' }], targetsStatus: 'ready', targetsComplete: true })), visualReview: [] },
  applications: ['rinne','village','demon','portal','ops-board','visual-review'].map((id,i) => ({ id, name: ['輪廻転焦','MURAAAAAAA','魔物側','WAYFINDER','開発状況ボード','Visual Review Lab'][i], kind: i < 3 ? 'game' : 'tool', targets: (i < 3 ? ['開発', '検証', '本番'] : ['公開先']).map((label, n) => ({ id: `${id}-${n}`, label, state: i === 3 ? 'unknown' : 'success', commit: 'a'.repeat(40), deployedAt: rawDate, url: base, source: '検証データ' })) })),
  environments: [{ id:'dev', name:'DEV', deployState:'success', deployedCommit:'a'.repeat(40), deployedAt:rawDate, url:base, branch:'develop', reflectedPrCount:1, reflectedPrs:[{number:3,title:'長い公開PR名 ' + 'SharedVillageVisualsAndCharacterWorkshop'.repeat(6),url:'https://github.com/charukun/soul-lineage/pull/3',mergedAt:rawDate}], historyComplete:true }],
  environmentDiff:{ count:1, label:'DEVはProductionより +1 PR', pulls:[] }, integration:{ phase:'delivery', tone:'progress', queue:[{number:999,title:'長い統合タスク ' + 'IntegrationAndCharacterAppearance'.repeat(5),label:'自動テスト中',tone:'progress',url:base,reason:'CI実行中'}], watchdog:{staleReadyCount:0,stalledThresholdMinutes:10} }, recentActionFailures:[], actionHistory:[],
};
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width:390, height:844 }, isMobile:true, hasTouch:true, deviceScaleFactor:1, locale:'ja-JP', timezoneId:'Asia/Tokyo' });
const page = await context.newPage();
page.setDefaultTimeout(12000);
page.on('pageerror', e => report.errors.push(e.message));
page.on('request', r => { if (new URL(r.url()).hostname === 'api.github.com') report.githubRequests.push(r.url()); });
let latestState = null;
page.on('response', async r => { if (new URL(r.url()).pathname === '/api/state' && r.status() === 200) { try { latestState = await r.json(); } catch {} } });
if (fixtureMode) await page.route('**/api/state', route => route.fulfill({ status:200, contentType:'application/json', body:JSON.stringify(fixture) }));
const check = (name, value = true) => { report.checks.push({ name, value }); console.log('PASS ' + name); };
const reload = async () => {
  await Promise.all([page.waitForResponse(r => new URL(r.url()).pathname === '/api/state'), page.locator('#reload').click()]);
  await page.waitForFunction(() => !document.querySelector('#reload').disabled);
};
try {
  await page.goto(base, { waitUntil:'domcontentloaded', timeout:45000 });
  await page.waitForSelector('.app-summary-card');
  await page.waitForSelector('.pull-filter');
  if (!fixtureMode) {
    const versionResponse = await context.request.get(new URL('version.json', base).href);
    assert.equal(versionResponse.status(), 200);
    const version = await versionResponse.json();
    if ((process.env.OPS_SOURCE_SHA || process.env.GITHUB_SHA)) assert.equal(version.commit, (process.env.OPS_SOURCE_SHA || process.env.GITHUB_SHA));
    report.version = version;
    assert.equal(latestState?.schemaVersion, 2);
    assert.equal(latestState?.syncStatus, 'ok');
    check('live snapshot and exact deployed SHA', version.commit);
  }
  assert.equal(await page.locator('#rescue-section').getAttribute('open'), null);
  assert.equal(await page.locator('#details-section').getAttribute('open'), null);
  assert.equal(await page.locator('.section-tabs a').count(), 3);
  const order = await page.locator('.priority-section').evaluateAll(nodes => nodes.map(node => node.id));
  assert.deepEqual(order, ['alert-section', 'apps-section', 'tasks-section']);
  check('three primary sections precede collapsed diagnostics');
  if (fixtureMode) assert.match(await page.locator('#alerts').innerText(), /確認した範囲に問題はありません/);
  await page.locator('.app-tools > summary').click();
  assert.ok(await page.locator('.app-tools .app-summary-card').count() > 0);
  await reload();
  assert.notEqual(await page.locator('.app-tools').getAttribute('open'), null);
  await page.locator('.app-tools > summary').click();
  check('tool disclosure remains available and survives refresh');
  const requestsBeforeFilters = report.githubRequests.length;
  for (const state of ['Draft','Ready','Merged','Closed','all']) {
    await page.locator(`.pull-filter[data-state="${state}"]`).click();
    assert.equal(await page.locator(`.pull-filter[data-state="${state}"]`).getAttribute('aria-pressed'), 'true');
  }
  assert.equal(report.githubRequests.length, requestsBeforeFilters);
  check('all state filters without GitHub requests');
  await page.locator('#pulls .completed-pulls > summary').click();
  await page.locator('#details-section > summary').click();
  await page.locator('#environments details > summary').first().click();
  await reload();
  assert.notEqual(await page.locator('#pulls .completed-pulls').getAttribute('open'), null);
  assert.notEqual(await page.locator('#environments details').first().getAttribute('open'), null);
  check('manual refresh preserves completed/publication disclosures');
  await page.locator('.pull-filter[data-state="Draft"]').click(); await reload();
  assert.equal(await page.locator('.pull-filter.active').getAttribute('data-state'), 'Draft');
  check('manual refresh preserves selected state');
  await page.locator('.app-more').first().click();
  assert.equal(await page.locator('#app-dialog').isVisible(), true);
  assert.match(await page.locator('#app-dialog').innerText(), /公開済みの版/);
  await page.evaluate(() => import('./view-state.js').then(module => module.loadBoard()));
  assert.equal(await page.locator('#app-dialog').isVisible(), true);
  await page.locator('.app-dialog-close').click();
  check('app exact metadata dialog remains open through snapshot updates');
  for (const width of [320,390,673,1100]) {
    await page.setViewportSize({ width, height:844 });
    await page.locator('.section-tabs a[href="#apps-section"]').click();
    await page.waitForTimeout(400);
    const metrics = await page.evaluate(() => ({ width:innerWidth, clientWidth:document.documentElement.clientWidth, scrollWidth:document.documentElement.scrollWidth,
      overflow:[...document.querySelectorAll('body *')].filter(node => {const r=node.getBoundingClientRect();return r.width>0 && r.right>document.documentElement.clientWidth+1;}).slice(0,12).map(node=>({tag:node.tagName,className:node.className,text:node.textContent.slice(0,100),right:node.getBoundingClientRect().right})),
      grids:[...document.querySelectorAll('.app-grid')].filter(node => node.getBoundingClientRect().width > 0).map(node => getComputedStyle(node).gridTemplateColumns.split(' ').length),
      targets:[...document.querySelectorAll('.app-summary-targets')].filter(node => node.getBoundingClientRect().width > 0).map(node => getComputedStyle(node).gridTemplateColumns.split(' ').length),
      fonts:[...document.querySelectorAll('#applications strong,#applications span,#applications h3,#applications button')].filter(node => node.textContent.trim()).map(node => parseFloat(getComputedStyle(node).fontSize)) }));
    await writeFile(`${out}/layout-${width}.json`, JSON.stringify(metrics, null, 2));
    assert.ok(metrics.scrollWidth <= width + 1, JSON.stringify(metrics));
    assert.ok(metrics.grids.every(n => n === (width >= 900 ? 3 : 1)), JSON.stringify(metrics));
    assert.ok(metrics.targets.every(n => n === 3), JSON.stringify(metrics));
    assert.ok(Math.min(...metrics.fonts) >= 11, JSON.stringify(metrics));
    await page.screenshot({ path:`${out}/apps-${width}.png` });
    check(`responsive readable layout at ${width}px`, metrics);
  }
  await page.setViewportSize({ width:390, height:844 });
  const beforeScroll = await page.evaluate(() => scrollY);
  await page.evaluate(() => import('./view-state.js').then(module => module.loadBoard()));
  const afterScroll = await page.evaluate(() => scrollY);
  assert.ok(Math.abs(afterScroll - beforeScroll) <= 3, `scroll jumped ${beforeScroll} -> ${afterScroll}`);
  check('background-style update preserves reading position');
  report.state = latestState;
  const stale = structuredClone(fixtureMode ? fixture : latestState);
  stale.generatedAt = new Date(Date.now()-7*60000).toISOString(); stale.syncStatus='degraded'; stale.syncError='browser test: HTTP 429'; stale.alerts=[];
  stale.integrationRescue={available:true, generatedAt:rawDate, counts:{active:0,queued:0,blocked:0,manual:1,stale:0}, workers:[], queue:[], manual:[{pr:85,state:'FAILED_MANUAL',title:'要確認',files:[],scopes:[]}], recent:[],waves:[],activity:[],throughput:{},coordinator:{},status:'ATTENTION'};
  stale.integration.queue=[{ number:85, title:'CI failure test', stage:'CI_FAILED', tone:'danger', label:'CI失敗', reason:'failure' }];
  stale.applications=[{id:'unknown',name:'未確認のアプリ',kind:'tool',targets:[{id:'unknown',label:'公開先',state:'unknown'}]}];
  await page.unroute('**/api/state');
  await page.route('**/api/state', route => route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(stale)}));
  await reload();
  assert.match(await page.locator('#alerts').innerText(), /最新情報を取得できていません/);
  assert.match(await page.locator('#alerts').innerText(), /#85/);
  assert.match(await page.locator('#sync-freshness').innerText(), /更新失敗/);
  await page.locator('#alerts a[href="#rescue-section"]').click();
  assert.notEqual(await page.locator('#rescue-section').getAttribute('open'), null);
  check('problem link opens the relevant Rescue detail');
  assert.doesNotMatch(await page.locator('#app-summary').innerText(), /正常/);
  await page.evaluate(() => scrollTo(0,0)); await page.screenshot({path:`${out}/simulated-alerts.png`});
  check('simulated stale sync and CI failure are visible; unknown app is not healthy');
  const cards = await page.locator('.app-summary-card').count();
  await page.unroute('**/api/state');
  await page.route('**/api/state', route => route.fulfill({status:503,contentType:'application/json',body:'{"error":"test outage"}'}));
  await reload(); assert.equal(await page.locator('.app-summary-card').count(), cards);
  assert.match(await page.locator('#alerts').innerText(), /HTTP 503/);
  check('temporary outage keeps previous data with visible warning');
  await page.unroute('**/api/state');
  if (fixtureMode) await page.route('**/api/state', route => route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(fixture)}));
  await reload(); assert.doesNotMatch(await page.locator('#sync-freshness').innerText(), /更新失敗/);
  check('recovery clears transient failure');
  assert.equal(report.errors.length,0,JSON.stringify(report.errors));
  assert.equal(report.githubRequests.length,0,JSON.stringify(report.githubRequests));
  report.result='success';
} catch (error) {
  report.result='failure'; report.failure=String(error.stack || error); process.exitCode=1;
  await page.screenshot({path:`${out}/failure.png`,fullPage:true}).catch(()=>{});
  console.error(report.failure);
} finally {
  report.finishedAt=new Date().toISOString();
  await writeFile(`${out}/report.json`,JSON.stringify(report,null,2));
  await browser.close();
}
