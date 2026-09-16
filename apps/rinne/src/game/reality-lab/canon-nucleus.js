const clone=value=>structuredClone(value);
const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
const canonical=value=>JSON.stringify(stable(value));
export function digest(value){
  const text=canonical(value);let hash=0x811c9dc5;
  for(let i=0;i<text.length;i++){hash^=text.charCodeAt(i);hash=Math.imul(hash,0x01000193)>>>0;}
  return hash.toString(16).padStart(8,'0');
}
export const NUCLEUS_SIZE=3;
export const NUCLEUS_QUORUM=2;
export const NUCLEUS_PHASE=Object.freeze({OPEN:'open',RECOVERING:'recovering',CLOSED:'closed'});
const validId=value=>typeof value==='string'&&/^[\w:.-]{1,120}$/.test(value);
const unique=values=>[...new Set(values)];

function validateMembers(members){
  if(!Array.isArray(members)||members.length!==NUCLEUS_SIZE||new Set(members).size!==NUCLEUS_SIZE||members.some(id=>!validId(id)))throw Error('Canon nucleus requires three unique members');
  return [...members];
}
function publicCommit(value){if(!value)return null;const{proofKey,...out}=value;return clone(out);}
function validReplica(replica,committed){
  return Boolean(replica&&committed&&replica.revision===committed.revision&&replica.canonRoot===committed.canonRoot&&replica.recoveryRoot===committed.recoveryRoot&&replica.root===committed.root&&replica.proofKey===committed.proofKey&&canonical({canon:replica.canon,recovery:replica.recovery})===replica.proofKey);
}
export function createCanonNucleus({members=['n0','n1','n2'],leaderId=members[0]}={}){
  members=validateMembers(members);if(!members.includes(leaderId))throw Error('Leader must be a nucleus member');
  let epoch=1,phase=NUCLEUS_PHASE.OPEN,leader=leaderId,committed=null,nextRevision=1;
  const nodes=new Map(members.map(id=>[id,{id,alive:true,replica:null}]));
  const operations=new Map();
  const live=()=>members.filter(id=>nodes.get(id).alive);
  const holderIds=()=>committed?live().filter(id=>validReplica(nodes.get(id).replica,committed)):[];
  function assertEpoch(expectedEpoch){if(expectedEpoch!==epoch)throw Error('Stale authority epoch');}
  function commit({operationId,canon,recovery,acknowledgers=members,expectedEpoch=epoch}={}){
    assertEpoch(expectedEpoch);
    if(phase!==NUCLEUS_PHASE.OPEN||!leader||!nodes.get(leader).alive)throw Error('Canon authority is not open');
    if(!validId(operationId))throw Error('Canon operation id is required');
    const canonRoot=digest(canon),recoveryRoot=digest(recovery),proofKey=canonical({canon,recovery}),root=digest({canon,recovery});
    const prior=operations.get(operationId);
    if(prior){if(prior.proofKey!==proofKey)throw Error('Canon operation payload conflict');return clone(prior.receipt);}
    const voters=unique([leader,...acknowledgers]).filter(id=>nodes.get(id)?.alive);
    if(voters.length<NUCLEUS_QUORUM)throw Error('Canon quorum unavailable');
    const revision=nextRevision++,replica={revision,commitEpoch:epoch,operationId,canonRoot,recoveryRoot,root,proofKey,canon:clone(canon),recovery:clone(recovery)};
    // Only acknowledged live nodes become holders. The operation is committed once any quorum stores the complete recovery material.
    for(const id of voters)nodes.get(id).replica=clone(replica);
    committed={revision,commitEpoch:epoch,operationId,canonRoot,recoveryRoot,root,proofKey};
    const receipt=Object.freeze({...publicCommit(committed),holders:voters.slice().sort()});
    operations.set(operationId,{root,proofKey,receipt});
    return clone(receipt);
  }
  function fail(ids){
    for(const id of Array.isArray(ids)?ids:[ids])if(nodes.has(id))nodes.get(id).alive=false;
    const remaining=live();
    if(remaining.length<NUCLEUS_QUORUM){leader=null;phase=NUCLEUS_PHASE.CLOSED;return snapshot();}
    if(!leader||!nodes.get(leader).alive){leader=null;phase=NUCLEUS_PHASE.RECOVERING;}
    return snapshot();
  }
  function revive(id,{empty=true}={}){const node=nodes.get(id);if(!node)throw Error('Unknown nucleus member');node.alive=true;if(empty)node.replica=null;return snapshot();}
  function corrupt(id,field='recovery'){
    const node=nodes.get(id);if(!node?.replica)return false;
    if(field==='canon')node.replica.canon={corrupt:true};else if(field==='recovery')node.replica.recovery={corrupt:true};else node.replica.root='00000000';
    return true;
  }
  function recover({candidateId=live()[0],expectedEpoch=epoch}={}){
    assertEpoch(expectedEpoch);
    const remaining=live();
    if(remaining.length<NUCLEUS_QUORUM){leader=null;phase=NUCLEUS_PHASE.CLOSED;return false;}
    if(!remaining.includes(candidateId))throw Error('Recovery candidate must be live');
    if(phase===NUCLEUS_PHASE.OPEN&&leader&&nodes.get(leader).alive){
      if(candidateId!==leader)throw Error('Cannot replace a healthy canon leader');
      return repair();
    }
    if(committed){
      const source=remaining.find(id=>validReplica(nodes.get(id).replica,committed));
      if(!source){leader=null;phase=NUCLEUS_PHASE.CLOSED;return false;}
      const replica=clone(nodes.get(source).replica);
      for(const id of remaining)nodes.get(id).replica=clone(replica);
      if(holderIds().length<NUCLEUS_QUORUM){leader=null;phase=NUCLEUS_PHASE.CLOSED;return false;}
    }
    epoch+=1;leader=candidateId;phase=NUCLEUS_PHASE.OPEN;return true;
  }
  function repair(){
    if(!committed)return true;
    const source=holderIds()[0];if(!source)return false;
    const replica=clone(nodes.get(source).replica);for(const id of live())nodes.get(id).replica=clone(replica);return holderIds().length>=Math.min(NUCLEUS_QUORUM,live().length);
  }
  function snapshot(){return Object.freeze({epoch,phase,leaderId:leader,live:live(),holders:holderIds(),committed:publicCommit(committed),nodes:Object.fromEntries(members.map(id=>[id,{alive:nodes.get(id).alive,revision:nodes.get(id).replica?.revision??0,root:nodes.get(id).replica?.root??null}]))});}
  return{commit,fail,revive,corrupt,recover,repair,snapshot,get epoch(){return epoch;},get phase(){return phase;},get leaderId(){return leader;}};
}

export function combinations(values,size){
  const out=[];function walk(start,row){if(row.length===size){out.push([...row]);return;}for(let i=start;i<values.length;i++){row.push(values[i]);walk(i+1,row);row.pop();}}walk(0,[]);return out;
}
export function proveThreeNodeQuorumIntersection(members=['n0','n1','n2']){
  members=validateMembers(members);const quorums=combinations(members,NUCLEUS_QUORUM);const intersections=[];
  for(let i=0;i<quorums.length;i++)for(let j=i;j<quorums.length;j++){const intersection=quorums[i].filter(id=>quorums[j].includes(id));intersections.push({left:quorums[i],right:quorums[j],intersection});}
  return{pass:intersections.every(row=>row.intersection.length>=1),quorums,intersections};
}

export function architectureCost({players=30,ticks=1200,realtimeBytesPerTick=2048,canonEvents=4,canonBytesPerEvent=512,recoveryBytesPerCanon=16_384,reliableMultiplier=1}={}){
  if(!Number.isInteger(players)||players<3||!Number.isInteger(ticks)||ticks<1||realtimeBytesPerTick<=0||canonEvents<0||canonBytesPerEvent<0||recoveryBytesPerCanon<0||reliableMultiplier<1)throw Error('Invalid architecture cost input');
  const realtimePayload=realtimeBytesPerTick*ticks;
  const starGameplay=(players-1)*realtimePayload;
  const canonPayload=canonEvents*(canonBytesPerEvent+recoveryBytesPerCanon);
  // Crash tolerance f=1 requires a committed item on at least two independent members. With the leader already holding one copy, one follower acknowledgement is the minimum commit-path transfer.
  const requiredFollowerCopies=1;
  const warmFollowerCopies=2;
  const fullStateCommitPath=requiredFollowerCopies*(realtimePayload+canonPayload)*reliableMultiplier;
  const nucleusCommitPath=requiredFollowerCopies*canonPayload*reliableMultiplier;
  const fullStateWarmReplication=warmFollowerCopies*(realtimePayload+canonPayload)*reliableMultiplier;
  const nucleusWarmReplication=warmFollowerCopies*canonPayload*reliableMultiplier;
  const fullStateTotal=starGameplay+fullStateWarmReplication;
  const nucleusTotal=starGameplay+nucleusWarmReplication;
  return Object.freeze({players,ticks,realtimePayload,canonPayload,starGameplay,requiredFollowerCopies,warmFollowerCopies,fullStateCommitPath,nucleusCommitPath,fullStateWarmReplication,nucleusWarmReplication,fullStateTotal,nucleusTotal,commitPathSaved:fullStateCommitPath-nucleusCommitPath,warmSaved:fullStateWarmReplication-nucleusWarmReplication,totalSaved:fullStateTotal-nucleusTotal,nucleusConnections:players,fullStateConnections:players,fullMeshConnections:players*(players-1)/2});
}

export function proveCrashToleranceLowerBound({failures=1,copies=NUCLEUS_QUORUM}={}){
  if(!Number.isInteger(failures)||failures<0||!Number.isInteger(copies)||copies<1)throw Error('Invalid crash tolerance proof input');
  const minimumCopies=failures+1;
  return Object.freeze({failures,copies,minimumCopies,pass:copies>=minimumCopies,strictlyMinimal:copies===minimumCopies});
}

export function proveCostDominance(input={}){
  const rows=[];
  const players=input.players??[3,4,10,30],ticks=input.ticks??[20,200,1200],realtime=input.realtime??[1,32,256,2048,8192],canonEvents=input.canonEvents??[0,1,4,20],canonBytes=input.canonBytes??[64,512,4096],recovery=input.recovery??[512,16_384,65_536],multipliers=input.reliableMultiplier??[1,1.1,1.5];
  for(const n of players)for(const t of ticks)for(const r of realtime)for(const c of canonEvents)for(const cb of canonBytes)for(const rb of recovery)for(const m of multipliers){const cost=architectureCost({players:n,ticks:t,realtimeBytesPerTick:r,canonEvents:c,canonBytesPerEvent:cb,recoveryBytesPerCanon:rb,reliableMultiplier:m});rows.push({...cost,strictCommitPathWin:cost.nucleusCommitPath<cost.fullStateCommitPath,strictWarmWin:cost.nucleusWarmReplication<cost.fullStateWarmReplication,strictTotalWin:cost.nucleusTotal<cost.fullStateTotal,meshConnectionWin:n===3?cost.nucleusConnections===cost.fullMeshConnections:cost.nucleusConnections<cost.fullMeshConnections});}
  return{pass:rows.every(row=>row.strictCommitPathWin&&row.strictWarmWin&&row.strictTotalWin&&row.meshConnectionWin),cases:rows.length,rows};
}

export function progressIsolation({actors=30,pendingCanonActors=1}={}){
  if(!Number.isInteger(actors)||actors<1||!Number.isInteger(pendingCanonActors)||pendingCanonActors<0||pendingCanonActors>actors)throw Error('Invalid progress isolation input');
  return Object.freeze({actors,pendingCanonActors,allStateBlocked:pendingCanonActors?actors:0,nucleusBlocked:pendingCanonActors,strictIsolation:pendingCanonActors>0&&pendingCanonActors<actors});
}

export function compareRequirementEnvelope(input={}){
  const players=input.players??30,cost=architectureCost({...input,players}),isolation=progressIsolation({actors:players,pendingCanonActors:Math.min(players,input.pendingCanonActors??1)});
  const architectures={
    singleHostStar:{feasible:false,reason:'host-loss can remove the only committed canon copy',connections:players-1,strongBytes:0,oneFailureCanon:false,majorityLossFailClosed:true},
    threeReplicaAllState:{feasible:true,connections:cost.fullStateConnections,strongBytes:cost.fullStateCommitPath,warmBytes:cost.fullStateWarmReplication,oneFailureCanon:true,majorityLossFailClosed:true,blockedDuringCanon:isolation.allStateBlocked},
    peerFullMeshQuorum:{feasible:true,connections:cost.fullMeshConnections,strongBytes:cost.fullStateCommitPath,warmBytes:cost.fullStateWarmReplication,oneFailureCanon:true,majorityLossFailClosed:true,blockedDuringCanon:isolation.allStateBlocked},
    canonNucleus:{feasible:true,connections:cost.nucleusConnections,strongBytes:cost.nucleusCommitPath,warmBytes:cost.nucleusWarmReplication,oneFailureCanon:true,majorityLossFailClosed:true,blockedDuringCanon:isolation.nucleusBlocked},
  };
  const constrainedDominance={
    overAllState:architectures.canonNucleus.oneFailureCanon===architectures.threeReplicaAllState.oneFailureCanon&&architectures.canonNucleus.majorityLossFailClosed===architectures.threeReplicaAllState.majorityLossFailClosed&&architectures.canonNucleus.connections<=architectures.threeReplicaAllState.connections&&architectures.canonNucleus.strongBytes<architectures.threeReplicaAllState.strongBytes&&architectures.canonNucleus.blockedDuringCanon<architectures.threeReplicaAllState.blockedDuringCanon,
    overFullMesh:architectures.canonNucleus.oneFailureCanon===architectures.peerFullMeshQuorum.oneFailureCanon&&architectures.canonNucleus.majorityLossFailClosed===architectures.peerFullMeshQuorum.majorityLossFailClosed&&architectures.canonNucleus.connections<architectures.peerFullMeshQuorum.connections&&architectures.canonNucleus.strongBytes<architectures.peerFullMeshQuorum.strongBytes,
  };
  return{players,architectures,cost,isolation,pass:players>3&&Object.values(constrainedDominance).every(Boolean),constrainedDominance};
}

export function runCanonNucleusProofSuite(){
  const members=['a','b','c'],quorum=proveThreeNodeQuorumIntersection(members),singleFailures=[],doubleFailures=[];
  for(const committers of combinations(members,2))for(const failed of members){
    const nucleus=createCanonNucleus({members,leaderId:'a'});const receipt=nucleus.commit({operationId:'life:1:end',canon:{lifeId:'life:1',ended:true},recovery:{tick:120,lifeId:'life:1'},acknowledgers:committers});
    nucleus.fail(failed);let recovered=nucleus.phase===NUCLEUS_PHASE.OPEN?nucleus.repair():nucleus.recover({candidateId:nucleus.snapshot().live[0]});
    const snap=nucleus.snapshot();singleFailures.push({committers,failed,recovered,phase:snap.phase,revision:snap.committed?.revision??0,holders:snap.holders,root:receipt.root,pass:recovered&&snap.phase==='open'&&snap.committed?.root===receipt.root&&snap.holders.length>=2});
  }
  for(const committers of combinations(members,2))for(const failed of combinations(members,2)){
    const nucleus=createCanonNucleus({members,leaderId:'a'});const receipt=nucleus.commit({operationId:'life:1:end',canon:{lifeId:'life:1',ended:true},recovery:{tick:120,lifeId:'life:1'},acknowledgers:committers});nucleus.fail(failed);const live=nucleus.snapshot().live;const recovered=live.length?(()=>{try{return nucleus.recover({candidateId:live[0]});}catch{return false;}})():false;const snap=nucleus.snapshot();doubleFailures.push({committers,failed,recovered,phase:snap.phase,root:receipt.root,pass:!recovered&&snap.phase==='closed'});
  }
  const stale=createCanonNucleus({members,leaderId:'a'});stale.commit({operationId:'x',canon:{v:1},recovery:{tick:1},acknowledgers:['a','b']});stale.fail('a');const oldEpoch=stale.epoch;stale.recover({candidateId:'b'});let staleRejected=false;try{stale.commit({operationId:'y',canon:{v:2},recovery:{tick:2},expectedEpoch:oldEpoch});}catch{staleRejected=true;}
  const corruption=createCanonNucleus({members,leaderId:'a'});corruption.commit({operationId:'x',canon:{v:1},recovery:{tick:1},acknowledgers:['a','b']});corruption.fail('a');corruption.corrupt('b');const corruptionRejected=!corruption.recover({candidateId:'c'})&&corruption.phase==='closed';
  const idempotent=createCanonNucleus({members,leaderId:'a'});const first=idempotent.commit({operationId:'same',canon:{v:1},recovery:{tick:1},acknowledgers:['a','b']}),again=idempotent.commit({operationId:'same',canon:{v:1},recovery:{tick:1},acknowledgers:['a','c']});let conflictRejected=false;try{idempotent.commit({operationId:'same',canon:{v:2},recovery:{tick:1},acknowledgers:['a','c']});}catch{conflictRejected=true;}
  const lowerBound=proveCrashToleranceLowerBound(),cost=proveCostDominance(),comparison=compareRequirementEnvelope({players:30,ticks:1200,realtimeBytesPerTick:2048,canonEvents:4,canonBytesPerEvent:512,recoveryBytesPerCanon:16_384,pendingCanonActors:1});
  const checks={crashToleranceLowerBound:lowerBound.pass&&lowerBound.strictlyMinimal,quorumIntersection:quorum.pass,singleFailureRecovery:singleFailures.every(row=>row.pass),doubleFailureFailClosed:doubleFailures.every(row=>row.pass),staleEpochRejected:staleRejected,corruptRecoveryRejected:corruptionRejected,idempotentOperation:first.root===again.root&&first.revision===again.revision&&conflictRejected,costDominance:cost.pass,requirementDominance:comparison.pass};
  return{pass:Object.values(checks).every(Boolean),checks,lowerBound,quorum,singleFailures,doubleFailures,cost:{pass:cost.pass,cases:cost.cases},comparison};
}
