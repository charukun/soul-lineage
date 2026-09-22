import test from 'node:test';
import assert from 'node:assert/strict';
import {combatBodyHudModel,createCombatBodyHud} from '../src/combat-body-hud.js';
import {COMBAT_BODY_PARTS,combatBodyOutcome} from '../src/rebuild/combat-choreography.js';
import {applyReviewBodyPreset} from '../src/review/battle/body-hud-presets.js';

const body=rows=>({ageSeconds:100,injuries:Object.fromEntries(COMBAT_BODY_PARTS.map(part=>[part,{severity:rows[part]||0,at:100}]))});
test('six canonical parts; no selection or missing state is safe',()=>{
  const model=combatBodyHudModel(null,'not-a-part');
  assert.deepEqual(model.parts.map(p=>p.id),COMBAT_BODY_PARTS);
  assert.equal(model.selected,null);assert.equal(model.damagedCount,0);
  assert.ok(model.parts.every(p=>p.durability===100&&p.stage==='正常'&&p.mark===''));
  assert.equal(createCombatBodyHud(),null);
});
test('all exact canonical stage boundaries have unique colour and non-colour marks',()=>{
  const rows=[[0,'正常','normal',''],[.1799,'正常','normal',''],[.18,'軽傷','light','·'],[.42,'負傷','wounded','Ⅱ'],[.68,'重傷','severe','!'],[.9,'機能不全','disabled','×'],[1,'機能不全','disabled','×']];
  for(const part of COMBAT_BODY_PARTS)for(const [severity,stage,tone,mark] of rows){
    const view=combatBodyHudModel(body({[part]:severity}),part).selected;
    assert.equal(view.stage,stage);assert.equal(view.tone,tone);assert.equal(view.mark,mark);assert.equal(view.durability,Math.round((1-severity)*100));
  }
});
test('render is read-only even when old injury timestamps would recover',()=>{
  const state=body({leftArm:.72,head:.2});state.injuries.leftArm.at=0;state.combatLessons={keep:true};state.pendingDiscoveries=['keep'];
  const before=structuredClone(state);Object.freeze(state.injuries.leftArm);Object.freeze(state.injuries);Object.freeze(state);
  for(let i=0;i<20;i++)assert.equal(combatBodyHudModel(state,'leftArm').selected.durability,28);
  assert.deepEqual(state,before);
});
test('selected contribution is not mislabeled whole-body aggregate',()=>{
  const state=body({head:.8,torso:.7,leftArm:.9,leftLeg:.92});
  const arm=combatBodyHudModel(state,'leftArm').selected;
  const authority=combatBodyOutcome(body({leftArm:.9}));
  assert.equal(arm.impact.attack,100-Math.round(authority.attackScale*100));
  assert.equal(arm.impact.movement,0);assert.equal(arm.impact.judgment,0);
  assert.ok(arm.attack<100-arm.impact.attack);
  const leg=combatBodyHudModel(state,'leftLeg').selected;assert.equal(leg.impact.attack,0);assert.ok(leg.impact.movement>0);
  const torso=combatBodyHudModel(state,'torso').selected;assert.ok(torso.impact.stamina>0&&torso.impact.judgment>0);
});
test('review preset uses existing canonical injuries; summary identifies worst part',()=>{
  const state=applyReviewBodyPreset(body({}),'body-stages');const model=combatBodyHudModel(state);
  assert.equal(model.damagedCount,4);assert.equal(model.worst.id,'leftLeg');assert.equal(model.worst.stage,'機能不全');
  assert.deepEqual(model.parts.map(p=>p.stage),['正常','軽傷','負傷','重傷','機能不全','正常']);
  assert.ok(Object.isFrozen(model)&&Object.isFrozen(model.parts));
});
test('legacy review part presets retain their original severity',()=>{
  for(const part of COMBAT_BODY_PARTS){const state=applyReviewBodyPreset(body({}),part);assert.equal(state.injuries[part].severity,.72);}
  assert.ok(COMBAT_BODY_PARTS.every(part=>applyReviewBodyPreset(body({}),'unknown').injuries[part].severity===0));
});
