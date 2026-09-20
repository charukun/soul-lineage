import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
const root=new URL('../../../',import.meta.url);
const read=path=>readFileSync(new URL(path,root),'utf8');
const blobHash=text=>createHash('sha1').update('blob '+Buffer.byteLength(text)+'\0').update(text).digest('hex');
const baseline=JSON.parse(read('docs/rinne/JOHAKYU_BATTLE_BASELINE.json'));

// P0 is deliberately name-only. Future behavior migrations must retain the immutable
// baseline and replace the relevant active-source equality with causal tests AND
// exact-build visual evidence, not refresh hashes to conceal rendering changes.
test('P0 preserves the native combat, animation, camera, environment, audio and asset source bytes',()=>{
  assert.equal(baseline.sourceCommit,'58bf65db139a64f456f3923fe4988d741285418c');
  assert.equal(baseline.implementationStage,'P0-name-and-preservation-only');
  assert.equal(Object.keys(baseline.activeBlobs).length,11);
  for(const [path,sha] of Object.entries(baseline.activeBlobs))assert.equal(blobHash(read(path)),sha,path);
});

test('the new name changes only page labels and its shared review catalog entry',()=>{
  const html=read('apps/review/battle2.html'),shared=read('packages/shared-ui/src/review-shell.js');
  assert.match(html,/<title>Visual Review｜序破急バトルシステム<\/title>/);
  assert.match(html,/<h1>序破急バトルシステム<\/h1>/);
  assert.match(html,/aria-label="序破急バトルシステムレビュー"/);
  assert.match(html,/data-review-surface="battle2"/);
  assert.match(shared,/id:'battle2',label:'序破急バトルシステム',detail:'百年転生へ段階統合する新戦闘基盤'/);
  assert.equal(blobHash(html.replaceAll(baseline.name,baseline.previousName)),baseline.renameOnlyBlobs['apps/review/battle2.html']);
  const normalized=shared.replaceAll(baseline.name,baseline.previousName).replace('百年転生へ段階統合する新戦闘基盤','ノクターン自動戦闘・演出基盤');
  assert.equal(blobHash(normalized),baseline.renameOnlyBlobs['packages/shared-ui/src/review-shell.js']);
});

test('the frozen backup receipt and runtime remain independent and immutable',()=>{
  const receipt=read(baseline.backupSnapshot.path);
  assert.equal(blobHash(receipt),baseline.backupSnapshot.blob);
  const snapshot=JSON.parse(receipt);
  assert.equal(snapshot.sourceRuntimeTree,baseline.runtimeTree);
  for(const [file,sha] of Object.entries(snapshot.runtimeBlobs))assert.equal(blobHash(read('apps/review/src/nocturne-bk/'+file)),sha,file);
});

test('the migration plan keeps three distinct canonical surfaces and real source references',()=>{
  assert.deepEqual(baseline.routes,{
    newSystem:{app:'review',id:'battle2',path:'/battle2'},
    legacyReference:{app:'rinne',id:'battle',path:'/review-battle'},
    frozenBackup:{app:'review',id:'battlebk',path:'/battlebk'}
  });
  for(const path of baseline.reviewedSources)assert.ok(existsSync(new URL(path,root)),path);
  assert.ok(existsSync(new URL('docs/rinne/JOHAKYU_BATTLE_PLAN.md',root)));
});
