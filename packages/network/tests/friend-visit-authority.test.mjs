import test from 'node:test';
import assert from 'node:assert/strict';
import {createFriendVisitHost,createFriendVisitGuest} from '../src/friend-visit-authority.js';

function pair(){
  let time=0;
  const toGuest=[],toHost=[],phases=[];
  const host=createFriendVisitHost({worldId:'v',selfId:'a',now:()=>time,send:m=>toGuest.push(m)});
  const welcome=host.admit('b');
  const guest=createFriendVisitGuest({welcome,worldId:'v',selfId:'b',now:()=>time,send:m=>toHost.push(m),onPhase:info=>phases.push(info.phase)});
  return {host,guest,welcome,phases,toGuest,toHost,
    advance(ms,{deliver=true}={}){time+=ms;host.tick();guest.tick();if(deliver){while(toGuest.length)guest.receive(toGuest.shift());while(toHost.length)host.receive(toHost.shift());}},
  };
}

test('invited visitor acknowledges the live owner without receiving a private checkpoint',()=>{
  const f=pair();
  for(let i=0;i<30;i++)f.advance(250);
  assert.equal(f.host.snapshot().phase,'open');
  assert.equal(f.guest.snapshot().phase,'open');
  assert.equal(f.guest.snapshot().hostId,'a');
  assert.equal(f.guest.snapshot().hostEligible,false);
  assert.equal(f.welcome.authority.members.b.eligible,false);
  assert.equal(f.guest.snapshot().checkpointRevision,0);
  assert.throws(()=>f.host.admit('c'),/already been used/);
});

test('a partition closes friend viewing and never promotes the read-only visitor',()=>{
  const f=pair();f.advance(250);
  for(let i=0;i<60;i++)f.advance(250,{deliver:false});
  assert.equal(f.guest.snapshot().phase,'closed');
  assert.notEqual(f.guest.snapshot().hostId,'b');
  assert.notEqual(f.host.snapshot().phase,'open');
  assert.ok(f.phases.includes('closed'));
});

test('friend authority refuses checkpoint, ownership, world and identity injection',()=>{
  const f=pair(),before=f.guest.snapshot();
  for(const type of ['world-checkpoint','world-handoff-grant','world-migration-open']){
    assert.equal(f.guest.receive({type:'friend-world',payload:{type,worldId:'v'}}),false);
    assert.equal(f.host.receive({type:'friend-world',payload:{type,worldId:'v'}}),false);
  }
  assert.equal(f.guest.receive({type:'friend-world',payload:{type:'world-heartbeat',worldId:'another',hostId:'a',epoch:1}}),false);
  assert.deepEqual(f.guest.snapshot(),before);
  const elevated=structuredClone(f.welcome);elevated.authority.members.b.eligible=true;
  assert.throws(()=>createFriendVisitGuest({welcome:elevated,worldId:'v',selfId:'b'}),/Invalid friend visit/);
  assert.throws(()=>createFriendVisitGuest({welcome:f.welcome,worldId:'other',selfId:'b'}),/does not match/);
  assert.throws(()=>createFriendVisitGuest({welcome:f.welcome,worldId:'v',selfId:'other'}),/does not match/);
});
