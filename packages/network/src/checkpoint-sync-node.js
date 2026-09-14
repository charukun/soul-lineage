import {createPeerHostedWorldNode} from './peer-hosted-world-core.js';
import {validateVillageCheckpoint} from './village-checkpoint.js';
import {appendCheckpoint,applyCatchupPayload,applyCheckpointDelta,checkpointDigest,checkpointJournalDiagnostics,createCatchupPayload,createCheckpointJournal,rebaseCheckpointJournal} from './checkpoint-sync.js';

const clone=value=>structuredClone(value);
const byteLength=value=>new TextEncoder().encode(JSON.stringify(value??null)).byteLength;

export function createCheckpointSyncedWorldNode(options={}){
 const {emit=()=>{},now=()=>Date.now(),validateCheckpoint=validateVillageCheckpoint}=options;
 let base=null,journal=createCheckpointJournal(),activeSync=null;
 const metrics={fullSentBytes:0,deltaSentBytes:0,catchupSentBytes:0,catchupRequests:0,fullFallbacks:0,appliedDeltas:0,digestFailures:0,lastCatchupMs:null};
 const emitMeasured=(event,kind)=>{const n=byteLength(event.message);if(kind==='full')metrics.fullSentBytes+=n;else if(kind==='delta')metrics.deltaSentBytes+=n;else if(kind==='catchup')metrics.catchupSentBytes+=n;emit(event);};
 function resetJournal(epoch,revision,checkpoint){journal=createCheckpointJournal({epoch,revision,checkpoint,maxEntries:24,maxBytes:700_000});}
 function prepareEpoch(epoch,revision){if(journal.epoch===epoch)return;if(journal.latestCheckpoint!==null&&journal.latestRevision===revision)journal=rebaseCheckpointJournal(journal,{epoch,revision,checkpoint:journal.latestCheckpoint});else journal=createCheckpointJournal({epoch,revision:0,checkpoint:null,maxEntries:24,maxBytes:700_000});}
 function absorbPublishedFull(message){
  validateCheckpoint(message.checkpoint);
  if(journal.latestCheckpoint===null){resetJournal(message.epoch,message.revision,message.checkpoint);return{entry:null,full:true};}
  if(message.epoch!==journal.epoch){const previous=message.revision-1;if(journal.latestRevision===previous)journal=rebaseCheckpointJournal(journal,{epoch:message.epoch,revision:previous,checkpoint:journal.latestCheckpoint});else{resetJournal(message.epoch,message.revision,message.checkpoint);return{entry:null,full:true};}}
  if(message.revision===journal.latestRevision&&checkpointDigest(message.checkpoint)===checkpointDigest(journal.latestCheckpoint))return{entry:null,full:false};
  if(message.revision!==journal.latestRevision+1){resetJournal(message.epoch,message.revision,message.checkpoint);return{entry:null,full:true};}
  const result=appendCheckpoint(journal,{epoch:message.epoch,revision:message.revision,checkpoint:message.checkpoint});journal=result.journal;return{entry:result.entry,full:false};
 }
 function catchupMessage(knownRevision=0,knownDigest=null){const snap=base?.snapshot()||{};const payload=createCatchupPayload(journal,knownRevision,knownDigest);if(payload.kind==='full')metrics.fullFallbacks++;return{type:'world-checkpoint-catchup',worldId:snap.worldId||options.worldId,hostId:snap.hostId||options.selfId,epoch:snap.epoch||journal.epoch,payload};}
 function sendCatchup(peerId,knownRevision=0,knownDigest=null){const message=catchupMessage(knownRevision,knownDigest);emitMeasured({to:peerId,message},'catchup');if(activeSync&&activeSync.peerId===peerId)activeSync.sent=true;return message;}
 function rawEmit(event){
  const message=event.message;
  if(message?.type==='world-sync-request'){
   emit({...event,message:{...message,knownRevision:journal.latestRevision,knownDigest:journal.latestCheckpoint===null?null:checkpointDigest(journal.latestCheckpoint)}});return;
  }
  if(message?.type!=='world-checkpoint'){emit(event);return;}
  const result=absorbPublishedFull(message);
  if(activeSync&&event.to===activeSync.peerId){sendCatchup(event.to,activeSync.knownRevision,activeSync.knownDigest);return;}
  if(result.entry){emitMeasured({...event,message:{type:'world-checkpoint-delta',worldId:message.worldId,hostId:message.hostId,epoch:message.epoch,...clone(result.entry)}},'delta');return;}
  if(result.full)emitMeasured(event,'full');
 }
 base=createPeerHostedWorldNode({...options,emit:rawEmit,validateCheckpoint});
 function requestSync(){const snap=base.snapshot(),hostId=snap.hostId;if(!hostId||hostId===options.selfId)return false;emit({to:hostId,message:{type:'world-sync-request',worldId:snap.worldId,knownEpoch:snap.epoch,knownRevision:journal.latestRevision,knownDigest:journal.latestCheckpoint===null?null:checkpointDigest(journal.latestCheckpoint)}});return true;}
 function acceptDelta(senderId,message){
  const snap=base.snapshot();if(senderId!==snap.hostId||message.worldId!==snap.worldId||message.hostId!==snap.hostId||message.toRevision!==message.fromRevision+1)return false;
  try{
   if(journal.latestCheckpoint===null||journal.latestRevision!==message.fromRevision){requestSync();return false;}
   prepareEpoch(message.epoch,message.fromRevision);
   const checkpoint=applyCheckpointDelta(journal.latestCheckpoint,message,{epoch:message.epoch,revision:journal.latestRevision});validateCheckpoint(checkpoint);
   const accepted=base.receive(senderId,{type:'world-checkpoint',worldId:message.worldId,hostId:message.hostId,epoch:message.epoch,revision:message.toRevision,checkpoint});if(!accepted)return false;
   const result=appendCheckpoint(journal,{epoch:message.epoch,revision:message.toRevision,checkpoint});journal=result.journal;metrics.appliedDeltas++;return true;
  }catch{metrics.digestFailures++;requestSync();return false;}
 }
 function acceptCatchup(senderId,message){
  const snap=base.snapshot();if(senderId!==snap.hostId||message.worldId!==snap.worldId||message.hostId!==snap.hostId||!message.payload)return false;
  const started=now();
  try{
   const current=journal.latestCheckpoint===null?null:journal.latestCheckpoint;
   const applied=applyCatchupPayload(current,{revision:journal.latestRevision},message.payload);
   if(applied.checkpoint===null)return applied.revision===journal.latestRevision;
   validateCheckpoint(applied.checkpoint);
   const accepted=base.receive(senderId,{type:'world-checkpoint',worldId:message.worldId,hostId:message.hostId,epoch:message.epoch,revision:applied.revision,checkpoint:applied.checkpoint});if(!accepted)return false;
   resetJournal(message.epoch,applied.revision,applied.checkpoint);metrics.lastCatchupMs=Math.max(0,now()-started);return true;
  }catch{metrics.digestFailures++;requestSync();return false;}
 }
 function receive(senderId,message){
  if(!message)return false;
  if(message.type==='world-checkpoint-delta')return acceptDelta(senderId,message);
  if(message.type==='world-checkpoint-catchup')return acceptCatchup(senderId,message);
  if(message.type==='world-sync-request'&&base.isHost){metrics.catchupRequests++;activeSync={peerId:senderId,knownRevision:Number.isSafeInteger(message.knownRevision)?message.knownRevision:0,knownDigest:typeof message.knownDigest==='string'?message.knownDigest:null,sent:false};const handled=base.syncPeer(senderId);if(!activeSync.sent)sendCatchup(senderId,activeSync.knownRevision,activeSync.knownDigest);activeSync=null;return handled||true;}
  if(message.type==='world-checkpoint'){
   const handled=base.receive(senderId,message);if(handled)resetJournal(message.epoch,message.revision,message.checkpoint);return handled;
  }
  const handled=base.receive(senderId,message);
  if(handled&&message.type==='world-migration-open'&&journal.latestCheckpoint!==null){const snap=base.snapshot();resetJournal(snap.epoch,journal.latestRevision,journal.latestCheckpoint);}
  return handled;
 }
 function publishCheckpoint(checkpoint){return base.publishCheckpoint(checkpoint);}
 function syncPeer(peerId,knownRevision=0,knownDigest=null){metrics.catchupRequests++;activeSync={peerId,knownRevision,knownDigest,sent:false};const handled=base.syncPeer(peerId);if(!activeSync.sent)sendCatchup(peerId,knownRevision,knownDigest);activeSync=null;return handled;}
 function snapshot(){const snap=base.snapshot();return Object.freeze({...snap,checkpointSync:{...checkpointJournalDiagnostics(journal),...metrics}});}
 return{seedHost:base.seedHost,adoptAuthority:base.adoptAuthority,hostAdmit:base.hostAdmit,hostDisconnect:base.hostDisconnect,publishCheckpoint,receive,tick:base.tick,syncPeer,gracefulHandoff:base.gracefulHandoff,snapshot,close:base.close,catchupPayload:(knownRevision,knownDigest=null)=>createCatchupPayload(journal,knownRevision,knownDigest),requestSync,get isHost(){return base.isHost;},get authority(){return base.authority;}};
}
