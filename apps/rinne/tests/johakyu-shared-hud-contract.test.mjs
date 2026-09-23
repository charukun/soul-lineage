import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('main battle HUD projects common technique/stage identity and keeps exchange state visible',async()=>{
  const ui=await readFile(new URL('../src/gameplay-ui.js',import.meta.url),'utf8');
  const css=await readFile(new URL('../src/combat-exchange-cue.css',import.meta.url),'utf8');
  assert.match(ui,/s\.combat\?\.engine==='johakyu'\?s\.combat\?\.johakyuAction/);
  assert.match(ui,/sharedAction\.stageLabel/);assert.match(ui,/sharedAction\?\.name/);
  assert.match(ui,/dataset\.techniqueId=sharedAction\.techniqueId/);assert.match(ui,/dataset\.stageIndex=String\(sharedAction\.stageIndex\)/);
  assert.match(ui,/\['tidebreak','johakyu'\]\.includes\(s\.combat\?\.engine\)/);
  assert.match(css,/data-battle-engine="johakyu"/);assert.match(css,/combat-phase-history\{display:none!important\}/);
});
