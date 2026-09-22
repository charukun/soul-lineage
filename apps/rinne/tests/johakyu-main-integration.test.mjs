import test from 'node:test';
import assert from 'node:assert/strict';
import {createLife,serializeLife,deserializeLife,tickLife,rebirth,LIFE_SECONDS,returnHome} from '../src/rebuild/domain.js';
import {createFront,normalizeFront,tickFront} from '../src/rebuild/combat.js';
import {tickFront as tickCoreFront} from '../src/rebuild/combat-core.js';
import {ensureCombatTerrain} from '../src/rebuild/combat-world-contact.js';
import {readRinneBattleFrame,readRinneImpactEvents} from '../src/rebuild/johakyu-presentation-contract.js';
import {createCanonicalPresentationDriver} from '@soul/johakyu-presentation/driver';
import {readSavedBody} from '../src/rebuild/johakyu-save-contract.js';
function scenario(){const state=createLife({seed:73917});Object.assign(state,{id:'fixed-life',ageSeconds:1200,ageYears:20,phase:'living',zone:'frontier',front:0,position:{x:0,z:0},resting:false});state.equipment={weapon:'sword',armor:'heavy',shield:false};state.knownSkills.push('basic.sword');const front=createFront();state.frontState=front;ensureCombatTerrain(front);return {state,front};}
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
test('P5 main presentation is a deep read-only projection, including every enemy and ally',()=>{
  const {state,front}=scenario();const ally=structuredClone(state);ally.id='ally';ally.position={x:1,z:1};
  const before=JSON.stringify({state,front,ally});freeze(state);freeze(ally);
  const snapshot=readRinneBattleFrame(state,front,{peers:[ally],epoch:2,revision:4});
  assert.equal(snapshot.actors.length,5);assert.equal(snapshot.actors.filter(a=>a.self).length,1);assert.equal(snapshot.obstacles.length,2);
  assert.equal(JSON.stringify({state,front,ally}),before);assert.throws(()=>{snapshot.actors[0].hp=0;},TypeError);
});
test('P5 enabling observation cannot change actual approach, injuries, stamina, targeting or result',()=>{
  const a=scenario(),b={state:structuredClone(a.state)};b.front=b.state.frontState;
  const driver=createCanonicalPresentationDriver({supports:()=>({supported:true}),spawn:row=>({id:row.id}),remove:()=>{},update:()=>{}});
  let emitted=0;
  for(let tick=0;tick<180;tick++){
    const ea=tickFront(a.state,a.front,1/60),eb=tickFront(b.state,b.front,1/60);
    assert.deepEqual(ea,eb);emitted+=ea.filter(e=>e.type==='player-hit'||e.type==='enemy-hit').length;
    driver.present(readRinneBattleFrame(b.state,b.front,{epoch:1,revision:tick}),1/60,readRinneImpactEvents(eb,b.state,{batchId:'tick-'+tick}));
    assert.deepEqual(a.state,b.state);
  }
  assert.ok(emitted>0);driver.dispose();
});
test('P5 terrain-blocked core contact cannot apply a hidden body injury before being undone',()=>{
  const {state,front}=scenario();front.enemies=front.enemies.slice(0,1);const enemy=front.enemies[0],z=front.terrain.obstacles[0].z;
  let blocked=0;
  for(let tick=0;tick<240;tick++){
    state.position={x:-3.75,z};enemy.x=-2.75;enemy.z=z;state.moving=false;
    const before=JSON.stringify([state.injuries,enemy.injuries||readSavedBody(null)]),hp=[state.hp,enemy.hp];
    const events=tickCoreFront(state,front,1/60);
    if(events.some(e=>e.type==='weapon-blocked')){blocked++;assert.deepEqual([state.hp,enemy.hp],hp);assert.equal(JSON.stringify([state.injuries,enemy.injuries||readSavedBody(null)]),before);}
  }
  assert.ok(blocked>0,'exercise a real blocked executor contact');
});
test('P6 actual life serialization preserves enemy parts, incapacity and rewards but not stale animation',()=>{
  const {state,front}=scenario();const enemy=front.enemies[0];enemy.injuries=readSavedBody(null);enemy.injuries.leftArm={severity:.71,at:0};enemy.injuries.head={severity:.89,at:0};enemy.hp=0;enemy.downed=true;enemy.tidebreakPose={attack:'heavy',execution:{attackId:'stale'}};
  state.injuries.rightLeg={severity:.43,at:state.ageSeconds};state.defeats=2;state.returns=1;state.combat={targetId:enemy.id,tidebreakPose:{attack:'heavy'},exchange:{mode:'pressure',initiativeId:state.id,responderId:enemy.id,serial:2,pressureCount:4,lastPhase:'ha',lastReason:'guard',continuity:'retain'}};
  const serialized=serializeLife(state),restored=deserializeLife(serialized),resumedFront=normalizeFront(restored.frontState,0);
  assert.equal(resumedFront.enemies[0].injuries.head.severity,.89);assert.equal(resumedFront.enemies[0].injuries.leftArm.severity,.71);assert.equal(resumedFront.enemies[0].downed,true);assert.equal(resumedFront.enemies[0].hp,0);assert.equal(resumedFront.enemies[0].tidebreakPose,null);
  assert.equal(restored.injuries.rightLeg.severity,.43);assert.equal(restored.defeats,2);assert.equal(restored.returns,1);assert.equal(restored.combat.tidebreakPose,undefined);assert.equal(restored.combat.exchange,undefined,'in-flight exchange interpretation must restart from reading after load');
  assert.equal(state.combat.tidebreakPose.attack,'heavy','saving must not mutate live animation');assert.equal(state.combat.exchange.mode,'pressure','saving must not mutate the live exchange');
});
test('P6 corrupted body progress is rejected, and rebirth keeps homeland rather than combat wounds',()=>{
  const {state,front}=scenario();front.enemies[0].injuries={head:{severity:1.5,at:0}};assert.throws(()=>normalizeFront(front,0),/部位/);assert.throws(()=>serializeLife(state),/部位/);front.enemies[0].injuries=readSavedBody(null);
  state.injuries.head.severity=-1;assert.throws(()=>serializeLife(state),/部位/);state.injuries.head.severity=.2;
  returnHome(state);const homeland=state.birthVillageId;state.ageSeconds=LIFE_SECONDS;state.ageYears=100;state.ended=true;state.phase='ended';
  const next=rebirth(state,{villageId:homeland,villageIds:[homeland]});assert.ok(next.homelands.includes(homeland));assert.ok(Object.values(next.injuries).every(row=>row.severity===0));assert.equal(next.equipment.weapon,'fist');assert.equal(next.ageYears,0);
});
test('P6 world rate is never used as presentation/animation progress',()=>{
  const {state,front}=scenario();const raw=structuredClone(state);state.clockRate=20;raw.clockRate=1;
  const before=readRinneBattleFrame(state,front),other=readRinneBattleFrame(raw,raw.frontState);assert.deepEqual(before,other);
  tickLife(state,{realDelta:.1,lifeDelta:.1});assert.equal(state.ageSeconds,1202);
});

test('P5/P6 real coop view carries ally injury/execution, while checkpoints omit transient poses',async()=>{
  const {CoopWorld}=await import('../src/rebuild/coop-world.js');const {defaultMuraLayout}=await import('@soul/world/mura');
  const world=new CoopWorld({worldId:'johakyu-room',ownerId:'owner',name:'本編',layout:defaultMuraLayout()});world.addPlayer('ally','仲間','private-ticket');
  for(const [id,row] of Object.entries(world.data.players)){const fixture=scenario();row.life=fixture.state;row.life.id=id+':1';row.life.front=5;row.life.frontState=null;row.life.injuries.leftArm={severity:.4,at:row.life.ageSeconds};row.life.combat={tidebreakPose:{attack:'slash',execution:{attackId:'attack-1',weapon:'sword',kind:'slash',phase:'ha',stepIndex:0,progress:.4,motionDuration:1}}};}
  world.data.fronts[5]=createFront(5);const view=world.view('owner');assert.equal(view.me.frontState,null);assert.equal(view.peers[0].combat,true);assert.equal(view.peers[0].injuries.leftArm.severity,.4);assert.equal(view.peers[0].hp,world.data.players.ally.life.hp);
  const frame=readRinneBattleFrame(view.me,view.front,{peers:view.peers}),ally=frame.actors.find(row=>row.id==='ally:1');assert.equal(ally.body.leftArm.severity,.4);assert.equal(ally.action.progress,.4);assert.ok(!JSON.stringify(view).includes('private-ticket'));
  const saved=world.save(),restored=new CoopWorld({worldId:'johakyu-room',ownerId:'owner',name:'本編',layout:saved.layout,saved:saved.world});assert.equal(restored.data.epoch,world.data.epoch+1);assert.equal(restored.data.players.ally.life.injuries.leftArm.severity,.4);assert.equal(restored.data.players.ally.life.combat.tidebreakPose,undefined);assert.equal(world.data.players.ally.life.combat.tidebreakPose.attack,'slash');
});

test('P5 secondary contacts use the same six-part authority exactly once per attack/target',async()=>{
  const {applyWorldBodyContact}=await import('../src/rebuild/combat-world-contact.js');const {state,front}=scenario();const enemy=front.enemies[0];
  const hit=applyWorldBodyContact(state,enemy,{attackId:'world-1',damage:10,phase:'ha'});assert.ok(hit.bodyPart);const once=structuredClone(enemy);
  assert.equal(applyWorldBodyContact(state,enemy,{attackId:'world-1',damage:10,phase:'ha'}),null);assert.deepEqual(enemy,once);
  assert.ok(applyWorldBodyContact(state,front.enemies[1],{attackId:'world-1',damage:10,phase:'ha'}));
});

test('P6 projectile contacts cannot be replayed after a real save/restore or carried into the next front',async()=>{
  const {tickRangedProjectiles}=await import('../src/rebuild/combat-world-contact.js');const {advanceFront}=await import('../src/rebuild/domain.js');const {state,front}=scenario();
  state.equipment.weapon='staff';state.ammo.staffCharges=0;const target=front.enemies[0];target.x=0;target.z=1;state.rangedCombat={serial:2,cooldown:0,projectiles:[{id:'p-2',x:0,z:.5,vx:0,vz:8.5,ttl:1,damage:10,targetId:target.id}]};
  const events=[];tickRangedProjectiles(state,front,.1,events);assert.equal(events.filter(e=>e.projectile).length,1);const restored=deserializeLife(serializeLife(state)),resumed=normalizeFront(restored.frontState,0),before=structuredClone(resumed.enemies);const again=[];tickRangedProjectiles(restored,resumed,.1,again);assert.deepEqual(resumed.enemies,before);assert.equal(again.length,0);
  restored.rangedCombat.projectiles=[{id:'unresolved'}];restored.position.z=-5.85;assert.equal(advanceFront(restored),true);assert.deepEqual(restored.rangedCombat.projectiles,[]);assert.equal(restored.rangedCombat.serial,2);
});
