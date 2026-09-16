import {combinations,digest} from './canon-nucleus.js';

const clone=value=>structuredClone(value);
const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
const canonical=value=>JSON.stringify(stable(value));
const validId=value=>typeof value==='string'&&/^[\w:.-]{1,120}$/.test(value);

export const PACKET_PHASE=Object.freeze({OPEN:'open',RECOVERING:'recovering',CLOSED:'closed'});
export const PACKET_TYPE=Object.freeze({PREPARE:'prepare',ACK:'ack',COMMIT:'commit'});

export function crashQuorumConfig(failures=1){
  if(!Number.isInteger(failures)||failures<0||failures>8)throw Error('Invalid crash failure budget');
  return Object.freeze({failures,members:2*failures+1,quorum:failures+1});
}

function makeProposal({epoch,revision,parentRoot,operationId,canon,recovery,priorDedupe={}}){
  const payloadKey=canonical({operationId,canon,recovery});
  const recoveryEnvelope={application:clone(recovery),operationDedupe:{...clone(priorDedupe),[operationId]:payloadKey}};
  const proofKey=canonical({epoch,revision,parentRoot,operationId,canon,recovery:recoveryEnvelope});
  return Object.freeze({epoch,revision,parentRoot,operationId,canon:clone(canon),recovery:recoveryEnvelope,payloadKey,proofKey,root:digest({epoch,revision,parentRoot,operationId,canon,recovery:recoveryEnvelope})});
}
function validProposal(p){
  if(!p||!Number.isInteger(p.epoch)||p.epoch<1||!Number.isInteger(p.revision)||p.revision<1||!validId(p.operationId)||typeof p.recovery?.operationDedupe!=='object')return false;
  const payloadKey=canonical({operationId:p.operationId,canon:p.canon,recovery:p.recovery.application});
  return p.payloadKey===payloadKey&&p.recovery.operationDedupe[p.operationId]===payloadKey&&p.proofKey===canonical({epoch:p.epoch,revision:p.revision,parentRoot:p.parentRoot,operationId:p.operationId,canon:p.canon,recovery:p.recovery})&&p.root===digest({epoch:p.epoch,revision:p.revision,parentRoot:p.parentRoot,operationId:p.operationId,canon:p.canon,recovery:p.recovery});
}
const entryKey=p=>`${p.epoch}:${p.revision}`;

export function createCanonPacketProtocol({failures=1,members=null,leaderId=null,allowUnsafeProof=false}={}){
  const config=crashQuorumConfig(failures);members=members??Array.from({length:config.members},(_,i)=>`n${i}`);
  if(!Array.isArray(members)||members.length!==config.members||new Set(members).size!==members.length||members.some(id=>!validId(id)))throw Error(`Canon packet protocol requires ${config.members} unique members`);
  leaderId=leaderId??members[0];if(!members.includes(leaderId))throw Error('Leader must be a member');
  let epoch=1,leader=leaderId,phase=PACKET_PHASE.OPEN,nextRevision=1,active=null,committed=null,serial=1,rejectedStale=0,rejectedConflict=0;
  const nodes=new Map(members.map(id=>[id,{id,alive:true,maxEpoch:1,entries:new Map()}])),queue=[],visible=[];
  const live=()=>members.filter(id=>nodes.get(id).alive);
  const matchingEntry=(node,p)=>{const row=node.entries.get(entryKey(p));return row&&row.proposal.proofKey===p.proofKey&&validProposal(row.proposal)?row:null;};
  const holders=(p,{aliveOnly=true}={})=>p?members.filter(id=>(!aliveOnly||nodes.get(id).alive)&&matchingEntry(nodes.get(id),p)):[];
  function store(node,p,state='prepared',{repair=false}={}){
    if(!validProposal(p))return false;if(!repair&&p.epoch<node.maxEpoch){rejectedStale++;return false;}
    const key=entryKey(p),prior=node.entries.get(key);if(prior&&prior.proposal.proofKey!==p.proofKey){rejectedConflict++;return false;}
    node.entries.set(key,{proposal:clone(p),state:state==='committed'||prior?.state==='committed'?'committed':'prepared'});if(!repair)node.maxEpoch=Math.max(node.maxEpoch,p.epoch);return true;
  }
  const enqueue=(type,from,to,p)=>queue.push({serial:serial++,type,from,to,epoch:p.epoch,revision:p.revision,root:p.root,proofKey:p.proofKey,proposal:type===PACKET_TYPE.ACK?null:clone(p)});
  const receipt=(p,extra={})=>Object.freeze({epoch:p.epoch,revision:p.revision,parentRoot:p.parentRoot,operationId:p.operationId,root:p.root,...extra});
  function begin({operationId,canon,recovery,expectedEpoch=epoch}={}){
    if(expectedEpoch!==epoch)throw Error('Stale authority epoch');if(phase!==PACKET_PHASE.OPEN||!leader||!nodes.get(leader).alive)throw Error('Canon authority is not open');if(!validId(operationId))throw Error('Canon operation id is required');
    const payloadKey=canonical({operationId,canon,recovery}),priorKey=committed?.recovery?.operationDedupe?.[operationId];
    if(priorKey){
      if(priorKey!==payloadKey)throw Error('Canon operation payload conflict');
      if(committed.operationId===operationId&&!visible.some(row=>row.root===committed.root)){const replay=receipt(committed,{recovered:true,replayOf:operationId,confirmedByRetry:true});visible.push({...replay,durableAtVisibility:holders(committed).length});return{replay:true,receipt:clone(replay),proposal:clone(committed)};}
      return{replay:true,receipt:{...receipt(committed,{recovered:true,replayOf:operationId}),operationId},proposal:clone(committed)};
    }
    if(active&&!active.visible)throw Error('Canon operation already pending');
    const p=makeProposal({epoch,revision:nextRevision++,parentRoot:committed?.root??'genesis',operationId,canon,recovery,priorDedupe:committed?.recovery?.operationDedupe??{}});
    if(!store(nodes.get(leader),p,'prepared'))throw Error('Leader could not durably prepare Canon');active={proposal:p,acks:new Set([leader]),visible:false};for(const id of members)if(id!==leader)enqueue(PACKET_TYPE.PREPARE,leader,id,p);return{replay:false,proposal:clone(p)};
  }
  function handle(message){
    const target=nodes.get(message.to);if(!target?.alive)return false;
    if(message.type===PACKET_TYPE.PREPARE){if(!store(target,message.proposal,'prepared'))return false;enqueue(PACKET_TYPE.ACK,message.to,message.from,message.proposal);return true;}
    if(message.type===PACKET_TYPE.ACK){if(message.epoch<target.maxEpoch){rejectedStale++;return false;}if(!leader||message.to!==leader||!active||active.proposal.epoch!==message.epoch||active.proposal.revision!==message.revision||active.proposal.proofKey!==message.proofKey)return false;const source=nodes.get(message.from);if(!source||!matchingEntry(source,active.proposal))return false;active.acks.add(message.from);return true;}
    if(message.type===PACKET_TYPE.COMMIT)return store(target,message.proposal,'committed');return false;
  }
  function deliverSerial(id){const index=queue.findIndex(row=>row.serial===id);if(index<0)return false;const[message]=queue.splice(index,1);return handle(message);}
  const deliverWhere=predicate=>{const row=queue.find(predicate);return row?deliverSerial(row.serial):false;};
  const dropWhere=predicate=>{const index=queue.findIndex(predicate);if(index<0)return false;queue.splice(index,1);return true;};
  function dropAll(predicate=()=>true){let count=0;for(let i=queue.length-1;i>=0;i--)if(predicate(queue[i])){queue.splice(i,1);count++;}return count;}
  function duplicateWhere(predicate){const row=queue.find(predicate);if(!row)return false;queue.push({...clone(row),serial:serial++});return true;}
  function inject(message){if(!message||!Object.values(PACKET_TYPE).includes(message.type)||!members.includes(message.from)||!members.includes(message.to))throw Error('Invalid injected proof message');queue.push({...clone(message),serial:serial++});return true;}
  function retryPrepare(){if(!active||active.visible||phase!==PACKET_PHASE.OPEN||!leader)return false;for(const id of members)if(id!==leader&&nodes.get(id).alive)enqueue(PACKET_TYPE.PREPARE,leader,id,active.proposal);return true;}
  const quorumReady=()=>Boolean(active&&!active.visible&&active.acks.size>=config.quorum&&holders(active.proposal).length>=config.quorum);
  function publish(){if(!quorumReady())throw Error('Canon durable quorum unavailable');if(phase!==PACKET_PHASE.OPEN||!leader||!nodes.get(leader).alive)throw Error('Canon authority is not open');active.visible=true;committed=clone(active.proposal);store(nodes.get(leader),active.proposal,'committed',{repair:true});const row={...receipt(active.proposal),durableAtVisibility:holders(active.proposal).length};visible.push(row);for(const id of members)if(id!==leader)enqueue(PACKET_TYPE.COMMIT,leader,id,active.proposal);return clone(row);}
  function unsafePublishBeforeQuorum(){if(!allowUnsafeProof)throw Error('Unsafe proof path disabled');if(!active)throw Error('No pending proposal');active.visible=true;committed=clone(active.proposal);const row={...receipt(active.proposal),durableAtVisibility:holders(active.proposal).length,unsafe:true};visible.push(row);return clone(row);}
  function crash(ids){for(const id of Array.isArray(ids)?ids:[ids])if(nodes.has(id))nodes.get(id).alive=false;if(live().length<config.quorum){leader=null;phase=PACKET_PHASE.CLOSED;return snapshot();}if(!leader||!nodes.get(leader).alive){leader=null;phase=PACKET_PHASE.RECOVERING;return snapshot();}if(committed&&holders(committed).length<config.quorum)phase=PACKET_PHASE.RECOVERING;return snapshot();}
  function revive(id){const node=nodes.get(id);if(!node)throw Error('Unknown member');node.alive=true;return snapshot();}
  function bestSurvivingProposal(){const candidates=[];for(const id of live())for(const row of nodes.get(id).entries.values())if(validProposal(row.proposal))candidates.push(row.proposal);if(!candidates.length)return null;candidates.sort((a,b)=>b.epoch-a.epoch||b.revision-a.revision||a.proofKey.localeCompare(b.proofKey));const top=candidates[0],same=candidates.filter(p=>p.epoch===top.epoch&&p.revision===top.revision);return new Set(same.map(p=>p.proofKey)).size>1?false:clone(top);}
  function recover({candidateId=live()[0]}={}){
    const survivors=live();if(survivors.length<config.quorum){leader=null;phase=PACKET_PHASE.CLOSED;return false;}if(!survivors.includes(candidateId))throw Error('Recovery candidate must be live');if(phase===PACKET_PHASE.OPEN&&leader&&nodes.get(leader).alive)return true;
    const chosen=bestSurvivingProposal();if(chosen===false){leader=null;phase=PACKET_PHASE.CLOSED;return false;}const lastVisibleRoot=visible.at(-1)?.root??'genesis';if(chosen&&chosen.root!==lastVisibleRoot&&chosen.parentRoot!==lastVisibleRoot){leader=null;phase=PACKET_PHASE.CLOSED;return false;}
    const leaderChanged=!leader||!nodes.get(leader)?.alive;if(chosen){for(const id of survivors)store(nodes.get(id),chosen,'committed',{repair:true});committed=clone(chosen);nextRevision=Math.max(nextRevision,chosen.revision+1);}else if(visible.length){leader=null;phase=PACKET_PHASE.CLOSED;return false;}
    if(leaderChanged){epoch+=1;leader=candidateId;}for(const id of survivors)nodes.get(id).maxEpoch=Math.max(nodes.get(id).maxEpoch,epoch);active=null;phase=PACKET_PHASE.OPEN;return !committed||holders(committed).length>=config.quorum;
  }
  function safety(){
    const keys=new Map(),conflicts=[];let parent='genesis';for(const row of visible){const key=`${row.epoch}:${row.revision}`,prior=keys.get(key);if(prior&&prior!==row.root)conflicts.push(key);else keys.set(key,row.root);if(row.parentRoot!==parent)conflicts.push(`parent:${key}`);parent=row.root;}
    const quorumVisibility=visible.every(row=>row.durableAtVisibility>=config.quorum),openDurability=phase!==PACKET_PHASE.OPEN||!committed||holders(committed).length>=config.quorum;return Object.freeze({pass:conflicts.length===0&&quorumVisibility&&openDurability,conflicts,quorumVisibility,openDurability});
  }
  function snapshot(){return Object.freeze({config,epoch,phase,leaderId:leader,live:live(),committed:committed?receipt(committed,{recovered:true}):null,holders:committed?holders(committed):[],visible:clone(visible),pending:clone(queue),rejectedStale,rejectedConflict,safety:safety(),nodes:Object.fromEntries(members.map(id=>[id,{alive:nodes.get(id).alive,maxEpoch:nodes.get(id).maxEpoch,entries:[...nodes.get(id).entries.values()].map(row=>({state:row.state,epoch:row.proposal.epoch,revision:row.proposal.revision,root:row.proposal.root,parentRoot:row.proposal.parentRoot,operationId:row.proposal.operationId}))}]))});}
  return{begin,publish,unsafePublishBeforeQuorum,crash,revive,recover,retryPrepare,deliverSerial,deliverWhere,dropWhere,dropAll,duplicateWhere,inject,pending:()=>clone(queue),snapshot,safety,get epoch(){return epoch;},get phase(){return phase;},get leaderId(){return leader;}};
}

export function proveGeneralCrashQuorums({maxFailures=4}={}){
  if(!Number.isInteger(maxFailures)||maxFailures<1||maxFailures>5)throw Error('Invalid max failure proof');const rows=[];
  for(let f=1;f<=maxFailures;f++){const{members:n,quorum:q}=crashQuorumConfig(f),ids=Array.from({length:n},(_,i)=>`n${i}`),quorums=combinations(ids,q),failures=combinations(ids,f);let minIntersection=Infinity,minSurvivingCopies=Infinity;for(const left of quorums)for(const right of quorums)minIntersection=Math.min(minIntersection,left.filter(id=>right.includes(id)).length);for(const committers of quorums)for(const failed of failures)minSurvivingCopies=Math.min(minSurvivingCopies,committers.filter(id=>!failed.includes(id)).length);const liveAfterFailures=n-f,liveWithOneFewer=2*f-f;rows.push({failures:f,members:n,quorum:q,quorumCount:quorums.length,failureSets:failures.length,minIntersection,minSurvivingCopies,liveAfterFailures,minimalMemberCounterexample:{members:2*f,liveAfterFailures:liveWithOneFewer,canReopenQuorum:liveWithOneFewer>=q},pass:minIntersection>=1&&minSurvivingCopies>=1&&liveAfterFailures>=q&&liveWithOneFewer<q});}
  return{pass:rows.every(row=>row.pass),rows};
}

export function proveTwoPeerNoWitnessBoundary(){const policies=[];for(const aCanOpenAlone of[false,true])for(const bCanOpenAlone of[false,true]){const availableAfterBCrash=aCanOpenAlone,availableAfterACrash=bCanOpenAlone,splitBrainSafe=!(aCanOpenAlone&&bCanOpenAlone);policies.push({aCanOpenAlone,bCanOpenAlone,availableAfterACrash,availableAfterBCrash,splitBrainSafe,satisfiesAll:availableAfterACrash&&availableAfterBCrash&&splitBrainSafe});}return{model:'two peers, arbitrary partition, no external witness/fencing clock',pass:policies.every(row=>!row.satisfiesAll),policies,requiresAdditionalFailureDiscriminator:true};}

const deliverPrepare=(protocol,to)=>protocol.deliverWhere(row=>row.type===PACKET_TYPE.PREPARE&&row.to===to),deliverAck=(protocol,from)=>protocol.deliverWhere(row=>row.type===PACKET_TYPE.ACK&&row.from===from);
function recoverIfNeeded(protocol){const snap=protocol.snapshot();return snap.phase===PACKET_PHASE.RECOVERING?protocol.recover({candidateId:snap.live[0]}):snap.phase===PACKET_PHASE.OPEN;}

export function proveCanonPacketInterleavings(){
  const members=['n0','n1','n2'],ackSets=[['n1'],['n2'],['n1','n2']],stages=['before-store','after-store','after-ack','after-visible','after-partial-commit'],cases=[];
  for(const ackSet of ackSets)for(const stage of stages)for(const failed of members){const protocol=createCanonPacketProtocol({failures:1,members,leaderId:'n0'}),started=protocol.begin({operationId:'life:1:end',canon:{lifeId:'life:1',ended:true},recovery:{tick:120,lifeId:'life:1'}}),proposal=started.proposal;if(stage!=='before-store')for(const id of ackSet)deliverPrepare(protocol,id);if(!['before-store','after-store'].includes(stage))for(const id of ackSet)deliverAck(protocol,id);if(['after-visible','after-partial-commit'].includes(stage)){protocol.publish();if(stage==='after-partial-commit')protocol.deliverWhere(row=>row.type===PACKET_TYPE.COMMIT&&row.to!==failed);}const visibleBefore=protocol.snapshot().visible.length>0;protocol.crash(failed);const recovered=recoverIfNeeded(protocol),snap=protocol.snapshot(),sameRoot=!snap.committed||snap.committed.root===proposal.root,visibleSafe=!visibleBefore||(recovered&&snap.phase===PACKET_PHASE.OPEN&&snap.visible.at(-1)?.root===proposal.root&&snap.holders.length>=2);cases.push({ackSet,stage,failed,visibleBefore,recovered,phase:snap.phase,holders:snap.holders.length,sameRoot,visibleSafe,pass:snap.safety.pass&&sameRoot&&visibleSafe});}
  const followerDies=createCanonPacketProtocol({failures:1,members,leaderId:'n0'});followerDies.begin({operationId:'life:2:end',canon:{ended:true},recovery:{tick:200}});deliverPrepare(followerDies,'n1');deliverAck(followerDies,'n1');followerDies.crash('n1');let publishBlocked=false;try{followerDies.publish();}catch{publishBlocked=true;}deliverPrepare(followerDies,'n2');deliverAck(followerDies,'n2');const repairedReceipt=followerDies.publish();return{pass:cases.every(row=>row.pass)&&publishBlocked&&Boolean(repairedReceipt),cases,publishBlockedWhenAckHolderDies:publishBlocked,repairedWithAlternateFollower:Boolean(repairedReceipt)};
}

export function proveGeneralPacketCrashRecovery({maxFailures=3}={}){
  if(!Number.isInteger(maxFailures)||maxFailures<1||maxFailures>3)throw Error('Invalid generalized packet sweep');const rows=[];let cases=0;
  for(let f=1;f<=maxFailures;f++){const{members:n,quorum:q}=crashQuorumConfig(f),members=Array.from({length:n},(_,i)=>`n${i}`);let familyPass=true,familyCases=0;for(const leader of members)for(const followers of combinations(members.filter(id=>id!==leader),q-1))for(const failed of combinations(members,f)){const protocol=createCanonPacketProtocol({failures:f,members,leaderId:leader}),started=protocol.begin({operationId:`f${f}:${leader}:${followers.join('.')}`,canon:{f,leader},recovery:{tick:f}});for(const id of followers){deliverPrepare(protocol,id);deliverAck(protocol,id);}const receipt=protocol.publish();protocol.crash(failed);const recovered=recoverIfNeeded(protocol),snap=protocol.snapshot(),pass=recovered&&snap.phase===PACKET_PHASE.OPEN&&snap.visible[0]?.root===receipt.root&&snap.committed?.root===started.proposal.root&&snap.holders.length>=q&&snap.safety.pass;familyPass&&=pass;familyCases++;cases++;}rows.push({failures:f,members:n,quorum:q,cases:familyCases,pass:familyPass});}
  return{pass:rows.every(row=>row.pass),cases,rows};
}

export function proveSequentialEpochAndDedupe(){
  const protocol=createCanonPacketProtocol(),a=protocol.begin({operationId:'life:A',canon:{generation:1},recovery:{tick:10}});deliverPrepare(protocol,'n1');deliverAck(protocol,'n1');const ar=protocol.publish();protocol.dropAll();
  const b=protocol.begin({operationId:'life:B',canon:{generation:2},recovery:{tick:20}});deliverPrepare(protocol,'n2');protocol.dropAll(row=>row.type===PACKET_TYPE.ACK);protocol.crash('n0');const recovered=protocol.recover({candidateId:'n1'}),afterRecovery=protocol.snapshot();
  const replayB=protocol.begin({operationId:'life:B',canon:{generation:2},recovery:{tick:20}}),revisionAfterB=protocol.snapshot().committed.revision,replayA=protocol.begin({operationId:'life:A',canon:{generation:1},recovery:{tick:10}});let conflictRejected=false;try{protocol.begin({operationId:'life:A',canon:{generation:999},recovery:{tick:10}});}catch{conflictRejected=true;}
  const c=protocol.begin({operationId:'life:C',canon:{generation:3},recovery:{tick:30}});deliverPrepare(protocol,'n2');deliverAck(protocol,'n2');const cr=protocol.publish(),stale={type:PACKET_TYPE.PREPARE,from:'n0',to:'n1',epoch:b.proposal.epoch,revision:b.proposal.revision,root:b.proposal.root,proofKey:b.proposal.proofKey,proposal:b.proposal};protocol.inject(stale);const staleAccepted=protocol.deliverWhere(row=>row.type===PACKET_TYPE.PREPARE&&row.epoch===b.proposal.epoch&&row.revision===b.proposal.revision),final=protocol.snapshot(),roots=final.visible.map(row=>row.root),parents=final.visible.map(row=>row.parentRoot);
  return{pass:recovered&&afterRecovery.committed?.root===b.proposal.root&&replayB.replay&&replayA.replay&&revisionAfterB===b.proposal.revision&&conflictRejected&&ar.parentRoot==='genesis'&&cr.parentRoot===b.proposal.root&&staleAccepted===false&&final.rejectedStale>=1&&roots.length===3&&roots[0]===a.proposal.root&&roots[1]===b.proposal.root&&roots[2]===c.proposal.root&&parents[0]==='genesis'&&parents[1]===a.proposal.root&&parents[2]===b.proposal.root&&final.safety.pass,recovered,replayCurrentOperation:replayB.replay,replayOlderOperation:replayA.replay,conflictRejected,staleAccepted,visible:final.visible,safety:final.safety};
}

export function proveFiniteBurstAndDuplicateSafety({maxBurst=16}={}){
  const burstCases=[];for(let burst=0;burst<=maxBurst;burst++){const protocol=createCanonPacketProtocol(),started=protocol.begin({operationId:`burst:${burst}`,canon:{value:burst},recovery:{tick:burst}});for(let i=0;i<burst;i++){protocol.dropAll();protocol.retryPrepare();}deliverPrepare(protocol,'n1');deliverAck(protocol,'n1');const receipt=protocol.publish();burstCases.push({burst,root:receipt.root,pass:protocol.snapshot().safety.pass&&receipt.root===started.proposal.root});}
  const duplicate=createCanonPacketProtocol(),started=duplicate.begin({operationId:'dup:1',canon:{value:1},recovery:{tick:1}});duplicate.duplicateWhere(row=>row.type===PACKET_TYPE.PREPARE&&row.to==='n1');while(duplicate.deliverWhere(row=>row.type===PACKET_TYPE.PREPARE&&row.to==='n1')){};duplicate.duplicateWhere(row=>row.type===PACKET_TYPE.ACK&&row.from==='n1');while(duplicate.deliverWhere(row=>row.type===PACKET_TYPE.ACK&&row.from==='n1')){};const visible=duplicate.publish();duplicate.duplicateWhere(row=>row.type===PACKET_TYPE.COMMIT&&row.to==='n2');while(duplicate.deliverWhere(row=>row.type===PACKET_TYPE.COMMIT&&row.to==='n2')){};duplicate.crash('n0');duplicate.recover({candidateId:'n1'});const recovered=duplicate.snapshot(),stale={type:PACKET_TYPE.PREPARE,from:'n0',to:'n1',epoch:started.proposal.epoch,revision:started.proposal.revision,root:started.proposal.root,proofKey:started.proposal.proofKey,proposal:started.proposal};duplicate.inject(stale);const staleDelivered=duplicate.deliverWhere(row=>row.serial===duplicate.pending().at(-1)?.serial),afterStale=duplicate.snapshot();const permanent=createCanonPacketProtocol();permanent.begin({operationId:'partition:1',canon:{value:1},recovery:{tick:1}});permanent.dropAll();let partitionPublishBlocked=false;try{permanent.publish();}catch{partitionPublishBlocked=true;}return{pass:burstCases.every(row=>row.pass)&&visible.root===started.proposal.root&&recovered.safety.pass&&staleDelivered===false&&afterStale.rejectedStale>=1&&partitionPublishBlocked,burstCases,duplicateReorderSafe:recovered.safety.pass,staleEpochRejected:staleDelivered===false&&afterStale.rejectedStale>=1,permanentPartitionMakesNoLivenessClaim:partitionPublishBlocked};
}

export function proveUnsafeEarlyVisibilityCounterexample(){const protocol=createCanonPacketProtocol({allowUnsafeProof:true}),started=protocol.begin({operationId:'unsafe:1',canon:{value:1},recovery:{tick:1}}),visible=protocol.unsafePublishBeforeQuorum();protocol.dropAll();protocol.crash('n0');const recovered=protocol.recover({candidateId:'n1'}),snap=protocol.snapshot();return{pass:visible.durableAtVisibility<2&&recovered===false&&snap.phase===PACKET_PHASE.CLOSED,visibleRoot:visible.root,proposalRoot:started.proposal.root,durableAtVisibility:visible.durableAtVisibility,recovered,phase:snap.phase,counterexample:'client-visible Canon before durable quorum can disappear with one allowed leader crash'};}

export function runCanonPacketProofSuite(){const generalized=proveGeneralCrashQuorums(),packetSweep=proveGeneralPacketCrashRecovery(),twoPeer=proveTwoPeerNoWitnessBoundary(),interleavings=proveCanonPacketInterleavings(),sequential=proveSequentialEpochAndDedupe(),faults=proveFiniteBurstAndDuplicateSafety(),unsafe=proveUnsafeEarlyVisibilityCounterexample();return{pass:generalized.pass&&packetSweep.pass&&twoPeer.pass&&interleavings.pass&&sequential.pass&&faults.pass&&unsafe.pass,generalized,packetSweep,twoPeer,interleavings,sequential,faults,unsafe,limits:['crash faults only; Byzantine behavior remains out of scope','finite burst proof assumes eventual delivery after the burst; permanent partition has no liveness guarantee','prepared-but-unacknowledged operations may be completed after recovery; recovery-carried operation dedupe makes stable client retry idempotent','2-peer impossibility statement assumes arbitrary partition with no external witness, fencing service or trusted bounded-drift lease']};}
