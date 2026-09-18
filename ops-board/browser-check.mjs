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
  applications: ['rinne','village','demon','portal','ops-board','visual-review'].map((id,i) => ({ id, name: ['輪廻転焦','MURAAAAAAA','魔物側','WAYFINDER','開発状況ボード','Visual Review Lab'][i], kind: i < 3 ? 'game' : 'tool', targets: [{ id, label: '開発版', state: i === 3 ? 'unknown' : 'success', commit: 'a'.repeat(40), deployedAt: rawDate, url: base, source: '検証データ' }] })),
  environments: [{ id:'dev', name:'DEV', deployState:'success', deployedCommit:'a'.repeat(40), branchCommit:'a'.repeat(40), deployedAt:rawDate, url:base, branch:'develop', exactCommit:true, reflectedPrCount:1, reflectedPrs:[{number:3,title:'長い公開PR名 ' + 'SharedVillageVisualsAndCharacterWorkshop'.repeat(6),url:'https://github.com/charukun/soul-lineage/pull/3',mergedAt:rawDate}], historyComplete:true }],
  environmentDiff:{ count:1, label:'DEVはProductionより +1 PR', pulls:[] }, integration:{ phase:'delivery', tone:'progress', queue:[{number:999,title:'長い統合タスク ' + 'IntegrationAndCharacterAppearance'.repeat(5),label:'自動テスト中',tone:'progress',url:base,reason:'CI実行中'}], watchdog:{staleReadyCount:0,stalledThresholdMinutes:10} }, recentActionFailures:[], actionHistory:[],
  controlTower: {
    status:'SYNCED', headline:'放置でOK', summary:'GitHub状態とDEV公開を確認済みです', enteredAt:rawDate,
    cause:'current state confirmed', nextAction:'次のGitHubイベントを待ちます', userActionRequired:false,
    completeness:{ state:'confirmed', label:'状態確定' }, confidence:1,
    sourceIdentity:'a'.repeat(40), publishedIdentity:'a'.repeat(40), fingerprint:'fixture-synced',
    lastGitHubChangeAt:rawDate, lastRefreshedAt:rawDate, counts:{draft:1,ready:1,userActions:0},
    flow:[{id:'implementation',label:'実装',state:'active',count:1},{id:'ready',label:'Ready',state:'active',count:1},{id:'integration',label:'Integration',state:'active',count:1},{id:'develop',label:'develop',state:'done',count:0},{id:'dev',label:'DEV公開',state:'done',count:0},{id:'pulse',label:'PULSE',state:'done',count:0}],
    impacts:[], impactLabels:[], incidents:[], timeline:[{at:rawDate,status:'SYNCED',headline:'放置でOK',cause:'current state confirmed'}],
    selfHealth:[{id:'runtime',label:'PULSE runtime',state:'ok',detail:'公開中'},{id:'event',label:'GitHub event',state:'ok',detail:'受信済み'},{id:'snapshot',label:'snapshot',state:'ok',detail:'状態確定'},{id:'ui',label:'UI',state:'ok',detail:'表示可能'}],
  },
  history:{
    snapshots:[{at:rawDate,status:'SYNCED',cause:'current state confirmed',sourceIdentity:'a'.repeat(40),publishedIdentity:'a'.repeat(40),counts:{draft:1,ready:1,userActions:0}}],
    publications:[{commit:'a'.repeat(40),publishedAt:rawDate,observedAt:rawDate,durationMs:120000,reflectedPrCount:1,url:base}],
  },
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
  await page.waitForSelector('#overview-task-card');
  await page.waitForFunction(() => document.querySelector('#overview-task-value')?.textContent !== '確認中');
  await page.waitForFunction(() => document.querySelector('#control-headline')?.textContent !== '状態を確認中');
  assert.match(await page.locator('#control-headline').innerText(), /放置でOK|自動対応中|確認が必要/);
  assert.equal(await page.locator('#overview-alert-value').innerText(), '操作不要');
  const firstGlance = await page.evaluate(() => ({
    viewport: innerHeight,
    bottoms: ['overview-alert-card','overview-task-card','overview-app-card'].map(id => document.getElementById(id)?.getBoundingClientRect().bottom || 99999),
  }));
  assert.ok(firstGlance.bottoms.every(bottom => bottom <= firstGlance.viewport + 1), JSON.stringify(firstGlance));
  assert.equal((await page.locator('body').innerText()).trimStart().startsWith('\\n'), false);
  check('first viewport exposes action, development and DEV without stray source text');
  assert.equal(await page.locator('#tasks-section').getAttribute('open'), null);
  assert.equal(await page.locator('#apps-section').getAttribute('open'), null);
  assert.equal(await page.locator('#history-section').getAttribute('open'), null);
  assert.equal(await page.locator('#details-section').getAttribute('open'), null);
  await page.locator('.control-details > summary').click();
  assert.equal(await page.locator('#control-flow .control-flow-step').count(), 4);
  await page.locator('.control-details > summary').click();
  check('summary-first sections are collapsed and operator flow is four stages');
  if (!fixtureMode) {
    const versionResponse = await context.request.get(new URL('version.json', base).href);
    assert.equal(versionResponse.status(), 200);
    const version = await versionResponse.json();
    if ((process.env.OPS_SOURCE_SHA || process.env.GITHUB_SHA)) assert.equal(version.commit, (process.env.OPS_SOURCE_SHA || process.env.GITHUB_SHA));
    report.version = version;
    assert.equal(latestState?.schemaVersion, 2);
    assert.equal(latestState?.syncStatus, 'ok');
    assert.ok(latestState?.controlTower?.status);
    check('live snapshot and exact deployed SHA', version.commit);
  }
  await page.locator('#overview-task-card').click();
  await page.waitForSelector('.pull-filter');
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
  assert.notEqual(await page.locator('#tasks-section').getAttribute('open'), null);
  assert.notEqual(await page.locator('#details-section').getAttribute('open'), null);
  assert.notEqual(await page.locator('#pulls .completed-pulls').getAttribute('open'), null);
  assert.notEqual(await page.locator('#environments details').first().getAttribute('open'), null);
  check('manual refresh preserves outer and inner disclosures');
  await page.locator('.pull-filter[data-state="Draft"]').click(); await reload();
  assert.equal(await page.locator('.pull-filter.active').getAttribute('data-state'), 'Draft');
  check('manual refresh preserves selected state');

  await page.locator('.section-tabs a[href="#apps-section"]').click();
  await page.waitForSelector('.app-summary-card');
  await page.locator('.app-more').first().click();
  assert.equal(await page.locator('#app-dialog').isVisible(), true);
  assert.match(await page.locator('#app-dialog').innerText(), /現在見えている版（SHA）/);
  const visibleCommit = await page.evaluate(() => {
    const label = [...document.querySelectorAll('#app-dialog dt')].find(node => node.textContent?.trim() === '現在見えている版（SHA）');
    return label?.nextElementSibling?.textContent?.trim() || '';
  });
  if (fixtureMode) assert.equal(visibleCommit, 'a'.repeat(40));
  else assert.match(visibleCommit, /^[0-9a-f]{40}$/);
  await page.evaluate(() => import('./view-state.js').then(module => module.loadBoard()));
  assert.equal(await page.locator('#app-dialog').isVisible(), true);
  await page.locator('#app-dialog .app-dialog-close').click();
  check('app exact metadata dialog remains open through snapshot updates');
  for (const width of [320,390,519,520,673]) {
    const expectedColumns = width < 520 ? 2 : 3;
    await page.setViewportSize({ width, height:844 });
    await page.locator('.section-tabs a[href="#apps-section"]').click();
    await page.waitForTimeout(400);
    const metrics = await page.evaluate(() => ({ width:innerWidth, clientWidth:document.documentElement.clientWidth, scrollWidth:document.documentElement.scrollWidth,
      overflow:[...document.querySelectorAll('body *')].filter(node => {const r=node.getBoundingClientRect();return r.width>0 && r.right>document.documentElement.clientWidth+1;}).slice(0,12).map(node=>({tag:node.tagName,className:node.className,text:node.textContent.slice(0,100),right:node.getBoundingClientRect().right})),
      grids:[...document.querySelectorAll('.app-grid')].map(node => getComputedStyle(node).gridTemplateColumns.split(' ').length),
      fonts:[...document.querySelectorAll('#applications strong,#applications span,#applications h3,#applications button')].filter(node => node.textContent.trim()).map(node => parseFloat(getComputedStyle(node).fontSize)) }));
    await writeFile(`${out}/layout-${width}.json`, JSON.stringify(metrics, null, 2));
    assert.ok(metrics.scrollWidth <= width + 1, JSON.stringify(metrics));
    assert.ok(metrics.grids.every(n => n === expectedColumns), JSON.stringify(metrics));
    assert.ok(Math.min(...metrics.fonts) >= 11, JSON.stringify(metrics));
    await page.screenshot({ path:`${out}/apps-${width}.png` });
    check(`${expectedColumns}-column readable layout at ${width}px`, metrics);
  }
  await page.setViewportSize({ width:390, height:844 });
  const beforeScroll = await page.evaluate(() => scrollY);
  await page.evaluate(() => import('./view-state.js').then(module => module.loadBoard()));
  const afterScroll = await page.evaluate(() => scrollY);
  assert.ok(Math.abs(afterScroll - beforeScroll) <= 3, `scroll jumped ${beforeScroll} -> ${afterScroll}`);
  check('background-style update preserves reading position');

  await page.locator('#history-section > summary').click();
  assert.ok(await page.locator('#publication-history .publication-history-row').count() >= 1);
  assert.match(await page.locator('#publication-history').innerText(), /公開処理/);
  check('publication history exposes publication time and duration');

  report.state = latestState;
  const recovering = structuredClone(fixtureMode ? fixture : latestState);
  recovering.generatedAt = new Date(Date.now()-7*60000).toISOString();
  recovering.syncStatus='degraded';
  recovering.syncError='browser test: HTTP 429';
  recovering.alerts=[];
  recovering.applications=[{id:'unknown',name:'未確認のアプリ',kind:'tool',targets:[{id:'unknown',label:'公開先',state:'unknown'}]}];
  recovering.controlTower = {
    ...(recovering.controlTower || {}),
    status:'RECOVERING', headline:'自動復旧中', summary:'最新状態を再取得しています。今は操作不要です。',
    userActionRequired:false, incidents:[], enteredAt:new Date(Date.now()-2*60000).toISOString(),
    completeness:{state:'last-known-good',label:'前回確定値'},
  };
  await page.unroute('**/api/state');
  await page.route('**/api/state', route => route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(recovering)}));
  await reload();
  assert.match(await page.locator('#control-headline').innerText(), /自動復旧中/);
  assert.match(await page.locator('#sync-freshness').innerText(), /再同期中/);
  assert.doesNotMatch(await page.locator('#app-summary').innerText(), /正常/);
  check('recoverable sync degradation stays visible without becoming a human action');

  const humanAction = structuredClone(recovering);
  humanAction.integration.queue=[{ number:85, title:'CI failure test', stage:'CI_FAILED', tone:'danger', label:'CI失敗', reason:'failure' }];
  humanAction.controlTower = {
    ...humanAction.controlTower,
    status:'NEEDS_USER', headline:'確認が必要', summary:'#85 の自動テスト結果を確認してください',
    userActionRequired:true, counts:{...(humanAction.controlTower?.counts || {}),userActions:1},
    incidents:[{type:'ci-failed',prNumber:85,tone:'danger',title:'#85 の自動テストが失敗',detail:'failure',userActionRequired:true}],
  };
  await page.unroute('**/api/state');
  await page.route('**/api/state', route => route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(humanAction)}));
  await reload();
  assert.match(await page.locator('#alerts').innerText(), /#85/);
  assert.match(await page.locator('#sync-freshness').innerText(), /確認が必要/);
  assert.match(await page.locator('#overview-alert-value').innerText(), /[1-9]/);
  await page.evaluate(() => scrollTo(0,0)); await page.screenshot({path:`${out}/simulated-alerts.png`});
  check('true human action is red while automatic recovery is not');

  const cards = await page.locator('.app-summary-card').count();
  await page.unroute('**/api/state');
  await page.route('**/api/state', route => route.fulfill({status:503,contentType:'application/json',body:'{"error":"test outage"}'}));
  await reload();
  assert.equal(await page.locator('.app-summary-card').count(), cards);
  assert.match(await page.locator('#sync-freshness').innerText(), /再同期中/);
  check('temporary outage keeps previous data with visible warning');

  const restarted = await context.newPage();
  await restarted.route('**/api/state', route => route.fulfill({status:503,contentType:'application/json',body:'{"error":"restart outage"}'}));
  await restarted.goto(base, { waitUntil:'domcontentloaded', timeout:45000 });
  await restarted.waitForFunction(() => document.querySelector('#overview-alert-value')?.textContent !== '確認中');
  assert.notEqual(await restarted.locator('#overview-alert-value').innerText(), '確認中');
  assert.match(await restarted.locator('#sync-freshness').innerText(), /再同期中/);
  await restarted.close();
  check('browser restart restores last-known-good snapshot during API outage');
  await page.unroute('**/api/state');
  if (fixtureMode) await page.route('**/api/state', route => route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(fixture)}));
  await reload();
  assert.doesNotMatch(await page.locator('#sync-freshness').innerText(), /再同期中|確認が必要/);
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
