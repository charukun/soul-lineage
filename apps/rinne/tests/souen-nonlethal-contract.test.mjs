import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');

test('体の三枠は構え・葬焉・残心で、戦法は心得intentへ吸収される',()=>{
  const loadout=read('../src/combat-loadout.js'),ui=read('../src/heart-technique-body-ui.js'),tactics=read('../src/rebuild/combat-tactics.js');
  assert.match(loadout,/BODY_FINISHERS/);assert.doesNotMatch(loadout,/BODY_STYLES/);
  assert.match(ui,/\['finisher','葬焉'/);assert.doesNotMatch(ui,/\['style','戦法'/);
  assert.match(tactics,/skillDefinition\(id\)\?\.intent/);assert.doesNotMatch(tactics,/strategyForState/);
});

test('ダウン後はトドメと葬焉を分離し、不殺なら葬焉しない',()=>{
  const core=read('../src/rebuild/combat-core.js'),catalog=read('../../../packages/game-data/src/causal-inspiration-catalog.js');
  assert.match(catalog,/id:'skill\.nonlethal',name:'不殺'/);
  assert.match(core,/action:'トドメ'/);assert.match(core,/souenId/);assert.match(core,/finisherPolicy\.nonlethal/);
  assert.match(core,/enemy-recovered/);assert.match(core,/nonlethal:true/);
});
