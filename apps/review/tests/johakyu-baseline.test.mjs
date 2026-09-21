import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
const root=new URL('../../../',import.meta.url);
const read=path=>readFileSync(new URL(path,root),'utf8');
const blobHash=text=>createHash('sha1').update('blob '+Buffer.byteLength(text)+'\0').update(text).digest('hex');
const baseline=JSON.parse(read('docs/rinne/JOHAKYU_BATTLE_BASELINE.json'));

// P0 stays immutable. P2 source changes are guarded by causal off-mode tests,
// strict original renderer/asset equality, pinned browser evidence, and a narrow
// dependency-only lock normalization. The backup remains an independent oracle.
function block(source,start,end){
  assert.equal(source.split(start).length,2,start);assert.equal(source.split(end).length,2,end);
  return source.slice(source.indexOf(start),source.indexOf(end));
}
test('P2 preserves the original actor artwork, clips, camera, effects and render loop',()=>{
  assert.equal(baseline.sourceCommit,'58bf65db139a64f456f3923fe4988d741285418c');
  assert.equal(baseline.implementationStage,'P0-name-and-preservation-only');
  const original=read('apps/review/src/nocturne-bk/runtime.js'),current=read('apps/review/src/nocturne/runtime.js');
  for(const [start,end] of [
    ['function resize(){','function actor('],['function actor(','function removeActor('],
    ['function face(','function startAttack('],['function ring(','function castBurst('],
    ['function project(','function fail('],['function draw(','function metrics(']
  ])assert.equal(block(current,start,end),block(original,start,end),start);
  const changed=new Set(['apps/review/src/nocturne/runtime.js','apps/review/src/nocturne-stage.js','package-lock.json']);
  for(const [path,sha] of Object.entries(baseline.activeBlobs))if(!changed.has(path))assert.equal(blobHash(read(path)),sha,path);
});

test('P2 does not upgrade, replace or remove any original dependency',()=>{
  const lock=JSON.parse(read('package-lock.json'));
  assert.equal(lock.packages['apps/review'].dependencies['@soul/johakyu-combat'],'*');
  assert.deepEqual(lock.packages['node_modules/@soul/johakyu-combat'],{resolved:'packages/johakyu-combat',link:true});
  assert.deepEqual(lock.packages['packages/johakyu-combat'],{version:'0.1.0',dependencies:{'@soul/game-data':'*'}});
  assert.equal(lock.packages['apps/rinne'].dependencies['@soul/johakyu-combat'],'*');
  delete lock.packages['apps/rinne'].dependencies['@soul/johakyu-combat'];
  delete lock.packages['apps/review'].dependencies['@soul/johakyu-combat'];
  delete lock.packages['node_modules/@soul/johakyu-combat'];delete lock.packages['packages/johakyu-combat'];
  assert.equal(blobHash(JSON.stringify(lock,null,2)+'\n'),baseline.activeBlobs['package-lock.json']);
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
