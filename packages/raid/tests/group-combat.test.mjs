import test from 'node:test';
import assert from 'node:assert/strict';
import {RaidSession} from '../group-session.js';
import {freshProfile} from '../profile.js';

const input={x:0,z:0,amount:0,active:false,dash:false};
function makeSession(){
 const profile=freshProfile('group-combat-test',123);
 const session=new RaidSession({id:'group:test',name:'試験村',seed:921,target:'traveller',raidScale:'small',source:'generated',weather:'fog'},profile,{});
 session.lineBlocked=()=>false;
 session.player.x=0;session.player.z=0;
 for(const [i,npc] of session.village.npcs.entries()){
  npc.x=20+i;npc.z=20;npc.state='idle';npc.dead=false;npc.eaten=false;npc.pose=null;
 }
 return session;
}

test('nearby enemies enter one combat without waiting for the first duel to finish',()=>{
 const session=makeSession(),[a,b,c]=session.village.npcs;
 a.x=0;a.z=3.2;b.x=1.1;b.z=3.3;c.x=-1.1;c.z=3.5;
 session.tick(1/60,input);
 assert.ok(session.fight);
 assert.equal(session.combatantCount(),3);
 assert.equal(new Set([session.fight.npc,...session.combatants.map(f=>f.npc)]).size,3);
 assert.ok([a,b,c].every(n=>n.state==='combat'));
});

test('a queued opponent becomes the primary target without dropping combat state',()=>{
 const session=makeSession(),[a,b]=session.village.npcs;
 a.x=0;a.z=3;b.x=1;b.z=3.2;
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
 a.x=0;a.z=2.8;b.x=0;b.z=3.2;
 session.engage(a);session.engage(b);
 b.z=9;
 for(let i=0;i<35;i++)session._tickSecondaries(1/30,input);
 assert.equal(session.fight.npc,a);
 assert.equal(session.combatantCount(),1);
 assert.equal(b.state,'pursue');
});
