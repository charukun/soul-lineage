import test from 'node:test';
import assert from 'node:assert/strict';
import {createVfxStreamingDemand,equippedVfxSkillIds,vfxEffectsForSkills} from '../src/rebuild/vfx-streaming.js';

const defs={slash:{},impact:{},finisher:{},focusAura:{skillIds:['skill.focus']},crashBurst:{skillIds:['action.crash']}};

test('equipped VFX skills contain only the active loadout plus the weapon basic',()=>{
  const state={equipment:{weapon:'sword'},combatLoadout:{heart:{active:['skill.focus']},technique:{activeComboId:'active',oneMotion:null,combos:[
    {id:'active',slots:{jo:'action.lunge',ha:'action.counter',kyu:'basic.sword'}},
    {id:'inactive',slots:{jo:'action.finish',ha:'action.finish',kyu:'action.finish'}},
  ]}}};
  assert.deepEqual(equippedVfxSkillIds(state),['basic.sword','skill.focus','action.lunge','action.counter']);
  assert.deepEqual(new Set(vfxEffectsForSkills(equippedVfxSkillIds(state),defs)),new Set(['slash','impact','focusAura']));
});

test('streaming demand prioritizes self and near peers, warms mid-range peers, and ignores far peers',()=>{
  const self={position:{x:0,z:0},equipment:{weapon:'sword'},combatLoadout:{heart:{active:[]},technique:{activeComboId:'a',oneMotion:null,combos:[{id:'a',slots:{jo:'basic.sword',ha:'basic.sword',kyu:'basic.sword'}}]}}};
  const peers=[
    {position:{x:10,z:0},vfxSkills:['action.crash']},
    {position:{x:30,z:0},vfxSkills:['action.finish']},
    {position:{x:45,z:0},vfxSkills:['skill.focus']},
  ];
  const demand=createVfxStreamingDemand({self,peers,effectDefinitions:defs}),byId=Object.fromEntries(demand.map(row=>[row.effect,row.priority]));
  assert.equal(byId.slash,100);assert.equal(byId.impact,100);assert.equal(byId.crashBurst,80);assert.equal(byId.finisher,45);assert.equal(byId.focusAura,undefined);
});
