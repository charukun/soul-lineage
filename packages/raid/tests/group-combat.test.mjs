import test from 'node:test';
import assert from 'node:assert/strict';
import {RaidSession} from '../group-session.js';
import {RaidSession as SingleRaidSession} from '../session.js';
import {freshProfile} from '../profile.js';
import {makeVillage,villagerBehavior} from '../world.js';

const input={x:0,z:0,amount:0,active:false,dash:false};
function makeSession(){
 const profile=freshProfile('group-combat-test',123);
 const session=new RaidSession({id:'group:test',name:'試験村',seed:921,target:'traveller',raidScale:'small',source:'generated',weather:'fog'},profile,{});
 session.lineBlocked=()=>false;
 session.player.x=0;session.player.z=0;
 for(const [i,npc] of session.village.npcs.entries()){
  npc.x=20+i;npc.z=20;npc.state='idle';npc.dead=false;npc.eaten=false;npc.pose=null;npc.fear=0;
 }
 return session;
}

test('villager behavior separates armed defenders from civilians',()=>{
 for(const role of ['smith','hunter','acolyte','arcanist','knight'])assert.equal(villagerBehavior(role),'fight');
 for(const role of ['traveller','bellkeeper','gravekeeper'])assert.equal(villagerBehavior(role),'flee');
 for(const raidScale of ['small','medium','large']){
  const world=makeVillage({id:`behavior:${raidScale}`,seed:41,target:'traveller',raidScale,source:'generated',weather:'fog'});
  const kinds=new Set(world.npcs.map(n=>n.behavior));
  assert.deepEqual(kinds,new Set(['fight','flee']));
 }
});

test('nearby attacking villagers enter one combat without waiting for the first duel to finish',()=>{
 const session=makeSession(),[a,b,c]=session.village.npcs;
 for(const n of [a,b,c])n.behavior='fight';
 a.x=0;a.z=3.2;b.x=1.1;b.z=3.3;c.x=-1.1;c.z=3.5;
 session.tick(1/60,input);
 assert.ok(session.fight);
 assert.equal(session.combatantCount(),3);
 assert.equal(new Set([session.fight.npc,...session.combatants.map(f=>f.npc)]).size,3);
 assert.ok([a,b,c].every(n=>n.state==='combat'));
});

test('held approach input is suppressed but reversing the same pointer to retreat is immediate',()=>{
 const session=makeSession(),runner=session.village.npcs[0];
 runner.behavior='flee';runner.x=0;runner.z=3.2;
 const approach={x:0,z:1,amount:1,active:true,dash:false};
 session.tick(1/60,approach);
 assert.equal(session.fight?.npc,runner);assert.equal(session.combatInputLatched,true);
 const seen=[],core=session.fight.core,originalInput=core.input.bind(core);
 core.input=(x,z,amount,...rest)=>{seen.push([x,z,amount]);return originalInput(x,z,amount,...rest);};
 session.tick(1/60,approach);
 assert.deepEqual(seen.at(-1),[0,0,0]);assert.equal(session.combatInputLatched,true);
 const retreat={x:0,z:-1,amount:.8,active:true,dash:false};
 session.tick(1/60,retreat);
 assert.deepEqual(seen.at(-1),[0,-1,.8]);assert.equal(session.combatInputLatched,false);
});

test('held retreat stays live when several attackers start combat around the player',()=>{
 const session=makeSession(),[a,b,c]=session.village.npcs;
 for(const n of [a,b,c])n.behavior='fight';
 a.x=0;a.z=3.2;b.x=1.1;b.z=3.3;c.x=-1.1;c.z=3.5;
 const retreat={x:0,z:-1,amount:1,active:true,dash:false};
 session.tick(1/60,retreat);
 assert.equal(session.combatantCount(),3);assert.equal(session.combatInputLatched,false);
 const seen=[],core=session.fight.core,originalInput=core.input.bind(core);
 core.input=(x,z,amount,...rest)=>{seen.push([x,z,amount]);return originalInput(x,z,amount,...rest);};
 session.tick(1/60,retreat);
 assert.deepEqual(seen.at(-1),[0,-1,1]);assert.equal(session.combatInputLatched,false);
});

test('group simulation delegates the same gated input to primary and secondary combat',t=>{
 const session=makeSession(),npc=session.village.npcs[0];
 npc.behavior='fight';npc.x=0;npc.z=3;
 session.engage(npc);session.combatInputLatched=true;
 const primary=[],secondary=[];
 t.mock.method(SingleRaidSession.prototype,'tick',function(dt,value){primary.push({dt,value});});
 t.mock.method(session,'_tickSecondaries',function(dt,value){secondary.push({dt,value});});
 const held={x:0,z:1,amount:1,active:true,dash:true};
 session.tick(1/60,held);
 assert.equal(primary.length,1);assert.equal(secondary.length,1);
 assert.equal(primary[0].dt,1/60);assert.equal(secondary[0].dt,1/60);
 for(const {value} of [primary[0],secondary[0]]){
  assert.deepEqual([value.x,value.z,value.amount,value.active,value.dash],[0,0,0,false,false]);
 }
 assert.deepEqual(held,{x:0,z:1,amount:1,active:true,dash:true});
 session.tick(1/60,input);
 const retreat={x:0,z:-1,amount:.8,active:true,dash:false};
 session.tick(1/60,retreat);
 assert.deepEqual(primary.at(-1).value,retreat);assert.deepEqual(secondary.at(-1).value,retreat);
});

test('attacking villagers rally from outside join range while fleeing villagers keep running',()=>{
 const session=makeSession(),[primary,fighter,runner]=session.village.npcs;
 primary.behavior='fight';fighter.behavior='fight';runner.behavior='flee';
 primary.x=0;primary.z=3;fighter.x=0;fighter.z=8.5;runner.x=1;runner.z=8.2;
 session.engage(primary);session._rallyAggressors();
 assert.equal(fighter.state,'pursue');
 assert.notEqual(runner.state,'pursue');
 session._joinNearby();
 assert.equal(session.combatants.includes(fighter),false);
 assert.equal(session.combatants.includes(runner),false);
});

test('only attacking villagers reinforce an active fight',()=>{
 const session=makeSession(),[primary,fighter,runner]=session.village.npcs;
 primary.behavior='fight';fighter.behavior='fight';runner.behavior='flee';
 primary.x=0;primary.z=3;fighter.x=1;fighter.z=5.5;runner.x=-1;runner.z=3.4;
 session.engage(primary);session._joinNearby();
 assert.equal(session.combatants.some(f=>f.npc===fighter),true);
 assert.equal(session.combatants.some(f=>f.npc===runner),false);
 assert.equal(runner.state,'idle');
});

test('a fleeing villager can still be caught when no other combat is active',()=>{
 const session=makeSession(),runner=session.village.npcs[0];
 runner.behavior='flee';runner.x=0;runner.z=3.2;
 session.tick(1/60,input);
 assert.equal(session.fight?.npc,runner);
});

test('a queued opponent becomes the primary target without dropping combat state',()=>{
 const session=makeSession(),[a,b]=session.village.npcs;
 a.behavior='fight';b.behavior='fight';a.x=0;a.z=3;b.x=1;b.z=3.2;
 session.engage(a);session.engage(b);
 assert.equal(session.fight.npc,a);assert.equal(session.combatantCount(),2);
 session.fight=null;session.devour={npc:a,t:0};a.dead=true;
 const promoted=session.promoteNextCombatant();
 assert.equal(promoted,true);
 assert.equal(session.fight.npc,b);
 assert.equal(session.devour,null);
 assert.equal(session.combatantCount(),1);
 assert.equal(session.safeTime,0);
});

test('only the enemy that leaves the group is released while the main fight continues',()=>{
 const session=makeSession(),[a,b]=session.village.npcs;
 a.behavior='fight';b.behavior='fight';a.x=0;a.z=2.8;b.x=0;b.z=3.2;
 session.engage(a);session.engage(b);
 b.z=9;
 for(let i=0;i<35;i++)session._tickSecondaries(1/30,input);
 assert.equal(session.fight.npc,a);
 assert.equal(session.combatantCount(),1);
 assert.equal(b.state,'pursue');
});
