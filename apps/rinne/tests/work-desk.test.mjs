import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash, webcrypto } from 'node:crypto';
import vm from 'node:vm';

const page = readFileSync(new URL('../public/work-desk/index.html', import.meta.url), 'utf8');
const script = page.match(/<script>([\s\S]*?)<\/script>/)[1];
const style = page.match(/<style>([\s\S]*?)<\/style>/)[1];
const policy = page.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)[1];
const context = vm.createContext({
  URL, crypto: webcrypto, localStorage: { getItem: () => null },
  document: { querySelector: () => ({}) }, setTimeout, clearTimeout,
});
vm.runInContext(script.slice(0, script.indexOf("$('#status').innerHTML=")) +
  '\nglobalThis.unit={normalize,safeUrl,stale,fits,esc,taskPrompt,stamp};', context);
const unit = context.unit;

test('inline script and style match restrictive CSP hashes', () => {
  for (const [kind, content] of [['script', script], ['style', style]]) {
    const hash = createHash('sha256').update(content).digest('base64');
    assert.ok(policy.includes(`${kind}-src 'sha256-${hash}'`));
  }
  assert.ok(policy.includes("default-src 'none'"));
  assert.ok(policy.includes('connect-src https://api.github.com;'));
  assert.ok(!policy.includes('unsafe-inline'));
});
test('page states account auto-sync is disconnected', () => {
  assert.ok(page.includes('ChatGPT全体の自動同期は未接続'));
  assert.ok(page.includes('この台帳に登録したタスクだけ'));
  assert.ok(page.includes('ChatGPTへの自動送信はしていません'));
});
test('no third-party executable, credential scraping, or AI API client', () => {
  assert.doesNotMatch(page, /<script[^>]+src=|document\.cookie|api\.openai\.com|Authorization:|Bearer /);
});
test('chat links must be private conversation paths on official HTTPS hosts', () => {
  for (const u of ['javascript:alert(1)', 'https://evil.example/c/test', 'https://chatgpt.com/share/test', 'https://x:password@chatgpt.com/c/test', 'https://chatgpt.com:444/c/test']) assert.equal(unit.safeUrl(u), '');
  assert.equal(unit.safeUrl('https://chat.openai.com/c/test?secret=remove#x'), 'https://chatgpt.com/c/test');
  assert.equal(unit.safeUrl('https://chatgpt.com/g/project/c/test'), 'https://chatgpt.com/g/project/c/test');
});
test('normalization keeps metadata only and does not infer running', () => {
  const task = unit.normalize({id:'one',title:'Test',status:'invented',mapping:{secret:'transcript'},access_token:'secret'});
  assert.equal(task.status,'unknown');
  assert.equal(task.confirmedAt,0);
  assert.ok(!('mapping' in task));
  assert.ok(!('access_token' in task));
  assert.throws(() => unit.normalize({id:'<bad>',title:'x'}));
});
test('old or undated running reports require attention, not claimed active', () => {
  const old = {status:'running',confirmedAt:Date.now()-7200000};
  assert.equal(unit.stale(old),true);
  assert.equal(unit.fits(old,'running'),false);
  assert.equal(unit.fits(old,'attention'),true);
  assert.equal(unit.stale({status:'running',confirmedAt:0}),true);
  assert.equal(unit.fits({status:'running',confirmedAt:Date.now()},'running'),true);
});
test('completion is not inferred from metadata', () => {
  assert.equal(unit.fits({status:'unknown'},'done'),false);
  assert.equal(unit.fits({status:'review'},'done'),false);
});
test('untrusted text escapes markup', () => {
  assert.equal(unit.esc('<img src=x onerror="x">'), '&lt;img src=x onerror=&quot;x&quot;&gt;');
});
test('handoff identifies task and requests an evidence-based status report', () => {
  const text = unit.taskPrompt({id:'task-test',title:'Test',project:'Demo',prompt:'Run tests'});
  assert.ok(text.includes('"id":"task-test"'));
  assert.ok(text.includes('doneは依頼範囲完了時のみ'));
});
test('mobile manifest stays within the current directory', () => {
  const manifest = JSON.parse(readFileSync(new URL('../public/work-desk/manifest.webmanifest', import.meta.url), 'utf8'));
  assert.equal(manifest.start_url,'./');
  assert.equal(manifest.scope,'./');
});
