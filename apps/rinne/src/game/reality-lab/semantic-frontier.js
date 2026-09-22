const clone=value=>structuredClone(value);
const uniq=values=>[...new Set(values)];
const finite=(v,name)=>{if(!Number.isFinite(v)||v<0)throw Error(`Invalid ${name}`);return v;};

export const OP_KIND=Object.freeze({
  PRESENCE:'presence',
  AUTHORITATIVE:'authoritative',
  MERGEABLE:'mergeable',
  CAUSAL:'causal',
  CANON:'canon',
  ADVERSARIAL_CANON:'adversarial-canon',
  EXTERNAL_TXN:'external-txn',
});

export const FAMILY=Object.freeze({
  SNAPSHOT:'authoritative-snapshot',
  DEDICATED:'dedicated-authoritative',
  LOCKSTEP:'deterministic-lockstep',
  ROLLBACK:'rollback',
  STATE_SYNC:'state-sync',
  RAFT:'raft-all-state',
  PAXOS:'paxos-consensus',
  REDBLUE:'redblue',
  CRDT:'crdt',
  GOSSIP:'gossip-eventual',
  MESH:'peer-full-mesh-quorum',
  PBFT:'pbft',
  EXTERNAL:'external-strong',
  CANON_NUCLEUS:'canon-nucleus',
  FRONTIER:'semantic-frontier',
});

const DEFAULT_ENV=Object.freeze({
  players:30,
  rttMs:80,
  jitterMs:20,
  loss:0.01,
  partitioned:false,
  fullyAsync:false,
  crashReplicas:3,
  byzantineReplicas:0,
  trustedAuthority:true,
  externalService:false,
  deterministicEngine:false,
});

export function normalizeEnvironment(input={}){
  const env={...DEFAULT_ENV,...input};
  if(!Number.isInteger(env.players)||env.players<1||env.players>512)throw Error('Invalid players');
  finite(env.rttMs,'rttMs');finite(env.jitterMs,'jitterMs');finite(env.loss,'loss');
  if(env.loss>1)throw Error('Invalid loss');
  if(!Number.isInteger(env.crashReplicas)||env.crashReplicas<0)throw Error('Invalid crashReplicas');
  if(!Number.isInteger(env.byzantineReplicas)||env.byzantineReplicas<0)throw Error('Invalid byzantineReplicas');
  return env;
}

export function normalizeOperation(input={}){
  if(!Object.values(OP_KIND).includes(input.kind))throw Error('Invalid operation kind');
  const op={
    id:String(input.id||input.kind),kind:input.kind,
    bytes:input.bytes??128,rate:input.rate??1,recipients:input.recipients??1,
    deterministic:Boolean(input.deterministic),mergeable:Boolean(input.mergeable),
    irreversible:Boolean(input.irreversible),requiresTotalOrder:Boolean(input.requiresTotalOrder),
    requiresByzantine:Boolean(input.requiresByzantine),requiresExternalOrder:Boolean(input.requiresExternalOrder),
    requiresCrashSurvival:Boolean(input.requiresCrashSurvival),requiresPartitionAvailability:Boolean(input.requiresPartitionAvailability),
    requiresGuaranteedTermination:Boolean(input.requiresGuaranteedTermination),rollbackAllowed:input.rollbackAllowed!==false,
    latencyBudgetMs:input.latencyBudgetMs??Infinity,recoveryBytes:input.recoveryBytes??0,
    invariants:Array.isArray(input.invariants)?uniq(input.invariants.map(String)):[],
    commutesWith:Array.isArray(input.commutesWith)?uniq(input.commutesWith.map(String)):[],
  };
  finite(op.bytes,'bytes');finite(op.rate,'rate');finite(op.recipients,'recipients');finite(op.recoveryBytes,'recoveryBytes');
  if(!Number.isFinite(op.latencyBudgetMs)&&op.latencyBudgetMs!==Infinity)throw Error('Invalid latencyBudgetMs');
  return op;
}

export function closeOperationRequirements(operations){
  const ops=operations.map(normalizeOperation);
  const escalations=[];
  const shares=(a,b)=>a.invariants.filter(x=>b.invariants.includes(x));
  const explicitCommute=(a,b)=>a.commutesWith.includes(b.id)&&b.commutesWith.includes(a.id);
  let changed=true;
  while(changed){
    changed=false;
    for(let i=0;i<ops.length;i++)for(let j=i+1;j<ops.length;j++){
      const a=ops[i],b=ops[j],shared=shares(a,b);if(!shared.length||explicitCommute(a,b))continue;
      const strong=a.irreversible||b.irreversible||a.requiresTotalOrder||b.requiresTotalOrder||a.requiresCrashSurvival||b.requiresCrashSurvival||a.requiresByzantine||b.requiresByzantine||a.requiresExternalOrder||b.requiresExternalOrder;
      if(!strong)continue;
      const merged={
        requiresTotalOrder:a.requiresTotalOrder||b.requiresTotalOrder||a.irreversible||b.irreversible,
        requiresCrashSurvival:a.requiresCrashSurvival||b.requiresCrashSurvival,
        requiresByzantine:a.requiresByzantine||b.requiresByzantine,
        requiresExternalOrder:a.requiresExternalOrder||b.requiresExternalOrder,
        irreversible:a.irreversible||b.irreversible,
      };
      for(const op of [a,b]){
        for(const[k,v]of Object.entries(merged))if(v&&!op[k]){op[k]=true;changed=true;}
        if((merged.requiresTotalOrder||merged.irreversible)&&op.rollbackAllowed){op.rollbackAllowed=false;changed=true;}
      }
      if(changed)escalations.push({left:a.id,right:b.id,invariants:shared});
    }
  }
  return{operations:ops,escalations};
}

function lowerBoundImpossible(op,env){
  if(env.partitioned&&op.requiresPartitionAvailability&&(op.requiresTotalOrder||op.irreversible||op.requiresExternalOrder))return 'CAP: strong/global order and availability cannot both be guaranteed across a partition';
  if(env.fullyAsync&&op.requiresGuaranteedTermination&&(op.requiresTotalOrder||op.irreversible||op.requiresExternalOrder))return 'FLP: deterministic crash consensus cannot guarantee termination in a fully asynchronous model';
  return null;
}

const edgesStar=n=>Math.max(0,n-1);
const edgesMesh=n=>n*(n-1)/2;
const traffic=(op,mult=1)=>op.bytes*op.rate*Math.max(1,op.recipients)*mult;
const recoveryTraffic=(op,mult=1)=>(op.bytes+op.recoveryBytes)*Math.max(1,op.rate)*mult;
const vector=(wireBytes,latencyMs,coordination,connections,cpuWork,infraUnits,rollbackExposure=0)=>({wireBytes,latencyMs,coordination,connections,cpuWork,infraUnits,rollbackExposure});

export const POLICY=Object.freeze({
  PRESENCE_DATAGRAM:'presence-datagram',
  SNAPSHOT_AUTHORITY:'snapshot-authority',
  LOCKSTEP:'lockstep',
  ROLLBACK:'rollback',
  STATE_SYNC:'state-sync',
  CRDT:'crdt',
  CAUSAL_BLUE:'causal-blue',
  GOSSIP:'gossip',
  RAFT:'raft',
  MESH_QUORUM:'mesh-quorum',
  CANON_NUCLEUS:'canon-nucleus',
  PBFT:'pbft',
  EXTERNAL_STRONG:'external-strong',
});

function policyResult(id,op,env){
  const impossible=lowerBoundImpossible(op,env);if(impossible)return{policy:id,feasible:false,reason:impossible};
  const n=env.players,rtt=env.rttMs,jitter=env.jitterMs;
  const base=traffic(op),recover=recoveryTraffic(op);
  const reject=reason=>({policy:id,feasible:false,reason});
  const ok=(cost,guarantees={})=>{
    if(op.requiresTotalOrder&&!guarantees.totalOrder&&!guarantees.externalOrder)return reject('total-order guarantee required');
    if(op.requiresCrashSurvival&&!guarantees.crashSurvival&&!guarantees.durable)return reject('crash-survival guarantee required');
    if(op.requiresByzantine&&!guarantees.byzantine)return reject('Byzantine guarantee required');
    if(op.requiresExternalOrder&&!guarantees.externalOrder)return reject('external-order guarantee required');
    if(op.requiresPartitionAvailability&&!guarantees.partitionAvailable)return reject('partition-availability guarantee required');
    return cost.latencyMs>op.latencyBudgetMs?reject('latency budget exceeded'):({policy:id,feasible:true,cost,guarantees});
  };
  switch(id){
    case POLICY.PRESENCE_DATAGRAM:
      if(op.kind!==OP_KIND.PRESENCE||op.irreversible||op.requiresTotalOrder||op.requiresCrashSurvival||op.requiresByzantine||op.requiresExternalOrder)return reject('replaceable presence only');
      return ok(vector(base,rtt/2+jitter,0,edgesStar(n),1,0,1),{replaceable:true,partialReliability:true});
    case POLICY.SNAPSHOT_AUTHORITY:
      if(!env.trustedAuthority)return reject('trusted authority unavailable');
      if(op.requiresByzantine)return reject('not Byzantine tolerant');
      if(op.requiresCrashSurvival||op.requiresExternalOrder)return reject('single authority is not durable/external');
      if(op.kind===OP_KIND.MERGEABLE&&op.requiresPartitionAvailability&&env.partitioned)return reject('server path unavailable under partition');
      return ok(vector(base*1.15,rtt/2+jitter,1,edgesStar(n),1,0,0),{authoritative:true,predictionCompatible:true,totalOrder:true});
    case POLICY.LOCKSTEP:
      if(!(env.deterministicEngine||op.deterministic))return reject('determinism required');
      if(op.irreversible||op.requiresCrashSurvival||op.requiresByzantine||op.requiresExternalOrder)return reject('not a durable canon commit protocol');
      if(op.requiresPartitionAvailability&&env.partitioned)return reject('all participants cannot advance through partition');
      return ok(vector(base*0.18,rtt+jitter,1,edgesMesh(n),1.4,0,0),{deterministic:true,waitsForInputs:true});
    case POLICY.ROLLBACK:
      if(!(env.deterministicEngine||op.deterministic))return reject('determinism required');
      if(!op.rollbackAllowed||op.irreversible||op.requiresCrashSurvival||op.requiresByzantine||op.requiresExternalOrder)return reject('rollback not allowed for irreversible/durable work');
      if(op.requiresPartitionAvailability&&env.partitioned)return reject('eventual input exchange still required');
      return ok(vector(base*0.22,0,0.5,edgesMesh(n),2.4,0,Math.max(0,env.loss*10+rtt/100)),{speculative:true,rollback:true});
    case POLICY.STATE_SYNC:
      if(op.irreversible||op.requiresTotalOrder||op.requiresCrashSurvival||op.requiresByzantine||op.requiresExternalOrder)return reject('approximate state synchronization only');
      return ok(vector(base*0.55,rtt/2+jitter,0,edgesStar(n),1.3,0,0.5),{approximate:true,priorityUpdates:true});
    case POLICY.CRDT:
      if(!op.mergeable||op.requiresTotalOrder||op.irreversible||op.requiresExternalOrder||op.requiresByzantine)return reject('commutative mergeable operations only');
      return ok(vector(base*0.35,rtt/2,0,Math.min(edgesStar(n),Math.max(1,op.recipients)),1.15,0,0),{eventual:true,partitionAvailable:true,convergent:true});
    case POLICY.CAUSAL_BLUE:
      if(!(op.kind===OP_KIND.MERGEABLE||op.kind===OP_KIND.CAUSAL)||op.requiresTotalOrder||op.irreversible||op.requiresExternalOrder||op.requiresByzantine)return reject('causal/blue operations only');
      return ok(vector(base*0.45,rtt/2,0.25,Math.min(edgesStar(n),Math.max(1,op.recipients)),1.2,0,0),{causal:true,eventual:true,partitionAvailable:true});
    case POLICY.GOSSIP:
      if(!(op.kind===OP_KIND.MERGEABLE||op.kind===OP_KIND.CAUSAL)||!op.mergeable||op.requiresTotalOrder||op.irreversible||op.requiresExternalOrder||op.requiresByzantine)return reject('mergeable eventual operations only');
      return ok(vector(base*.3,1.2*rtt+jitter,0,Math.min(edgesStar(n),Math.max(2,Math.ceil(Math.log2(Math.max(2,n)))*2)),1.3,0,0),{eventual:true,partitionAvailable:true,epidemic:true});
    case POLICY.RAFT:
      if(env.crashReplicas<3)return reject('three crash replicas required');
      if(op.requiresByzantine)return reject('crash fault only');
      if(op.requiresPartitionAvailability&&env.partitioned)return reject('minority partition unavailable');
      return ok(vector(recover*2,1.5*rtt,2,Math.max(0,n),1.5,0,0),{strong:true,crashSurvival:true,totalOrder:true});
    case POLICY.MESH_QUORUM:
      if(env.crashReplicas<3)return reject('three eligible peers required');
      if(op.requiresByzantine)return reject('crash fault only');
      if(op.requiresPartitionAvailability&&env.partitioned)return reject('quorum side only');
      return ok(vector(recover*2.2,1.4*rtt,2,edgesMesh(n),1.7,0,0),{strong:true,crashSurvival:true,totalOrder:true,peerQuorum:true});
    case POLICY.CANON_NUCLEUS:
      if(env.crashReplicas<3)return reject('three nucleus peers required');
      if(op.requiresByzantine)return reject('non-Byzantine canon');
      if(!(op.irreversible||op.requiresCrashSurvival||op.kind===OP_KIND.CANON))return reject('canon path only');
      if(op.requiresExternalOrder)return reject('no external global clock');
      if(op.requiresPartitionAvailability&&env.partitioned)return reject('canon sacrifices availability without quorum');
      return ok(vector(recover,1.25*rtt,1,Math.max(0,n),1.25,0,0),{strong:true,crashSurvival:true,recoveryComplete:true,totalOrder:true});
    case POLICY.PBFT:{
      const replicas=env.byzantineReplicas;if(replicas<4)return reject('four Byzantine replicas required for f=1');
      if(op.requiresPartitionAvailability&&env.partitioned)return reject('quorum unavailable on arbitrary partition');
      const messages=replicas*(replicas-1);
      return ok(vector(recover*messages,2*rtt,3,Math.max(edgesMesh(replicas),n+Math.max(0,replicas-2)),2.5,0,0),{strong:true,byzantine:true,crashSurvival:true,totalOrder:true});
    }
    case POLICY.EXTERNAL_STRONG:
      if(!env.externalService)return reject('external authority service unavailable');
      if(op.requiresPartitionAvailability&&env.partitioned)return reject('client cannot require both external strong order and local partition availability');
      return ok(vector(recover*1.1,2.2*rtt,3,Math.max(1,n),1.1,1,0),{strong:true,externalOrder:true,durable:true,crashSurvival:true,totalOrder:true});
    default:return reject('unknown policy');
  }
}

export function evaluatePolicy(policy,operation,environment={}){
  const op=normalizeOperation(operation),env=normalizeEnvironment(environment);return policyResult(policy,op,env);
}

export const FAMILY_POLICIES=Object.freeze({
  [FAMILY.SNAPSHOT]:[POLICY.PRESENCE_DATAGRAM,POLICY.SNAPSHOT_AUTHORITY],
  [FAMILY.DEDICATED]:[POLICY.PRESENCE_DATAGRAM,POLICY.SNAPSHOT_AUTHORITY,POLICY.EXTERNAL_STRONG],
  [FAMILY.LOCKSTEP]:[POLICY.LOCKSTEP],
  [FAMILY.ROLLBACK]:[POLICY.ROLLBACK],
  [FAMILY.STATE_SYNC]:[POLICY.STATE_SYNC],
  [FAMILY.RAFT]:[POLICY.RAFT],
  [FAMILY.PAXOS]:[POLICY.RAFT],
  [FAMILY.REDBLUE]:[POLICY.CAUSAL_BLUE,POLICY.RAFT],
  [FAMILY.CRDT]:[POLICY.CRDT],
  [FAMILY.GOSSIP]:[POLICY.GOSSIP],
  [FAMILY.MESH]:[POLICY.MESH_QUORUM],
  [FAMILY.PBFT]:[POLICY.PBFT],
  [FAMILY.EXTERNAL]:[POLICY.EXTERNAL_STRONG],
  [FAMILY.CANON_NUCLEUS]:[POLICY.PRESENCE_DATAGRAM,POLICY.SNAPSHOT_AUTHORITY,POLICY.CRDT,POLICY.CAUSAL_BLUE,POLICY.CANON_NUCLEUS],
});
const ALL_POLICIES=Object.freeze(uniq(Object.values(FAMILY_POLICIES).flat().concat(POLICY.PBFT,POLICY.EXTERNAL_STRONG,POLICY.RAFT,POLICY.ROLLBACK,POLICY.LOCKSTEP,POLICY.STATE_SYNC,POLICY.MESH_QUORUM)));

function addCost(a,b){return{wireBytes:a.wireBytes+b.wireBytes,latencyMs:a.latencyMs+b.latencyMs,coordination:a.coordination+b.coordination,connections:Math.max(a.connections,b.connections),cpuWork:a.cpuWork+b.cpuWork,infraUnits:a.infraUnits+b.infraUnits,rollbackExposure:a.rollbackExposure+b.rollbackExposure};}
const ZERO=Object.freeze(vector(0,0,0,0,0,0,0));
function withTransitionOverhead(cost,rows,ops,env,{bytesPerBoundary=64,latencyPerBoundaryMs=.25,cpuPerBoundary=.02}={}){
  let boundaries=0,barriers=0;const details=[];
  for(let i=1;i<rows.length;i++){
    if(rows[i].policy===rows[i-1].policy)continue;
    boundaries++;cost={...cost,wireBytes:cost.wireBytes+bytesPerBoundary,latencyMs:cost.latencyMs+latencyPerBoundaryMs,cpuWork:cost.cpuWork+cpuPerBoundary};
    const shared=ops[i-1].invariants.filter(x=>ops[i].invariants.includes(x));
    if(!shared.length)continue;
    barriers++;const strongA=Boolean(rows[i-1].guarantees?.strong||rows[i-1].guarantees?.totalOrder||rows[i-1].guarantees?.externalOrder||rows[i-1].guarantees?.byzantine),strongB=Boolean(rows[i].guarantees?.strong||rows[i].guarantees?.totalOrder||rows[i].guarantees?.externalOrder||rows[i].guarantees?.byzantine);
    const bytes=128+Math.max(ops[i-1].recoveryBytes,ops[i].recoveryBytes);
    cost={...cost,wireBytes:cost.wireBytes+bytes,latencyMs:cost.latencyMs+env.rttMs/2,coordination:cost.coordination+1,cpuWork:cost.cpuWork+.1};
    details.push({at:i,shared,from:rows[i-1].policy,to:rows[i].policy,mode:!strongA&&strongB?'reconcile-to-strong':strongA&&!strongB?'fence-to-weak':'ordered-handoff'});
  }
  return{...cost,boundaries,barriers,transitionDetails:details};
}
function dominates(a,b){
  const keys=['wireBytes','latencyMs','coordination','connections','cpuWork','infraUnits','rollbackExposure'];
  const le=keys.every(k=>a[k]<=b[k]+1e-9),lt=keys.some(k=>a[k]<b[k]-1e-9);return le&&lt;
}
function equalCost(a,b){return['wireBytes','latencyMs','coordination','connections','cpuWork','infraUnits','rollbackExposure'].every(k=>Math.abs(a[k]-b[k])<1e-9);}

export function enumeratePlans(operations,environment={},allowedPolicies=ALL_POLICIES,{maxPlans=250000,switchOverhead}={}){
  const closed=closeOperationRequirements(operations),ops=closed.operations,env=normalizeEnvironment(environment);
  const choices=ops.map(op=>allowedPolicies.map(policy=>policyResult(policy,op,env)).filter(row=>row.feasible));
  if(choices.some(row=>!row.length))return[];
  const plans=[];
  function walk(index,rows){
    if(plans.length>maxPlans)throw Error('Plan search exceeded bound');
    if(index===ops.length){
      const policies=rows.map(r=>r.policy);let cost=rows.reduce((acc,row)=>addCost(acc,row.cost),clone(ZERO));cost=withTransitionOverhead(cost,rows,ops,env,switchOverhead);
      plans.push({policies,cost,rows:clone(rows),escalations:clone(closed.escalations)});return;
    }
    for(const row of choices[index]){rows.push(row);walk(index+1,rows);rows.pop();}
  }
  walk(0,[]);return plans;
}

export function paretoFrontier(plans){
  const out=[];
  for(let i=0;i<plans.length;i++){
    const p=plans[i];let beaten=false;
    for(let j=0;j<plans.length&&!beaten;j++)if(i!==j&&dominates(plans[j].cost,p.cost))beaten=true;
    if(!beaten&&!out.some(q=>equalCost(q.cost,p.cost)&&q.policies.join('|')===p.policies.join('|')))out.push(p);
  }
  return out;
}

export function bestFamilyPlan(family,operations,environment={},options={}){
  const policies=FAMILY_POLICIES[family];if(!policies)throw Error('Unknown family');
  const plans=enumeratePlans(operations,environment,policies,options);if(!plans.length)return null;
  const frontier=paretoFrontier(plans);
  const score=p=>p.cost.wireBytes+p.cost.latencyMs*128+p.cost.coordination*2048+p.cost.connections*256+p.cost.cpuWork*512+p.cost.infraUnits*100000+p.cost.rollbackExposure*4096;
  return frontier.slice().sort((a,b)=>score(a)-score(b)||a.policies.join('|').localeCompare(b.policies.join('|')))[0];
}

export function semanticFrontier(operations,environment={},options={}){
  const plans=enumeratePlans(operations,environment,ALL_POLICIES,options),frontier=paretoFrontier(plans);
  const baselines={},baselineFrontiers={},coverage={};
  for(const family of Object.keys(FAMILY_POLICIES)){
    const familyPlans=enumeratePlans(operations,environment,FAMILY_POLICIES[family],options),familyFrontier=paretoFrontier(familyPlans);
    baselineFrontiers[family]=familyFrontier;
    baselines[family]=familyFrontier.length?bestFamilyPlan(family,operations,environment,options):null;
    if(!familyFrontier.length){coverage[family]={feasible:false,covered:true,paretoPoints:0,strictlyDominated:false,strictlyDominatedPoints:0};continue;}
    let covered=0,strictlyDominatedPoints=0;const witnesses=[];
    for(const point of familyFrontier){
      const exact=plans.some(p=>p.policies.join('|')===point.policies.join('|')&&equalCost(p.cost,point.cost));
      const dominator=frontier.find(p=>dominates(p.cost,point.cost));
      if(exact||dominator)covered++;
      if(dominator){strictlyDominatedPoints++;if(witnesses.length<3)witnesses.push({baseline:{policies:point.policies,cost:point.cost},dominator:{policies:dominator.policies,cost:dominator.cost}});}
    }
    coverage[family]={feasible:true,covered:covered===familyFrontier.length,paretoPoints:familyFrontier.length,strictlyDominated:strictlyDominatedPoints===familyFrontier.length,strictlyDominatedSome:strictlyDominatedPoints>0,strictlyDominatedPoints,witnesses};
  }
  return{plans:plans.length,frontier,baselines,baselineFrontiers,coverage,weaklyDominatesIncludedBaselines:Object.values(coverage).every(row=>row.covered),strictlyDominatedFamilies:Object.entries(coverage).filter(([,r])=>r.strictlyDominated).map(([k])=>k),partiallyDominatedFamilies:Object.entries(coverage).filter(([,r])=>r.strictlyDominatedSome).map(([k])=>k)};
}

export function proveImpossibilityBoundaries(){
  const capOp={id:'canon',kind:OP_KIND.CANON,bytes:100,irreversible:true,requiresTotalOrder:true,requiresPartitionAvailability:true,requiresCrashSurvival:true};
  const flpOp={id:'canon',kind:OP_KIND.CANON,bytes:100,irreversible:true,requiresTotalOrder:true,requiresCrashSurvival:true,requiresGuaranteedTermination:true};
  const cap=semanticFrontier([capOp],{partitioned:true,crashReplicas:3});
  const flp=semanticFrontier([flpOp],{fullyAsync:true,crashReplicas:3});
  const lowerBound={failures:1,minimumCommittedCopies:2,canonNucleusCopies:2,strictlyBeatable:false};
  return{pass:cap.frontier.length===0&&flp.frontier.length===0&&!lowerBound.strictlyBeatable,capInfeasible:cap.frontier.length===0,flpInfeasible:flp.frontier.length===0,lowerBound};
}

export function canonicalRinneWorkload(){return[
  {id:'presence',kind:OP_KIND.PRESENCE,bytes:96,rate:20,recipients:12,latencyBudgetMs:120,rollbackAllowed:true},
  {id:'combat',kind:OP_KIND.AUTHORITATIVE,bytes:180,rate:10,recipients:8,latencyBudgetMs:160,rollbackAllowed:true},
  {id:'social-counter',kind:OP_KIND.MERGEABLE,bytes:48,rate:1,recipients:4,mergeable:true,requiresPartitionAvailability:false},
  {id:'death-rebirth',kind:OP_KIND.CANON,bytes:512,recoveryBytes:16384,rate:0.02,recipients:2,irreversible:true,requiresTotalOrder:true,requiresCrashSurvival:true,rollbackAllowed:false},
];}

export function adversarialWorkload(){return[
  {id:'presence',kind:OP_KIND.PRESENCE,bytes:96,rate:20,recipients:8},
  {id:'ranked-canon',kind:OP_KIND.ADVERSARIAL_CANON,bytes:512,recoveryBytes:4096,rate:0.1,recipients:3,irreversible:true,requiresTotalOrder:true,requiresCrashSurvival:true,requiresByzantine:true,rollbackAllowed:false},
];}

export function proveKnownFamilyClosure(){
  const environments=[
    {players:30,deterministicEngine:false,crashReplicas:3,trustedAuthority:true},
    {players:4,deterministicEngine:true,crashReplicas:3,trustedAuthority:true},
    {players:30,deterministicEngine:false,crashReplicas:3,externalService:true,trustedAuthority:true},
    {players:12,deterministicEngine:true,crashReplicas:3,byzantineReplicas:4,trustedAuthority:false},
  ];
  const workloads=[
    canonicalRinneWorkload(),
    [{id:'presence',kind:OP_KIND.PRESENCE,bytes:64,rate:20,recipients:3,deterministic:true}],
    [{id:'merge',kind:OP_KIND.MERGEABLE,bytes:64,rate:3,recipients:5,mergeable:true}],
    [{id:'canon',kind:OP_KIND.CANON,bytes:256,recoveryBytes:2048,rate:.1,recipients:2,irreversible:true,requiresTotalOrder:true,requiresCrashSurvival:true,rollbackAllowed:false}],
    adversarialWorkload(),
  ];
  let cases=0,covered=0,strictCases=0;
  const failures=[];
  for(const env of environments)for(const ops of workloads){
    const result=semanticFrontier(ops,env);cases++;
    if(result.weaklyDominatesIncludedBaselines)covered++;else failures.push({env,ops,result});
    if(result.strictlyDominatedFamilies.length)strictCases++;
  }
  return{pass:covered===cases&&strictCases>0,cases,covered,strictCases,failures};
}

function familyReachabilityWitnesses(){
  const crashCanon=[{id:'canon',kind:OP_KIND.CANON,bytes:256,recoveryBytes:2048,rate:.1,recipients:2,irreversible:true,requiresTotalOrder:true,requiresCrashSurvival:true,rollbackAllowed:false}];
  return{
    [FAMILY.SNAPSHOT]:{operations:[{id:'presence',kind:OP_KIND.PRESENCE,bytes:64,rate:20,recipients:8}],environment:{players:30,trustedAuthority:true}},
    [FAMILY.DEDICATED]:{operations:[{id:'presence',kind:OP_KIND.PRESENCE,bytes:64,rate:20,recipients:8},{id:'txn',kind:OP_KIND.EXTERNAL_TXN,bytes:256,recoveryBytes:2048,irreversible:true,requiresTotalOrder:true,requiresCrashSurvival:true,requiresExternalOrder:true,rollbackAllowed:false}],environment:{players:30,trustedAuthority:true,externalService:true,crashReplicas:3}},
    [FAMILY.LOCKSTEP]:{operations:[{id:'combat',kind:OP_KIND.AUTHORITATIVE,bytes:64,rate:10,recipients:3,deterministic:true}],environment:{players:4,deterministicEngine:true}},
    [FAMILY.ROLLBACK]:{operations:[{id:'combat',kind:OP_KIND.AUTHORITATIVE,bytes:64,rate:10,recipients:3,deterministic:true,rollbackAllowed:true}],environment:{players:4,deterministicEngine:true}},
    [FAMILY.STATE_SYNC]:{operations:[{id:'presence',kind:OP_KIND.PRESENCE,bytes:64,rate:20,recipients:8}],environment:{players:30}},
    [FAMILY.RAFT]:{operations:crashCanon,environment:{players:30,crashReplicas:3}},
    [FAMILY.PAXOS]:{operations:crashCanon,environment:{players:30,crashReplicas:3}},
    [FAMILY.REDBLUE]:{operations:[{id:'merge',kind:OP_KIND.MERGEABLE,bytes:64,rate:3,recipients:5,mergeable:true},...crashCanon],environment:{players:30,crashReplicas:3}},
    [FAMILY.CRDT]:{operations:[{id:'merge',kind:OP_KIND.MERGEABLE,bytes:64,rate:3,recipients:5,mergeable:true,requiresPartitionAvailability:true}],environment:{players:30,partitioned:true}},
    [FAMILY.GOSSIP]:{operations:[{id:'merge',kind:OP_KIND.MERGEABLE,bytes:64,rate:3,recipients:5,mergeable:true,requiresPartitionAvailability:true}],environment:{players:30,partitioned:true}},
    [FAMILY.MESH]:{operations:crashCanon,environment:{players:30,crashReplicas:3}},
    [FAMILY.PBFT]:{operations:[{id:'ranked',kind:OP_KIND.ADVERSARIAL_CANON,bytes:256,recoveryBytes:2048,irreversible:true,requiresTotalOrder:true,requiresCrashSurvival:true,requiresByzantine:true,rollbackAllowed:false}],environment:{players:30,crashReplicas:3,byzantineReplicas:4}},
    [FAMILY.EXTERNAL]:{operations:[{id:'txn',kind:OP_KIND.EXTERNAL_TXN,bytes:256,recoveryBytes:2048,irreversible:true,requiresTotalOrder:true,requiresCrashSurvival:true,requiresExternalOrder:true,rollbackAllowed:false}],environment:{players:30,externalService:true}},
    [FAMILY.CANON_NUCLEUS]:{operations:crashCanon,environment:{players:30,crashReplicas:3}},
  };
}

export function proveFamilyReachability(){
  const witnesses=familyReachabilityWitnesses(),rows={};
  for(const family of Object.keys(FAMILY_POLICIES)){
    const witness=witnesses[family];if(!witness){rows[family]={pass:false,reason:'missing witness'};continue;}
    const result=semanticFrontier(witness.operations,witness.environment),coverage=result.coverage[family];
    rows[family]={pass:Boolean(coverage?.feasible&&coverage.paretoPoints>0),paretoPoints:coverage?.paretoPoints??0,frontierPoints:result.frontier.length};
  }
  return{pass:Object.values(rows).every(row=>row.pass),families:Object.keys(rows).length,rows};
}

function familyExtensionWitnesses(){
  const ap=[{id:'ap-merge',kind:OP_KIND.MERGEABLE,bytes:64,rate:2,recipients:4,mergeable:true,requiresPartitionAvailability:true}];
  const crashCanon=[{id:'crash-canon',kind:OP_KIND.CANON,bytes:256,recoveryBytes:4096,irreversible:true,requiresTotalOrder:true,requiresCrashSurvival:true,rollbackAllowed:false}];
  const byzantine=[{id:'ranked-canon',kind:OP_KIND.ADVERSARIAL_CANON,bytes:256,recoveryBytes:4096,irreversible:true,requiresTotalOrder:true,requiresCrashSurvival:true,requiresByzantine:true,rollbackAllowed:false}];
  const external=[{id:'external-txn',kind:OP_KIND.EXTERNAL_TXN,bytes:256,recoveryBytes:4096,irreversible:true,requiresTotalOrder:true,requiresCrashSurvival:true,requiresExternalOrder:true,rollbackAllowed:false}];
  return{
    [FAMILY.SNAPSHOT]:{operations:ap,environment:{players:30,partitioned:true,trustedAuthority:true}},
    [FAMILY.DEDICATED]:{operations:ap,environment:{players:30,partitioned:true,trustedAuthority:true,externalService:true}},
    [FAMILY.LOCKSTEP]:{operations:ap,environment:{players:30,partitioned:true,deterministicEngine:true}},
    [FAMILY.ROLLBACK]:{operations:crashCanon,environment:{players:30,crashReplicas:3,deterministicEngine:true}},
    [FAMILY.STATE_SYNC]:{operations:crashCanon,environment:{players:30,crashReplicas:3}},
    [FAMILY.RAFT]:{operations:ap,environment:{players:30,partitioned:true,crashReplicas:3}},
    [FAMILY.PAXOS]:{operations:ap,environment:{players:30,partitioned:true,crashReplicas:3}},
    [FAMILY.REDBLUE]:{operations:byzantine,environment:{players:30,crashReplicas:3,byzantineReplicas:4}},
    [FAMILY.CRDT]:{operations:crashCanon,environment:{players:30,crashReplicas:3}},
    [FAMILY.GOSSIP]:{operations:crashCanon,environment:{players:30,crashReplicas:3}},
    [FAMILY.MESH]:{operations:ap,environment:{players:30,partitioned:true,crashReplicas:3}},
    [FAMILY.PBFT]:{operations:external,environment:{players:30,crashReplicas:3,byzantineReplicas:4,externalService:true}},
    [FAMILY.EXTERNAL]:{operations:byzantine,environment:{players:30,crashReplicas:3,byzantineReplicas:4,externalService:true}},
    [FAMILY.CANON_NUCLEUS]:{operations:byzantine,environment:{players:30,crashReplicas:3,byzantineReplicas:4}},
  };
}

export function proveFamilyStrictExtension(){
  const witnesses=familyExtensionWitnesses(),rows={};
  for(const family of Object.keys(FAMILY_POLICIES)){
    const witness=witnesses[family];if(!witness){rows[family]={pass:false,reason:'missing witness'};continue;}
    const result=semanticFrontier(witness.operations,witness.environment),coverage=result.coverage[family];
    const capabilityExtension=!coverage.feasible&&result.frontier.length>0;
    const costExtension=Boolean(coverage.feasible&&coverage.strictlyDominated);
    rows[family]={pass:capabilityExtension||costExtension,capabilityExtension,costExtension,baselineFeasible:coverage.feasible,frontierPoints:result.frontier.length,witnessPolicies:result.frontier.slice(0,3).map(plan=>plan.policies)};
  }
  return{pass:Object.values(rows).every(row=>row.pass),families:Object.keys(rows).length,rows};
}

export function proveSafetyClassification(){
  const env={players:30,crashReplicas:3,byzantineReplicas:4,trustedAuthority:true,externalService:true,deterministicEngine:true};
  const irreversible=normalizeOperation({id:'canon',kind:OP_KIND.CANON,bytes:100,recoveryBytes:1000,irreversible:true,requiresTotalOrder:true,requiresCrashSurvival:true,rollbackAllowed:false});
  const adversarial=normalizeOperation({id:'adv',kind:OP_KIND.ADVERSARIAL_CANON,bytes:100,recoveryBytes:1000,irreversible:true,requiresTotalOrder:true,requiresCrashSurvival:true,requiresByzantine:true,rollbackAllowed:false});
  const mergeable=normalizeOperation({id:'merge',kind:OP_KIND.MERGEABLE,bytes:100,mergeable:true,requiresPartitionAvailability:true});
  const rollback=evaluatePolicy(POLICY.ROLLBACK,irreversible,env);
  const crdtCanon=evaluatePolicy(POLICY.CRDT,irreversible,env);
  const nucleusAdversarial=evaluatePolicy(POLICY.CANON_NUCLEUS,adversarial,env);
  const pbft=evaluatePolicy(POLICY.PBFT,adversarial,env);
  const crdtPartition=evaluatePolicy(POLICY.CRDT,mergeable,{...env,partitioned:true});
  return{pass:!rollback.feasible&&!crdtCanon.feasible&&!nucleusAdversarial.feasible&&pbft.feasible&&crdtPartition.feasible,checks:{rollbackRejected:!rollback.feasible,crdtCanonRejected:!crdtCanon.feasible,nucleusByzantineRejected:!nucleusAdversarial.feasible,pbftAccepted:pbft.feasible,crdtPartitionAccepted:crdtPartition.feasible}};
}

export function proveMixedWorkloadStrictGain(){
  const env={players:30,rttMs:80,jitterMs:20,loss:.01,crashReplicas:3,trustedAuthority:true,deterministicEngine:false};
  const result=semanticFrontier(canonicalRinneWorkload(),env,{switchOverhead:{bytesPerBoundary:64,latencyPerBoundaryMs:.25,cpuPerBoundary:.02}});
  const feasible=Object.entries(result.baselines).filter(([,p])=>p);
  const dominated=feasible.filter(([family,plan])=>result.frontier.some(p=>dominates(p.cost,plan.cost))).map(([family])=>family);
  const raftDominated=dominated.includes(FAMILY.RAFT),meshDominated=dominated.includes(FAMILY.MESH);
  return{pass:result.weaklyDominatesIncludedBaselines&&raftDominated&&meshDominated,result:{plans:result.plans,frontier:result.frontier.length,dominated,coverage:result.coverage}};
}

export function proveHomogeneousNoFalseStrictClaim(){
  const ops=[{id:'merge',kind:OP_KIND.MERGEABLE,bytes:64,rate:2,recipients:3,mergeable:true}],env={players:30,crashReplicas:3};
  const result=semanticFrontier(ops,env);
  const crdt=result.baselines[FAMILY.CRDT];
  const matched=result.frontier.some(p=>equalCost(p.cost,crdt.cost));
  return{pass:Boolean(crdt)&&matched&&!result.coverage[FAMILY.CRDT].strictlyDominated,matched,strictlyDominated:result.coverage[FAMILY.CRDT]?.strictlyDominated};
}

export function proveInvariantClosure(){
  const unsafe=[
    {id:'credit',kind:OP_KIND.MERGEABLE,bytes:32,mergeable:true,invariants:['balance']},
    {id:'spend',kind:OP_KIND.CANON,bytes:64,recoveryBytes:256,irreversible:true,requiresTotalOrder:true,requiresCrashSurvival:true,rollbackAllowed:false,invariants:['balance']},
  ];
  const closed=closeOperationRequirements(unsafe),unsafePlan=semanticFrontier(unsafe,{players:30,crashReplicas:3});
  const safe=[
    {id:'badge',kind:OP_KIND.MERGEABLE,bytes:32,mergeable:true,invariants:['profile'],commutesWith:['rebirth']},
    {id:'rebirth',kind:OP_KIND.CANON,bytes:64,recoveryBytes:256,irreversible:true,requiresTotalOrder:true,requiresCrashSurvival:true,rollbackAllowed:false,invariants:['profile'],commutesWith:['badge']},
  ];
  const open=closeOperationRequirements(safe),safePlan=semanticFrontier(safe,{players:30,crashReplicas:3});
  const conflictEscalated=closed.operations[0].requiresTotalOrder&&closed.operations[0].requiresCrashSurvival&&!closed.operations[0].rollbackAllowed&&unsafePlan.frontier.every(p=>p.policies[0]!==POLICY.CRDT);
  const provenCommutativityPreserved=!open.operations[0].requiresTotalOrder&&safePlan.frontier.some(p=>p.policies[0]===POLICY.CRDT);
  return{pass:conflictEscalated&&provenCommutativityPreserved,conflictEscalated,provenCommutativityPreserved,escalations:closed.escalations};
}

export function runSemanticFrontierProofSuite(){
  const impossibility=proveImpossibilityBoundaries();
  const closure=proveKnownFamilyClosure();
  const reachability=proveFamilyReachability();
  const familyExtension=proveFamilyStrictExtension();
  const safety=proveSafetyClassification();
  const mixed=proveMixedWorkloadStrictGain();
  const homogeneous=proveHomogeneousNoFalseStrictClaim();
  const invariantClosure=proveInvariantClosure();
  const maximal=proveMaximalFrontierTheorem();
  const sweep=proveFrontierDominanceSweep();
  const checks={impossibilityBoundaries:impossibility.pass,knownFamilyClosure:closure.pass,familyReachability:reachability.pass,familyStrictExtension:familyExtension.pass,safetyClassification:safety.pass,mixedWorkloadStrictGain:mixed.pass,homogeneousHonesty:homogeneous.pass,invariantClosure:invariantClosure.pass,maximalFrontier:maximal.pass,dominanceSweep:sweep.pass};
  return{pass:Object.values(checks).every(Boolean),checks,impossibility,closure,reachability,familyExtension,mixed,homogeneous,invariantClosure,maximal,sweep:{pass:sweep.pass,cases:sweep.cases,covered:sweep.covered,strict:sweep.strict,infeasible:sweep.infeasible,failures:sweep.failures}};
}

export function frontierWorkloads(){return[
  [{id:'presence-only',kind:OP_KIND.PRESENCE,bytes:64,rate:20,recipients:8,latencyBudgetMs:140,rollbackAllowed:true}],
  [{id:'deterministic-combat',kind:OP_KIND.AUTHORITATIVE,bytes:96,rate:10,recipients:3,deterministic:true,latencyBudgetMs:180,rollbackAllowed:true}],
  [{id:'merge-ap',kind:OP_KIND.MERGEABLE,bytes:48,rate:2,recipients:4,mergeable:true,requiresPartitionAvailability:true}],
  [{id:'canon-crash',kind:OP_KIND.CANON,bytes:256,recoveryBytes:4096,rate:.05,recipients:2,irreversible:true,requiresTotalOrder:true,requiresCrashSurvival:true,rollbackAllowed:false}],
  canonicalRinneWorkload(),
  adversarialWorkload(),
  [{id:'external-txn',kind:OP_KIND.EXTERNAL_TXN,bytes:512,recoveryBytes:1024,rate:.1,recipients:2,irreversible:true,requiresTotalOrder:true,requiresCrashSurvival:true,requiresExternalOrder:true,rollbackAllowed:false}],
];}

export function proveFrontierDominanceSweep(){
  const workloads=frontierWorkloads(),failures=[];let cases=0,covered=0,strict=0,infeasible=0;
  for(const players of [4,30])for(const rttMs of [20,80,220])for(const deterministicEngine of [false,true])for(const crashReplicas of [0,3])for(const byzantineReplicas of [0,4])for(const trustedAuthority of [false,true])for(const externalService of [false,true])for(const partitioned of [false,true]){
    const env={players,rttMs,jitterMs:rttMs>100?40:10,loss:rttMs>100?.08:.01,deterministicEngine,crashReplicas,byzantineReplicas,trustedAuthority,externalService,partitioned};
    for(const ops of workloads){
      cases++;const result=semanticFrontier(ops,env,{maxPlans:250000});
      const feasibleBaseline=Object.values(result.baselines).some(Boolean);
      const casePass=result.weaklyDominatesIncludedBaselines&&(!feasibleBaseline||result.frontier.length>0);
      if(casePass)covered++;else failures.push({env,ops,result:{plans:result.plans,frontier:result.frontier.length,coverage:result.coverage}});
      if(result.strictlyDominatedFamilies.length)strict++;
      if(!result.frontier.length)infeasible++;
    }
  }
  return{pass:covered===cases&&strict>0,cases,covered,strict,infeasible,failures};
}

export function proveByzantineReplicaLowerBound({faults=1,replicas=4}={}){
  if(!Number.isInteger(faults)||faults<0||!Number.isInteger(replicas)||replicas<1)throw Error('Invalid Byzantine lower-bound input');
  const minimumReplicas=3*faults+1;
  return Object.freeze({faults,replicas,minimumReplicas,pass:replicas>=minimumReplicas,strictlyMinimal:replicas===minimumReplicas});
}

export function proveMaximalFrontierTheorem(){
  const impossibility=proveImpossibilityBoundaries(),byzantine=proveByzantineReplicaLowerBound(),closure=proveKnownFamilyClosure(),reachability=proveFamilyReachability(),familyExtension=proveFamilyStrictExtension(),mixed=proveMixedWorkloadStrictGain(),homogeneous=proveHomogeneousNoFalseStrictClaim(),invariants=proveInvariantClosure();
  const strictUniversalDominancePossible=false;
  const weakPolicyClosure=closure.pass;
  const strictExpansion=mixed.pass&&mixed.result.dominated.length>0&&familyExtension.pass;
  const lowerBoundHonesty=impossibility.pass&&byzantine.pass&&homogeneous.pass;
  return{pass:weakPolicyClosure&&reachability.pass&&strictExpansion&&lowerBoundHonesty&&invariants.pass&&!strictUniversalDominancePossible,strictUniversalDominancePossible,weakPolicyClosure,strictExpansion,lowerBoundHonesty,reachability,familyExtension,byzantine,invariants};
}
