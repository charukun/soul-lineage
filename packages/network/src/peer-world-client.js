import {acceptHostOffer} from './peer.js';
import {createPeerMeshCoordinator} from './peer-mesh.js';
import {createCheckpointSyncedWorldNode} from './checkpoint-sync-node.js';
import {createPresenceTransport} from './transport-lod.js';

const CLOSED=new Set(['closed','failed','error']);
export async function connectPeerHostedWorld({
  offer,
  selfId,
  role,
  name,
  app,
  hostEligible=false,
  RTCPeerConnection,
  now=()=>performance.now(),
  getLocalState=()=>null,
  sendHz=20,
  onState=()=>{},
  onPhase=()=>{},
  onPresence=()=>{},
  onBattle=()=>{},
  onAccepted=()=>{},
  applyCheckpoint=()=>{},
}={}){
  if(!offer||!selfId||!role||!RTCPeerConnection)throw new Error('Peer world client requires offer, identity and WebRTC');
  let star=null,starHostId=null,node=null,mesh=null,disposed=false;
  const transport=createPresenceTransport({now});
  const connectionFor=peerId=>mesh?.connection(peerId)||(starHostId===String(peerId)?star:null)||null;
  const sendTo=(peerId,message,{presence=false}={})=>{const connection=connectionFor(peerId);if(!connection)return false;try{presence&&connection.sendPresence?connection.sendPresence(message):connection.send(message);return true;}catch{return false;}};
  const broadcast=message=>{let sent=0,seen=new Set();if(star&&starHostId){try{star.send(message);sent++;seen.add(starHostId);}catch{}}for(const id of mesh?.snapshot().connected||[])if(!seen.has(id)&&mesh.send(id,message))sent++;return sent;};
  const emit=({to,message})=>to?sendTo(to,message):broadcast(message);
  function syncMesh(){const authority=node?.authority;if(!authority||!mesh)return;const starOwnsCurrentHost=Boolean(star&&starHostId===authority.hostId);mesh.syncMembers(Object.keys(authority.members||{}),{hostId:starOwnsCurrentHost?authority.hostId:null});}
  function phase(info){onPhase(info);syncMesh();}
  function createNode(message){
    if(node)return node;
    node=createCheckpointSyncedWorldNode({selfId,worldId:message.worldId,mayorId:message.mayorId,hostEligible,now,emit,applyCheckpoint,onPhase:phase});
    mesh=createPeerMeshCoordinator({selfId,RTCPeerConnection,relay:event=>{const hostId=node?.snapshot().hostId;if(hostId&&hostId!==selfId)sendTo(hostId,{type:'mesh-relay',from:selfId,...event});},onMessage:(peerId,payload,kind)=>handle(peerId,payload,kind),onState:(peerId,state)=>onState(`mesh:${state}`,{peerId})});
    node.adoptAuthority(message.authority.hostId||message.mayorId,message.authority);
    if(message.checkpoint?.checkpoint)node.receive(message.authority.hostId||message.mayorId,{type:'world-checkpoint',worldId:message.worldId,hostId:message.authority.hostId||message.mayorId,epoch:message.checkpoint.epoch,revision:message.checkpoint.revision,checkpoint:message.checkpoint.checkpoint});
    syncMesh();return node;
  }
  function handle(senderId,message,kind='reliable'){
    if(disposed||!message)return false;
    if(message.type==='world-welcome'){starHostId=String(message.authority?.hostId||message.mayorId);createNode(message);onAccepted(message);return true;}
    if(message.type==='mesh-signal'){mesh?.handleSignal(message.from||senderId,message.signal);return true;}
    if(message.type?.startsWith('world-')){const handled=node?.receive(senderId,message)||false;if(handled&&['world-authority','world-migration-open'].includes(message.type))syncMesh();return handled;}
    if(message.type==='snapshot-delta'||message.type==='snapshot'){onPresence(message.players||{},message.serverTime??now());if(message.battle)onBattle(message.battle);return true;}
    if(message.type==='battle'){onBattle(message.battle);return true;}
    if(message.type==='accepted'){onAccepted(message);return true;}
    if(message.type==='rejected'){onState('rejected',{reason:message.reason});return true;}
    return false;
  }
  let connection;
  connection=await acceptHostOffer(offer,{RTCPeerConnection,dualChannel:true,onState:state=>{onState(state);if(state==='open'&&connection)connection.send({type:'join',role,playerId:selfId,name:name||role,app:app||role,hostEligible,transport:'dual-v1'});if(CLOSED.has(state)&&node){star=null;node.tick();syncMesh();}},onMessage:(message,kind)=>handle(starHostId||'initial-host',message,kind)});
  star=connection;
  const timer=setInterval(()=>{if(disposed)return;node?.tick();const hostId=node?.snapshot().hostId,state=getLocalState?.();if(hostId&&hostId!==selfId&&state){const connection=connectionFor(hostId);if(connection)transport.sendLocalState(selfId,connection,state,{hz:sendHz,time:now()});}},25);
  function dispose(){if(disposed)return;disposed=true;clearInterval(timer);mesh?.close();star?.close?.();node?.close();}
  return{answerCode:connection.code,dispose,sendTo,snapshot:()=>Object.freeze({selfId,starHostId,node:node?.snapshot()||null,mesh:mesh?.snapshot()||null,transport:transport.snapshot()}),get node(){return node;}};
}
