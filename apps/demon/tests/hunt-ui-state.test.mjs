import test from 'node:test';
import assert from 'node:assert/strict';
import {huntUiState} from '../src/web/hunt-ui-state.js';
const game=overrides=>({fight:null,devour:null,finished:false,eaten:0,scentCooldown:0,targetEaten:false,escapeHold:0,...overrides});
test('return is visibly locked before the first successful devour without disabling feedback',()=>{
 const ui=huntUiState(game());
 assert.equal(ui.canReturn,false);assert.equal(ui.returnLocked,true);assert.equal(ui.returnDisabled,false);assert.equal(ui.showReturnHint,false);
});
test('combat and devour suppress auxiliary hunt controls',()=>{
 for(const state of [{fight:{}},{devour:{}}]){const ui=huntUiState(game(state));assert.equal(ui.busy,true);assert.equal(ui.scentDisabled,true);assert.equal(ui.memoryDisabled,true);assert.equal(ui.returnDisabled,true);}
});
test('scent cooldown only blocks scent',()=>{
 const ui=huntUiState(game({scentCooldown:4}));assert.equal(ui.scentDisabled,true);assert.equal(ui.memoryDisabled,false);assert.equal(ui.returnDisabled,false);
});
test('a devoured prey unlocks return hint only when return is requested or relevant',()=>{
 const ready=game({eaten:1});assert.equal(huntUiState(ready).canReturn,true);assert.equal(huntUiState(ready).showReturnHint,false);assert.equal(huntUiState(ready,{returning:true}).showReturnHint,true);
 assert.equal(huntUiState(game({eaten:1,targetEaten:true})).showReturnHint,true);assert.equal(huntUiState(game({eaten:1,escapeHold:.5})).showReturnHint,true);
});
test('finished hunts disable all hunt controls',()=>{
 const ui=huntUiState(game({finished:true,eaten:1}));assert.equal(ui.scentDisabled,true);assert.equal(ui.memoryDisabled,true);assert.equal(ui.returnDisabled,true);assert.equal(ui.canReturn,false);
});
