import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
const root=new URL('../../../',import.meta.url);
const read=path=>readFileSync(new URL(path,root),'utf8');
const blobHash=text=>createHash('sha1').update('blob '+Buffer.byteLength(text)+'\0').update(text).digest('hex');
const baseline=JSON.parse(read('docs/rinne/JOHAKYU_BATTLE_BASELINE.json'));
// Independent controls already merged at develop@8013cf94, not part of this
// integration. Pin their exact blocks, then still compare the remainder to P0.
function originalSharedCss(){
  const value=read('packages/shared-ui/src/review-shell.css'),index=value.indexOf('\n.review-stage-controls{');
  assert.ok(index>0);assert.equal(blobHash(value.slice(index)),'7337e1b3bf1497f8db2fc3dd0eaf897c1762aea6');
  return value.slice(0,index);
}
function originalSharedJs(value){
  const start=value.indexOf('export function mountReviewStageControls('),end=value.indexOf('export function createReviewStageLifecycle(');
  assert.ok(start>0&&end>start);assert.equal(blobHash(value.slice(start,end)),'5c3dcc02457844b354eab7eaaff3fd92ba10b188');
  return value.slice(0,start)+value.slice(end);
}

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
  const original=read('apps/review/src/nocturne-bk/runtime.js'),current=read('packages/johakyu-presentation/src/runtime.js');
  for(const [start,end] of [
    ['function resize(){','function actor('],['function actor(','function removeActor('],
    ['function face(','function startAttack('],['function ring(','function castBurst('],
    ['function project(','function fail('],['function draw(','function metrics(']
  ])assert.equal(block(current,start,end),block(original,start,end),start);
  const changed=new Set(['apps/review/src/nocturne/runtime.js','apps/review/src/nocturne-stage.js','apps/review/src/nocturne/assets.js','apps/review/src/nocturne/audio.js','package-lock.json']);
  for(const [path,sha] of Object.entries(baseline.activeBlobs))if(!changed.has(path))assert.equal(blobHash(path==='packages/shared-ui/src/review-shell.css'?originalSharedCss():read(path)),sha,path);
  for(const file of ['runtime','assets','audio'])assert.equal(read(`apps/review/src/nocturne/${file}.js`),`// Shared native presentation; main and review never import another app.\nexport * from '@soul/johakyu-presentation/${file}';\n`);
  for(const file of ['audio.js','environment.js','manifest.json','source-receipt.json'])assert.equal(blobHash(read('packages/johakyu-presentation/src/'+file)),baseline.activeBlobs['apps/review/src/nocturne/'+file],file);
  const originalLoader=read('packages/johakyu-presentation/src/assets.js').replace('async function download(row,signal,base){','async function download(row,signal){').replace('signal,onProgress=()=>{},base=location.href})','signal,onProgress=()=>{}})').replaceAll('assetUrl(row.path,base)','assetUrl(row.path)').replaceAll('await download(row,signal,base)','await download(row,signal)');
  assert.equal(blobHash(originalLoader),baseline.activeBlobs['apps/review/src/nocturne/assets.js']);
});

test('P2 does not upgrade, replace or remove any original dependency',()=>{
  const lock=JSON.parse(read('package-lock.json'));
  assert.deepEqual(lock.packages['packages/johakyu-presentation'],{version:'0.1.0',dependencies:{'@soul/assets':'*','@soul/shared-ui':'*',three:'0.186.0'}});
  assert.deepEqual(lock.packages['node_modules/@soul/johakyu-presentation'],{resolved:'packages/johakyu-presentation',link:true});
  for(const app of ['review','rinne']){assert.equal(lock.packages[`apps/${app}`].dependencies['@soul/johakyu-presentation'],'*');delete lock.packages[`apps/${app}`].dependencies['@soul/johakyu-presentation'];}
  delete lock.packages['packages/johakyu-presentation'];delete lock.packages['node_modules/@soul/johakyu-presentation'];
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
  assert.match(html,/<title>Visual Review｜序破急バトル<\/title>/);
  assert.match(html,/<h1>序破急バトル<\/h1>/);
  assert.match(html,/aria-label="序破急バトルレビュー"/);
  assert.match(html,/data-review-surface="battle2"/);
  assert.match(shared,/id:'battle2',label:'序破急バトル',detail:'百年転生の序破急戦闘を確認'/);
  const p7Readout='\n        <div class="battle2-p7-readout" data-p7-readout hidden aria-label="P7戦闘状態">\n          <span class="battle2-p7-phase" data-p7-phase>序</span>\n          <span class="battle2-p7-copy"><strong data-p7-summary>P7 本編契約 · 2対3</strong><small data-p7-detail>ST 100 · 傷 なし</small></span>\n        </div>';
  const p7Normalized=html
    .replace('\n<link rel="stylesheet" href="./src/nocturne/johakyu-p7-readout.css">','')
    .replace(p7Readout,'')
    .replace('aria-label="序破急 canonical 自動戦闘"','aria-label="NOCTURNE 自動戦闘"');
  assert.equal(blobHash(p7Normalized.replaceAll(baseline.name,baseline.previousName)),baseline.renameOnlyBlobs['apps/review/battle2.html']);
  const normalized=originalSharedJs(shared).replaceAll(baseline.name,baseline.previousName).replace('百年転生の序破急戦闘を確認','ノクターン自動戦闘・演出基盤');
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
