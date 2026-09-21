import test from 'node:test';
import assert from 'node:assert/strict';
import {createLife} from '../src/rebuild/domain.js';
import {ensureCombatLoadout,setHeartActive,setBodyChoice} from '../src/combat-loadout.js';
import {
  applySkillComponents,chooseEnemyAttention,directionalDefenseFor,noteEnemyThreat,resolveBodyIntent,
  staminaPolicyFor,tidebreakMindVectorFor,tidebreakMindsetFromVector
} from '../src/rebuild/combat-tactics.js';

function life(seed=9){const state=createLife({seed});state.phase='living';state.ageYears=20;state.ageSeconds=1200;state.position={x:0,z:0};state.yaw=0;state.equipment.weapon='sword';state.knownSkills.push('basic.sword');ensureCombatLoadout(state);return state;}
// This fixture represents a validated pre-inspiration save. Knowing a support
// skill is separate from explicitly equipping it in the three heart slots.
function equippedLegacy(state,skills){state.inspiration.legacySkills.push(...skills);state.knownSkills.push(...skills);state.combatLoadout=null;ensureCombatLoadout(state);for(const id of skills)assert.equal(setHeartActive(state,id,true),true);return state;}
const enemy=(id,x,z)=>({id,x,z,hp:100,maxHp:100,dead:false,cooldown:0,attackWindow:.3,threat:{}});

test('continuous mind vector reacts to learned heart/body choices instead of being only a label',()=>{
  const state=life();const base=tidebreakMindVectorFor(state);equippedLegacy(state,['skill.read','skill.patience','skill.peripheral']);assert.equal(setBodyChoice(state,'style','counter'),true);const trained=tidebreakMindVectorFor(state);
  assert.ok(trained.counter>base.counter);assert.ok(trained.guard>base.guard);assert.equal(typeof tidebreakMindsetFromVector(trained),'string');
});

test('stamina exhaustion changes decision policy into recovery instead of allowing a free attack',()=>{
  const state=life();state.stamina=3;state.staminaCap=100;const foe=enemy('a',0,1.1),intent=resolveBodyIntent(state,[foe],'a');
  assert.equal(staminaPolicyFor(state).band,'critical');assert.equal(intent.mode,'recover');assert.equal(intent.stamina.allowOffense,false);
});

test('rear attacks stay dangerous until awareness skills are learned',()=>{
  const raw=life(11),rear=enemy('rear',0,-1);const before=directionalDefenseFor(raw,rear);equippedLegacy(raw,['skill.danger','skill.peripheral','skill.flow-step']);const after=directionalDefenseFor(raw,rear);
  assert.equal(before.sector,'back');assert.ok(before.damageScale>1);assert.ok(after.awareness>before.awareness);assert.ok(after.damageScale<before.damageScale);
});

test('learned support skills alter Tidebreak recipe components directly',()=>{
  const state=life(12),base={kinds:['slash','heavy','ready'],feet:['forward','forward','stay'],charges:['none','none','none'],rhythm:'flow',tempo:1};equippedLegacy(state,['skill.flow-step','skill.focus','skill.tempo']);const result=applySkillComponents(state,'action.finish','kyu',base);
  assert.notDeepEqual(result.feet,base.feet);assert.notDeepEqual(result.charges,base.charges);assert.equal(result.rhythm,'sharp');
});

test('enemy attention is an intent score and does not imply exclusive participation',()=>{
  const a=life(20),b=life(21),foe=enemy('boss',0,1.3);a.id='a';b.id='b';a.position.x=-.2;b.position.x=.2;noteEnemyThreat(foe,'b',30);const target=chooseEnemyAttention(foe,[a,b]);
  assert.equal(target.id,'b');assert.ok(Number(foe.threat.b)>0);assert.equal(foe.attentionTargetId,undefined);
});
