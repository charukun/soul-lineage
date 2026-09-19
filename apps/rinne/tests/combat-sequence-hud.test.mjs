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

test('the interrupted attack key stays inactive until spacing or a different action releases it',()=>{
  const live=sequenceHudState({phase:'ha',attack:'裂き'}),blocked=sequenceHudState({phase:'ha',attack:'裂き',blockedKey:live.key});
  assert.equal(blocked.comboActive,false);
  assert.equal(sequenceHudState({phase:'ha',blockedKey:live.key}).comboActive,false);
  assert.equal(sequenceHudState({phase:'kyu',attack:'決め',blockedKey:live.key}).comboActive,true);
});

test('Rinne HUD wires soft history replacement, simple damage copy, and interruption animation',async()=>{
  const ui=await readFile(new URL('../src/gameplay-ui.js',import.meta.url),'utf8');
  const runtime=await readFile(new URL('../src/rebuild/runtime.js',import.meta.url),'utf8');
  const css=await readFile(new URL('../src/reincarnation-hud.css',import.meta.url),'utf8');
  assert.match(ui,/data-motion=index===0\?'incoming':'outgoing'/);
  assert.match(ui,/action:'攻撃を受けた',kind:'damage'/);
  assert.match(ui,/blockedComboKey=currentComboKey/);
  assert.match(runtime,/rinne:combat-feedback/);
  assert.match(css,/rinne-phase-history-enter/);
  assert.match(css,/rinne-phase-history-exit/);
  assert.match(css,/rinne-sequence-interrupt/);
  assert.match(css,/data-combo-active="false"/);
});
