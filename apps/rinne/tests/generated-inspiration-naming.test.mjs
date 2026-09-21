import test from 'node:test';
import assert from 'node:assert/strict';
import { generatedTechniqueCandidates, generatedTechniqueNaming } from '@soul/game-data';
import { inspirationName } from '../src/rebuild/inspiration-state.js';

test('generated personal names are deterministic per life and are not player-editable save labels', () => {
  const row=generatedTechniqueCandidates({weapon:'spear',phase:'ha'}).find(item=>item.steps.length===3);
  const state={
    seed:287,
    inspiration:{
      version:1,
      body:{reach:1,drive:1,balance:1,endurance:1,coordination:1},
      heritage:[{motif:'precision',strength:.4,depth:1,sourceLifeId:'a',sourceName:'先代',generation:1,relation:'lineage'}],
      records:{[row.id]:{answerId:row.id,name:'俺が勝手につけた名前'}},
    },
  };
  const expected=generatedTechniqueNaming(row,{seed:state.seed,motifs:[...row.motifs,'precision']}).displayName;
  assert.equal(inspirationName(state,row.id),expected);
  assert.notEqual(inspirationName(state,row.id),'俺が勝手につけた名前');
});

test('different lives can name the same generated structure differently without changing its technique id', () => {
  const row=generatedTechniqueCandidates({weapon:'sword',phase:'ha'}).find(item=>item.steps.length===3);
  const names=new Set();
  for(let seed=0;seed<400;seed++){
    const state={seed,inspiration:{version:1,body:{reach:1,drive:1,balance:1,endurance:1,coordination:1},heritage:[],records:{}}};
    names.add(inspirationName(state,row.id));
  }
  assert.ok(names.size>1);
  assert.equal(row.id,row.id);
});
