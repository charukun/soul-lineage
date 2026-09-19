import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');

test('hunt shell exposes movement combat readout and the system pause escape hatch',()=>{
  const index=read('../index.html');
  for(const id of ['game','hud','pause','skill-name'])assert.match(index,new RegExp(`id="${id}"`),id);
  assert.match(index,/class="phases combat-sequence combat-sequence--flat"/);
  for(const phase of ['jo','ha','kyu'])assert.match(index,new RegExp(`data-phase="${phase}"`),phase);
});

test('movement-only input contract keeps utility actions automatic',()=>{
  const contract=read('../docs/PLAY_INPUT_CONTRACT.md');
  assert.match(contract,/能動操作は \*\*移動だけ\*\*/);
  assert.match(contract,/例外はポーズ \/ システムメニュー/);
  assert.match(contract,/嗅覚: 狩場へ入った時と必要な再探索時に自動/);
  assert.match(contract,/帰路: 捕食後は最寄りの帰還口を自動案内/);
  assert.match(contract,/序・破・急の現在phaseと現在行動名/);
});


test('hunt HUD keeps the foot-level combat readout and omits enemy identity and health chrome',()=>{
  const index=read('../index.html');
  const flow=read('../src/web/hunt-flow-ui.js');
  const css=read('../src/web/hunt-minimal-hud.css');
  const main=read('../src/web/main.js');
  assert.match(flow,/hunt-minimal-hud\.css/);
  assert.match(flow,/人影 \$\{eaten\}\/\$\{plan\.quota\}/);
  assert.match(flow,/戦利 \$\{haul\}/);
  assert.match(flow,/帰還 \$\{game\.carried/);
  assert.doesNotMatch(index,/enemy-health-(?:track|fill)/);
  assert.doesNotMatch(main,/enemy-health-(?:track|fill)/);
  assert.doesNotMatch(css,/enemy-health-(?:track|fill)/);
  assert.doesNotMatch(index,/id="enemy-name"/);
  assert.doesNotMatch(main,/enemy-name/);
  assert.doesNotMatch(css,/#enemy-name/);
  assert.match(main,/combatDamageLine/);
  assert.match(main,/demon-combat-feed/);
  assert.ok(index.includes('id="battle"><div class="phases combat-sequence combat-sequence--flat"'));
  assert.match(index,/data-combat-sequence/);
  assert.ok(css.includes('left:0!important;right:0!important;bottom:calc(165px + env(safe-area-inset-bottom))!important;'));
  assert.ok(css.includes('background:none!important;clip-path:none!important;filter:none!important;'));
  assert.ok(css.includes('body.hunt-loop #hud .phases{justify-content:center!important'));
  assert.match(css,/\.controls\{display:none!important\}/);
  assert.match(css,/#objective>small/);
  assert.match(css,/#return-hint/);
});
