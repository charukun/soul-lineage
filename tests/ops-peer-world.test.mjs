import test from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyPeerWorldRegistry,createPeerWorldRoom,joinPeerWorldRoom,listPeerWorldRooms,readHostEvents,postPeerWorldOffer,
  readGuestEvents,postPeerWorldAnswer,updatePeerWorldTelemetry,publicPeerWorldSnapshot,prunePeerWorldRegistry,
  PEER_WORLD_TTL_MS,
} from '../ops-board/peer-world-registry.mjs';

test('signaling registry exchanges offer and answer without exposing secrets publicly',()=>{
  const t=1_000_000;
  let state=emptyPeerWorldRegistry();
  let step=createPeerWorldRoom(state,{purpose:'standby',worldId:'village-1',hostId:'host-A',label:'Test village',capability:{score:92}},t);state=step.state;const {room,hostToken,inviteToken}=step.result;
  step=joinPeerWorldRoom(state,room.roomId,{inviteToken,peerId:'peer-B',app:'village',hostEligible:true,capability:{score:81}},t+1);state=step.state;const {joinId,guestToken}=step.result;
  step=readHostEvents(state,room.roomId,hostToken,0,t+2);state=step.state;assert.equal(step.result.events[0].type,'join');
  step=postPeerWorldOffer(state,room.roomId,joinId,hostToken,'offer-abcdefghijklmnopqrstuvwxyz',t+3);state=step.state;
  step=readGuestEvents(state,room.roomId,joinId,guestToken,0,t+4);state=step.state;assert.equal(step.result.events[0].type,'offer');
  step=postPeerWorldAnswer(state,room.roomId,joinId,guestToken,'answer-abcdefghijklmnopqrstuvwxyz',t+5);state=step.state;assert.equal(step.result.controller,true);const cursor=step.result.hostCursor;
  step=readHostEvents(state,room.roomId,hostToken,1,t+6);state=step.state;assert.equal(step.result.events.at(-1).type,'answer');
  step=updatePeerWorldTelemetry(state,room.roomId,hostToken,{phase:'open',hostId:'host-A',hostRef:'host-A',hostScore:92,peers:2,epoch:3,checkpointRevision:18,quorum:{acked:2,total:2},migrationMs:1400,sloPass:true,splitBrainPrevented:1},t+7);state=step.state;
  const published=publicPeerWorldSnapshot(state,t+8);assert.equal(published.counts.rooms,1);assert.equal(published.rooms[0].checkpointRevision,18);assert.equal(published.rooms[0].lastMigrationMs,1400);assert.equal(JSON.stringify(published).includes(hostToken),false);assert.equal(JSON.stringify(published).includes(guestToken),false);assert.equal(JSON.stringify(published).includes('offer-abcdefghijklmnopqrstuvwxyz'),false);assert.ok(cursor>=2);
});

test('answered host-eligible standby can control signaling after authority migration',()=>{
  const t=3_000_000;let state=emptyPeerWorldRegistry();let step=createPeerWorldRoom(state,{purpose:'standby',worldId:'village-3',hostId:'host-A'},t);state=step.state;const {room,hostToken,inviteToken}=step.result;
  step=joinPeerWorldRoom(state,room.roomId,{inviteToken,peerId:'peer-B-abcdef',app:'village',hostEligible:true},t+1);state=step.state;const {joinId,guestToken}=step.result;
  step=postPeerWorldOffer(state,room.roomId,joinId,hostToken,'offer-abcdefghijklmnopqrstuvwxyz',t+2);state=step.state;
  step=postPeerWorldAnswer(state,room.roomId,joinId,guestToken,'answer-abcdefghijklmnopqrstuvwxyz',t+3);state=step.state;const cursor=step.result.hostCursor;
  step=readHostEvents(state,room.roomId,guestToken,cursor,t+4);state=step.state;assert.deepEqual(step.result.events,[]);
  step=updatePeerWorldTelemetry(state,room.roomId,guestToken,{phase:'open',hostId:'peer-B-abcdef',hostRef:'peer-B-a',hostScore:88,peers:2,epoch:2,checkpointRevision:9,quorum:{acked:2,total:2}},t+5);state=step.state;
  assert.equal(publicPeerWorldSnapshot(state,t+6).rooms[0].hostRef,'peer-B-a');
  let guest=joinPeerWorldRoom(state,room.roomId,{inviteToken,peerId:'peer-C',app:'village',hostEligible:true},t+7);state=guest.state;
  step=readHostEvents(state,room.roomId,guestToken,cursor,t+8);state=step.state;assert.equal(step.result.events.at(-1).peerId,'peer-C');
  assert.throws(()=>updatePeerWorldTelemetry(state,room.roomId,guest.result.guestToken,{phase:'open',hostRef:'peer-C'},t+9),/unauthorized/);
});

test('non-host-eligible guest never receives signaling controller authority',()=>{
  const t=4_000_000;let state=emptyPeerWorldRegistry();let step=createPeerWorldRoom(state,{worldId:'village-4',hostId:'host-A'},t);state=step.state;const {room,hostToken,inviteToken}=step.result;
  step=joinPeerWorldRoom(state,room.roomId,{inviteToken,peerId:'rinne-client',app:'rinne',hostEligible:false},t+1);state=step.state;const {joinId,guestToken}=step.result;
  step=postPeerWorldOffer(state,room.roomId,joinId,hostToken,'offer-abcdefghijklmnopqrstuvwxyz',t+2);state=step.state;
  step=postPeerWorldAnswer(state,room.roomId,joinId,guestToken,'answer-abcdefghijklmnopqrstuvwxyz',t+3);state=step.state;assert.equal(step.result.controller,false);
  assert.throws(()=>readHostEvents(state,room.roomId,guestToken,0,t+4),/unauthorized/);
});

test('signaling state expires and wrong tokens fail closed',()=>{
  const t=2_000_000;let state=emptyPeerWorldRegistry();let step=createPeerWorldRoom(state,{worldId:'village-2',hostId:'host-X'},t);state=step.state;const {room,hostToken,inviteToken}=step.result;
  assert.throws(()=>readHostEvents(state,room.roomId,'wrong',0,t+1),/unauthorized/);
  assert.equal(publicPeerWorldSnapshot(state,t+PEER_WORLD_TTL_MS+1).rooms.length,0);
  assert.equal(Object.keys(prunePeerWorldRegistry(state,t+PEER_WORLD_TTL_MS+1).rooms).length,0);
  assert.ok(hostToken.length>32);
});


test('private rooms require an invitation and never appear in public discovery',()=>{
 const t=5_000_000;
 const created=createPeerWorldRoom(emptyPeerWorldRegistry(),{worldId:'private-world',hostId:'owner',label:'Private name'},t);
 const {state,result:{room,hostToken,inviteToken}}=created;
 assert.throws(()=>joinPeerWorldRoom(state,room.roomId,{peerId:'stranger'},t+1),/unauthorized/);
 assert.throws(()=>joinPeerWorldRoom(state,room.roomId,{peerId:'stranger',inviteToken:'wrong'},t+1),/unauthorized/);
 assert.deepEqual(listPeerWorldRooms(state,t+1).result.rooms,[]);
 const publicText=JSON.stringify(publicPeerWorldSnapshot(state,t+1));
 for(const secret of [room.roomId,'private-world','Private name',hostToken,inviteToken])assert.equal(publicText.includes(secret),false);
 assert.throws(()=>joinPeerWorldRoom(state,room.roomId,{peerId:'visitor',app:'village',hostEligible:true,inviteToken},t+1),/host_eligibility_forbidden/);
 const joined=joinPeerWorldRoom(state,room.roomId,{peerId:'visitor',app:'village',hostEligible:false,inviteToken},t+2);
 assert.equal(joined.state.rooms[room.roomId].joins[joined.result.joinId].hostEligible,false);
 assert.throws(()=>readHostEvents(state,room.roomId,joined.result.guestToken,0,t+3),/unauthorized/);
});

test('an answer requires an owner offer and cannot grant control after validation failure',()=>{
 const t=6_000_000;
 const {state,result:{room,hostToken,inviteToken}}=createPeerWorldRoom(emptyPeerWorldRegistry(),{purpose:'standby',worldId:'w',hostId:'owner'},t);
 const {result:{joinId,guestToken}}=joinPeerWorldRoom(state,room.roomId,{peerId:'candidate',app:'village',hostEligible:true,inviteToken},t+1);
 assert.throws(()=>postPeerWorldAnswer(state,room.roomId,joinId,guestToken,'answer-12345678',t+2),/offer_required/);
 assert.throws(()=>readHostEvents(state,room.roomId,guestToken,0,t+3),/unauthorized/);
 postPeerWorldOffer(state,room.roomId,joinId,hostToken,'offer-12345678',t+4);
 assert.throws(()=>postPeerWorldAnswer(state,room.roomId,joinId,guestToken,'bad',t+5),/invalid_signal/);
 assert.throws(()=>readHostEvents(state,room.roomId,guestToken,0,t+6),/unauthorized/);
});


test('signaling capability metadata cannot persist game checkpoints or save data',()=>{
 const {state,result:{room,inviteToken}}=createPeerWorldRoom(emptyPeerWorldRegistry(),{worldId:'private',hostId:'owner',capability:{score:90,checkpoint:{secret:'world'},save:{secret:'personal'}}},7_000_000);
 joinPeerWorldRoom(state,room.roomId,{inviteToken,peerId:'visitor',capability:{score:80,world:{secret:'world'},inventory:['private']}},7_000_001);
 assert.deepEqual(state.rooms[room.roomId].capability,{score:90});
 assert.deepEqual(Object.values(state.rooms[room.roomId].joins)[0].capability,{score:80});
});
