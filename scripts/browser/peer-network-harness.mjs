import {readFileSync} from 'node:fs';

// Load the exact portable package sources into independent browsers. Only the
// signalling exchange is orchestrated by Playwright; transport is native WebRTC.
function moduleUrl(file,cache=new Map()){
  if(cache.has(file.href))return cache.get(file.href);
  const source=readFileSync(file,'utf8').replace(/from\s+(['"])(\.\.?\/[^'"]+)\1/g,(_,quote,path)=>`from ${quote}${moduleUrl(new URL(path,file),cache)}${quote}`);
  const url=`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;cache.set(file.href,url);return url;
}

export async function installPeerNetworkHarness(page,selfId){
  const root=new URL('../../packages/network/src/',import.meta.url);
  const modules={node:moduleUrl(new URL('peer-hosted-world.js',root)),mesh:moduleUrl(new URL('peer-mesh.js',root)),peer:moduleUrl(new URL('peer.js',root))};
  await page.evaluate(async({selfId,modules})=>{
    const {createPeerHostedWorldNode}=await import(modules.node);
    const {createPeerMeshCoordinator}=await import(modules.mesh);
    const {createHostOffer,acceptHostOffer}=await import(modules.peer);
    const Native=RTCPeerConnection;
    const LocalRTC=class extends Native{constructor(){super({iceServers:[]});}};
    const direct=new Map(),history=[],phaseTimes=[],restored=[];
    let node,mesh,closed=false;
    const connection=id=>direct.get(id)||mesh?.connection(id);
    const send=(id,message)=>{try{connection(id)?.send(message);return true;}catch{return false;}};
    const emit=({to,message})=>{if(to)return send(to,message);const ids=new Set([...direct.keys(),...(mesh?.snapshot().connected||[])]);for(const id of ids)send(id,message);};
    function sync(){const authority=node?.authority;if(authority&&authority.hostId!==selfId)mesh.syncMembers(Object.keys(authority.members),{hostId:direct.has(authority.hostId)?authority.hostId:null});}
    function handle(from,message){
      if(closed)return;
      if(message.type==='mesh-relay'&&node.isHost){send(message.to,{type:'mesh-signal',from,signal:message.signal});return;}
      if(message.type==='mesh-signal'){mesh.handleSignal(message.from,message.signal);return;}
      node.receive(from,message);sync();
    }
    node=createPeerHostedWorldNode({selfId,worldId:'browser-world',mayorId:'a',hostEligible:true,emit,now:()=>performance.now(),timings:{hostLeaseMs:1800,migrationTimeoutMs:6000},applyCheckpoint:cp=>restored.push(cp.world.value),onPhase:info=>{history.push(info.phase);phaseTimes.push({phase:info.phase,at:performance.now()});sync();}});
    mesh=createPeerMeshCoordinator({selfId,RTCPeerConnection:LocalRTC,relay:event=>send(node.snapshot().hostId,{type:'mesh-relay',...event}),onMessage:handle});
    const timer=setInterval(()=>node.tick(),40);
    window.__PEER_NETWORK_TEST__={
      async offer(id){const peer=await createHostOffer({RTCPeerConnection:LocalRTC,dualChannel:true,onMessage:m=>handle(id,m)});direct.set(id,peer);return peer.code;},
      async answer(id,offer){const peer=await acceptHostOffer(offer,{RTCPeerConnection:LocalRTC,dualChannel:true,onMessage:m=>handle(id,m)});direct.set(id,peer);return peer.code;},
      accept:(id,answer)=>direct.get(id).accept(answer),
      ready:id=>direct.get(id)?.channel?.readyState==='open',
      start(){node.seedHost();node.hostAdmit('b',{eligible:true});node.hostAdmit('c',{eligible:true});this.checkpoint(7);},
      checkpoint:value=>node.publishCheckpoint({schemaVersion:1,worldTimeMs:value,world:{value},characters:[],npcs:[],randomState:null,session:null}),
      handoff:()=>node.gracefulHandoff(),
      snapshot:()=>({node:node.snapshot(),mesh:mesh.snapshot(),history:[...history],phaseTimes:[...phaseTimes],restored:[...restored],direct:[...direct].map(([id,p])=>({id,connection:p.pc.connectionState,ice:p.pc.iceConnectionState,gathering:p.pc.iceGatheringState,channel:p.channel?.readyState,localCandidates:(p.pc.localDescription?.sdp.match(/a=candidate:/g)||[]).length,remoteCandidates:(p.pc.remoteDescription?.sdp.match(/a=candidate:/g)||[]).length}))}),
      crash(){closed=true;clearInterval(timer);node.close();mesh.close();for(const peer of direct.values())peer.close();},
    };
  },{selfId,modules});
}
