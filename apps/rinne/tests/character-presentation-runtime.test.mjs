import test from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync,readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
import {createLife} from '../src/rebuild/domain.js';
import {createFront} from '../src/rebuild/combat.js';
import {
  RINNE_RUNTIME_CHARACTER_ASSET,
  createRinneEnemyCharacter,
  createRinneHeroCharacter,
  createRinneMotherCharacter,
  resolveRinneRuntimeCharacter,
  resolveRinneRuntimeRoster,
  rinneRuntimeAgeMs
} from '../src/rebuild/character-presentation.js';

const here=dirname(fileURLToPath(import.meta.url)),rebuild=join(here,'../src/rebuild');

test('main-game humanoids resolve through one explicit DCC Character Presentation candidate',()=>{
  const state=createLife({seed:41});state.phase='living';state.ageSeconds=24*60;state.ageYears=24;
  const front=createFront(0,state.seed),hero=createRinneHeroCharacter(state),mother=createRinneMotherCharacter(state);
  const enemies=front.enemies.map((enemy,index)=>createRinneEnemyCharacter(enemy,{lifeSeed:state.seed,stage:0,index}));
  const ids=[hero,mother,...enemies].map(row=>row.character.id);
  assert.equal(new Set(ids).size,ids.length);
  assert.equal(RINNE_RUNTIME_CHARACTER_ASSET.procedural,false);
  assert.equal(RINNE_RUNTIME_CHARACTER_ASSET.productionReady,false);
  assert.equal(RINNE_RUNTIME_CHARACTER_ASSET.productionStage,'PRIMARY');
  assert.equal(RINNE_RUNTIME_CHARACTER_ASSET.modelingMode,'dcc-blender');
  assert.equal(RINNE_RUNTIME_CHARACTER_ASSET.visualApproval,'pending');
  assert.match(RINNE_RUNTIME_CHARACTER_ASSET.url,/SHINO_REFERENCE_V2\.vrm$/);
  for(const actor of [hero,mother,...enemies]){
    const presentation=resolveRinneRuntimeCharacter({...actor,distance:1,visible:true,important:actor.kind==='hero'});
    assert.equal(presentation.app,'rinne');
    assert.equal(presentation.runtimeAsset.id,RINNE_RUNTIME_CHARACTER_ASSET.id);
    assert.equal(presentation.runtimeAsset.procedural,false);
    assert.equal(presentation.productionAsset,null,'PRIMARY DEV candidate must not be promoted to RUNTIME_READY implicitly');
  }
});

test('combat roster uses shared render tiers instead of a second enemy renderer',()=>{
  const state=createLife({seed:42}),front=createFront(1,state.seed);
  const actors=[
    {...createRinneHeroCharacter(state),distance:0,visible:true,important:true},
    ...front.enemies.map((enemy,index)=>({...createRinneEnemyCharacter(enemy,{lifeSeed:state.seed,stage:1,index}),distance:index<2?3:12+index*5,visible:true,important:false}))
  ];
  const roster=resolveRinneRuntimeRoster(actors,{lod:{maxFull:2,nearDistance:8,farDistance:20}});
  assert.equal(roster.length,actors.length);
  assert.equal(roster[0].render.tier,'full');
  assert.ok(roster.some(row=>row.render.tier==='mid'||row.render.tier==='far'));
  assert.ok(roster.every(row=>row.runtimeAsset.id===RINNE_RUNTIME_CHARACTER_ASSET.id));
});

test('100-year game life never turns the 90-year presentation contract into a dead actor',()=>{
  assert.ok(rinneRuntimeAgeMs(99*60)<90*60*1000);
  const state=createLife({seed:43});state.ageSeconds=99*60;state.ageYears=99;
  const hero=createRinneHeroCharacter(state);
  assert.equal(hero.character.lifeState,'alive');
});

test('Rinne main runtime cannot reintroduce Mura resident people as gameplay humanoids',()=>{
  const offenders=[];
  for(const name of readdirSync(rebuild).filter(name=>name.endsWith('.js'))){
    const source=readFileSync(join(rebuild,name),'utf8');
    if(/\bmodels\.person\s*\(/.test(source))offenders.push(name);
  }
  assert.deepEqual(offenders,[]);
  const renderer=readFileSync(join(rebuild,'renderer.js'),'utf8'),runtime=readFileSync(join(rebuild,'runtime.js'),'utf8');
  assert.match(renderer,/createMasterCharacterPool/);
  assert.match(renderer,/createRinneEnemyCharacter/);
  assert.match(renderer,/RINNE_RUNTIME_CHARACTER_ASSET\.url/);
  assert.match(runtime,/await createWorldRenderer/);
});

test('carrier locomotion is delegated to the canonical character renderer',()=>{
  const source=readFileSync(join(rebuild,'birth-experience.js'),'utf8');
  assert.match(source,/setCarrierMotion/);
});
