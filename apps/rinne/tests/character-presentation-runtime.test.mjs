import test from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync,readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
import {KAYKIT_FAMILY_ID,KAYKIT_MODEL_BY_KEY,KAYKIT_MODELS} from '@soul/characters';
import {createLife} from '../src/rebuild/domain.js';
import {createFront} from '../src/rebuild/combat.js';
import {
  RINNE_PROTAGONIST_RUNTIME_ASSET,
  RINNE_RUNTIME_CHARACTER_ASSET,
  RINNE_RUNTIME_CHARACTER_FAMILY,
  createRinneEnemyCharacter,
  createRinneHeroCharacter,
  createRinneMotherCharacter,
  resolveRinneRuntimeCharacter,
  resolveRinneRuntimeRoster,
  rinneRuntimeAgeMs
} from '../src/rebuild/character-presentation.js';

const here=dirname(fileURLToPath(import.meta.url)),rebuild=join(here,'../src/rebuild');

test('playable hero uses the same pinned KayKit Knight as motion review while the surrounding cast stays on KayKit',()=>{
  const state=createLife({seed:41});state.phase='living';state.ageSeconds=24*60;state.ageYears=24;
  const front=createFront(0,state.seed),hero=createRinneHeroCharacter(state),mother=createRinneMotherCharacter(state);
  const enemies=front.enemies.map((enemy,index)=>createRinneEnemyCharacter(enemy,{lifeSeed:state.seed,stage:0,index}));
  const ids=[hero,mother,...enemies].map(row=>row.character.id);
  assert.equal(new Set(ids).size,ids.length);
  assert.equal(RINNE_RUNTIME_CHARACTER_FAMILY.id,KAYKIT_FAMILY_ID);
  assert.equal(RINNE_RUNTIME_CHARACTER_FAMILY.models.length,5);
  assert.deepEqual(RINNE_RUNTIME_CHARACTER_FAMILY.models.map(row=>row.label),['Knight','Barbarian','Mage','Rogue','Rogue Hooded']);
  assert.equal(RINNE_RUNTIME_CHARACTER_ASSET.procedural,false);
  assert.equal(RINNE_RUNTIME_CHARACTER_ASSET.productionReady,false);
  assert.match(RINNE_RUNTIME_CHARACTER_ASSET.url,/kaykit\/Rogue\.glb$/);

  assert.equal(hero.familyId,KAYKIT_FAMILY_ID);
  assert.equal(hero.modelId,KAYKIT_MODEL_BY_KEY.knight.id);
  assert.equal(hero.asset,RINNE_PROTAGONIST_RUNTIME_ASSET);
  assert.equal(hero.asset.productionStage,'REFERENCE');
  assert.equal(hero.asset.modelingMode,'imported-reviewed');
  assert.equal(hero.asset.productionReady,false);
  assert.equal(hero.asset.visualApproval,'pending');
  assert.equal(hero.asset.usage,'dev-runtime-protagonist');
  assert.equal(hero.asset.source.gitBlobSha,'717b56ca2b5ff5392679774725201ba03a3eefab');
  assert.match(hero.asset.url,/kaykit\/Knight\.glb$/);

  assert.equal(mother.modelId,'kaykit.rogue-hooded.v1');
  for(const actor of [mother,...enemies]){
    assert.ok(KAYKIT_MODELS.some(row=>row.id===actor.modelId));
    const presentation=resolveRinneRuntimeCharacter({...actor,distance:1,visible:true,important:false});
    assert.equal(presentation.app,'rinne');
    assert.equal(presentation.characterFamily,KAYKIT_FAMILY_ID);
    assert.equal(presentation.runtimeAsset.familyId,KAYKIT_FAMILY_ID);
    assert.ok(KAYKIT_MODELS.some(row=>row.id===presentation.runtimeAsset.modelId));
    assert.equal(presentation.runtimeAsset.procedural,false);
    assert.equal(presentation.productionAsset,null,'foundation asset must not be promoted to RUNTIME_READY implicitly');
  }
  const heroPresentation=resolveRinneRuntimeCharacter({...hero,distance:0,visible:true,important:true});
  assert.equal(heroPresentation.runtimeAsset.modelId,KAYKIT_MODEL_BY_KEY.knight.id);
  assert.equal(heroPresentation.productionAsset,null,'PRIMARY hero remains separate from RUNTIME_READY promotion');
});

test('combat roster uses shared render tiers and multiple KayKit cast models instead of a second NPC renderer',()=>{
  const state=createLife({seed:42}),front=createFront(1,state.seed);
  const actors=[
    {...createRinneHeroCharacter(state),distance:0,visible:true,important:true},
    ...front.enemies.map((enemy,index)=>({...createRinneEnemyCharacter(enemy,{lifeSeed:state.seed,stage:1,index}),distance:index<2?3:12+index*5,visible:true,important:false}))
  ];
  const roster=resolveRinneRuntimeRoster(actors,{lod:{maxFull:2,nearDistance:8,farDistance:20}});
  assert.equal(roster.length,actors.length);
  assert.equal(roster[0].render.tier,'full');
  assert.ok(roster.some(row=>row.render.tier==='mid'||row.render.tier==='far'));
  assert.ok(roster.every(row=>row.characterFamily===KAYKIT_FAMILY_ID));
  assert.equal(roster[0].runtimeAsset.modelId,KAYKIT_MODEL_BY_KEY.knight.id);
  assert.ok(new Set(roster.slice(1).map(row=>row.runtimeAsset.modelId)).size>=1);
});

test('100-year game life never turns the 90-year presentation contract into a dead actor',()=>{
  assert.ok(rinneRuntimeAgeMs(99*60)<90*60*1000);
  const state=createLife({seed:43});state.ageSeconds=99*60;state.ageYears=99;
  const hero=createRinneHeroCharacter(state);
  assert.equal(hero.character.lifeState,'alive');
});

test('Rinne main runtime keeps one character stage and cannot reintroduce legacy Shino gameplay humanoids',()=>{
  const offenders=[];
  for(const name of readdirSync(rebuild).filter(name=>name.endsWith('.js'))){
    const source=readFileSync(join(rebuild,name),'utf8');
    if(/\bmodels\.person\s*\(/.test(source))offenders.push(name);
  }
  assert.deepEqual(offenders,[]);
  const renderer=readFileSync(join(rebuild,'renderer.js'),'utf8'),stage=readFileSync(join(rebuild,'runtime-character-stage.js'),'utf8'),runtime=readFileSync(join(rebuild,'runtime.js'),'utf8');
  assert.match(renderer,/createRinneCharacterStage/);
  assert.match(stage,/createKaykitCharacterPools/);
  assert.match(stage,/createProtagonistCharacterPool/);
  assert.match(stage,/heroPool/);
  assert.match(stage,/createRinneEnemyCharacter/);
  assert.doesNotMatch(stage,/SHINO_review\.vrm|shinoHumanoidFromGLTF/);
  assert.match(runtime,/await createWorldRenderer/);
});

test('carrier locomotion is delegated to the canonical character renderer',()=>{
  const source=readFileSync(join(rebuild,'birth-experience.js'),'utf8');
  assert.match(source,/setCarrierMotion/);
});
