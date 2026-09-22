import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {sequenceHudState} from '../src/combat-sequence-hud.js';

test('spacing keeps Jo-Ha-Kyu inactive while preserving a readable current action',()=>{
  const state=sequenceHudState({phase:'jo'});
  assert.equal(state.comboActive,false);
  assert.equal(state.activePhase,'');
  assert.equal(state.action,'間合いを測る');
  assert.deepEqual(state.completed,{jo:false,ha:false,kyu:false});
});

test('committed combo actions activate and accumulate completed phases',()=>{
  const jo=sequenceHudState({phase:'jo',attack:'斬り上げ'});
  const ha=sequenceHudState({phase:'ha',attack:'裂き'});
  const kyu=sequenceHudState({phase:'kyu',attack:'決め'});
  assert.equal(jo.comboActive,true);assert.equal(jo.activePhase,'jo');assert.deepEqual(jo.completed,{jo:false,ha:false,kyu:false});
  assert.equal(ha.activePhase,'ha');assert.deepEqual(ha.completed,{jo:true,ha:false,kyu:false});
  assert.equal(kyu.activePhase,'kyu');assert.deepEqual(kyu.completed,{jo:true,ha:true,kyu:false});
});

test('an interrupted combo stays inactive until a spacing window starts the next combo',()=>{
  assert.equal(sequenceHudState({phase:'ha',attack:'裂き',interrupted:true}).comboActive,false);
  assert.equal(sequenceHudState({phase:'kyu',attack:'決め',interrupted:true}).comboActive,false);
  const spacing=sequenceHudState({phase:'jo',interrupted:true});
  assert.equal(spacing.comboActive,false);assert.equal(spacing.action,'間合いを測る');
  assert.equal(sequenceHudState({phase:'jo',attack:'踏み込み'}).comboActive,true);
});

test('Rinne HUD wires soft history replacement, simple damage copy, and interruption animation',async()=>{
  const ui=await readFile(new URL('../src/gameplay-ui.js',import.meta.url),'utf8');
  const runtime=await readFile(new URL('../src/rebuild/runtime.js',import.meta.url),'utf8');
  const css=await readFile(new URL('../src/reincarnation-hud.css',import.meta.url),'utf8');
  assert.match(ui,/dataset\.motion=index===0\?'incoming':'outgoing'/);
  assert.match(ui,/action:'攻撃を受けた',kind:'damage'/);
  assert.match(ui,/comboInterrupted=true/);
  assert.match(ui,/comboInterrupted&&!rawAction/);
  assert.match(runtime,/rinne:combat-feedback/);
  assert.match(css,/rinne-phase-history-enter/);
  assert.match(css,/rinne-phase-history-exit/);
  assert.match(css,/translate:0 46px/);
  assert.match(css,/rinne-sequence-interrupt/);
  assert.match(css,/data-combo-active="false"/);
});


test('main combat HUD shows technique names and heart slots use 意識 language',async()=>{
  const ui=await readFile(new URL('../src/gameplay-ui.js',import.meta.url),'utf8');
  const heart=await readFile(new URL('../src/heart-technique-body-ui.js',import.meta.url),'utf8');
  assert.match(ui,/phaseTechnique/);assert.match(ui,/combatSkillForPhase/);assert.match(ui,/const action=rawAction/);
  assert.match(heart,/意識中/);assert.match(heart,/心得枠で意識する/);assert.doesNotMatch(heart,/心得枠へ装着/);
});
