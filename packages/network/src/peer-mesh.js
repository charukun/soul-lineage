import {createHostOffer,acceptHostOffer} from './peer.js';
const TERMINAL=new Set(['closed','failed','error']);

export function createPeerMeshCoordinator({
  selfId,
  RTCPeerConnection,
  relay,
  onMessage=()=>{},
  onState=()=>{},
  createOffer=createHostOffer,
  acceptOffer=acceptHostOffer,
}={}) {
  if (!selfId || typeof relay !== 'function') throw new Error('Mesh requires self identity and relay');
  const connections=new Map(), pending=new Map();
  let offers=0, answers=0, failures=0;

  function bind(peerId,connection){const previous=connections.get(peerId);if(previous&&previous!==connection)previous.close?.();connections.set(peerId,connection);return connection;}
  async function initiate(peerId){
    if(peerId===selfId||connections.has(peerId)||pending.has(peerId))return false;pending.set(peerId,{state:'creating'});
    try{let connection;connection=await createOffer({RTCPeerConnection,dualChannel:true,onState:state=>{onState(peerId,state);if(TERMINAL.has(state)&&connections.get(peerId)===connection)connections.delete(peerId);},onMessage:(message,kind)=>onMessage(peerId,message,kind)});pending.set(peerId,{state:'offer',connection});offers++;relay({type:'mesh-signal',to:peerId,signal:{kind:'offer',code:connection.code}});return true;}catch(error){pending.delete(peerId);failures++;onState(peerId,'error',error);return false;}
  }
  async function handleSignal(from,signal){
    if(!from||from===selfId||!signal)return false;
    if(signal.kind==='offer'){
      if(connections.has(from))return true;
      try{let connection;connection=await acceptOffer(signal.code,{RTCPeerConnection,dualChannel:true,onState:state=>{onState(from,state);if(TERMINAL.has(state)&&connections.get(from)===connection)connections.delete(from);},onMessage:(message,kind)=>onMessage(from,message,kind)});bind(from,connection);answers++;relay({type:'mesh-signal',to:from,signal:{kind:'answer',code:connection.code}});return true;}catch(error){failures++;onState(from,'error',error);return false;}
    }
    if(signal.kind==='answer'){
      const item=pending.get(from);if(!item?.connection)return false;
      try{await item.connection.accept(signal.code);bind(from,item.connection);pending.delete(from);answers++;return true;}catch(error){pending.delete(from);failures++;onState(from,'error',error);return false;}
    }
    return false;
  }
  function syncMembers(memberIds,{hostId=null}={}){const members=new Set((memberIds||[]).map(String).filter(id=>id!==selfId));for(const id of [...connections.keys()])if(!members.has(id)){connections.get(id)?.close?.();connections.delete(id);}for(const id of members){if(id===hostId)continue;if(selfId.localeCompare(id)<0)initiate(id);}return snapshot();}
  function send(peerId,message,{presence=false}={}){const id=String(peerId),connection=connections.get(id);if(!connection)return false;try{presence&&connection.sendPresence?connection.sendPresence(message):connection.send(message);return true;}catch{connections.delete(id);failures++;return false;}}
  function broadcast(message,options){let sent=0;for(const[id]of connections)if(send(id,message,options))sent++;return sent;}
  function closePeer(peerId){const id=String(peerId);connections.get(id)?.close?.();connections.delete(id);const item=pending.get(id);item?.connection?.close?.();pending.delete(id);}
  function close(){for(const id of [...connections.keys()])closePeer(id);for(const[id,item]of pending){item.connection?.close?.();pending.delete(id);}}
  function snapshot(){return Object.freeze({selfId,connected:[...connections.keys()].sort(),pending:[...pending.keys()].sort(),offers,answers,failures});}
  return{syncMembers,handleSignal,send,broadcast,connection:peerId=>connections.get(String(peerId))||null,closePeer,close,snapshot,has:peerId=>connections.has(String(peerId))};
}
