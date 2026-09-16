import test from 'node:test';
import assert from 'node:assert/strict';
import {createLife} from '../src/rebuild/domain.js';
import {createVillageSkirmish,skirmishAlive,tickVillageSkirmish,villageSkirmishAnchor} from '../src/rebuild/village-skirmish.js';

function living(seed=1){const state=createLife({seed});state.phase='living';state.ageYears=20;state.ageSeconds=1200;state.equipment.weapon='sword';state.knownSkills.push('basic.sword');return state;}
function exposed(seed=1){
  const skirmish=createVillageSkirmish({x:0,z:-10,angle:Math.PI},seed);for(const guard of skirmish.guards){guard.dead=true;guard.respawn=999;}
  for(const hostile of skirmish.hostiles){hostile.x=0;hostile.z=-10;hostile.cooldown=-1;}
  return skirmish;
}

test('guard-line anchor is placed beyond a guard-side village station',()=>{
  const anchor=villageSkirmishAnchor([{id:'door.guard',label:'詰所',x:0,z:-20,enterInterior:true}]);
  assert.equal(anchor.x,0);assert.ok(anchor.z<-20);
});

test('guards and wildlife/monster keep resolving combat instead of forming a static tableau',()=>{
  const state=living(31),skirmish=createVillageSkirmish({x:0,z:-30,angle:Math.PI},31),before=skirmish.hostiles.map(row=>({x:row.x,z:row.z,hp:row.hp}));
  state.position={x:100,z:100};for(let i=0;i<80;i++)tickVillageSkirmish(state,skirmish,.1);
  assert.ok(skirmish.hostiles.some((row,index)=>row.hp!==before[index].hp||Math.hypot(row.x-before[index].x,row.z-before[index].z)>.1));
  assert.ok(skirmish.guards.some(row=>row.hp<row.maxHp||row.dead));
  assert.ok(skirmishAlive(skirmish).hostiles>=1);
});

test('unprepared player is downed quickly when walking into several village-edge threats',()=>{
  const state=living(41),skirmish=exposed(41);state.position={x:0,z:-10};
  for(let i=0;i<20&&!state.down;i++){for(const hostile of skirmish.hostiles)hostile.cooldown=-1;tickVillageSkirmish(state,skirmish,.1);}
  assert.ok(state.down?.village);assert.equal(state.hp,0);assert.equal(state.down.rescueSeconds,12);
});

test('survival support reduces incoming damage while power support raises outgoing damage',()=>{
  const base=living(51),defender=living(52),power=living(53);base.position=defender.position=power.position={x:0,z:-10};
  defender.knownSkills.push('skill.balance','skill.adapt');power.knownSkills.push('skill.focus','skill.edge');
  const baseBattle=exposed(51),defBattle=exposed(52),powerBattle=exposed(53);
  for(const battle of [baseBattle,defBattle,powerBattle])battle.hostiles.splice(1);
  tickVillageSkirmish(base,baseBattle,.1);tickVillageSkirmish(defender,defBattle,.1);tickVillageSkirmish(power,powerBattle,.1);
  assert.ok(defender.hp>base.hp,'mitigation build should take less damage');
  assert.ok(powerBattle.hostiles[0].hp<baseBattle.hostiles[0].hp,'power build should deal more damage');
});

test('village down state is rescued by guards without ending the hundred-year life',()=>{
  const state=living(61),skirmish=exposed(61);state.position={x:0,z:-10};state.hp=0;state.down={elapsed:11.9,rescueSeconds:12,village:true};
  const events=tickVillageSkirmish(state,skirmish,.2);
  assert.equal(state.down,null);assert.ok(state.hp>0);assert.ok(events.some(row=>row.type==='rescued'));assert.equal(state.ended,false);
});
