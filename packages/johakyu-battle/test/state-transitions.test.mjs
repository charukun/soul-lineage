import test from 'node:test';
import assert from 'node:assert/strict';
import {createJohakyuBattleRuntime} from '../src/runtime.js';
import {createJohakyuDomainActor} from '@soul/johakyu-combat/domain';
import {presentBattleFrame} from '@soul/johakyu-presentation/battle-presentation';

const actor=(id,side,extra={})=>({...createJohakyuDomainActor({id,side,hp:125,maxHp:125,equipment:{weapon:'sword',armor:'cloth',shield:false}}),position:{x:0,z:side==='party'?0:1.7},stability:.7,mind:'aggressive',staminaMultiplier:.12,readyDelay:0,...extra});
const downed=()=>actor('victim','enemy',{hp:0,downed:true,incapacitated:true});
const create=()=>createJohakyuBattleRuntime({battleId:'transitions',actors:[actor('hero','party',{self:true}),downed()]});
function until(runtime,predicate,limit=480){for(let i=0;i<limit;i++){const result=runtime.step(1/60);if(predicate(result))return result;}assert.fail('transition did not occur');}
const roster=runtime=>runtime.snapshot().actors.map(row=>structuredClone(runtime.actor(row.id)));

test('snapshot observes ground settlement without performing lifecycle transitions',()=>{
 const runtime=create(),victim=runtime.actor('victim');victim.downedAt=-10;
 const before=JSON.stringify(victim),first=runtime.snapshot(),second=runtime.snapshot();
 assert.equal(first.actors.find(a=>a.id==='victim').downedState.phase,'settled');
 assert.deepEqual(second,first);assert.equal(JSON.stringify(victim),before);
 runtime.step(1/60);assert.notEqual(victim.executionLifecycle,'FALLING');
});

test('execution and zanshin hold the weapon even when no live opponent remains',()=>{
 const runtime=create();
 const start=until(runtime,result=>result.events.some(e=>e.type==='finisher-start'));
 const row=start.frame.actors.find(a=>a.id==='hero');
 assert.equal(row.state.phase,'executing');assert.equal(row.state.weapon,'drawn');assert.equal(row.state.rootLocked,true);
 assert.equal(presentBattleFrame(start.frame).actors.find(a=>a.id==='hero').combatReady,true);
 const finish=until(runtime,result=>result.events.some(e=>e.type==='finisher-complete'));
 assert.equal(finish.frame.actors.find(a=>a.id==='hero').state.phase,'zanshin');
 assert.equal(finish.frame.actors.find(a=>a.id==='hero').state.weapon,'drawn');
 until(runtime,result=>result.frame.actors.find(a=>a.id==='hero').state.phase==='idle');
 assert.equal(runtime.snapshot().actors.find(a=>a.id==='hero').state.weapon,'sheathed');
});

test('removing an execution target atomically releases action, socket and movement',()=>{
 const runtime=create();until(runtime,()=>runtime.actor('hero').action?.finisher);
 runtime.sync(roster(runtime).filter(a=>a.id==='hero'));
 const hero=runtime.actor('hero');assert.equal(hero.action,null);assert.equal(hero.executionSocket,null);
 assert.equal(hero.executionLifecycle,'ACTIVE');assert.equal(hero.decision,null);
 const previous={...hero.position};runtime.setMovement('hero',{x:1,z:0});runtime.step(.1);
 assert.ok(hero.position.x>previous.x);assert.equal(runtime.snapshot().actors[0].state.rootLocked,false);
});

test('equipment change during execution cancels the old reservation on both actors',()=>{
 const runtime=create();until(runtime,()=>runtime.actor('hero').action?.finisher);
 const rows=roster(runtime);rows.find(a=>a.id==='hero').equipment.weapon='dagger';runtime.sync(rows);
 assert.equal(runtime.actor('hero').action,null);assert.equal(runtime.actor('hero').executionSocket,null);
 assert.equal(runtime.actor('victim').finisherClaimedBy,null);assert.equal(runtime.actor('victim').finisherClaimAttackId,null);
 assert.equal(runtime.actor('victim').executionLifecycle,'SETTLED');
 const next=until(runtime,result=>result.events.some(e=>e.type==='finisher-start'));
 assert.equal(next.frame.actors.find(a=>a.id==='hero').action.weapon,'dagger');
});

test('cancelling after execution contact keeps the dead victim a corpse',()=>{
 const runtime=create();until(runtime,()=>runtime.actor('victim').dead);
 const rows=roster(runtime);rows.find(a=>a.id==='hero').equipment.weapon='dagger';runtime.sync(rows);
 assert.equal(runtime.actor('victim').dead,true);assert.equal(runtime.actor('victim').executionLifecycle,'CORPSE');
 assert.equal(runtime.actor('victim').finisherClaimedBy,null);
});

test('host recovery cancels the executor and clears stale impulses, queues and claims',()=>{
 const runtime=create();until(runtime,()=>runtime.actor('hero').action?.finisher);
 const victim=runtime.actor('victim');victim.impulseVelocity={x:30,z:-30};victim.queuedInspiration={targetId:'hero'};
 const injuries=Object.fromEntries(Object.keys(victim.injuries).map(part=>[part,{severity:0,at:0}]));
 assert.equal(runtime.recoverActor('victim',{position:{x:3,z:3},injuries}),true);
 assert.equal(runtime.actor('hero').action,null);assert.equal(runtime.actor('hero').executionSocket,null);
 assert.equal(victim.downedAt,null);assert.equal(victim.queuedInspiration,null);assert.deepEqual(victim.impulseVelocity,{x:0,z:0});
 assert.equal(victim.executionLifecycle,'ACTIVE');assert.equal(runtime.snapshot().actors.find(a=>a.id==='victim').downedState,null);
});

test('manual movement takes over an execution approach before the action locks',()=>{
 const runtime=create();until(runtime,()=>runtime.actor('hero').decision?.intent==='execution-approach');
 runtime.setMovement('hero',{x:1,z:0});runtime.step(1/60);
 assert.equal(runtime.actor('hero').executionSocket,null);assert.equal(runtime.actor('victim').finisherClaimedBy,null);
 assert.equal(runtime.actor('hero').moving,true);
});

test('separation never pushes either root outside the world bounds',()=>{
 const bounds={minX:-2,maxX:2,minZ:-2,maxZ:2};
 const runtime=createJohakyuBattleRuntime({battleId:'bounds',bounds,actors:[actor('a','party',{position:{x:-2,z:-2},canAttack:false}),actor('b','party',{position:{x:-2,z:-2},canAttack:false})]});
 for(let i=0;i<240;i++)for(const row of runtime.step(1/60).frame.actors){assert.ok(row.position.x>=-2&&row.position.x<=2);assert.ok(row.position.z>=-2&&row.position.z<=2);}
});

test('spawning opponents do not interrupt zanshin before they are eligible targets',()=>{
 const runtime=create();until(runtime,result=>result.events.some(e=>e.type==='finisher-complete'));
 runtime.sync([...roster(runtime),actor('new','enemy',{spawnSeconds:10,targetId:'hero'})]);
 assert.equal(runtime.step(1/60).frame.actors.find(a=>a.id==='hero').state.phase,'zanshin');
});

test('every semantic event is addressable and removed encounters release their exchange records',()=>{
 const runtime=createJohakyuBattleRuntime({battleId:'events',actors:[actor('hero','party'),actor('enemy','enemy')]});
 const seen=new Set();
 for(let i=0;i<600;i++)for(const event of runtime.step(1/60).events){assert.equal(typeof event.id,'string');assert.ok(!seen.has(event.id));seen.add(event.id);}
 assert.ok(seen.size>0);runtime.sync(roster(runtime).filter(a=>a.id==='hero'));
 assert.equal(runtime.inspect().exchanges.length,0);
});

test('per-frame host sync preserves the executor socket until its finisher completes',()=>{
 const runtime=create();until(runtime,()=>runtime.actor('hero').action?.finisher);
 const socket=structuredClone(runtime.actor('hero').executionSocket);let completed=false;
 for(let i=0;i<180&&!completed;i++){
   runtime.sync(roster(runtime));
   assert.deepEqual(runtime.actor('hero').executionSocket,socket);
   assert.equal(runtime.actor('hero').executionLifecycle,'EXECUTING');
   completed=runtime.step(1/60).events.some(e=>e.type==='finisher-complete');
 }
 assert.ok(completed);assert.equal(runtime.actor('hero').executionSocket,null);
});
