import { createHostOffer } from '@soul/network/peer';
import { COOP_PROTOCOL } from '../rebuild/coop-world.js';
import { createRoomWire } from './wire.js';
import { createCheckpointWriter } from './checkpoint-writer.js';
import { applyRebirthIntent } from './history.js';
export { joinCoopHost } from './guest-session.js';

export async function createCoopHost({world,contentVersion,save,RTCPeerConnection,onChange=()=>{},now=()=>performance.now(),uuid=()=>crypto.randomUUID()}){
  let closed=false,paused=false,stalled=false,ready=false,pending=null,lastSave=now(),lastBroadcast=0,inputSeq=0,latest=null,error='';
  const links=new Map(),selfId=world.data.ownerId;
  world.data.rebirthOps??={};
  const writer=createCheckpointWriter({world,save,now,
    onCommit:()=>{stalled=false;if(ready&&!closed)publish();},
    onError:e=>{error=e.message;paused=true;if(ready&&!closed)publish();}});
  await writer.request();ready=true;latest=writer.project(world.view(selfId));
  const open=()=>!closed&&!paused&&!stalled&&!error;
  const packet=id=>({type:'view',phase:open()?'open':'closed',view:{...writer.project(world.view(id)),connected:links.size+1}});
  function sendFirst(link){if(link.firstMessage&&link.wire.send(link.connection,link.firstMessage))link.firstMessage=null;}
  function publish(){latest=writer.project(world.view(selfId));for(const [id,link]of links)try{sendFirst(link);if(!link.firstMessage)link.wire.send(link.connection,packet(id),{replaceable:true});}catch(e){error=e.message;paused=true;}world.events.clear();onChange();}
  function closeLink(id,link){link.closed=true;if(links.get(id)!==link)return;links.delete(id);world.clearInput(id);}
  function persist(){lastSave=now();world.dirtyHistory=false;return writer.request();}
  async function rebirth(playerId,lifeId,villageId){
    if(!open())throw Error(error||'村の再開を待ってください。');
    const intent=applyRebirthIntent(world,writer.committed,{playerId,lifeId,villageId});
    await persist();return intent;
  }
  async function welcome(link,message){
    if(link.joining||link.joined)return;link.joining=true;
    try{
      if(closed||Date.now()>link.expiresAt||message.contentVersion!==contentVersion)throw Error('招待期限またはアプリの版が違います。両方を再読み込みしてください。');
      if(!open())throw Error(error||'村の再開を待ってください。');
      let id=message.resume?.playerId,token=message.resume?.token;
      if(!id||!Object.hasOwn(world.data.players,id)||id===selfId||world.data.players[id].token!==token){id=`p-${uuid()}`;token=uuid();world.addPlayer(id,String(message.name||'旅人').slice(0,12),token);}
      await persist();if(closed||link.closed)return;
      links.get(id)?.connection.close();world.clearInput(id);link.id=id;link.joined=true;links.set(id,link);
      link.firstMessage={...packet(id),type:'welcome',protocol:COOP_PROTOCOL,contentVersion,worldId:world.data.worldId,layout:world.layout,playerId:id,token};sendFirst(link);
    }catch(e){link.firstMessage={type:'error',message:e.message};sendFirst(link);if(link.id)closeLink(link.id,link);}
    finally{link.joining=false;}
  }
  async function invite(){
    if(!open())throw Error(error||'村は閉じています。');if(pending&&!pending.joined)pending.connection?.close();
    const link={connection:null,joined:false,joining:false,closed:false,expiresAt:Date.now()+15*60*1000,id:null};pending=link;
    link.wire=createRoomWire(async message=>{
      if(closed||!message||message.worldId!==world.data.worldId||message.protocol!==COOP_PROTOCOL)return;
      if(message.type==='hello'&&!link.joined)return welcome(link,message);
      if(!link.joined||links.get(link.id)!==link||!open()||message.epoch!==world.data.epoch)return;
      if(message.type==='input'&&!writer.pendingIds().has(link.id))world.acceptInput(link.id,message.input);
      if(message.type==='rebirth'){
        try{const result=await rebirth(link.id,message.lifeId,message.villageId);link.wire.send(link.connection,{type:'rebirth-result',lifeId:message.lifeId,resultId:result.resultId});}
        catch(e){if(!link.closed)link.wire.send(link.connection,{type:'rebirth-result',lifeId:message.lifeId,error:e.message});}
      }
    });
    link.connection=await createHostOffer({RTCPeerConnection,dualChannel:true,onMessage:m=>link.wire.receive(m),onState:state=>{if(state==='open')sendFirst(link);if(['closed','failed','error'].includes(state))closeLink(link.id,link);}});
    return{protocol:COOP_PROTOCOL,contentVersion,worldId:world.data.worldId,offer:link.connection.code,expiresAt:link.expiresAt};
  }
  function step(){
    if(closed)return;
    if(writer.pending&&now()-writer.pendingSince>3000&&!stalled){stalled=true;publish();}
    if(!open())return;
    try{
      world.advance(.05,{blocked:writer.pendingIds()});
      if(world.dirtyHistory||(!writer.pending&&now()-lastSave>=1000))void persist().catch(()=>{});
      if(now()-lastBroadcast>=95){lastBroadcast=now();publish();}
    }catch(e){error=e.message;paused=true;publish();}
  }
  const timer=setInterval(step,50);
  function pause(value){paused=Boolean(value)||Boolean(error);for(const id of Object.keys(world.data.players))world.clearInput(id);publish();}
  async function dispose(){
    if(closed)return;closed=true;clearInterval(timer);pending?.connection?.close();for(const link of links.values())link.connection.close();links.clear();
    if(!writer.failure)await writer.request();
  }
  return{role:'host',selfId,layout:world.layout,worldId:world.data.worldId,invite,
    accept:answer=>{if(!pending)throw Error('先に招待を作ってください。');return pending.connection.accept(answer.trim());},
    input:direction=>{if(open()&&!writer.pendingIds().has(selfId))world.acceptInput(selfId,{seq:++inputSeq,...direction});},
    setRate:async rate=>{if(!open())throw Error('村の再開を待ってください。');world.setRate(selfId,rate);await persist();},
    rebirth:(villageId,lifeId=writer.committed.world.players[selfId].life.id)=>rebirth(selfId,lifeId,villageId),pause,dispose,
    snapshot:()=>({phase:open()?'open':'closed',error,historyPending:writer.pending,view:latest&&{...latest,connected:links.size+1}}),
    save:()=>writer.failure?Promise.reject(writer.failure):persist()};
}
