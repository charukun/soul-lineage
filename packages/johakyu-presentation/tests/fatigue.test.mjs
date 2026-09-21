import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createJohakyuDomainActor,johakyuActorCapability} from '../../johakyu-combat/src/domain.js';
import {FATIGUE_BREATH_ASSET,resolveFatiguePresentation} from '../src/fatigue.js';
import {FATIGUE_MOTION_ASSET,sampleFatigueMotion} from '../src/fatigue-motion.js';

const repoFile=path=>new URL('../../../'+path,import.meta.url);
test('fatigue presentation consumes canonical bands without inventing stamina thresholds',()=>{
  const bands=[['fresh',90],['steady',50],['low',25],['critical',10]];
  for(const [expected,stamina] of bands){
    const actor=createJohakyuDomainActor({id:'actor-'+expected,stamina,staminaCap:100});
    const capability=johakyuActorCapability(actor),view=resolveFatiguePresentation({capability});
    assert.equal(capability.stamina.band,expected);assert.equal(view.band,expected);assert.equal(view.canonical,true);
    assert.equal(view.attackLocked,!capability.canAttack);
  }
  const source=readFileSync(new URL('../src/fatigue.js',import.meta.url),'utf8');
  assert.doesNotMatch(source,/ratio\s*[<>]=?\s*\.?\d/,'presentation must not derive a second stamina threshold');
});
test('RINNE-owned fatigue motion is authored for Rig_Medium with readable critical recovery beats',()=>{
  assert.equal(FATIGUE_MOTION_ASSET.author,'RINNE');assert.equal(FATIGUE_MOTION_ASSET.rigFamily,'Rig_Medium');
  assert.equal(FATIGUE_MOTION_ASSET.format,'authored-key-pose-runtime');
  const critical=FATIGUE_MOTION_ASSET.clips.critical,labels=critical.keyframes.map(row=>row.label);
  assert.ok(labels.includes('fold'));assert.ok(labels.includes('inhale'));assert.ok(labels.includes('recover'));
  const fold=critical.keyframes.find(row=>row.label==='fold'),recover=critical.keyframes.find(row=>row.label==='recover');
  assert.ok(fold.rootLean>recover.rootLean,'recovery beat must visibly rise from the exhausted fold');
  assert.ok(critical.keyframes.some(row=>row.shoulderRoll>.08),'critical breathing must visibly lift the shoulders');
  assert.deepEqual(sampleFatigueMotion('critical',0),sampleFatigueMotion('critical',critical.duration),'loop seam must be pose-continuous');
});
test('fatigue motion escalates from steady to low to critical without renaming unrelated source clips',()=>{
  const steady=sampleFatigueMotion('steady',1),low=sampleFatigueMotion('low',1),critical=sampleFatigueMotion('critical',1);
  assert.ok(steady.rootLean<low.rootLean&&low.rootLean<critical.rootLean);
  assert.ok(steady.shoulderRoll<low.shoulderRoll&&low.shoulderRoll<critical.shoulderRoll);
  assert.equal(sampleFatigueMotion('fresh',1).motionId,null);
  const runtime=readFileSync(new URL('../src/runtime.js',import.meta.url),'utf8');
  assert.match(runtime,/sampleFatigueMotion\(profile\.band/);
  assert.match(runtime,/item\.kind==='arm'/);
  assert.doesNotMatch(runtime,/Hit_[AB].*fatigue|Sit_Floor.*fatigue|Exhausted.*Hit_/i);
});
test('breathing SFX remains materialized with pinned CC0 provenance and no third-party runtime URL',()=>{
  const provenance=JSON.parse(readFileSync(repoFile('apps/review/public/library/provenance/fatigue-breathing-mikeask-v1.json'),'utf8'));
  const bytes=readFileSync(repoFile('apps/review/public/library/'+FATIGUE_BREATH_ASSET.path));
  assert.equal(provenance.author,'mikeask');assert.equal(provenance.license,'CC0-1.0');
  assert.equal(bytes.byteLength,FATIGUE_BREATH_ASSET.byteLength);
  const gitBlob=createHash('sha1').update(Buffer.from('blob '+bytes.byteLength+'\0')).update(bytes).digest('hex');
  assert.equal(gitBlob,FATIGUE_BREATH_ASSET.gitBlob);assert.equal(gitBlob,provenance.provenance.hash.value);
  const audioSource=readFileSync(new URL('../src/audio.js',import.meta.url),'utf8');
  assert.match(audioSource,/\/library\/.*FATIGUE_BREATH_ASSET\.path/);
  assert.doesNotMatch(audioSource,/opengameart|freesound|githubusercontent|jsdelivr/i);
});
test('battle2 frame keeps canonical stamina capability as the only attack authority',()=>{
  const source=readFileSync(repoFile('apps/review/src/nocturne/johakyu-p7-review.js'),'utf8');
  assert.match(source,/capability:\{canMove:capability\.canMove,canAttack:capability\.canAttack,stamina:capability\.stamina\}/);
  assert.match(source,/stageDamage\(node\.stage\)>0&&!capability\.canAttack/);
});
