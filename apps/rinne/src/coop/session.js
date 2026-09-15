import { createHostOffer, acceptHostOffer } from '@soul/network/peer';
import { COOP_PROTOCOL } from '../rebuild/coop-world.js';
import { validateLife } from '../rebuild/domain.js';
import { normalizeFront } from '../rebuild/combat.js';
import { validateMuraLayout } from '@soul/world/mura';
import { createRoomWire } from './wire.js';

export async function createCoopHost({world,contentVersion,save,RTCPeerConnection,onChange=()=>{},now=()=>performance.now(),uuid=()=>crypto.randomUUID()}){
  let closed=false,paused=false,busy=false,pending=null,lastSave=now(),lastBroadcast=0,inputSeq=0,latest=null,error='';
  const links=new Map(),selfId=world.data.ownerId;
  let queue=Promise.resolve();const serialize=fn=>{const task=queue.then(fn);queue=task.catch(()=>{});return task;};
  await save(world.save());world.dirtyHistory=false;latest=world.view(selfId);
  const packet=id=>({type:'view',phase:paused?'closed':'open',view:{...world.view(id),connected:links.size+1}});
  function sendFirst(link){if(link.firstMessage&&link.wire.send(link.connection,link.firstMessage))link.firstMessage=null;}
  function publish(){latest=world.view(selfId);for(const [id,link]of links)try{sendFirst(link);if(!link.firstMessage)link.wire.send(link.connection,packet(id),{replaceable:true});}catch(e){error=e.message;paused=true;}world.events.clear();onChange();}
  function closeLink(id,link){if(links.get(id)!==link)return;links.delete(id);world.clearInput(id);}
  async function invite(){
    if(closed)throw Error('村は閉じています。');if(pending&&!pending.joined)pending.connection?.close();
    const link={connection:null,joined:false,expiresAt:Date.now()+15*60*1000,id:null};pending=link;
    link.wire=createRoomWire(async message=>{
      if(closed||!message||message.worldId!==world.data.worldId||message.protocol!==COOP_PROTOCOL)return;
      if(message.type==='hello'&&!link.joined){
        return serialize(async()=>{if(closed||link.joined)return;busy=true;try{
          if(Date.now()>link.expiresAt||message.contentVersion!==contentVersion)throw Error('招待期限またはアプリの版が違います。両方を再読み込みしてください。');
          let id=message.resume?.playerId,token=message.resume?.token;
          if(!id||!Object.hasOwn(world.data.players,id)||id===selfId||world.data.players[id].token!==token){id=`p-${uuid()}`;token=uuid();world.addPlayer(id,String(message.name||'旅人').slice(0,12),token);}
          links.get(id)?.connection.close();world.clearInput(id);link.id=id;link.joined=true;links.set(id,link);
          try{await save(world.save());world.dirtyHistory=false;}catch(e){error=e.message;paused=true;throw e;}
          link.firstMessage={...packet(id),type:'welcome',protocol:COOP_PROTOCOL,contentVersion,worldId:world.data.worldId,layout:world.layout,playerId:id,token};sendFirst(link);
        }catch(e){link.firstMessage={type:'error',message:e.message};sendFirst(link);if(link.id)closeLink(link.id,link);link.joined=false;}finally{busy=false;}});
      }
      if(!link.joined||links.get(link.id)!==link||paused||busy||message.epoch!==world.data.epoch)return;
      if(message.type==='input')world.acceptInput(link.id,message.input);
      if(message.type==='rebirth')try{world.rebirth(link.id,message.villageId);}catch(e){link.wire.send(link.connection,{type:'error',message:e.message});}
    });
    link.connection=await createHostOffer({RTCPeerConnection,dualChannel:true,onMessage:m=>link.wire.receive(m),onState:state=>{if(state==='open')sendFirst(link);if(['closed','failed','error'].includes(state)&&link.id)closeLink(link.id,link);}});
    return{protocol:COOP_PROTOCOL,contentVersion,worldId:world.data.worldId,offer:link.connection.code,expiresAt:link.expiresAt};
  }
  async function step(){
    if(closed||paused||busy)return;busy=true;
    return serialize(async()=>{busy=true;try{
      if(closed||paused)return;
      world.advance(.05);
      if(world.dirtyHistory||now()-lastSave>=1000){await save(world.save());world.dirtyHistory=false;lastSave=now();}
      if(now()-lastBroadcast>=95){lastBroadcast=now();publish();}
    }catch(e){error=e.message;paused=true;onChange();}finally{busy=false;}});
  }
  const timer=setInterval(()=>void step(),50);
  function pause(value){paused=Boolean(value)||Boolean(error);for(const id of Object.keys(world.data.players))world.clearInput(id);if(!busy&&!error)publish();else onChange();}
  async function dispose(){if(closed)return;closed=true;clearInterval(timer);pending?.connection?.close();for(const link of links.values())link.connection.close();links.clear();await serialize(()=>save(world.save()));}
  return{role:'host',selfId,layout:world.layout,worldId:world.data.worldId,invite,
    accept:answer=>{if(!pending)throw Error('先に招待を作ってください。');return pending.connection.accept(answer.trim());},
    input:direction=>world.acceptInput(selfId,{seq:++inputSeq,...direction}),setRate:rate=>serialize(()=>world.setRate(selfId,rate)),rebirth:villageId=>serialize(()=>world.rebirth(selfId,villageId)),pause,dispose,
    snapshot:()=>({phase:closed||paused?'closed':'open',error,view:latest&&{...latest,connected:links.size+1}}),save:()=>serialize(()=>save(world.save()))};
}

export async function joinCoopHost({invite,name,contentVersion,RTCPeerConnection,resume=null,remember=()=>{},onChange=()=>{},now=()=>performance.now()}){
  let connection=null,latest=null,phase='connecting',selfId=null,layout=null,error='',lastSeen=now(),seq=0,lastEpoch=0,lastTick=-1,disposed=false;
  const send=m=>wire.send(connection,{...m,worldId:invite.worldId,protocol:COOP_PROTOCOL,epoch:lastEpoch});
  const wire=createRoomWire(message=>{
    if(message?.type==='error'){error=String(message.message).slice(0,180);phase='closed';onChange();return;}
    if(!message||!['welcome','view'].includes(message.type))return;
    if(message.type==='welcome'){
      if(message.worldId!==invite.worldId||message.contentVersion!==contentVersion||message.protocol!==COOP_PROTOCOL||typeof message.playerId!=='string'||typeof message.token!=='string')return;
      layout=validateMuraLayout(message.layout);selfId=message.playerId;remember({playerId:selfId,token:message.token});
    }
    const view=message.view;
    if(!selfId||view?.worldId!==invite.worldId||!Number.isSafeInteger(view.epoch)||view.epoch<lastEpoch||!Number.isSafeInteger(view.tick)||(view.epoch===lastEpoch&&view.tick<lastTick)||!Array.isArray(view.peers)||view.peers.length>29)return;
    validateLife(view.me);if(view.front)normalizeFront(view.front,view.me.front);
    for(const peer of view.peers)if(!peer||typeof peer.id!=='string'||!Number.isFinite(peer.position?.x)||!Number.isFinite(peer.position?.z)||!Number.isFinite(peer.ageSeconds)||!Number.isFinite(peer.yaw))return;
    lastEpoch=view.epoch;lastTick=view.tick;latest=view;lastSeen=now();phase=message.phase==='open'?'open':'closed';if(phase==='open')error='';onChange();
  });
  connection=await acceptHostOffer(invite.offer,{RTCPeerConnection,dualChannel:true,onMessage:m=>wire.receive(m),onState:state=>{
    if(state==='open')send({type:'hello',name:String(name||'旅人').slice(0,12),contentVersion,resume});
    if(['closed','failed','error'].includes(state)){phase='closed';onChange();}
  }});
  const timer=setInterval(()=>{if(latest&&now()-lastSeen>2500&&phase!=='closed'){phase='closed';error='村とのつながりを待っています。';onChange();}},250);
  return{role:'guest',worldId:invite.worldId,get selfId(){return selfId;},get layout(){return layout;},answerCode:connection.code,
    input:direction=>phase==='open'&&send({type:'input',input:{seq:++seq,...direction}}),rebirth:villageId=>send({type:'rebirth',villageId}),setRate:()=>{},pause:()=>{},save:async()=>true,
    snapshot:()=>({phase,error,view:latest}),dispose:()=>{if(disposed)return;disposed=true;phase='closed';clearInterval(timer);connection.close();}};
}
