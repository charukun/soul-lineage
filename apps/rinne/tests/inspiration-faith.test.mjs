import test from 'node:test';
import assert from 'node:assert/strict';
import {CAUSAL_ANSWER_BY_ID,EFFECT_AFFINITIES,validateCausalAnswers} from '@soul/game-data';
import {faithProfile} from '../src/rebuild/skill-system.js';
import {chooseInspirationEffectAffinity,inspirationAffinityChance} from '../src/rebuild/inspiration-state.js';
import {AUTHORED_EFFECTS} from '../src/rebuild/authored-effect-manifest.js';
import {combatEffectCues} from '../src/rebuild/combat-effect-cues.js';
import {createVfxStreamingDemand} from '../src/rebuild/vfx-streaming.js';
import {REVIEW_VFX_LIBRARY_EFFECTS} from '../src/rebuild/review-vfx-library-manifest.js';
import {REVIEW_EFFECT_CATALOG} from '../src/review-effect-catalog.js';

const heartRecord=id=>[id,{answerId:id,kind:'heart',archived:false}];
const faithState=(ids,seed=1)=>({seed,inspiration:{version:1,legacySkills:[],records:Object.fromEntries(ids.map(heartRecord))}});

test('fire faith is authored on heart answers and aggregates as more heart insights are learned',()=>{
  assert.equal(validateCausalAnswers(),true);
  assert.ok(EFFECT_AFFINITIES.includes('fire'));
  assert.ok(CAUSAL_ANSWER_BY_ID['skill.fire-vigil'].faith.fire>0);
  assert.ok(CAUSAL_ANSWER_BY_ID['skill.fire-hearth'].faith.fire>0);
  const one=faithState(['skill.fire-vigil']),two=faithState(['skill.fire-vigil','skill.fire-hearth']);
  assert.ok(faithProfile(two).fire>faithProfile(one).fire);
  assert.ok(inspirationAffinityChance(two,'fire')>inspirationAffinityChance(one,'fire'));
});

test('more fire faith raises the population of fire-presented inspirations',()=>{
  let oneCount=0,twoCount=0;
  for(let seed=1;seed<=512;seed++){
    if(chooseInspirationEffectAffinity(faithState(['skill.fire-vigil'],seed),'spark.sword.under')==='fire')oneCount++;
    if(chooseInspirationEffectAffinity(faithState(['skill.fire-vigil','skill.fire-hearth'],seed),'spark.sword.under')==='fire')twoCount++;
  }
  assert.ok(oneCount>0);
  assert.ok(twoCount>oneCount);
  assert.equal(chooseInspirationEffectAffinity(faithState([],77),'spark.sword.under'),null);
});

test('effect manifests expose affinity metadata and promote one pinned fire effect to runtime',()=>{
  const fire=REVIEW_VFX_LIBRARY_EFFECTS.find(row=>row.id==='lib-tktk02-fire1');
  const water=REVIEW_VFX_LIBRARY_EFFECTS.find(row=>row.id==='lib-tktk03-toonwater');
  const plain=REVIEW_VFX_LIBRARY_EFFECTS.find(row=>row.id==='lib-tktk01-blow1');
  assert.deepEqual(fire.affinities,['fire']);
  assert.ok(water.affinities.includes('water'));
  assert.deepEqual(plain.affinities,[]);
  assert.deepEqual(AUTHORED_EFFECTS['affinity-fire'].affinities,['fire']);
  assert.equal(AUTHORED_EFFECTS['affinity-fire'].sourceEffectId,'lib-tktk02-fire1');
  const card=REVIEW_EFFECT_CATALOG.find(row=>row.id==='source-lib-tktk02-fire1');
  assert.equal(card.category,'elemental');
  assert.deepEqual(card.affinities,['fire']);
});

test('a learned fire-presented technique uses fire VFX without changing hit authority',()=>{
  const state={id:'life',zone:'frontier',phase:'life',position:{x:0,z:0},inspiration:{records:{'spark.sword.under':{effectAffinity:'fire'}}}};
  const front={stage:0,enemies:[{id:'enemy',x:2,z:0}]};
  const event={type:'player-hit',targetId:'enemy',damage:7,phase:'ha',engine:'tidebreak',techniqueId:'spark.sword.under'};
  const cues=combatEffectCues([event],{state,front});
  assert.equal(cues[0].effect,'affinity-fire');
  assert.equal(cues[0].kind,'affinity-contact');
  assert.equal(cues[1].effect,'slash');
  assert.equal(event.damage,7);
});

test('equipped affinity techniques are prefetched before their first contact',()=>{
  const self={position:{x:0,z:0},equipment:{weapon:'sword'},combatLoadout:{heart:{active:[]},technique:{activeComboId:'combo',combos:[{id:'combo',slots:{jo:'spark.sword.under',ha:'basic.sword',kyu:'basic.sword'}}]}},inspiration:{records:{'spark.sword.under':{effectAffinity:'fire'}}}};
  const demand=createVfxStreamingDemand({self,effectDefinitions:AUTHORED_EFFECTS});
  assert.ok(demand.some(row=>row.effect==='affinity-fire'&&row.priority>=100));
});
