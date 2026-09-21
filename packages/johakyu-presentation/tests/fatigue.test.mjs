import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createJohakyuDomainActor,johakyuActorCapability} from '../../johakyu-combat/src/domain.js';
import {FATIGUE_BREATH_ASSET,resolveFatiguePresentation} from '../src/fatigue.js';

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
test('fatigue posture escalates while remaining presentation-only',()=>{
  const fresh=resolveFatiguePresentation({capability:{canAttack:true,stamina:{band:'fresh',ratio:.9}}});
  const steady=resolveFatiguePresentation({capability:{canAttack:true,stamina:{band:'steady',ratio:.5}}});
  const low=resolveFatiguePresentation({capability:{canAttack:true,stamina:{band:'low',ratio:.25}}});
  const critical=resolveFatiguePresentation({capability:{canAttack:false,stamina:{band:'critical',ratio:.1}}});
  assert.ok(fresh.lean<steady.lean&&steady.lean<low.lean&&low.lean<critical.lean);
  assert.ok(fresh.breathHz<steady.breathHz&&steady.breathHz<low.breathHz&&low.breathHz<critical.breathHz);
  assert.equal(fresh.audioGain,0);assert.equal(steady.audioGain,0);assert.ok(low.audioGain>0);assert.ok(critical.audioGain>low.audioGain);
  assert.equal(low.attackLocked,false);assert.equal(critical.attackLocked,true);
});
test('breathing SFX is materialized with pinned CC0 provenance and no third-party runtime URL',()=>{
  const provenance=JSON.parse(readFileSync(repoFile('apps/review/public/library/provenance/fatigue-breathing-mikeask-v1.json'),'utf8'));
  const bytes=readFileSync(repoFile('apps/review/public/library/'+FATIGUE_BREATH_ASSET.path));
  assert.equal(provenance.author,'mikeask');assert.equal(provenance.license,'CC0-1.0');
  assert.equal(provenance.originalSourceUrl,'https://opengameart.org/content/breathing-tired');
  assert.equal(bytes.byteLength,FATIGUE_BREATH_ASSET.byteLength);
  const gitBlob=createHash('sha1').update(Buffer.from('blob '+bytes.byteLength+'\0')).update(bytes).digest('hex');
  assert.equal(gitBlob,FATIGUE_BREATH_ASSET.gitBlob);assert.equal(gitBlob,provenance.provenance.hash.value);
  const audioSource=readFileSync(new URL('../src/audio.js',import.meta.url),'utf8');
  assert.match(audioSource,/\/library\/.*FATIGUE_BREATH_ASSET\.path/);
  assert.doesNotMatch(audioSource,/opengameart|freesound|githubusercontent|jsdelivr/i);
});
test('battle2 frame forwards canonical stamina capability and gates offense with it',()=>{
  const source=readFileSync(repoFile('apps/review/src/nocturne/johakyu-p7-review.js'),'utf8');
  assert.match(source,/capability:\{canMove:capability\.canMove,canAttack:capability\.canAttack,stamina:capability\.stamina\}/);
  assert.match(source,/stageDamage\(node\.stage\)>0&&!capability\.canAttack/);
});
