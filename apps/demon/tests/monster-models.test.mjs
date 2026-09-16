import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {EXTERNAL_MONSTER_MODELS,GOBKIT_SOURCE_COMMIT,externalMonsterUrl,gitBlobSha,monsterAnimationTime} from '../src/web/monster-models.js';

const provenance=JSON.parse(readFileSync(new URL('../public/assets/monsters/gobkit/provenance.json',import.meta.url),'utf8'));

test('five Gobkit surfaces are pinned to one immutable CC0 source revision',()=>{
 const ids=Object.keys(EXTERNAL_MONSTER_MODELS);assert.equal(ids.length,5);assert.match(GOBKIT_SOURCE_COMMIT,/^[0-9a-f]{40}$/);
 assert.equal(provenance.source.commit,GOBKIT_SOURCE_COMMIT);assert.equal(provenance.source.license,'CC0-1.0');assert.equal(provenance.models.length,5);
 for(const id of ids){const spec=EXTERNAL_MONSTER_MODELS[id],record=provenance.models.find(row=>row.species===id);
  assert.ok(record,id);assert.equal(record.gitBlobSha,spec.gitBlobSha);assert.equal(record.bytes,spec.bytes);assert.ok(spec.bytes>0&&spec.bytes<512*1024,id);
  assert.match(spec.gitBlobSha,/^[0-9a-f]{40}$/);assert.match(externalMonsterUrl(id),new RegExp(GOBKIT_SOURCE_COMMIT));assert.ok(externalMonsterUrl(id).endsWith(spec.path));
  for(const state of ['idle','attack','dead'])assert.ok(spec.clips[state],`${id} ${state}`);
 }
 assert.ok(EXTERNAL_MONSTER_MODELS['night-bat'].clips.walk);
});

test('Git blob integrity helper matches Git hash-object semantics',async()=>{
 const bytes=new TextEncoder().encode('abc');assert.equal(await gitBlobSha(bytes),'f2ba8f84ab5c1bce84a7b441cb1959cfc7093b7f');
});

test('animation sampler keeps gameplay states inside their authored frame ranges',()=>{
 for(const [id,spec] of Object.entries(EXTERNAL_MONSTER_MODELS))for(const state of ['idle','attack','dead']){
  const [first,last]=spec.clips[state].map(frame=>frame/spec.fps),samples=[monsterAnimationTime(spec,state,0,0),monsterAnimationTime(spec,state,2.37,.5),monsterAnimationTime(spec,state,99,1)];
  for(const value of samples)assert.ok(value>=first&&value<=last,`${id} ${state}: ${value}`);
  if(state==='dead')assert.equal(samples[0],last);
 }
});

test('demon boot installs the external surface adapter and documents fallback behavior',()=>{
 const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8'),adapter=readFileSync(new URL('../src/monster-player.js',import.meta.url),'utf8'),license=readFileSync(new URL('../public/assets/monsters/gobkit/LICENSE.txt',import.meta.url),'utf8');
 assert.match(main,/import\('\.\/monster-player\.js'\)/);assert.match(adapter,/procedural fallback/);assert.match(adapter,/monsterSpecies/);assert.match(license,/CC0 1\.0 Universal/);
 assert.equal(provenance.delivery.mode,'commit-pinned-remote-glb');assert.equal(provenance.delivery.gameplayFallback,'night-creature');
});
