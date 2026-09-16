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

function proposalFor({epoch,revision,parentRoot,operationId,canon,recovery}){
  const payloadKey=canonical({operationId,canon,recovery});
  const proofKey=canonical({epoch,revision,parentRoot,operationId,canon,recovery});
  return Object.freeze({epoch,revision,parentRoot,operationId,canon:clone(canon),recovery:clone(recovery),payloadKey,proofKey,root:digest({epoch,revision,parentRoot,operationId,canon,recovery})});
}
function validProposal(proposal){
  if(!proposal||!Number.isInteger(proposal.epoch)||proposal.epoch<1||!Number.isInteger(proposal.revision)||proposal.revision<1||!validId(proposal.operationId))return false;
  return proposal.payloadKey===canonical({operationId:proposal.operationId,canon:proposal.canon,recovery:proposal.recovery})&&proposal.proofKey===canonical({epoch:proposal.epoch,revision:proposal.revision,parentRoot:proposal.parentRoot,operationId:proposal.operationId,canon:proposal.canon,recovery:proposal.recovery})&&proposal.root===digest({epoch:proposal.epoch,revision:proposal.revision,parentRoot:proposal.parentRoot,operationId:proposal.operationId,canon:proposal.canon,recovery:proposal.recovery});
}
const entryKey=proposal=>`${proposal.epoch}:${proposal.revision}`;

export function createCanonPacketProtocol({failures=1,members=null,leaderId=null,allowUnsafeProof=false}={}){
  const config=crashQuorumConfig(failures);members=members??Array.from({length:config.members},(_,i)=>`n${i}`);
  if(!Array.isArray(members)||members.length!==config.members||new Set(members).size!==members.length||members.some(id=>!validId(id)))throw Error(`Canon packet protocol requires ${config.members} unique members`);
  leaderId=leaderId??members[0];if(!members.includes(leaderId))throw Error('Leader must be a member');
  let epoch=1,leader=leaderId,phase=PACKET_PHASE.OPEN,nextRevision=1,active=null,committed=null,serial=1,rejectedStale=0,rejectedConflict=0;
  const nodes=new Map(members.map(id=>[id,{id,alive:true,maxEpoch:1,entries:new Map()}]));
  const queue=[],visible=[];
  const live=()=>members.filter(id=>nodes.get(id).alive);
  const liveCount=()=>live().length;
  function matchingEntry(node,proposal){const row=node.entries.get(entryKey(proposal));return row&&row.proposal.proofKey===proposal.proofKey&&validProposal(row.proposal)?row:null;}
  function holders(proposal,{aliveOnly=true}={}){if(!proposal)return[];return members.filter(id=>(!aliveOnly||nodes.get(id).alive)&&matchingEntry(nodes.get(id),proposal));}
  function store(node,proposal,state='prepared',{repair=false}={}){
    if(!validProposal(proposal))return false;
    if(!repair&&proposal.epoch<node.maxEpoch){rejectedStale++;return false;}
    const key=entryKey(proposal),prior=node.entries.get(key);
    if(prior&&prior.proposal.proofKey!==proposal.proofKey){rejectedConflict++;return false;}
    node.entries.set(key,{proposal:clone(proposal),state:state==='committed'||prior?.state==='committed'?'committed':'prepared'});
    if(!repair)node.maxEpoch=Math.max(node.maxEpoch,proposal.epoch);
    return true;
  }
  function enqueue(type,from,to,proposal){queue.push({serial:serial++,type,from,to,epoch:proposal.epoch,revision:proposal.revision,root:proposal.root,proofKey:proposal.proofKey,proposal:type===PACKET_TYPE.ACK?null:clone(proposal)});}
  function receipt(proposal,{recovered=false}={}){return Object.freeze({epoch:proposal.epoch,revision:proposal.revision,operationId:proposal.operationId,root:proposal.root,recovered});}
  function begin({operationId,canon,recovery,expectedEpoch=epoch}={}){
    if(expectedEpoch!==epoch)throw Error('Stale authority epoch');if(phase!==PACKET_PHASE.OPEN||!leader||!nodes.get(leader).alive)throw Error('Canon authority is not open');if(!validId(operationId))throw Error('Canon operation id is required');
    const payloadKey=canonical({operationId,canon,recovery});
    if(committed?.operationId===operationId){if(committed.payloadKey!==payloadKey)throw Error('Canon operation payload conflict');const replay=receipt(committed,{recovered:true});if(!visible.some(row=>row.root===replay.root))visible.push({...replay,durableAtVisibility:holders(committed).length,replayed:true});return{replay:true,receipt:clone(replay),proposal:clone(committed)};}
    if(active&&!active.visible)throw Error('Canon operation already pending');
    const proposal=proposalFor({epoch,revision:nextRevision++,parentRoot:committed?.root??'genesis',operationId,canon,recovery});
    const leaderNode=nodes.get(leader);if(!store(leaderNode,proposal,'prepared'))throw Error('Leader could not durably prepare Canon');
    active={proposal,acks:new Set([leader]),visible:false};for(const id of members)if(id!==leader)enqueue(PACKET_TYPE.PREPARE,leader,id,proposal);
    return{replay:false,proposal:clone(proposal)};
  }
  function handle(message){
    const target=nodes.get(message.to);if(!target?.alive)return false;
    if(message.type===PACKET_TYPE.PREPARE){if(!store(target,message.proposal,'prepared'))return false;enqueue(PACKET_TYPE.ACK,message.to,message.from,message.proposal);return true;}
    if(message.type===PACKET_TYPE.ACK){
      if(message.epoch<target.maxEpoch){rejectedStale++;return false;}if(!leader||message.to!==leader||!active||active.proposal.epoch!==message.epoch||active.proposal.revision!==message.revision||active.proposal.proofKey!==message.proofKey)return false;
      const source=nodes.get(message.from);if(!source||!matchingEntry(source,active.proposal))return false;active.acks.add(message.from);return true;
    }
    if(message.type===PACKET_TYPE.COMMIT){if(!store(target,message.proposal,'committed'))return false;return true;}
    return false;
  }
  function deliverSerial(id){const index=queue.findIndex(row=>row.serial===id);if(index<0)return false;const[message]=queue.splice(index,1);return handle(message);}
  function deliverWhere(predicate){const row=queue.find(predicate);return row?deliverSerial(row.serial):false;}
  function dropWhere(predicate){const index=queue.findIndex(predicate);if(index<0)return false;queue.splice(index,1);return true;}
  function dropAll(predicate=()=>true){let count=0;for(let i=queue.length-1;i>=0;i--)if(predicate(queue[i])){queue.splice(i,1);count++;}return count;}
  function duplicateWhere(predicate){const row=queue.find(predicate);if(!row)return false;queue.push({...clone(row),serial:serial++});return true;}
  function inject(message){if(!message||!Object.values(PACKET_TYPE).includes(message.type)||!members.includes(message.from)||!members.includes(message.to))throw Error('Invalid injected proof message');queue.push({...clone(message),serial:serial++});return true;}
  function retryPrepare(){if(!active||active.visible||phase!==PACKET_PHASE.OPEN||!leader)return false;for(const id of members)if(id!==leader&&nodes.get(id).alive)enqueue(PACKET_TYPE.PREPARE,leader,id,active.proposal);return true;}
  function quorumReady(){return Boolean(active&&!active.visible&&active.acks.size>=config.quorum&&holders(active.proposal).length>=config.quorum);}
  function publish(){
    if(!quorumReady())throw Error('Canon durable quorum unavailable');if(phase!==PACKET_PHASE.OPEN||!leader||!nodes.get(leader).alive)throw Error('Canon authority is not open');
    active.visible=true;committed=clone(active.proposal);store(nodes.get(leader),active.proposal,'committed',{repair:true});const durableAtVisibility=holders(active.proposal).length;const row={...receipt(active.proposal),durableAtVisibility};visible.push(row);for(const id of members)if(id!==leader)enqueue(PACKET_TYPE.COMMIT,leader,id,active.proposal);return clone(row);
  }
  function unsafePublishBeforeQuorum(){if(!allowUnsafeProof)throw Error('Unsafe proof path disabled');if(!active)throw Error('No pending proposal');active.visible=true;committed=clone(active.proposal);const row={...receipt(active.proposal),durableAtVisibility:holders(active.proposal).length,unsafe:true};visible.push(row);return clone(row);}
  function crash(ids){for(const id of Array.isArray(ids)?ids:[ids])if(nodes.has(id))nodes.get(id).alive=false;if(liveCount()<config.quorum){leader=null;phase=PACKET_PHASE.CLOSED;return snapshot();}if(!leader||!nodes.get(leader).alive){leader=null;phase=PACKET_PHASE.RECOVERING;return snapshot();}if(committed&&holders(committed).length<config.quorum)phase=PACKET_PHASE.RECOVERING;return snapshot();}
  function revive(id){const node=nodes.get(id);if(!node)throw Error('Unknown member');node.alive=true;return snapshot();}
  function bestSurvivingProposal(){
    const candidates=[];for(const id of live())for(const row of nodes.get(id).entries.values())if(validProposal(row.proposal))candidates.push(row.proposal);if(!candidates.length)return null;
    candidates.sort((a,b)=>b.epoch-a.epoch||b.revision-a.revision||a.proofKey.localeCompare(b.proofKey));const top=candidates[0],same=candidates.filter(p=>p.epoch===top.epoch&&p.revision===top.revision);if(new Set(same.map(p=>p.proofKey)).size>1)return false;return clone(top);
  }
  function recover({candidateId=live()[0]}={}){
    const survivors=live();if(survivors.length<config.quorum){leader=null;phase=PACKET_PHASE.CLOSED;return false;}if(!survivors.includes(candidateId))throw Error('Recovery candidate must be live');
    if(phase===PACKET_PHASE.OPEN&&leader&&nodes.get(leader).alive)return true;
    const chosen=bestSurvivingProposal();if(chosen===false){leader=null;phase=PACKET_PHASE.CLOSED;return false;}const leaderChanged=!leader||!nodes.get(leader)?.alive;
    if(chosen){for(const id of survivors)store(nodes.get(id),chosen,'committed',{repair:true});committed=clone(chosen);nextRevision=Math.max(nextRevision,chosen.revision+1);}
    else if(visible.length){leader=null;phase=PACKET_PHASE.CLOSED;return false;}
    if(leaderChanged){epoch+=1;leader=candidateId;}for(const id of survivors)nodes.get(id).maxEpoch=Math.max(nodes.get(id).maxEpoch,epoch);active=null;phase=PACKET_PHASE.OPEN;return !committed||holders(committed).length>=config.quorum;
  }
  function safety(){
    const uniqueVisible=new Map(),conflicts=[];for(const row of visible){const key=`${row.epoch}:${row.revision}`;const prior=uniqueVisible.get(key);if(prior&&prior!==row.root)conflicts.push(key);else uniqueVisible.set(key,row.root);}
    const quorumVisibility=visible.every(row=>row.durableAtVisibility>=config.quorum);const openDurability=phase!==PACKET_PHASE.OPEN||!committed||holders(committed).length>=config.quorum;
    return Object.freeze({pass:conflicts.length===0&&quorumVisibility&&openDurability,conflicts,quorumVisibility,openDurability});
  }
  function snapshot(){
    return Object.freeze({config,epoch,phase,leaderId:leader,live:live(),committed:committed?receipt(committed,{recovered:true}):null,holders:committed?holders(committed):[],visible:clone(visible),pending:clone(queue),rejectedStale,rejectedConflict,safety:safety(),nodes:Object.fromEntries(members.map(id=>[id,{alive:nodes.get(id).alive,maxEpoch:nodes.get(id).maxEpoch,entries:[...nodes.get(id).entries.values()].map(row=>({state:row.state,epoch:row.proposal.epoch,revision:row.proposal.revision,root:row.proposal.root,operationId:row.proposal.operationId}))}]))});
  }
  return{begin,publish,unsafePublishBeforeQuorum,crash,revive,recover,retryPrepare,deliverSerial,deliverWhere,dropWhere,dropAll,duplicateWhere,inject,pending:()=>clone(queue),snapshot,safety,get epoch(){return epoch;},get phase(){return phase;},get leaderId(){return leader;}};
}

export function proveGeneralCrashQuorums({maxFailures=4}={}){
  if(!Number.isInteger(maxFailures)||maxFailures<1||maxFailures>5)throw Error('Invalid max failure proof');const rows=[];
  for(let f=1;f<=maxFailures;f++){
    const{members:n,quorum:q}=crashQuorumConfig(f),ids=Array.from({length:n},(_,i)=>`n${i}`),quorums=combinations(ids,q),failures=combinations(ids,f);let minIntersection=Infinity,minSurvivingCopies=Infinity;
    for(const left of quorums)for(const right of quorums)minIntersection=Math.min(minIntersection,left.filter(id=>right.includes(id)).length);
    for(const committers of quorums)for(const failed of failures)minSurvivingCopies=Math.min(minSurvivingCopies,committers.filter(id=>!failed.includes(id)).length);
    const liveAfterFailures=n-f,minimalMembers=n-1,liveWithOneFewer=minimalMembers-f;
    rows.push({failures:f,members:n,quorum:q,quorumCount:quorums.length,failureSets:failures.length,minIntersection,minSurvivingCopies,liveAfterFailures,minimalMemberCounterexample:{members:minimalMembers,liveAfterFailures:liveWithOneFewer,canReopenQuorum:liveWithOneFewer>=q},pass:minIntersection>=1&&minSurvivingCopies>=1&&liveAfterFailures>=q&&liveWithOneFewer<q});
  }
  return{pass:rows.every(row=>row.pass),rows};
}

export function proveTwoPeerNoWitnessBoundary(){
  const policies=[];for(const aCanOpenAlone of[false,true])for(const bCanOpenAlone of[false,true]){
    const availableAfterBCrash=aCanOpenAlone,availableAfterACrash=bCanOpenAlone,splitBrainSafe=!(aCanOpenAlone&&bCanOpenAlone);
    policies.push({aCanOpenAlone,bCanOpenAlone,availableAfterACrash,availableAfterBCrash,splitBrainSafe,satisfiesAll:availableAfterACrash&&availableAfterBCrash&&splitBrainSafe});
  }
  return{model:'two peers, arbitrary partition, no external witness/fencing clock',pass:policies.every(row=>!row.satisfiesAll),policies,requiresAdditionalFailureDiscriminator:true};
}

const deliverPrepare=(protocol,to)=>protocol.deliverWhere(row=>row.type===PACKET_TYPE.PREPARE&&row.to===to);
const deliverAck=(protocol,from)=>protocol.deliverWhere(row=>row.type===PACKET_TYPE.ACK&&row.from===from);
function recoverIfNeeded(protocol){const snap=protocol.snapshot();if(snap.phase===PACKET_PHASE.RECOVERING)return protocol.recover({candidateId:snap.live[0]});return snap.phase===PACKET_PHASE.OPEN;}

export function proveCanonPacketInterleavings(){
  const members=['n0','n1','n2'],followers=['n1','n2'],ackSets=[['n1'],['n2'],['n1','n2']],stages=['before-store','after-store','after-ack','after-visible','after-partial-commit'],cases=[];
  for(const ackSet of ackSets)for(const stage of stages)for(const failed of members){
    const protocol=createCanonPacketProtocol({failures:1,members,leaderId:'n0'}),started=protocol.begin({operationId:'life:1:end',canon:{lifeId:'life:1',ended:true},recovery:{tick:120,lifeId:'life:1',dedupe:['life:1:end']}}),proposal=started.proposal;
    if(stage!=='before-store')for(const id of ackSet)deliverPrepare(protocol,id);
    if(!['before-store','after-store'].includes(stage))for(const id of ackSet)deliverAck(protocol,id);
    if(['after-visible','after-partial-commit'].includes(stage)){protocol.publish();if(stage==='after-partial-commit')protocol.deliverWhere(row=>row.type===PACKET_TYPE.COMMIT&&row.to!==failed);}
    const visibleBefore=protocol.snapshot().visible.length>0;protocol.crash(failed);const recovered=recoverIfNeeded(protocol),snap=protocol.snapshot(),sameRoot=!snap.committed||snap.committed.root===proposal.root,visibleSafe=!visibleBefore||(recovered&&snap.phase===PACKET_PHASE.OPEN&&snap.visible.at(-1)?.root===proposal.root&&snap.holders.length>=2);
    cases.push({ackSet,stage,failed,visibleBefore,recovered,phase:snap.phase,holders:snap.holders.length,sameRoot,visibleSafe,pass:snap.safety.pass&&sameRoot&&visibleSafe});
  }
  const followerDies=createCanonPacketProtocol({failures:1,members,leaderId:'n0'});followerDies.begin({operationId:'life:2:end',canon:{ended:true},recovery:{tick:200}});deliverPrepare(followerDies,'n1');deliverAck(followerDies,'n1');followerDies.crash('n1');let publishBlocked=false;try{followerDies.publish();}catch{publishBlocked=true;}
  deliverPrepare(followerDies,'n2');deliverAck(followerDies,'n2');const repairedReceipt=followerDies.publish();
  return{pass:cases.every(row=>row.pass)&&publishBlocked&&Boolean(repairedReceipt),cases,publishBlockedWhenAckHolderDies:publishBlocked,repairedWithAlternateFollower:Boolean(repairedReceipt)};
}

export function proveFiniteBurstAndDuplicateSafety({maxBurst=16}={}){
  const burstCases=[];for(let burst=0;burst<=maxBurst;burst++){
    const protocol=createCanonPacketProtocol(),started=protocol.begin({operationId:`burst:${burst}`,canon:{value:burst},recovery:{tick:burst}});for(let i=0;i<burst;i++){protocol.dropAll();protocol.retryPrepare();}
    protocol.dropAll();protocol.retryPrepare();deliverPrepare(protocol,'n1');deliverAck(protocol,'n1');const receipt=protocol.publish();burstCases.push({burst,root:receipt.root,pass:protocol.snapshot().safety.pass&&receipt.root===started.proposal.root});
  }
  const duplicate=createCanonPacketProtocol(),started=duplicate.begin({operationId:'dup:1',canon:{value:1},recovery:{tick:1}});duplicate.duplicateWhere(row=>row.type===PACKET_TYPE.PREPARE&&row.to==='n1');while(duplicate.deliverWhere(row=>row.type===PACKET_TYPE.PREPARE&&row.to==='n1')){};duplicate.duplicateWhere(row=>row.type===PACKET_TYPE.ACK&&row.from==='n1');while(duplicate.deliverWhere(row=>row.type===PACKET_TYPE.ACK&&row.from==='n1')){};const visible=duplicate.publish();duplicate.duplicateWhere(row=>row.type===PACKET_TYPE.COMMIT&&row.to==='n2');while(duplicate.deliverWhere(row=>row.type===PACKET_TYPE.COMMIT&&row.to==='n2')){};duplicate.crash('n0');duplicate.recover({candidateId:'n1'});const recovered=duplicate.snapshot();
  const stale={type:PACKET_TYPE.PREPARE,from:'n0',to:'n1',epoch:started.proposal.epoch,revision:started.proposal.revision,root:started.proposal.root,proofKey:started.proposal.proofKey,proposal:started.proposal};duplicate.inject(stale);const staleDelivered=duplicate.deliverWhere(row=>row.serial===duplicate.pending().at(-1)?.serial),afterStale=duplicate.snapshot();
  const permanent=createCanonPacketProtocol();permanent.begin({operationId:'partition:1',canon:{value:1},recovery:{tick:1}});permanent.dropAll();let partitionPublishBlocked=false;try{permanent.publish();}catch{partitionPublishBlocked=true;}
  return{pass:burstCases.every(row=>row.pass)&&visible.root===started.proposal.root&&recovered.safety.pass&&staleDelivered===false&&afterStale.rejectedStale>=1&&partitionPublishBlocked,burstCases,duplicateReorderSafe:recovered.safety.pass,staleEpochRejected:staleDelivered===false&&afterStale.rejectedStale>=1,permanentPartitionMakesNoLivenessClaim:partitionPublishBlocked};
}

export function proveUnsafeEarlyVisibilityCounterexample(){
  const protocol=createCanonPacketProtocol({allowUnsafeProof:true}),started=protocol.begin({operationId:'unsafe:1',canon:{value:1},recovery:{tick:1}}),visible=protocol.unsafePublishBeforeQuorum();protocol.dropAll();protocol.crash('n0');const recovered=protocol.recover({candidateId:'n1'}),snap=protocol.snapshot();
  return{pass:visible.durableAtVisibility<2&&recovered===false&&snap.phase===PACKET_PHASE.CLOSED,visibleRoot:visible.root,proposalRoot:started.proposal.root,durableAtVisibility:visible.durableAtVisibility,recovered,phase:snap.phase,counterexample:'client-visible Canon before durable quorum can disappear with one allowed leader crash'};
}

export function runCanonPacketProofSuite(){
  const generalized=proveGeneralCrashQuorums(),twoPeer=proveTwoPeerNoWitnessBoundary(),interleavings=proveCanonPacketInterleavings(),faults=proveFiniteBurstAndDuplicateSafety(),unsafe=proveUnsafeEarlyVisibilityCounterexample();
  return{pass:generalized.pass&&twoPeer.pass&&interleavings.pass&&faults.pass&&unsafe.pass,generalized,twoPeer,interleavings,faults,unsafe,limits:['crash faults only; Byzantine behavior remains out of scope','finite burst proof assumes eventual delivery after the burst; permanent partition has no liveness guarantee','prepared-but-unacknowledged operations may be completed after recovery and therefore require idempotent client retry','2-peer impossibility statement assumes arbitrary partition with no external witness, fencing service or trusted bounded-drift lease']};
}
