import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { LIFE_YEARS, createLife, rebirth } from '../src/rebuild/domain.js';
import { equipmentAccess, requestEquipmentChange, objectiveNavigation, rebirthPreview } from '../src/rebuild/gameplay-contract.js';
import { ensureCombatLoadout, learnedHeartSkills, learnedTechniqueSkills } from '../src/combat-loadout.js';

const atRack=()=>({id:'rack.sword',label:'武具棚',x:0,z:0,equipmentAccess:true,equipmentRadius:1.55});
function adultLife(){
  const state=createLife({name:'旅人',seed:42,villageIds:['village-a']});
  state.phase='living';state.ageSeconds=8*60;state.ageYears=8;state.position={x:0,z:0};
  state.inventory={weapons:['fist','sword'],armors:['cloth','light'],shields:[false,true]};
  return state;
}

test('canonical life contract is 100 years',()=>{
  assert.equal(LIFE_YEARS,100);
});

test('equipment changes are rejected when age, place, combat, or ownership rules fail',()=>{
  const station=atRack();
  const child=adultLife();child.ageSeconds=6*60;child.ageYears=6;
  assert.equal(equipmentAccess(child,{stations:[station]}).ok,false);

  const away=adultLife();away.position={x:9,z:9};
  assert.equal(equipmentAccess(away,{stations:[station]}).ok,false);

  const fighting=adultLife();fighting.combat={targetId:'enemy'};
  assert.equal(equipmentAccess(fighting,{stations:[station]}).ok,false);

  const adult=adultLife();
  assert.equal(requestEquipmentChange(adult,{kind:'weapon',value:'axe',stations:[station]}).ok,false);
  const changed=requestEquipmentChange(adult,{kind:'weapon',value:'sword',stations:[station]});
  assert.equal(changed.ok,true);assert.equal(changed.changed,true);assert.equal(adult.equipment.weapon,'sword');
  assert.ok(adult.knownSkills.includes('basic.sword'));
});

test('combat editor reads the game-owned catalog instead of inventing candidates',()=>{
  const state=adultLife();
  state.combatCatalog=['skill.breath','action.lunge'];
  ensureCombatLoadout(state);
  assert.deepEqual(learnedHeartSkills(state),['skill.breath']);
  const techniques=learnedTechniqueSkills(state);
  assert.ok(techniques.includes('basic.fist'));
  assert.ok(techniques.includes('action.lunge'));
  assert.ok(!techniques.includes('action.counter'));
});

test('objective navigation preserves the same target id for HUD and map',()=>{
  const state=adultLife();state.yaw=0;
  const navigation=objectiveNavigation(state,{target:{id:'port',label:'港',x:10,z:0}});
  assert.equal(navigation.targetId,'port');
  assert.equal(navigation.distance,10);
  assert.match(navigation.text,/港/);
});

test('rebirth preview matches the reset/persist behavior of the domain',()=>{
  const state=adultLife();
  state.homelands=['village-a'];state.lineage=[{generation:0,name:'先代'}];state.equipment={weapon:'sword',armor:'light',shield:true};state.experiences={practice:{score:4,count:4}};
  const preview=rebirthPreview(state,{villageLabel:'故郷'});
  assert.equal(preview.lifeYears,100);
  assert.ok(preview.preserved.some(text=>text.includes('一族の記録')));
  assert.ok(preview.preserved.some(text=>text.includes('故郷')));
  assert.ok(preview.reset.some(text=>text.includes('装備')));
  const next=rebirth(state,{villageId:'village-a',villageIds:['village-a']});
  assert.equal(next.ageYears,0);assert.equal(next.equipment.weapon,'fist');assert.deepEqual(next.experiences,{});
  assert.deepEqual(next.homelands,['village-a']);assert.equal(next.lineage.length,2);
});

test('main UI keeps four plan entrances, no debug entrance, and no direct equipment mutation',async()=>{
  const ui=await readFile(new URL('../src/gameplay-ui.js',import.meta.url),'utf8');
  const upgrade=await readFile(new URL('../src/gameplay-upgrade.js',import.meta.url),'utf8');
  const css=await readFile(new URL('../src/gameplay-ui-contract.css',import.meta.url),'utf8');
  const index=await readFile(new URL('../index.html',import.meta.url),'utf8');
  assert.match(ui,/data-combat/);assert.match(ui,/data-items/);assert.match(ui,/data-map/);assert.match(ui,/data-record/);
  assert.doesNotMatch(ui,/data-debug/);
  assert.doesNotMatch(ui,/state\.equipment\.(weapon|armor|shield)\s*=/);
  assert.doesNotMatch(upgrade,/data-debug/);
  assert.match(css,/\.upgrade-panel\{overflow:hidden!important/);
  assert.match(index,/gameplay-ui-contract\.css/);
});
