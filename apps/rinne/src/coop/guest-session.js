import { acceptHostOffer } from '@soul/network/peer';
import { COOP_PROTOCOL } from '../rebuild/coop-world.js';
import { validateLife } from '../rebuild/domain.js';
import { normalizeFront } from '../rebuild/combat.js';
import { validateMuraLayout } from '@soul/world/mura';
import { createRoomWire } from './wire.js';

export async function joinCoopHost({invite,name,contentVersion,RTCPeerConnection,resume=null,remember=()=>{},onChange=()=>{},now=()=>performance.now()}){
  let connection=null,latest=null,phase='connecting',selfId=null,layout=null,error='',lastSeen=now(),seq=0,lastEpoch=0,lastTick=-1,lastRevision=0,disposed=false,rebirthRequest=null;
  const send=m=>wire.send(connection,{...m,worldId:invite.worldId,protocol:COOP_PROTOCOL,epoch:lastEpoch});
  const failRequest=message=>{rebirthRequest?.reject(Error(message));rebirthRequest=null;};
  const wire=createRoomWire(message=>{
    if(message?.type==='error'){error=String(message.message).slice(0,180);phase='closed';failRequest(error);onChange();return;}
    if(message?.type==='rebirth-result'&&rebirthRequest?.lifeId===message.lifeId){
      if(message.error)failRequest(String(message.error));else{rebirthRequest.resolve();rebirthRequest=null;}return;
    }
    if(!message||!['welcome','view'].includes(message.type))return;
    if(message.type==='welcome'){
      if(message.worldId!==invite.worldId||message.contentVersion!==contentVersion||message.protocol!==COOP_PROTOCOL||typeof message.playerId!=='string'||typeof message.token!=='string')return;
      layout=validateMuraLayout(message.layout);selfId=message.playerId;remember({playerId:selfId,token:message.token});
    }
    const view=message.view;
    if(!selfId||view?.worldId!==invite.worldId||!Number.isSafeInteger(view.epoch)||view.epoch<lastEpoch||!Number.isSafeInteger(view.tick)||(view.epoch===lastEpoch&&view.tick<lastTick)||!Array.isArray(view.peers)||view.peers.length>29)return;
    if(!Number.isSafeInteger(view.historyRevision)||view.historyRevision<0||(view.epoch===lastEpoch&&view.historyRevision<lastRevision))return;
    validateLife(view.me);if(view.front)normalizeFront(view.front,view.me.front);
    for(const peer of view.peers)if(!peer||typeof peer.id!=='string'||!Number.isFinite(peer.position?.x)||!Number.isFinite(peer.position?.z)||!Number.isFinite(peer.ageSeconds)||!Number.isFinite(peer.yaw))return;
    lastEpoch=view.epoch;lastTick=view.tick;lastRevision=view.historyRevision;latest=view;lastSeen=now();phase=message.phase==='open'?'open':'closed';if(phase==='open')error='';
    if(rebirthRequest&&view.me.id!==rebirthRequest.lifeId){rebirthRequest.resolve();rebirthRequest=null;}
    onChange();
  });
  connection=await acceptHostOffer(invite.offer,{RTCPeerConnection,dualChannel:true,onMessage:m=>wire.receive(m),onState:state=>{
    if(state==='open')send({type:'hello',name:String(name||'旅人').slice(0,12),contentVersion,resume});
    if(['closed','failed','error'].includes(state)){phase='closed';failRequest('村とのつながりを待っています。');onChange();}
  }});
  const timer=setInterval(()=>{if(latest&&now()-lastSeen>2500&&phase!=='closed'){phase='closed';error='村とのつながりを待っています。';failRequest(error);onChange();}},250);
  function rebirth(villageId){
    if(phase!=='open'||!latest?.me.ended)return Promise.reject(Error('人生の確定を待ってください。'));
    if(rebirthRequest)return rebirthRequest.promise;
    let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});
    const lifeId=latest.me.id;rebirthRequest={lifeId,promise,resolve,reject};
    try{if(!send({type:'rebirth',lifeId,villageId:villageId||null}))failRequest('村との接続がありません。');}
    catch(e){failRequest(e.message);}return promise;
  }
  return{role:'guest',worldId:invite.worldId,get selfId(){return selfId;},get layout(){return layout;},answerCode:connection.code,
    input:direction=>phase==='open'&&!latest?.historyPending&&send({type:'input',input:{seq:++seq,...direction}}),rebirth,setRate:()=>{},pause:()=>{},save:async()=>true,
    snapshot:()=>({phase,error,view:latest}),dispose:()=>{if(disposed)return;disposed=true;phase='closed';clearInterval(timer);failRequest('村を離れました。');connection.close();}};
}
