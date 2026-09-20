import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
const root=new URL('../../../',import.meta.url);
const read=path=>readFileSync(new URL(path,root),'utf8');
const blobHash=text=>createHash('sha1').update('blob '+Buffer.byteLength(text)+'\0').update(text).digest('hex');
const baseline=JSON.parse(read('docs/rinne/JOHAKYU_BATTLE_BASELINE.json'));

// P1 adds only this lazy, read-only observation. After removing these exact
// additions, every original native byte must still match the immutable P0 hash.
// Combat/RNG/audio equivalence is ALSO exercised against bk by the causal test.
function sourceWithoutP1Observation(path){
  let source=read(path);
  const removeOnce=value=>{
    assert.equal(source.split(value).length,2,`Expected one exact P1 insertion: ${path}`);
    source=source.replace(value,'');
  };
  if(path==='apps/review/src/nocturne/runtime.js'){
    removeOnce("import {createBattleObservation} from '@soul/shared-ui/johakyu-observation';\n");
    removeOnce("function inspectBattle(bootEpoch){\n if(!game.ready||disposed)return null;\n return createBattleObservation({authority:'native-demo',battleId:`battle2:${bootEpoch}:${rounds}`,timeSeconds:game.time,status:game.phase,\n  actors:actors.map(a=>({id:a.object.uuid,side:a.kind==='hero'?'hero':'enemy',position:a.pos.toArray(),hp:a.hp,maxHp:a.maxHp,dead:a.dead,phase:null,animation:a.actionName})),events:[]});\n}\n");
    assert.equal(source.split('metrics,inspectActors,inspectBattle,advance').length,2);
    source=source.replace('metrics,inspectActors,inspectBattle,advance','metrics,inspectActors,advance');
  }else if(path==='apps/review/src/nocturne-stage.js'){
    removeOnce('  get observation(){return prepared?runtime?.inspectBattle(sequence)??null:null;},\n');
  }
  return source;
}

test('P0/P1 preserve native combat, animation, camera, environment, audio and assets',()=>{
  assert.equal(baseline.sourceCommit,'58bf65db139a64f456f3923fe4988d741285418c');
  assert.equal(baseline.implementationStage,'P0-name-and-preservation-only');
  assert.equal(Object.keys(baseline.activeBlobs).length,11);
  for(const [path,sha] of Object.entries(baseline.activeBlobs))assert.equal(blobHash(sourceWithoutP1Observation(path)),sha,path);
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
