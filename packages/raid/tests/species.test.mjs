import test from 'node:test';
import assert from 'node:assert/strict';
import {freshProfile} from '../profile.js';
import {RaidSession} from '../session.js';
import {DEFAULT_MONSTER_SPECIES,MONSTER_SPECIES,MONSTER_SPECIES_IDS,chooseMonsterSpecies,feedingGrowth} from '../species.js';

const village=id=>({id,seed:17,name:'種別試験村',target:'traveller',raidScale:'small'});

test('catalog contains the procedural monster plus five distinct imported species profiles',()=>{
 assert.equal(DEFAULT_MONSTER_SPECIES,'night-creature');
 assert.equal(MONSTER_SPECIES_IDS.length,6);
 assert.equal(MONSTER_SPECIES_IDS.filter(id=>MONSTER_SPECIES[id].model).length,5);
 for(const id of MONSTER_SPECIES_IDS){
  const species=MONSTER_SPECIES[id],start=feedingGrowth(0,id),full=feedingGrowth(species.growth.fullMeals,id);
  assert.equal(start.scale,species.growth.minScale,id);assert.equal(full.scale,species.growth.maxScale,id);
  assert.ok(start.hpScale<full.hpScale,id);assert.ok(start.moveScale>0&&full.moveScale>0,id);
  assert.ok(species.growth.maxScale<=3.2,id);assert.ok(species.growth.fullMeals>=6,id);assert.ok(species.growth.pace>1,id);
 }
});

test('early feeding growth remains visible without jumping close to human scale',()=>{
 const start=feedingGrowth(0),first=feedingGrowth(1),second=feedingGrowth(2),third=feedingGrowth(3),full=feedingGrowth(MONSTER_SPECIES[DEFAULT_MONSTER_SPECIES].growth.fullMeals);
 assert.equal(start.scale,.28);
 assert.ok(first.scale>start.scale&&first.scale<.5,`first meal scale ${first.scale}`);
 assert.ok(second.scale>first.scale&&second.scale<.7,`second meal scale ${second.scale}`);
 assert.ok(third.scale>second.scale&&third.scale<1,`third meal scale ${third.scale}`);
 assert.equal(full.scale,3.2);
});

test('each village receives one deterministic species while explicit future selection can override it',()=>{
 for(let i=0;i<30;i++)assert.equal(chooseMonsterSpecies(`village:${i}`),chooseMonsterSpecies(`village:${i}`));
 const seen=new Set(Array.from({length:80},(_,i)=>chooseMonsterSpecies(`village:${i}`)));
 assert.ok(seen.size>=5,`only ${[...seen].join(', ')}`);
 assert.equal(chooseMonsterSpecies('any','night-bat'),'night-bat');
 assert.equal(chooseMonsterSpecies('any','not-a-species'),chooseMonsterSpecies('any'));
});

test('species override is stable through a hunt and each species exposes its own monster techniques',()=>{
 const signatures=new Set();
 for(const id of MONSTER_SPECIES_IDS){
  const profile=freshProfile(`species-${id}`,1);profile.monsterSpecies=id;
  const game=new RaidSession(village(`hunt:${id}`),profile),skills=game.skillSet();
  assert.equal(game.monsterSpecies,id);assert.equal(game.player.growthScale,MONSTER_SPECIES[id].growth.minScale);
  const names=[skills.loadout.jo.name,skills.loadout.ha.name,skills.loadout.kyu.name];
  assert.ok(names.every(Boolean));signatures.add(names.join('|'));
  game.refreshProfile({...profile,monsterSpecies:undefined});assert.equal(game.monsterSpecies,id);
 }
 assert.equal(signatures.size,MONSTER_SPECIES_IDS.length);
});

test('species make different bodies without changing the feeding loop contract',()=>{
 const runt=feedingGrowth(6,'goblin-runt'),brute=feedingGrowth(6,'horn-brute'),bat=feedingGrowth(6,'night-bat'),ogre=feedingGrowth(6,'grave-ogre');
 assert.equal(runt.progress,1);assert.ok(runt.scale<brute.scale);assert.ok(bat.moveScale>brute.moveScale);assert.ok(ogre.hpScale>bat.hpScale);
 for(const id of MONSTER_SPECIES_IDS){const g=feedingGrowth(999,id);assert.equal(g.progress,1);assert.equal(g.scale,MONSTER_SPECIES[id].growth.maxScale);}
});
