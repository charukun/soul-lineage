import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createLife} from '../src/rebuild/domain.js';
import {applyCombatInjury,injuryEffects,noteTechniqueUse,techniqueMutationFor,evolveTechniqueForm} from '../src/rebuild/combat-growth.js';
import {applyMultiTargetContact,ensureCombatTerrain,lineBlocked,tickRangedProjectiles} from '../src/rebuild/combat-world-contact.js';
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

test('combat terrain blocks movement and line of fire through visible-contract cover',()=>{
  const f=front([]);const terrain=ensureCombatTerrain(f),cover=terrain.obstacles[0],a={x:cover.x-2,z:cover.z},b={x:cover.x+2,z:cover.z};assert.equal(lineBlocked(f,a,b),true);
});

test('injuries persist, affect body capabilities, and heal with elapsed life time',()=>{
  const s=state();const hit=applyCombatInjury(s,{damage:38,sector:'back',sourceId:'ogre'}),before=injuryEffects(s);assert.ok(hit.severity>0);assert.ok(before.attackScale<1||before.movementScale<1||before.judgmentScale<1||before.staminaScale<1);
  s.ageSeconds+=240;const after=injuryEffects(s);assert.ok(after.severity<before.severity);
});

test('repeated lived technique use mutates footwork rhythm and charge without changing the skill id',()=>{
  const s=state();for(let i=0;i<36;i++)noteTechniqueUse(s,'action.counter',{phase:i%3===0?'kyu':'ha',hit:true});const mutation=techniqueMutationFor(s,'action.counter');assert.equal(mutation.tier,3);
  const form=evolveTechniqueForm(s,'action.counter',{kinds:['parry','counter','thrust'],feet:['stay','stay','chase'],charges:['none','none','none'],rhythm:'sharp',tempo:1});assert.equal(form.kinds.length,3);assert.notDeepEqual(form.feet,['stay','stay','chase']);assert.ok(form.tempo!==1||form.rhythm!=='sharp'||form.charges.some(x=>x!=='none'));
});

test('enemy squad roles coordinate without capping attackers and repeated patterns trigger learning',()=>{
  const s=state(),enemies=[enemy('a',0,1),enemy('b',1,1),enemy('c',-1,1),enemy('d',0,2)],f=front(enemies);for(const e of enemies)e.attentionTargetId=s.id;const counts=assignSquadRoles(f,[s]);assert.equal(Object.values(counts).reduce((a,b)=>a+b,0),4);assert.ok(enemies.every(e=>e.squadRole));
  for(let i=0;i<4;i++)recordEnemyPattern(enemies[0],s.id,'action.counter');assert.equal(enemyLearningResponse(enemies[0],s.id).kind,'counter');
});

test('ranged staff uses finite charges and world-space projectile contact',()=>{
  const s=state();s.equipment.weapon='staff';const target=enemy('far',0,4,120),f=front([target]);let events=[];for(let i=0;i<12;i++)tickRangedProjectiles(s,f,.1,events);assert.equal(s.ammo.staffCharges,7);assert.ok(events.some(e=>e.type==='projectile-fired'));assert.ok(target.hp<120);assert.ok(events.some(e=>e.projectile));
});

test('compact combat replay digest is deterministic for the same inputs',()=>{
  const a=state(123),b=state(123),fa=front([enemy('e',0,1)]),fb=front([enemy('e',0,1)]);for(let i=0;i<8;i++){recordCombatReplay(a,fa,.1,[{type:'player-hit',targetId:'e',skill:'basic.sword',phase:'jo',damage:3}]);recordCombatReplay(b,fb,.1,[{type:'player-hit',targetId:'e',skill:'basic.sword',phase:'jo',damage:3}]);}assert.equal(combatReplayDigest(a.combatReplay),combatReplayDigest(b.combatReplay));
});

test('combat evolution deliberately contains no anti-stunlock rescue gate',async()=>{
  const source=await readFile(new URL('../src/rebuild/combat-evolution-runtime.js',import.meta.url),'utf8');assert.doesNotMatch(source,/attackerCap|stunImmunity|recoveryIFrames|postHitInvulnerability/);
});
