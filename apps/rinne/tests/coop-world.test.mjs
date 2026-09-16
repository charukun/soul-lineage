import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultMuraLayout } from '@soul/world/mura';
import { CoopWorld, COOP_LIMIT, COOP_PROTOCOL } from '../src/rebuild/coop-world.js';
import { createLife, LIFE_SECONDS } from '../src/rebuild/domain.js';
import { createFront, tickSharedFront } from '../src/rebuild/combat.js';
import { createRoomWire, invitationUrl, readInvitation } from '../src/coop/wire.js';

const world=()=>new CoopWorld({worldId:'room-test',ownerId:'owner',name:'村長',layout:defaultMuraLayout()});
const adult=(id,x=0)=>{const life=createLife({name:id,seed:7});life.id=id;life.phase='living';life.ageYears=20;life.ageSeconds=1200;life.zone='frontier';life.position={x,z:0};life.yaw=Math.PI/2;life.equipment.weapon='sword';return life;};

test('shared room has 30 independent lives, bounded input and one owner clock',()=>{
  const room=world();for(let i=1;i<COOP_LIMIT;i++)room.addPlayer(`p${i}`,`友${i}`,`secret${i}`);
  assert.throws(()=>room.addPlayer('overflow','extra','token'));
  assert.throws(()=>room.setRate('p1',20));room.setRate('owner',20);room.advance(.05);
  assert.equal(room.data.worldSeconds,1);assert(Object.values(room.data.players).every(row=>row.life.ageSeconds===1));
  assert.equal(room.acceptInput('p1',{seq:1,x:999,z:0}),false);
  assert.equal(room.acceptInput('p1',{seq:1,x:0,z:1}),true);
  assert.equal(room.acceptInput('p1',{seq:1,x:0,z:1}),false);
  assert.equal(room.acceptInput('stranger',{seq:1,x:0,z:0}),false);
});
test('stale held movement expires and observation has no guest tickets or other histories',()=>{
  const room=world();room.addPlayer('friend','友達','private-reconnect-ticket');
  room.data.players.friend.life.position={x:0,z:0};room.acceptInput('friend',{seq:1,x:0,z:1});
  for(let i=0;i<12;i++)room.advance(.05);const stopped=structuredClone(room.data.players.friend.life.position);
  for(let i=0;i<5;i++)room.advance(.05);assert.deepEqual(room.data.players.friend.life.position,stopped);
  const view=room.view('owner');assert.equal(view.peers.length,1);assert(!JSON.stringify(view).includes('private-reconnect-ticket'));assert(!Object.hasOwn(view.peers[0],'history'));
});
test('30 players share one enemy HP and one timer advancement',()=>{
  const states=Array.from({length:30},(_,i)=>adult(`p${String(i).padStart(2,'0')}`,i*.001));
  const front=createFront();front.enemies.forEach((enemy,i)=>{enemy.x=i===0?.8:6;enemy.z=i===0?0:-5;enemy.cooldown=10;});
  tickSharedFront(states,front,.05);
  assert.equal(front.enemies[1].cooldown,9.95);assert.equal(front.enemies[0].hp,0);
  assert.equal(states.reduce((n,s)=>n+s.defeats,0),1,'one shared enemy grants one defeat');
  const one=createFront(),two=structuredClone(one),left=states.map(s=>adult(s.id)),right=left.map(s=>structuredClone(s));
  for(let tick=0;tick<50;tick++){tickSharedFront(left,one,.05);tickSharedFront([...right].reverse(),two,.05);}
  assert.deepEqual(one,two);assert.deepEqual(left,right,'network arrival order cannot reorder the actors');
});
test('saved room restores all frontier timers, ancestry and stable participant identity',()=>{
  const room=world();room.addPlayer('friend','友達','resume-secret');room.data.players.friend.life=adult('friend:1');
  for(let i=0;i<15;i++)room.advance(.05);const saved=room.save();const restored=new CoopWorld({worldId:'room-test',ownerId:'owner',layout:saved.layout,saved:saved.world});
  assert.equal(restored.data.epoch,2);assert.equal(restored.data.players.friend.token,'resume-secret');
  for(let i=0;i<30;i++){room.advance(.05);restored.advance(.05);}
  const a=room.save().world,b=restored.save().world;a.epoch=b.epoch;assert.deepEqual(a,b);
  restored.data.players.owner.life.ageSeconds=LIFE_SECONDS-.01;restored.data.players.owner.life.ageYears=99.99;restored.advance(.05);
  assert(restored.data.players.owner.life.ended);assert(restored.dirtyHistory);assert(restored.rebirth('owner',null));assert.equal(restored.rebirth('owner',null),false);assert.equal(restored.data.players.owner.life.lineage.length,1);
});
test('wire assembles Unicode frames, rejects oversized parts and drops superseded frames',()=>{
  const received=[],wire=createRoomWire(m=>received.push(m)),frames=[],sender=createRoomWire(()=>{}),connection={channel:{readyState:'open',bufferedAmount:0},send:m=>frames.push(m)};
  const body={text:'輪廻転焦'.repeat(5000)};sender.send(connection,body);frames.reverse().forEach(wire.receive);assert.deepEqual(received,[body]);
  frames.forEach(wire.receive);assert.equal(received.length,1);
  assert.equal(wire.receive({type:'coop-part',id:9,part:0,total:129,data:'x'}),false);
  assert.equal(wire.receive({type:'coop-part',id:9,part:0,total:1,data:'x'.repeat(4001)}),false);
});
test('invitation uses a private fragment with expiration',()=>{
  const invite={protocol:COOP_PROTOCOL,worldId:'room-1',offer:'sdp',expiresAt:Date.now()+60000};
  const url=invitationUrl('https://example.test/dev/rinne/',invite);assert.equal(new URL(url).search,'');assert.deepEqual(readInvitation(url),invite);assert.deepEqual(readInvitation(new URL(url).hash),invite);assert.throws(()=>readInvitation(url,invite.expiresAt));
});
