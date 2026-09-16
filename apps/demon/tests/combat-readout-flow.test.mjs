import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {nextCombatReadoutState} from '../src/web/combat-readout-state.js';

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');

test('same action and phase do not retrigger presentation',()=>{
  const a=nextCombatReadoutState({},'間合いを測る','jo');
  assert.equal(a.actionChanged,true);
  assert.equal(a.phaseChanged,true);
  const b=nextCombatReadoutState(a,'間合いを測る','jo');
  assert.equal(b.actionChanged,false);
  assert.equal(b.phaseChanged,false);
});

test('action and phase changes are detected independently',()=>{
  const base={action:'間合いを測る',phase:'jo'};
  const action=nextCombatReadoutState(base,'爪牙・裂く','jo');
  assert.equal(action.actionChanged,true);
  assert.equal(action.phaseChanged,false);
  const phase=nextCombatReadoutState(base,'間合いを測る','ha');
  assert.equal(phase.actionChanged,false);
  assert.equal(phase.phaseChanged,true);
});

test('invalid phases are normalized without inventing combat state',()=>{
  assert.deepEqual(nextCombatReadoutState({},'  技名  ','bad'),{
    action:'技名',phase:'',actionChanged:true,phaseChanged:false,
  });
});

test('combat readout flow is loaded and uses incoming/outgoing layers',()=>{
  const index=read('../index.html');
  const js=read('../src/web/combat-readout-flow.js');
  const css=read('../src/web/combat-readout-flow.css');
  assert.match(index,/combat-readout-flow\.js/);
  assert.match(js,/combat-action-outgoing/);
  assert.match(js,/combat-action-current/);
  assert.match(js,/nextCombatReadoutState/);
  assert.match(css,/@keyframes combat-action-enter/);
  assert.match(css,/@keyframes combat-action-exit/);
  assert.match(css,/combat-phase-shift/);
  assert.match(css,/prefers-reduced-motion:reduce/);
});

test('contract requires semantic-change-only flow transitions',()=>{
  const contract=read('../docs/PLAY_INPUT_CONTRACT.md');
  assert.match(contract,/同じ行動が続いている間は再アニメーションしません/);
  assert.match(contract,/直前の行動を上方へ流しながら薄く消し/);
  assert.match(contract,/新しい行動を下方から浮かび上がらせ/);
});
