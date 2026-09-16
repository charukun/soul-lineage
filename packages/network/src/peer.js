const ICE={iceServers:[{urls:'stun:stun.l.google.com:19302'},{urls:'stun:stun.cloudflare.com:3478'}]};
const PRESENCE_LABEL='soul-lineage-presence';
const encode=value=>{const bytes=new TextEncoder().encode(JSON.stringify(value));let text='';for(const byte of bytes)text+=String.fromCharCode(byte);return btoa(text);};
const decode=value=>{const text=atob(value.trim()),bytes=Uint8Array.from(text,c=>c.charCodeAt(0));return JSON.parse(new TextDecoder().decode(bytes));};
const waitIce=pc=>pc.iceGatheringState==='complete'?Promise.resolve():new Promise(resolve=>{const timer=setTimeout(resolve,12000);pc.addEventListener('icegatheringstatechange',()=>{if(pc.iceGatheringState==='complete'){clearTimeout(timer);resolve();}});});
const send=(channel,value)=>{if(channel?.readyState!=='open')throw Error('相手との接続が開いていません。');channel.send(JSON.stringify(value));};
function wireChannel(channel,onMessage,onState,kind){channel.onopen=()=>onState?.(kind==='reliable'?'open':'presence-open');channel.onclose=()=>onState?.(kind==='reliable'?'closed':'presence-closed');channel.onerror=()=>onState?.(kind==='reliable'?'error':'presence-error');channel.onmessage=e=>{try{onMessage?.(JSON.parse(e.data),kind);}catch{onState?.('invalid');}};}
function wireConnection(pc,onState){pc.onconnectionstatechange=()=>onState?.(pc.connectionState);}
export async function createHostOffer({RTCPeerConnection,onMessage,onState,dualChannel=false}){
 const pc=new RTCPeerConnection(ICE),reliable=pc.createDataChannel('soul-lineage',{ordered:true}),presence=dualChannel?pc.createDataChannel(PRESENCE_LABEL,{ordered:false,maxRetransmits:0}):null;wireChannel(reliable,onMessage,onState,'reliable');if(presence)wireChannel(presence,onMessage,onState,'presence');wireConnection(pc,onState);await pc.setLocalDescription(await pc.createOffer());await waitIce(pc);
 return{code:encode(pc.localDescription),accept:async answer=>{await pc.setRemoteDescription(decode(answer));},send:value=>send(reliable,value),sendPresence:value=>send(presence?.readyState==='open'?presence:reliable,value),presenceBufferedAmount:()=>presence?.bufferedAmount??reliable.bufferedAmount,close:()=>pc.close(),pc,channel:reliable,presenceChannel:presence};
}
export async function acceptHostOffer(code,{RTCPeerConnection,onMessage,onState,dualChannel=false}){
 const pc=new RTCPeerConnection(ICE),channels={reliable:null,presence:null};wireConnection(pc,onState);pc.ondatachannel=e=>{const kind=e.channel.label===PRESENCE_LABEL?'presence':'reliable';if(kind==='presence'&&!dualChannel){e.channel.close();return;}channels[kind]=e.channel;wireChannel(e.channel,onMessage,onState,kind);};await pc.setRemoteDescription(decode(code));await pc.setLocalDescription(await pc.createAnswer());await waitIce(pc);
 return{code:encode(pc.localDescription),send:value=>send(channels.reliable,value),sendPresence:value=>send(channels.presence?.readyState==='open'?channels.presence:channels.reliable,value),presenceBufferedAmount:()=>channels.presence?.bufferedAmount??channels.reliable?.bufferedAmount??0,close:()=>pc.close(),pc,get channel(){return channels.reliable;},get presenceChannel(){return channels.presence;}};
}
