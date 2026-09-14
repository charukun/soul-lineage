const DEFAULT_ENDPOINT='https://rinne-ops.c-okamoto.workers.dev/';
const cleanBase=value=>{const url=new URL(value||DEFAULT_ENDPOINT);if(url.protocol!=='https:')throw new Error('Peer signaling requires HTTPS');url.pathname=url.pathname.replace(/\/*$/,'/');return url;};
const bodyOf=value=>value===undefined?undefined:JSON.stringify(value);
async function parse(response){let value=null;try{value=await response.json();}catch{}if(!response.ok)throw new Error(value?.error||`peer_signaling_${response.status}`);return value;}
export function createPeerSignalingClient({endpoint=DEFAULT_ENDPOINT,fetchImpl=fetch,timeoutMs=10_000}={}){
  const base=cleanBase(endpoint);
  async function request(path,{method='GET',token,body}={}){
    const url=new URL(path.replace(/^\//,''),base);if(url.origin!==base.origin)throw new Error('Peer signaling escaped endpoint');
    const headers={accept:'application/json'};if(body!==undefined)headers['content-type']='application/json';if(token)headers.authorization=`Bearer ${token}`;
    return parse(await fetchImpl(url,{method,headers,body:bodyOf(body),signal:AbortSignal.timeout(timeoutMs)}));
  }
  return Object.freeze({
    endpoint:base.href,
    listRooms:()=>request('api/peer-world/rooms'),
    createRoom:payload=>request('api/peer-world/rooms',{method:'POST',body:payload}),
    joinRoom:(roomId,payload)=>request(`api/peer-world/rooms/${encodeURIComponent(roomId)}/join`,{method:'POST',body:payload}),
    pollHost:(roomId,token,after=0)=>request(`api/peer-world/rooms/${encodeURIComponent(roomId)}/host-events?after=${Math.max(0,after|0)}`,{token}),
    postOffer:(roomId,joinId,token,offer)=>request(`api/peer-world/rooms/${encodeURIComponent(roomId)}/joins/${encodeURIComponent(joinId)}/offer`,{method:'POST',token,body:{offer}}),
    pollGuest:(roomId,joinId,token,after=0)=>request(`api/peer-world/rooms/${encodeURIComponent(roomId)}/joins/${encodeURIComponent(joinId)}/events?after=${Math.max(0,after|0)}`,{token}),
    postAnswer:(roomId,joinId,token,answer)=>request(`api/peer-world/rooms/${encodeURIComponent(roomId)}/joins/${encodeURIComponent(joinId)}/answer`,{method:'POST',token,body:{answer}}),
    telemetry:(roomId,token,payload)=>request(`api/peer-world/rooms/${encodeURIComponent(roomId)}/telemetry`,{method:'POST',token,body:payload}),
    closeRoom:(roomId,token)=>request(`api/peer-world/rooms/${encodeURIComponent(roomId)}`,{method:'DELETE',token}),
  });
}

export async function sampleBrowserHostCapability({adaptive=globalThis.__VILLAGE_ADAPTIVE_QUALITY__?.snapshot?.(),worldScale=globalThis.__VILLAGE_WORLD_SCALE__?.snapshot?.()}={}){
  let battery=null;try{battery=await navigator.getBattery?.();}catch{}
  const connection=navigator.connection||navigator.mozConnection||navigator.webkitConnection||null;
  return Object.freeze({
    foreground:document.visibilityState!=='hidden',
    charging:battery?.charging===true,
    batteryLevel:Number.isFinite(battery?.level)?battery.level:null,
    hardwareConcurrency:navigator.hardwareConcurrency||2,
    deviceMemory:navigator.deviceMemory||worldScale?.device?.deviceMemory||2,
    rttMs:Number.isFinite(connection?.rtt)?connection.rtt:null,
    downlinkMbps:Number.isFinite(connection?.downlink)?connection.downlink:null,
    saveData:connection?.saveData===true,
    frameP95Ms:adaptive?.performance?.frame?.p95Ms??worldScale?.device?.learned?.frameP95??null,
    gpuP95Ms:adaptive?.performance?.gpu?.p95Ms??worldScale?.device?.learned?.gpuP95??null,
  });
}
export {DEFAULT_ENDPOINT as DEFAULT_PEER_SIGNALING_ENDPOINT};
