import {createPresenceScheduler} from './presence-lod.js';
const json=value=>JSON.stringify(value);
const battleEnvelope=battle=>battle?Object.freeze({demon:battle.demon??null,human:battle.human??null,finished:Boolean(battle.finished),winner:battle.winner??null}):null;
export function createPresenceTransport({now=()=>performance.now(),highWaterMark=128*1024}={}){
 const scheduler=createPresenceScheduler({now}),battleSignature=new Map();let presenceSent=0,reliableSent=0,dropped=0,bytes=0;
 const canPresence=connection=>{const amount=Number(connection?.presenceBufferedAmount?.()??connection?.channel?.bufferedAmount??0);return !Number.isFinite(amount)||amount<highWaterMark;};
 function sendPresence(connection,payload){if(!canPresence(connection)){dropped++;return false;}const text=json(payload);try{if(typeof connection?.sendPresence==='function')connection.sendPresence(payload);else connection?.send?.(payload);presenceSent++;bytes+=text.length;return true;}catch{dropped++;return false;}}
 function sendReliable(connection,payload){try{connection?.send?.(payload);reliableSent++;bytes+=json(payload).length;return true;}catch{return false;}}
 function sendObserverSnapshot(observerId,connection,snapshot,time=now()){
  const players={};for(const[id,state]of Object.entries(snapshot?.players||{})){const policy=state?._presence||{hz:20,tier:'near'};if(!scheduler.due(`${observerId}:${id}`,policy,time))continue;const{_presence,...rest}=state;players[id]=rest;}
  if(Object.keys(players).length)sendPresence(connection,{type:'snapshot-delta',villageId:snapshot.villageId,players,partial:true,serverTime:time});
  const battle=battleEnvelope(snapshot?.battle),signature=json(battle),previous=battleSignature.get(observerId);if(signature!==previous){battleSignature.set(observerId,signature);sendReliable(connection,{type:'battle',villageId:snapshot?.villageId,battle,serverTime:time});}
 }
 function sendLocalState(id,connection,state,{hz=20,time=now()}={}){if(!scheduler.due(`local:${id}`,{hz},time))return false;return sendPresence(connection,{type:'state',...state,clientTime:time});}
 return{sendObserverSnapshot,sendLocalState,sendReliable,reset(id){scheduler.reset(id);if(id!==undefined)battleSignature.delete(id);else battleSignature.clear();},snapshot(){return Object.freeze({presenceSent,reliableSent,dropped,bytes,highWaterMark,scheduler:scheduler.snapshot()});}};
}
