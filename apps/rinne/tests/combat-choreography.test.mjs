import test from 'node:test';
import assert from 'node:assert/strict';
import {applyChoreographyImpact,combatBodyOutcome,combatBodySnapshot,normalizeCombatStrategy,strategyForState} from '../src/rebuild/combat-choreography.js';
import {createLife} from '../src/rebuild/domain.js';
import {tidebreakMindVectorFor} from '../src/rebuild/combat-tactics.js';
const actor=(strategy='balanced')=>({seed:7,generation:1,ageSeconds:0,maxHp:100,combatStrategy:strategy,injuries:{}});
test('each body part exposes durability instead of a single life gauge',()=>{const body=combatBodySnapshot(actor());assert.deepEqual(Object.keys(body),['head','torso','leftArm','rightArm','leftLeg','rightLeg']);assert.ok(Object.values(body).every(row=>row.durability===100&&row.stage==='正常'));});
test('meaningful hits damage deterministic body parts and can incapacitate',()=>{const state=actor(),first=applyChoreographyImpact(state,{damage:28,maxIntegrity:100,sector:'left',sourceId:'foe',phase:'ha'});assert.ok(['leftArm','leftLeg','torso','head'].includes(first.part));assert.ok(first.durability<100);for(let i=0;i<12&&!combatBodyOutcome(state).incapacitated;i++)applyChoreographyImpact(state,{damage:34,maxIntegrity:100,sector:'front',sourceId:'foe-'+i,phase:'kyu'});assert.equal(combatBodyOutcome(state).incapacitated,true);});
test('player strategy remains a continuous balance',()=>{const attack=normalizeCombatStrategy('aggressive'),patient=normalizeCombatStrategy('patient');assert.ok(attack.attack>patient.attack);assert.ok(patient.counter>attack.counter);const state=actor({attack:.8,guard:.2,spacing:.7,counter:.1,mobility:.5,survival:.3});assert.equal(strategyForState(state).attack,.8);assert.equal(strategyForState(state).guard,.2);});

test('strategy changes the actual combat mind vector used by the autonomous fighter',()=>{
  const attack=createLife({seed:91}),patient=createLife({seed:91});
  for(const state of [attack,patient]){state.phase='living';state.ageSeconds=1200;state.ageYears=20;state.equipment.weapon='sword';state.knownSkills.push('basic.sword');}
  attack.combatStrategy='aggressive';patient.combatStrategy='patient';
  const a=tidebreakMindVectorFor(attack),p=tidebreakMindVectorFor(patient);
  assert.ok(a.attack>p.attack);assert.ok(p.spacing>a.spacing);assert.ok(p.counter>a.counter);
});
test('leg damage visibly reduces movement authority before incapacitation',()=>{
  const state=actor();const before=combatBodyOutcome(state);
  applyChoreographyImpact(state,{damage:52,maxIntegrity:100,part:'rightLeg',phase:'kyu'});
  const after=combatBodyOutcome(state);
  assert.ok(after.movementScale<before.movementScale);assert.equal(after.incapacitated,false);
});
