import test from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyPeerWorldRegistry,createPeerWorldRoom,joinPeerWorldRoom,readHostEvents,postPeerWorldOffer,
  readGuestEvents,postPeerWorldAnswer,updatePeerWorldTelemetry,publicPeerWorldSnapshot,prunePeerWorldRegistry,
  PEER_WORLD_TTL_MS,
} from '../ops-board/peer-world-registry.mjs';

test('signaling registry exchanges offer and answer without exposing secrets publicly',()=>{
  const t=1_000_000;
  let state=emptyPeerWorldRegistry();
  let step=createPeerWorldRoom(state,{worldId:'village-1',hostId:'host-A',label:'Test village',capability:{score:92}},t);state=step.state;const {room,hostToken}=step.result;
  step=joinPeerWorldRoom(state,room.roomId,{peerId:'peer-B',app:'village',capability:{score:81}},t+1);state=step.state;const {joinId,guestToken}=step.result;
  step=readHostEvents(state,room.roomId,hostToken,0,t+2);state=step.state;assert.equal(step.result.events[0].type,'join');
  step=postPeerWorldOffer(state,room.roomId,joinId,hostToken,'offer-abcdefghijklmnopqrstuvwxyz',t+3);state=step.state;
  step=readGuestEvents(state,room.roomId,joinId,guestToken,0,t+4);state=step.state;assert.equal(step.result.events[0].type,'offer');
  step=postPeerWorldAnswer(state,room.roomId,joinId,guestToken,'answer-abcdefghijklmnopqrstuvwxyz',t+5);state=step.state;
  step=readHostEvents(state,room.roomId,hostToken,1,t+6);state=step.state;assert.equal(step.result.events.at(-1).type,'answer');
  step=updatePeerWorldTelemetry(state,room.roomId,hostToken,{phase:'open',hostRef:'host-A',hostScore:92,peers:2,epoch:3,checkpointRevision:18,quorum:{acked:2,total:2},migrationMs:1400,sloPass:true,splitBrainPrevented:1},t+7);state=step.state;
  const published=publicPeerWorldSnapshot(state,t+8);assert.equal(published.counts.rooms,1);assert.equal(published.rooms[0].checkpointRevision,18);assert.equal(published.rooms[0].lastMigrationMs,1400);assert.equal(JSON.stringify(published).includes(hostToken),false);assert.equal(JSON.stringify(published).includes(guestToken),false);assert.equal(JSON.stringify(published).includes('offer-abcdefghijklmnopqrstuvwxyz'),false);
});

test('signaling state expires and wrong tokens fail closed',()=>{
  const t=2_000_000;let state=emptyPeerWorldRegistry();let step=createPeerWorldRoom(state,{worldId:'village-2',hostId:'host-X'},t);state=step.state;const {room,hostToken}=step.result;
  assert.throws(()=>readHostEvents(state,room.roomId,'wrong',0,t+1),/unauthorized/);
  assert.equal(publicPeerWorldSnapshot(state,t+PEER_WORLD_TTL_MS+1).rooms.length,0);
  assert.equal(Object.keys(prunePeerWorldRegistry(state,t+PEER_WORLD_TTL_MS+1).rooms).length,0);
  assert.ok(hostToken.length>32);
});
