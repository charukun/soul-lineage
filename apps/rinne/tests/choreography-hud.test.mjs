import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('RINNE gameplay removes the life gauge while keeping breath and injury-driven presentation',async()=>{
  const [index,ui,runtime]=await Promise.all([
    readFile(new URL('../index.html',import.meta.url),'utf8'),
    readFile(new URL('../src/gameplay-ui.js',import.meta.url),'utf8'),
    readFile(new URL('../src/rebuild/runtime.js',import.meta.url),'utf8')
  ]);
  assert.doesNotMatch(index,/id="hp-bar"|<span>命<\/span>/);
  assert.match(index,/id="stamina-bar"/);
  assert.doesNotMatch(ui,/data-context-hp|data-vital-life|<span>命<\/span>/);
  assert.match(ui,/data-context-stamina/);
  assert.match(runtime,/combatBodyOutcome\(state\)/);
  assert.doesNotMatch(runtime,/\$\('hp-bar'\)/);
});

test('battle presentation view exposes deterministic choreography controls and body HUD',async()=>{
  const [html,source]=await Promise.all([
    readFile(new URL('../review-battle.html',import.meta.url),'utf8'),
    readFile(new URL('../src/review-battle.js',import.meta.url),'utf8')
  ]);
  for(const id of ['battle-strategy-a','battle-strategy-b','battle-ab-toggle','battle-review-seed','battle-injury-preset','battle-body-hud'])assert.match(html,new RegExp(`id="${id}"`));
  assert.match(html,/<title>Visual Review｜戦闘演出<\/title>/);assert.match(html,/<h1>戦闘演出<\/h1>/);assert.doesNotMatch(html,/id="battle-body-readout"/);
  assert.match(source,/strategyVariant==='A'/);
  assert.match(source,/reviewSeed/);
  assert.match(source,/applyChoreographyImpact/);
  assert.match(source,/createCombatBodyHud/);assert.match(source,/bodyHud\?\.flash\(bodyImpact\.part\)/);
});
