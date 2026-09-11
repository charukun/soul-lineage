const ICE={iceServers:[{urls:'stun:stun.l.google.com:19302'},{urls:'stun:stun.cloudflare.com:3478'}]};
const encode=value=>{const bytes=new TextEncoder().encode(JSON.stringify(value));let text='';for(const byte of bytes)text+=String.fromCharCode(byte);return btoa(text);};
const decode=value=>{const text=atob(value.trim()),bytes=Uint8Array.from(text,c=>c.charCodeAt(0));return JSON.parse(new TextDecoder().decode(bytes));};
const waitIce=pc=>pc.iceGatheringState==='complete'?Promise.resolve():new Promise(resolve=>{const timer=setTimeout(resolve,12000);pc.addEventListener('icegatheringstatechange',()=>{if(pc.iceGatheringState==='complete'){clearTimeout(timer);resolve();}});});
export async function createHostOffer({RTCPeerConnection,onMessage,onState}){
 const pc=new RTCPeerConnection(ICE),channel=pc.createDataChannel('soul-lineage',{ordered:true});
 wire(pc,channel,onMessage,onState);await pc.setLocalDescription(await pc.createOffer());await waitIce(pc);
 return{code:encode(pc.localDescription),accept:async answer=>{await pc.setRemoteDescription(decode(answer));},send:value=>send(channel,value),close:()=>pc.close(),pc,channel};
}
export async function acceptHostOffer(code,{RTCPeerConnection,onMessage,onState}){
 const pc=new RTCPeerConnection(ICE);let channel=null;pc.ondatachannel=e=>{channel=e.channel;wire(pc,channel,onMessage,onState);};
 await pc.setRemoteDescription(decode(code));await pc.setLocalDescription(await pc.createAnswer());await waitIce(pc);
 return{code:encode(pc.localDescription),send:value=>{if(!channel)throw Error('接続待機中です。');send(channel,value);},close:()=>pc.close(),pc,get channel(){return channel;}};
}
function send(channel,value){if(channel.readyState!=='open')throw Error('相手との接続が開いていません。');channel.send(JSON.stringify(value));}
function wire(pc,channel,onMessage,onState){channel.onopen=()=>onState?.('open');channel.onclose=()=>onState?.('closed');channel.onerror=()=>onState?.('error');channel.onmessage=e=>{try{onMessage?.(JSON.parse(e.data));}catch{onState?.('invalid');}};pc.onconnectionstatechange=()=>onState?.(pc.connectionState);}
