import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createLife,deserializeLife,serializeLife,tickLife} from '../src/rebuild/domain.js';
import {applyCombatInjury,injuryEffects,stripCombatProgressionState} from '../src/rebuild/combat-injury.js';
import {evolveTechniqueForm,recordCombatLesson,techniqueMutationFor} from '../src/rebuild/combat-growth.js';
import {applyMultiTargetContact,enemySweepTargets,ensureCombatTerrain,lineBlocked,tickRangedProjectiles} from '../src/rebuild/combat-world-contact.js';
import {assignSquadRoles,enemyLearningResponse,recordEnemyPattern} from '../src/rebuild/combat-squad-ai.js';
import {combatReplayDigest,recordCombatReplay} from '../src/rebuild/combat-replay.js';

function state(seed=91){const s=createLife({seed});s.id=`p-${seed}`;s.phase='living';s.zone='frontier';s.ageSeconds=20*60;s.ageYears=20;s.position={x:0,z:0};s.yaw=0;s.equipment.weapon='sword';return s;}
function enemy(id,x,z,hp=100){return{id,x,z,hp,maxHp:hp,dead:false,cooldown:0,flash:0,yaw:Math.PI,attackWindow:0,moving:false};}
function front(enemies,stage=0){return{stage,enemies,cleared:false,clearSeconds:0};}

test('one Tidebreak sweep can damage several world targets while thrust remains first-contact only',()=>{
  const s=state(),a=enemy('a',0,1),b=enemy('b',.75,1.05),c=enemy('c',-.72,.95),f=front([a,b,c]);s.combat={tidebreakPose:{attack:'spin',pose:{hand:[0,1,0],tip:[0,1,1]}}};
  const events=[{type:'player-hit',targetId:'a',skill:'basic.sword',phase:'jo',damage:12,engine:'tidebreak'}];applyMultiTargetContact(s,f,events[0],events);assert.ok(b.hp<100&&c.hp<100);assert.ok(events.filter(e=>e.multiTarget).length>=2);
  const d=enemy('d',.7,1,100),f2=front([enemy('main',0,1),d]);s.combat.tidebreakPose.attack='thrust';const rows=[{type:'player-hit',targetId:'main',skill:'basic.sword',phase:'jo',damage:12,engine:'tidebreak'}];applyMultiTargetContact(s,f2,rows[0],rows);assert.equal(d.hp,100);
});

test('enemy sweep can threaten multiple players without an attacker cap',()=>{
  const attacker=enemy('boss',0,0);attacker.tidebreakPose={attack:'spin'};attacker.yaw=0;const a=state(1),b=state(2),c=state(3);a.position={x:0,z:1};b.position={x:.8,z:1};c.position={x:-.8,z:1};const f=front([attacker],5);
  assert.equal(enemySweepTargets(attacker,[a,b,c],a.id,f).length,2);
});

test('combat terrain blocks movement and line of fire through deterministic cover',()=>{
  const f=front([]);const terrain=ensureCombatTerrain(f),cover=terrain.obstacles[0],a={x:cover.x-2,z:cover.z},b={x:cover.x+2,z:cover.z};assert.equal(lineBlocked(f,a,b),true);
});

test('injuries persist, affect body capabilities, and heal without becoming permanent growth',()=>{
  const s=state();const hit=applyCombatInjury(s,{damage:38,sector:'back',sourceId:'ogre'}),before=injuryEffects(s);assert.ok(hit.severity>0);assert.ok(before.attackScale<1||before.movementScale<1||before.judgmentScale<1||before.staminaScale<1);
  const restored=deserializeLife(serializeLife(s));assert.ok(Object.values(restored.injuries).some(row=>row.severity>0));restored.ageSeconds+=240;const after=injuryEffects(restored);assert.ok(after.severity<before.severity);
});

test('combat history never mutates techniques, unlocks skills, or creates inherited power',()=>{
  const s=state(),form={kinds:['parry','counter','thrust'],feet:['stay','stay','chase'],charges:['none','none','none'],rhythm:'sharp',tempo:1};
  s.combatLessons={backHit:9};s.combatLessonRecent={backHit:10};s.techniqueEvolution={'action.counter':{uses:99,hits:99,ha:99}};s.combatLegacy={forms:{'action.counter':{tier:3,uses:99}},lessons:{backHit:9}};
  stripCombatProgressionState(s);assert.equal('combatLessons'in s,false);assert.equal('techniqueEvolution'in s,false);assert.equal('combatLegacy'in s,false);
  assert.deepEqual(recordCombatLesson(s,'backHit'),{recorded:false,unlocked:[],names:[]});assert.equal(techniqueMutationFor(s,'action.counter').tier,0);assert.deepEqual(evolveTechniqueForm(s,'action.counter',form),form);
});

test('enemy squad roles coordinate without capping attackers and repeated patterns trigger only short-term enemy learning',()=>{
  const s=state(),enemies=[enemy('a',0,1),enemy('b',1,1),enemy('c',-1,1),enemy('d',0,2)],f=front(enemies);for(const e of enemies)e.attentionTargetId=s.id;const counts=assignSquadRoles(f,[s]);assert.equal(Object.values(counts).reduce((a,b)=>a+b,0),4);assert.ok(enemies.every(e=>e.squadRole));
  for(let i=0;i<4;i++)recordEnemyPattern(enemies[0],s.id,'action.counter');assert.equal(enemyLearningResponse(enemies[0],s.id).kind,'counter');
});

test('ranged staff uses finite charges, world-space contact, and village rest can resupply',()=>{
  const s=state();s.equipment.weapon='staff';const target=enemy('far',0,4,120),f=front([target]);let events=[];for(let i=0;i<6;i++)tickRangedProjectiles(s,f,.1,events);assert.equal(s.ammo.staffCharges,7);assert.ok(events.some(e=>e.type==='projectile-fired'));assert.ok(target.hp<120);assert.ok(events.some(e=>e.projectile));
  s.zone='village';s.combat=null;s.moving=false;s.resting=true;s.ammo.staffCharges=0;for(let i=0;i<28;i++)tickLife(s,{realDelta:.25,lifeDelta:.25});assert.ok(s.ammo.staffCharges>=1);
});

test('compact combat replay digest is deterministic for the same inputs',()=>{
  const a=state(123),b=state(123),fa=front([enemy('e',0,1)]),fb=front([enemy('e',0,1)]);for(let i=0;i<8;i++){recordCombatReplay(a,fa,.1,[{type:'player-hit',targetId:'e',skill:'basic.sword',phase:'jo',damage:3}]);recordCombatReplay(b,fb,.1,[{type:'player-hit',targetId:'e',skill:'basic.sword',phase:'jo',damage:3}]);}assert.equal(combatReplayDigest(a.combatReplay),combatReplayDigest(b.combatReplay));
});

test('combat evolution deliberately contains neither anti-stunlock rescue nor player progression hooks',async()=>{
  const source=await readFile(new URL('../src/rebuild/combat-evolution-runtime.js',import.meta.url),'utf8');assert.doesNotMatch(source,/attackerCap|stunImmunity|recoveryIFrames|postHitInvulnerability/);
  const growth=await readFile(new URL('../src/rebuild/combat-growth.js',import.meta.url),'utf8');assert.doesNotMatch(growth,/eligibleDiscoveries|techniqueEvolution\[|combatLessons\[/);
});
