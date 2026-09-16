import { COOP_PROTOCOL } from '../rebuild/coop-world.js';

export const COOP_HASH='rinne-coop';
export function invitationUrl(base,invite){const url=new URL(base);url.hash=new URLSearchParams({[COOP_HASH]:JSON.stringify(invite)}).toString();return url.href;}
export function readInvitation(value,now=Date.now()){
  let raw=String(value||'').trim();if(!raw)return null;
  if(raw.includes('#')&&!raw.startsWith('#'))raw=new URL(raw).hash;
  const encoded=new URLSearchParams(raw.replace(/^#/, '')).get(COOP_HASH);if(!encoded)return null;
  if(encoded.length>64000)throw Error('招待が長すぎます。');const invite=JSON.parse(encoded);
  if(invite.protocol!==COOP_PROTOCOL||typeof invite.worldId!=='string'||invite.worldId.length>120||typeof invite.offer!=='string'||invite.offer.length>40000||!Number.isFinite(invite.expiresAt)||invite.expiresAt<=now||invite.expiresAt>now+16*60*1000)throw Error('招待が期限切れか、対応していない形式です。');
  return invite;
}

/** Bound large welcome/save-derived messages below SCTP message limits; at most one bounded assembly. */
export function createRoomWire(onMessage,{now=()=>performance.now()}={}){
  let outgoing=0,assembly=null,received=0;
  function receive(frame){
    if(!frame||frame.type!=='coop-part'||!Number.isSafeInteger(frame.id)||frame.id<=received||!Number.isInteger(frame.part)||!Number.isInteger(frame.total)||frame.total<1||frame.total>128||frame.part<0||frame.part>=frame.total||typeof frame.data!=='string'||frame.data.length>4000)return false;
    if(!assembly||now()>assembly.expires||frame.id>assembly.id)assembly={id:frame.id,total:frame.total,parts:new Map(),expires:now()+5000};
    if(frame.id!==assembly.id||frame.total!==assembly.total)return false;
    assembly.parts.set(frame.part,frame.data);if(assembly.parts.size!==assembly.total)return true;
    const text=Array.from({length:assembly.total},(_,i)=>assembly.parts.get(i)).join('');received=assembly.id;assembly=null;
    try{onMessage(JSON.parse(text));return true;}catch{return false;}
  }
  function send(connection,message,{replaceable=false}={}){
    if(!connection||connection.channel?.readyState!=='open')return false;
    if(replaceable&&(connection.channel.bufferedAmount>64000||connection.presenceBufferedAmount?.()>64000))return false;
    const text=JSON.stringify(message),total=Math.ceil(text.length/4000);if(total>128)throw Error('共有データが送信上限を超えました。');const id=++outgoing;
    for(let part=0;part<total;part++)connection.send({type:'coop-part',id,part,total,data:text.slice(part*4000,(part+1)*4000)});
    return true;
  }
  return{receive,send};
}
