import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {nextCombatReadoutState,combatDamageLine} from '../src/web/combat-readout-state.js';

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

test('damage lines expose damage current life and readable condition',()=>{
  assert.equal(combatDamageLine(7.2,81,100),'被弾 −8 · 生命 81/100 · 健在');
  assert.equal(combatDamageLine(15,44,100),'被弾 −15 · 生命 44/100 · 重傷');
  assert.equal(combatDamageLine(15,20,100),'被弾 −15 · 生命 20/100 · 瀕死');
  assert.equal(combatDamageLine(99,0,100),'被弾 −99 · 生命 0/100 · 戦闘不能');
});

test('combat readout is a top-inserted downward feed with damage events',()=>{
  const index=read('../index.html');
  const js=read('../src/web/combat-readout-flow.js');
  const css=read('../src/web/combat-readout-flow.css');
  const main=read('../src/web/main.js');
  assert.match(index,/combat-readout-flow\.js/);
  assert.doesNotMatch(index,/id="enemy-name"/);
  assert.match(js,/combat-feed-baseline">間合いを測っている…/);
  assert.match(js,/class="combat-feed-events"/);
  assert.match(js,/feed\.prepend\(item\)/);
  assert.match(js,/setTimeout\(\(\)=>item\.remove\(\),2700\)/);
  assert.doesNotMatch(js,/entries\.length>6/);
  assert.match(js,/doc\.addEventListener\('demon-combat-feed',onFeed\)/);
  assert.match(js,/battle\.style\.opacity==='1'/);
  assert.match(js,/nextCombatReadoutState/);
  assert.match(main,/e\.type === 'hurt'/);
  assert.match(main,/combatDamageLine/);
  assert.match(main,/demon-combat-feed/);
  assert.match(css,/@keyframes combat-feed-event/);
  assert.match(css,/38%\{opacity:1;transform:translate\(-50%,0\)\}/);
  assert.match(css,/translate\(-50%,34px\)/);
  assert.match(css,/\[data-kind="hurt"\]/);
  assert.match(css,/prefers-reduced-motion:reduce/);
});

test('contract requires downward chronological combat flow and no enemy chrome',()=>{
  const contract=read('../docs/PLAY_INPUT_CONTRACT.md');
  assert.match(contract,/敵名・敵生命は表示しません/);
  assert.match(contract,/既存項目を下へ押し流し/);
  assert.match(contract,/被弾時はダメージ量、現在生命/);
});
