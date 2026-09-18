import test from 'node:test';
import assert from 'node:assert/strict';
import {buildMotionReviewCatalog,classifyReviewMotion,filterMotionReviewCatalog} from '../src/review-motion-catalog.js';

const clips=[
  {name:'Idle',duration:2.1},{name:'Interact',duration:1.4},{name:'PickUp',duration:1.2},{name:'Cheer',duration:1.6},{name:'Wave',duration:1.5},{name:'Sitting_Idle',duration:3},
  {name:'Walking_A',duration:1},{name:'Running_A',duration:.8},{name:'Jump_Full',duration:1.1},{name:'Crouch_Idle',duration:2},{name:'Sneaking',duration:1.2},{name:'Dodge_Roll',duration:.9},
  {name:'1H_Melee_Attack_Chop',duration:.7},{name:'Heavy_Attack',duration:1.1},{name:'Attack_Combo',duration:1.3},{name:'Block',duration:1},{name:'Shoot_2H',duration:.8},{name:'Spellcast',duration:1.5},
  {name:'Hit_A',duration:.5},{name:'Death_A',duration:1.8},{name:'Spawn',duration:1.2},{name:'Look_Around',duration:2}
];

test('motion review classifies KayKit-style clip names by review intent',()=>{
  assert.equal(classifyReviewMotion('Sitting_Idle'),'life');
  assert.equal(classifyReviewMotion('Dodge_Roll'),'move');
  assert.equal(classifyReviewMotion('1H_Melee_Attack_Chop'),'combat');
  assert.equal(classifyReviewMotion('Death_A'),'reaction');
  assert.equal(classifyReviewMotion('Look_Around'),'other');
});

test('motion review recommendation keeps a balanced bounded candidate set',()=>{
  const catalog=buildMotionReviewCatalog(clips,{perCategory:3});
  const recommended=filterMotionReviewCatalog(catalog,'recommended');
  assert.ok(recommended.length<=12);
  for(const category of ['life','move','combat','reaction'])assert.ok(recommended.some(row=>row.category===category));
  assert.equal(filterMotionReviewCatalog(catalog,'all').length,clips.length);
});

test('motion review preserves exact source index, name and duration',()=>{
  const catalog=buildMotionReviewCatalog(clips);
  const attack=catalog.find(row=>row.name==='1H_Melee_Attack_Chop');
  assert.equal(attack.index,12);
  assert.equal(attack.duration,.7);
  assert.equal(attack.category,'combat');
});
