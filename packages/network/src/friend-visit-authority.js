import {createPeerHostedWorldNode} from './peer-hosted-world.js';

// The current friend entry shares exterior presentation, never simulation state.
// Visitors vote in the lease but cannot inherit the owner's village authority.
const VISIT_MESSAGES = new Set(['world-authority', 'world-heartbeat', 'world-heartbeat-ack', 'world-sync-request']);

export function createFriendVisitHost({worldId, selfId, now=()=>Date.now(), send=()=>{}, onPhase=()=>{}}) {
  let visitorId=null, active=false, disposed=false;
  const node=createPeerHostedWorldNode({selfId, worldId, now, hostEligible:true, onPhase,
    emit:({message})=>{if(active && !disposed && VISIT_MESSAGES.has(message.type))send({type:'friend-world', payload:message});},
  });
  node.seedHost();
  return {
    admit(id) {
      if(disposed)throw new Error('Friend session is closed');
      if(visitorId)throw new Error('Friend invitation has already been used');
      visitorId=String(id || 'visitor');
      if(visitorId===selfId || visitorId.length>180)throw new Error('Invalid visitor identity');
      node.hostAdmit(visitorId,{eligible:false});
      active=true;
      return {worldId, selfId:visitorId, hostId:selfId, authority:node.authority};
    },
    receive(message) {
      if(disposed || !active || message?.type!=='friend-world')return false;
      const payload=message.payload;
      if(!['world-heartbeat-ack','world-sync-request'].includes(payload?.type))return false;
      if(payload.worldId!==worldId)return false;
      return node.receive(visitorId,payload);
    },
    tick(){if(active && !disposed)node.tick();},
    snapshot:()=>node.snapshot(),
    dispose(){disposed=true;active=false;node.close();},
  };
}

function validateFriendAuthority(value, worldId, selfId, hostId) {
  const members=value?.members;
  if(value?.villageId!==worldId || value?.hostId!==hostId || value?.mayorId!==hostId ||
    !members || Object.keys(members).length!==2 || !members[hostId]?.eligible ||
    members[selfId]?.eligible!==false || value.checkpoint || value.revision!==0) {
    throw new Error('Invalid friend visit authority');
  }
  return value;
}

export function createFriendVisitGuest({welcome, worldId, selfId, now=()=>Date.now(), send=()=>{}, onPhase=()=>{}}) {
  if(welcome?.worldId!==worldId || welcome?.selfId!==selfId || !welcome.hostId || welcome.hostId===selfId) {
    throw new Error('Friend visit identity does not match its invitation');
  }
  const hostId=welcome.hostId;
  validateFriendAuthority(welcome.authority,worldId,selfId,hostId);
  const node=createPeerHostedWorldNode({selfId,worldId,mayorId:hostId,now,hostEligible:false,onPhase,
    emit:({to,message})=>{if(to===hostId && VISIT_MESSAGES.has(message.type))send({type:'friend-world',payload:message});},
  });
  if(!node.adoptAuthority(hostId,welcome.authority))throw new Error('Friend visit has no open authority');
  let disposed=false;
  return {
    receive(message) {
      if(disposed || message?.type!=='friend-world')return false;
      const payload=message.payload;
      if(!['world-authority','world-heartbeat'].includes(payload?.type))return false;
      if(payload.type==='world-authority')validateFriendAuthority(payload.authority,worldId,selfId,hostId);
      else if(payload.worldId!==worldId || payload.hostId!==hostId)return false;
      return node.receive(hostId,payload);
    },
    tick(){if(!disposed)node.tick();},
    snapshot:()=>node.snapshot(),
    dispose(){disposed=true;node.close();},
  };
}
