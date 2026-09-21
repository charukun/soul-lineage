import test from 'node:test';
import assert from 'node:assert/strict';
import {addTechniqueToReviewChain,compileTechniqueComposition,createReviewTechniqueComposition,reviewChainLabel,techniqueFromCombatForm} from '../src/technique-composition.js';

test('canonical combat forms compile into technique -> stage -> phase chains',()=>{
  const composition=createReviewTechniqueComposition();
  addTechniqueToReviewChain(composition,'jo',techniqueFromCombatForm('action.feint',{name:'誘い'}));
  addTechniqueToReviewChain(composition,'jo',techniqueFromCombatForm('action.side-step',{name:'外し歩'}));
  addTechniqueToReviewChain(composition,'ha',techniqueFromCombatForm('action.counter',{name:'返し'}));
  addTechniqueToReviewChain(composition,'kyu',techniqueFromCombatForm('action.precision',{name:'一点通し'}));
  const compiled=compileTechniqueComposition(composition);
  assert.equal(reviewChainLabel('jo',compiled.jo.length),'序 · 二連');
  assert.deepEqual(compiled.jo.map(row=>row.id),['action.feint','action.side-step']);
  assert.deepEqual(compiled.jo[0].stages.map(row=>[row.label,row.kind,row.step.footwork]),[
    ['一段','ready','sideR'],['二段','slash','cross'],['三段','back','retreat']
  ]);
  assert.deepEqual(compiled.ha[0].stages.map(row=>row.kind),['parry','counter','thrust']);
  assert.deepEqual(compiled.kyu[0].stages.map(row=>row.kind),['thrust','pierce','thrust']);
});

test('composition only accepts registered combat forms and keeps chains bounded',()=>{
  assert.throws(()=>techniqueFromCombatForm('invented.ultimate'),/Unregistered combat form/);
  const composition=createReviewTechniqueComposition();
  for(const [id,name] of [['action.feint','誘い'],['action.slip','流し身'],['action.guard-step','受け流し歩法'],['action.counter','返し']])
    addTechniqueToReviewChain(composition,'ha',techniqueFromCombatForm(id,{name}));
  assert.deepEqual(composition.ha.map(row=>row.id),['action.slip','action.guard-step','action.counter']);
});
