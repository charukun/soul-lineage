export const PEER_WORLD_REGISTRY_KEY='peer-world-registry-v1';
export const PEER_WORLD_TTL_MS=10*60*1000;
const MAX_ROOMS=48,MAX_JOINS=16,MAX_EVENTS=64,MAX_SIGNAL=96_000;
const clone=value=>structuredClone(value);
const text=(value,max=96)=>String(value??'').trim().slice(0,max);
const integer=(value,min=0,max=Number.MAX_SAFE_INTEGER)=>Math.min(max,Math.max(min,Math.trunc(Number(value)||0)));
const token=()=>crypto.randomUUID().replaceAll('-','')+crypto.randomUUID().replaceAll('-','');
const roomId=()=>crypto.randomUUID().replaceAll('-','').slice(0,14);
const event=(room,type,payload={})=>{const row={seq:++room.nextSeq,type,at:new Date().toISOString(),...payload};room.hostEvents.push(row);if(room.hostEvents.length>MAX_EVENTS)room.hostEvents.splice(0,room.hostEvents.length-MAX_EVENTS);return row;};
const guestEvent=(room,join,type,payload={})=>{const row={seq:++room.nextSeq,type,at:new Date().toISOString(),...payload};join.events.push(row);if(join.events.length>MAX_EVENTS)join.events.splice(0,join.events.length-MAX_EVENTS);return row;};
const validSignal=value=>{if(typeof value!=='string'||value.length<8||value.length>MAX_SIGNAL)throw new Error('invalid_signal');return value;};
export function emptyPeerWorldRegistry(){return{version:1,rooms:{}};}
export function normalizePeerWorldRegistry(value){return value?.version===1&&value.rooms&&typeof value.rooms==='object'&&!Array.isArray(value.rooms)?value:emptyPeerWorldRegistry();}
export function prunePeerWorldRegistry(value,now=Date.now()){
  const state=normalizePeerWorldRegistry(value);for(const[id,room]of Object.entries(state.rooms))if(!Number.isFinite(room.expiresAt)||room.expiresAt<=now)delete state.rooms[id];return state;
}
function publicRoom(room){return{roomId:room.roomId,worldId:room.worldId,label:room.label,phase:room.telemetry?.phase||'open',peers:integer(room.telemetry?.peers,Object.keys(room.joins||{}).length+1,999),hostRef:text(room.telemetry?.hostRef||room.hostId,12),hostScore:Number.isFinite(room.telemetry?.hostScore)?integer(room.telemetry.hostScore,0,110):Number.isFinite(room.capability?.score)?integer(room.capability.score,0,110):null,checkpointRevision:integer(room.telemetry?.checkpointRevision,0),epoch:integer(room.telemetry?.epoch,1),quorum:room.telemetry?.quorum||null,lastMigrationMs:Number.isFinite(room.telemetry?.migrationMs)?Math.round(room.telemetry.migrationMs):null,detectionMs:Number.isFinite(room.telemetry?.detectionMs)?Math.round(room.telemetry.detectionMs):null,sloPass:room.telemetry?.sloPass!==false,splitBrainPrevented:integer(room.telemetry?.splitBrainPrevented,0),updatedAt:room.updatedAt,expiresAt:new Date(room.expiresAt).toISOString()};}
export function publicPeerWorldSnapshot(value,now=Date.now()){
  const state=prunePeerWorldRegistry(value,now),rooms=Object.values(state.rooms).map(publicRoom).sort((a,b)=>Date.parse(b.updatedAt)-Date.parse(a.updatedAt));
  return{available:true,generatedAt:new Date(now).toISOString(),counts:{rooms:rooms.length,open:rooms.filter(r=>r.phase==='open').length,migrating:rooms.filter(r=>r.phase==='migrating').length,closed:rooms.filter(r=>r.phase==='closed').length,sloViolations:rooms.filter(r=>r.sloPass===false).length,peers:rooms.reduce((n,r)=>n+r.peers,0)},rooms};
}
export function createPeerWorldRoom(value,input={},now=Date.now()){
  const state=prunePeerWorldRegistry(value,now);if(Object.keys(state.rooms).length>=MAX_ROOMS)throw new Error('room_limit');
  const id=roomId(),hostToken=token(),worldId=text(input.worldId,96),hostId=text(input.hostId,128);if(!worldId||!hostId)throw new Error('invalid_room');
  const room={roomId:id,worldId,label:text(input.label||'共通村',64),hostId,hostToken,capability:clone(input.capability||null),createdAt:new Date(now).toISOString(),updatedAt:new Date(now).toISOString(),expiresAt:now+PEER_WORLD_TTL_MS,nextSeq:0,hostEvents:[],joins:{},telemetry:{phase:'open',peers:1,epoch:1,checkpointRevision:0,sloPass:true,splitBrainPrevented:0}};state.rooms[id]=room;return{state,result:{room:publicRoom(room),hostToken}};
}
function getRoom(state,id,now=Date.now()){prunePeerWorldRegistry(state,now);const room=state.rooms[text(id,32)];if(!room)throw new Error('room_not_found');return room;}
function touch(room,now){room.updatedAt=new Date(now).toISOString();room.expiresAt=now+PEER_WORLD_TTL_MS;}
function controllerJoin(room,auth){return Object.values(room.joins||{}).find(join=>join.guestToken===auth&&join.hostEligible===true&&join.answeredAt)||null;}
function assertHost(room,auth){if(!auth||auth!==room.hostToken)throw new Error('unauthorized');}
function assertController(room,auth){if(auth&&auth===room.hostToken)return null;const join=controllerJoin(room,auth);if(!join)throw new Error('unauthorized');return join;}
function assertGuest(join,auth){if(!auth||auth!==join?.guestToken)throw new Error('unauthorized');}
export function listPeerWorldRooms(value,now=Date.now()){return{state:prunePeerWorldRegistry(value,now),result:{rooms:publicPeerWorldSnapshot(value,now).rooms}};}
export function joinPeerWorldRoom(value,id,input={},now=Date.now()){
  const state=prunePeerWorldRegistry(value,now),room=getRoom(state,id,now);if(Object.keys(room.joins).length>=MAX_JOINS)throw new Error('join_limit');
  const peerId=text(input.peerId,128);if(!peerId)throw new Error('invalid_peer');const joinId=roomId(),guestToken=token();room.joins[joinId]={joinId,peerId,app:text(input.app||'village',24),hostEligible:input.hostEligible===true,guestToken,capability:clone(input.capability||null),events:[],createdAt:new Date(now).toISOString(),answeredAt:null};event(room,'join',{joinId,peerId,app:room.joins[joinId].app,hostEligible:room.joins[joinId].hostEligible,capability:room.joins[joinId].capability});touch(room,now);return{state,result:{joinId,guestToken,room:publicRoom(room)}};
}
export function readHostEvents(value,id,auth,after=0,now=Date.now()){
  const state=prunePeerWorldRegistry(value,now),room=getRoom(state,id,now);assertController(room,auth);touch(room,now);const events=room.hostEvents.filter(row=>row.seq>integer(after));return{state,result:{events,next:events.at(-1)?.seq??integer(after)}};
}
export function postPeerWorldOffer(value,id,joinId,auth,offer,now=Date.now()){
  const state=prunePeerWorldRegistry(value,now),room=getRoom(state,id,now);assertController(room,auth);const join=room.joins[text(joinId,32)];if(!join)throw new Error('join_not_found');guestEvent(room,join,'offer',{offer:validSignal(offer)});touch(room,now);return{state,result:{accepted:true}};
}
export function readGuestEvents(value,id,joinId,auth,after=0,now=Date.now()){
  const state=prunePeerWorldRegistry(value,now),room=getRoom(state,id,now),join=room.joins[text(joinId,32)];if(!join)throw new Error('join_not_found');assertGuest(join,auth);touch(room,now);const events=join.events.filter(row=>row.seq>integer(after));return{state,result:{events,next:events.at(-1)?.seq??integer(after)}};
}
export function postPeerWorldAnswer(value,id,joinId,auth,answer,now=Date.now()){
  const state=prunePeerWorldRegistry(value,now),room=getRoom(state,id,now),join=room.joins[text(joinId,32)];if(!join)throw new Error('join_not_found');assertGuest(join,auth);join.answeredAt=new Date(now).toISOString();event(room,'answer',{joinId:join.joinId,peerId:join.peerId,answer:validSignal(answer)});touch(room,now);return{state,result:{accepted:true,hostCursor:room.nextSeq,controller:join.hostEligible===true}};
}
export function updatePeerWorldTelemetry(value,id,auth,input={},now=Date.now()){
  const state=prunePeerWorldRegistry(value,now),room=getRoom(state,id,now);const controller=assertController(room,auth);const phase=['open','migrating','closed'].includes(input.phase)?input.phase:'open';
  if(controller&&text(input.hostRef,12)&&!controller.peerId.startsWith(text(input.hostRef,12)))throw new Error('controller_host_mismatch');
  room.telemetry={phase,hostRef:text(input.hostRef||room.hostId,12),hostScore:Number.isFinite(input.hostScore)?integer(input.hostScore,0,110):null,peers:integer(input.peers,1,999),checkpointRevision:integer(input.checkpointRevision,0),epoch:integer(input.epoch,1),quorum:input.quorum&&Number.isFinite(input.quorum.acked)&&Number.isFinite(input.quorum.total)?{acked:integer(input.quorum.acked,0,999),total:integer(input.quorum.total,0,999)}:null,migrationMs:Number.isFinite(input.migrationMs)?integer(input.migrationMs,0,120000):null,detectionMs:Number.isFinite(input.detectionMs)?integer(input.detectionMs,0,120000):null,sloPass:input.sloPass!==false,splitBrainPrevented:integer(input.splitBrainPrevented,0,1_000_000)};room.hostId=text(input.hostId||room.hostId,128);touch(room,now);return{state,result:{room:publicRoom(room)}};
}
export function deletePeerWorldRoom(value,id,auth,now=Date.now()){
  const state=prunePeerWorldRegistry(value,now),room=getRoom(state,id,now);assertHost(room,auth);delete state.rooms[room.roomId];return{state,result:{deleted:true}};
}
