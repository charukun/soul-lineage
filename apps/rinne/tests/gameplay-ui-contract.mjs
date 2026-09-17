import assert from 'node:assert/strict';
import { discoverAvailableSkills } from '../src/rebuild/skill-system.js';
import { learnedHeartSkills, learnedTechniqueSkills, setComboSkill, setHeartActive, ensureCombatLoadout } from '../src/combat-loadout.js';
import { equipmentAccess, requestEquip } from '../src/rebuild/gameplay-commands.js';
import { createGameplayViewModel } from '../src/gameplay-view-model.js';

const rack={id:'rack.sword',label:'武具棚',x:5,z:0,equipment:{weapon:'sword'}};
const state={
  id:'life-test',phase:'living',zone:'village',interior:null,ended:false,down:null,ageYears:10,position:{x:0,z:0},combat:null,
  equipment:{weapon:'fist',armor:'cloth',shield:false},inventory:{weapons:['fist','sword'],armors:['cloth'],shields:[false]},
  knownSkills:['basic.fist'],skillWeights:{jo:{'basic.fist':100},ha:{},kyu:{}},experiences:{balance:{score:1},practice:{score:4}},
  lineage:[],generation:1,name:'旅人',defeats:0,returns:0,clockRate:1,
};
const discovered=discoverAvailableSkills(state);
assert.ok(discovered.includes('skill.balance'));
assert.ok(state.knownSkills.includes('skill.balance'));
ensureCombatLoadout(state);
assert.deepEqual(learnedHeartSkills(state),learnedHeartSkills(state).filter(id=>state.knownSkills.includes(id)));
assert.ok(learnedTechniqueSkills(state).every(id=>id.startsWith('basic.')||state.knownSkills.includes(id)));
const combo=state.combatLoadout.technique.combos[0];
assert.equal(setComboSkill(state,combo.id,'jo','action.finish'),false,'unlearned action must be rejected');
assert.equal(setHeartActive(state,'skill.focus',true),false,'unlearned support must be rejected');

state.ageYears=6;
assert.equal(equipmentAccess(state,[rack]).ok,false,'equipment is locked under age 7');
state.ageYears=10;state.position={x:0,z:0};
assert.equal(equipmentAccess(state,[rack]).ok,false,'equipment requires proximity');
state.position={x:5,z:0};state.combat={targetId:'enemy'};
assert.equal(equipmentAccess(state,[rack]).ok,false,'equipment is blocked during combat');
state.combat=null;
assert.equal(requestEquip(state,{kind:'weapon',value:'sword'},[rack]).ok,true);
assert.equal(state.equipment.weapon,'sword');

state.position={x:0,z:0};state.ageYears=10;state.equipment.weapon='fist';
const vm=createGameplayViewModel(state,{stations:[rack]});
assert.equal(vm.target?.id,'rack.sword');
assert.ok(Math.abs(vm.target.distance-5)<0.001);
assert.ok(vm.target.arrow);
console.log('gameplay-ui-contract ok');
