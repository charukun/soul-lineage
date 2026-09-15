import {emptyPeerWorldRegistry,createPeerWorldRoom,listPeerWorldRooms,joinPeerWorldRoom,readHostEvents,postPeerWorldOffer,readGuestEvents,postPeerWorldAnswer,updatePeerWorldTelemetry,deletePeerWorldRoom,publicPeerWorldSnapshot} from '../../ops-board/peer-world-registry.mjs';

// Exercises the exact bounded registry locally; RTCPeerConnection stays native.
// Neither the successful auto path nor the manual fallback contacts live PULSE.
export async function installPrivateSignalingHarness(contexts,{available=true}={}){
 let state=emptyPeerWorldRegistry();
 const calls=[];
 for(const context of contexts)await context.route('https://rinne-ops.c-okamoto.workers.dev/api/peer-world/**',async route=>{
  if(!available){await route.fulfill({status:503,contentType:'application/json',body:'{"error":"signaling_unavailable"}'});return;}
  const request=route.request(),url=new URL(request.url()),parts=url.pathname.split('/').filter(Boolean),method=request.method(),auth=(request.headers().authorization||'').replace(/^Bearer /,''),body=request.postDataJSON()||{},now=Date.now();
  calls.push({method,path:url.pathname});
  try{
   let result;
   if(parts.length===3&&method==='POST')result=createPeerWorldRoom(state,body,now);
   else if(parts.length===3&&method==='GET')result=listPeerWorldRooms(state,now);
   else if(parts.length===4&&method==='DELETE')result=deletePeerWorldRoom(state,parts[3],auth,now);
   else if(parts[4]==='join')result=joinPeerWorldRoom(state,parts[3],{...body,inviteToken:auth},now);
   else if(parts[4]==='host-events')result=readHostEvents(state,parts[3],auth,Number(url.searchParams.get('after')||0),now);
   else if(parts[4]==='telemetry')result=updatePeerWorldTelemetry(state,parts[3],auth,body,now);
   else if(parts[6]==='offer')result=postPeerWorldOffer(state,parts[3],parts[5],auth,body.offer,now);
   else if(parts[6]==='answer')result=postPeerWorldAnswer(state,parts[3],parts[5],auth,body.answer,now);
   else if(parts[6]==='events')result=readGuestEvents(state,parts[3],parts[5],auth,Number(url.searchParams.get('after')||0),now);
   else throw new Error('not_found');
   state=result.state;
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(result.result)});
  }catch(error){await route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({error:error.message})});}
 });
 return {snapshot:()=>publicPeerWorldSnapshot(state),calls:()=>[...calls]};
}
