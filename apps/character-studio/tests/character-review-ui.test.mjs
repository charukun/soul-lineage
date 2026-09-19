import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = p => readFileSync(new URL(p, import.meta.url), 'utf8');
const main = read('../index.html'), advanced = read('../advanced.html');
const engine = read('../src/character-review.js'), shell = read('../src/character-review-main.js');
const css = read('../src/character-review-main.css'), detailCss = read('../src/character-review-advanced.css');
const vite = read('../vite.config.js');
test('main and advanced retain every audited renderer control with unique IDs', () => {
  for (const html of [main, advanced]) {
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
    assert.equal(ids.length, new Set(ids).size);
    for (const [,id] of engine.matchAll(/\bel\('([^']+)'\)/g)) assert.ok(ids.includes(id), id);
    for (const camera of ['overview','front','side','back','face']) assert.ok(html.includes(`data-camera="${camera}"`));
  }
});
test('model review is the visible purpose while detailed editing controls remain available underneath', () => {
  assert.match(main, /キャラクターモデル確認/);
  assert.match(main, /aria-label="キャラクターモデル確認"/);
  assert.equal([...main.matchAll(/role="tab"/g)].length, 5);
  for (const tab of ['parts','colors','motion','qa','compare']) assert.ok(main.includes(`data-tab="${tab}"`));
  assert.match(main, /id="compat-controls" hidden/);
  assert.match(main, /href="\.\/advanced\.html"/);
  assert.match(shell, /ArrowRight/); assert.match(shell, /ArrowLeft/);
  for (const id of ['undo','redo','save-workspace','original-preview']) assert.ok(main.includes(`id="${id}"`));
  for (const id of ['seed','gene-height','session-file']) assert.ok(advanced.includes(`id="${id}"`));
});
test('both pages have bounded viewports and independent control scrolling', () => {
  assert.match(css, /html,body\{[^}]*overflow:hidden/);
  assert.match(css, /\.review-controls\{[^}]*overflow-y:auto/);
  assert.match(css, /grid-template-rows:minmax\(0,57fr\) minmax\(0,43fr\)/);
  assert.match(css, /\.canvas-wrap canvas\{[^}]*height:100%/);
  assert.match(css, /touch-action:none/);
  assert.match(detailCss, /\.advanced-review \.controls\{[^}]*overflow-y:auto/);
  assert.match(detailCss, /grid-template-rows:minmax\(0,60fr\) minmax\(0,40fr\)/);
});
test('renderer and visible shell remain isolated from game saves and authority', () => {
  assert.match(shell, /import '\.\/character-review\.js'/);
  assert.match(shell, /createCharacterWorkspace/);
  for (const code of [engine,shell]) assert.doesNotMatch(code, /localStorage|sessionStorage|indexedDB|WebSocket|RTCPeerConnection|\.innerHTML\s*=/);
  assert.match(main, /本編・セーブ・通信には接続しません/);
});
test('model audit uses pinned CC0 KayKit identity, bounded loads and GPU recovery', () => {
  assert.match(engine, /KAYKIT_MODEL_BY_KEY/);
  assert.match(engine, /defaultModel = KAYKIT_MODEL_BY_KEY\.knight/);
  assert.match(engine, /defaultBytes = \(\) => modelBytes\(defaultModel\.runtime\.url\)/);
  assert.match(engine, /gitBlobSha/);
  assert.match(engine, /defaultModel\.source\.gitBlobSha/);
  assert.match(engine, /defaultModel\.license/);
  assert.doesNotMatch(engine, /SHINO_review\.vrm/);
  assert.ok(engine.indexOf('auditDocument(json, hash, bytes.byteLength, blobSha)') < engine.indexOf("new GLTFLoader().parseAsync(bytes, '')"));
  for (const expression of [/if \(!audit\.approved\) throw/, /length > MAX_MODEL_BYTES/, /file\.size > MAX_SESSION_BYTES/, /webglcontextlost/, /webglcontextrestored/]) assert.match(engine, expression);
});
test('Character Studio is an independent two-entry dev-tool build', { timeout: 240000 }, async () => {
  assert.match(main, /data-dev-tool="character-studio"/);
  assert.match(vite, /appConfig\('character-studio',import\.meta\.url\)/);
  assert.match(vite, /main:fileURLToPath\(new URL\('\.\/index\.html'/);
  assert.match(vite, /advanced:fileURLToPath\(new URL\('\.\/advanced\.html'/);
  assert.doesNotMatch(vite, /characters\.html|apps\/rinne/);
  const { chromium } = await import('@playwright/test');
  const { spawn, execFileSync } = await import('node:child_process');
  const { mkdirSync, readFileSync: readEvidence } = await import('node:fs');
  const { resolve } = await import('node:path');
  const root = resolve(new URL('../../..', import.meta.url).pathname), app = resolve(root, 'apps/character-studio');
  const output = resolve(root, 'test-results/character-studio-portrait'); mkdirSync(output, { recursive: true });
  execFileSync(process.execPath, ['scripts/prepare-kaykit-foundation.mjs', 'character-studio'], { cwd: root, stdio: 'inherit' });
  const viteProc = spawn(process.execPath, [resolve(root, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', '5277', '--strictPort'], { cwd: app, stdio: 'ignore', env: { ...process.env, APP_ENV:'dev' } });
  let browser;
  try {
    for (let i=0;i<80;i++) { try { if ((await fetch('http://127.0.0.1:5277/')).ok) break; } catch {} await new Promise(r=>setTimeout(r,250)); if(i===79) throw new Error('vite timeout'); }
    const chrome=execFileSync('bash',['-lc','command -v google-chrome || command -v google-chrome-stable || command -v chromium'],{encoding:'utf8'}).trim();
    browser=await chromium.launch({executablePath:chrome,headless:true,args:['--use-angle=swiftshader','--enable-webgl','--enable-unsafe-swiftshader','--no-sandbox']});
    const { verifyCharacterStudioPortrait } = await import('./character-studio.browser.mjs');
    const result=await verifyCharacterStudioPortrait(browser,'http://127.0.0.1:5277/',output);
    console.log('PORTRAIT_EVIDENCE_JSON_BEGIN'); console.log(JSON.stringify(result)); console.log('PORTRAIT_EVIDENCE_JSON_END');
    console.log('PORTRAIT_EVIDENCE_PNG_BEGIN'); console.log(readEvidence(resolve(output,'studio-character-ready-mobile.png')).toString('base64')); console.log('PORTRAIT_EVIDENCE_PNG_END');
  } finally { await browser?.close().catch(()=>{}); if(viteProc.exitCode===null) viteProc.kill('SIGTERM'); }
});
