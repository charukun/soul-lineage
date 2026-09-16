import {OP_KIND,semanticFrontier} from './semantic-frontier.js';
import {digest} from './canon-nucleus.js';

const clone=value=>structuredClone(value);
const sortedPair=(a,b)=>a<b?[a,b]:[b,a];
const effectKey=(a,b)=>sortedPair(a.id,b.id).join('::');
const COST_KEYS=Object.freeze(['wireBytes','latencyMs','coordination','connections','cpuWork','infraUnits','rollbackExposure']);

function normalizeResource(resource){
  const id=String(resource?.id||'');if(!id)throw Error('Invariant resource id is required');
  if(resource.type==='bounded-counter'){
    if(!Number.isInteger(resource.min)||!Number.isInteger(resource.max)||resource.min>resource.max||resource.max-resource.min>10000)throw Error('Invalid bounded counter');
    return{id,type:resource.type,min:resource.min,max:resource.max};
  }
  if(resource.type==='grow-only-set')return{id,type:resource.type};
  if(resource.type==='unique-register')return{id,type:resource.type};
  if(resource.type==='single-use-token')return{id,type:resource.type};
  throw Error(`Unknown invariant resource ${resource.type}`);
}
function normalizeOperation(operation,resources){
  const id=String(operation?.id||'');if(!id)throw Error('Invariant operation id is required');
  const effects={};for(const [resourceId,effect] of Object.entries(operation.effects||{})){if(!resources.has(resourceId))throw Error(`Unknown invariant resource ${resourceId}`);effects[resourceId]=clone(effect);}
  const latencyBudgetMs=operation.latencyBudgetMs??Infinity;if(!Number.isFinite(latencyBudgetMs)&&latencyBudgetMs!==Infinity)throw Error('Invalid invariant operation latency budget');
  return{id,kind:operation.kind||OP_KIND.MERGEABLE,bytes:operation.bytes??64,rate:operation.rate??1,recipients:operation.recipients??1,mergeable:operation.mergeable!==false,deterministic:Boolean(operation.deterministic),irreversible:Boolean(operation.irreversible),requiresTotalOrder:Boolean(operation.requiresTotalOrder),requiresCrashSurvival:Boolean(operation.requiresCrashSurvival),requiresByzantine:Boolean(operation.requiresByzantine),requiresExternalOrder:Boolean(operation.requiresExternalOrder),requiresPartitionAvailability:Boolean(operation.requiresPartitionAvailability),requiresGuaranteedTermination:Boolean(operation.requiresGuaranteedTermination),rollbackAllowed:operation.rollbackAllowed!==false,latencyBudgetMs,recoveryBytes:operation.recoveryBytes??0,effects};
}

function boundedCounterWitness(resource,a,b){
  const da=Number(a?.delta??0),db=Number(b?.delta??0);if(!Number.isInteger(da)||!Number.isInteger(db))throw Error('Counter delta must be integer');
  for(let base=resource.min;base<=resource.max;base++){
    const left=base+da,right=base+db,merged=base+da+db;
    const leftValid=left>=resource.min&&left<=resource.max,rightValid=right>=resource.min&&right<=resource.max,mergedValid=merged>=resource.min&&merged<=resource.max;
    if(leftValid&&rightValid&&!mergedValid)return{resourceId:resource.id,type:resource.type,base,left,right,merged,deltas:[da,db]};
  }
  return null;
}
function uniqueRegisterWitness(resource,a,b){if(!a||!b||!Object.hasOwn(a,'assign')||!Object.hasOwn(b,'assign')||a.assign===b.assign)return null;return{resourceId:resource.id,type:resource.type,base:null,left:a.assign,right:b.assign,merged:'conflict'};}
function tokenWitness(resource,a,b){return a?.consume===true&&b?.consume===true?{resourceId:resource.id,type:resource.type,base:'available',left:'consumed',right:'consumed',merged:'double-consume'}:null;}
function conflictWitness(resource,a,b){if(resource.type==='grow-only-set')return null;if(resource.type==='bounded-counter')return boundedCounterWitness(resource,a,b);if(resource.type==='unique-register')return uniqueRegisterWitness(resource,a,b);if(resource.type==='single-use-token')return tokenWitness(resource,a,b);throw Error('Unknown invariant resource');}

export function compileInvariantCoordination({resources=[],operations=[]}={}){
  const resourceRows=resources.map(normalizeResource),resourceMap=new Map(resourceRows.map(row=>[row.id,row]));
  const ops=operations.map(op=>normalizeOperation(op,resourceMap));if(new Set(ops.map(op=>op.id)).size!==ops.length)throw Error('Invariant operation ids must be unique');
  const conflicts=[],safePairs=[];
  for(let i=0;i<ops.length;i++)for(let j=i+1;j<ops.length;j++){
    const a=ops[i],b=ops[j],shared=Object.keys(a.effects).filter(id=>Object.hasOwn(b.effects,id)),witnesses=[];
    for(const resourceId of shared){const witness=conflictWitness(resourceMap.get(resourceId),a.effects[resourceId],b.effects[resourceId]);if(witness)witnesses.push(witness);}
    if(witnesses.length)conflicts.push({key:effectKey(a,b),left:a.id,right:b.id,resources:shared,witnesses});else safePairs.push({key:effectKey(a,b),left:a.id,right:b.id,resources:shared});
  }
  const conflictIds=new Set(conflicts.flatMap(row=>[row.left,row.right])),safeMap=new Map(ops.map(op=>[op.id,new Set()]));for(const row of safePairs){safeMap.get(row.left).add(row.right);safeMap.get(row.right).add(row.left);}
  const semanticOperations=ops.map(op=>{
    const compiledStrong=conflictIds.has(op.id)||op.irreversible;
    return{id:op.id,kind:op.kind,bytes:op.bytes,rate:op.rate,recipients:op.recipients,mergeable:op.mergeable,deterministic:op.deterministic,irreversible:op.irreversible,requiresTotalOrder:op.requiresTotalOrder||compiledStrong,requiresCrashSurvival:op.requiresCrashSurvival,requiresByzantine:op.requiresByzantine,requiresExternalOrder:op.requiresExternalOrder,requiresPartitionAvailability:op.requiresPartitionAvailability,requiresGuaranteedTermination:op.requiresGuaranteedTermination,rollbackAllowed:op.rollbackAllowed&&!compiledStrong,latencyBudgetMs:op.latencyBudgetMs,recoveryBytes:op.recoveryBytes,invariants:Object.keys(op.effects),commutesWith:[...safeMap.get(op.id)].sort()};
  });
  const certificate={schema:'rrp-invariant-kernel/1',resources:resourceRows,operations:ops.map(op=>({id:op.id,effects:op.effects})),conflicts,safePairs};certificate.root=digest(certificate);
  return{resources:resourceRows,operations:ops,semanticOperations,conflicts,safePairs,certificate,coordinationRequired:conflicts.length>0};
}

export function verifyInvariantCoordinationCertificate(certificate){if(certificate?.schema!=='rrp-invariant-kernel/1'||typeof certificate.root!=='string')return false;try{const rebuilt=compileInvariantCoordination({resources:certificate.resources,operations:certificate.operations});return rebuilt.certificate.root===certificate.root;}catch{return false;}}

function normalizeObjective(objective){const rows=Array.isArray(objective)&&objective.length?objective:[...COST_KEYS];if(new Set(rows).size!==rows.length||rows.some(key=>!COST_KEYS.includes(key)))throw Error('Invalid proof plan objective');return rows;}
function comparePlan(a,b,objective){for(const key of objective){const delta=a.cost[key]-b.cost[key];if(Math.abs(delta)>1e-9)return delta;}return a.policies.join('|').localeCompare(b.policies.join('|'));}
function sameCost(a,b){return COST_KEYS.every(key=>Math.abs(Number(a?.[key])-Number(b?.[key]))<1e-9);}

export function synthesizeProofCarryingPlan({resources=[],operations=[],environment={},objective=COST_KEYS}={}){
  objective=normalizeObjective(objective);const compiled=compileInvariantCoordination({resources,operations}),frontier=semanticFrontier(compiled.semanticOperations,environment).frontier;if(!frontier.length)return{pass:false,reason:'no feasible semantic plan',compiled};
  const selected=frontier.slice().sort((a,b)=>comparePlan(a,b,objective))[0];
  const body={schema:'rrp-proof-carrying-plan/1',resources:compiled.resources,operations:compiled.operations,environment:clone(environment),objective:[...objective],invariantCertificate:compiled.certificate,selected:{policies:[...selected.policies],cost:clone(selected.cost)}};body.root=digest(body);
  return{pass:true,bundle:Object.freeze(body),compiled,frontierPoints:frontier.length};
}

export function verifyProofCarryingPlan(bundle){
  if(bundle?.schema!=='rrp-proof-carrying-plan/1'||typeof bundle.root!=='string'||!verifyInvariantCoordinationCertificate(bundle.invariantCertificate))return false;
  try{const withoutRoot=clone(bundle);delete withoutRoot.root;if(digest(withoutRoot)!==bundle.root)return false;const synthesized=synthesizeProofCarryingPlan({resources:bundle.resources,operations:bundle.operations,environment:bundle.environment,objective:bundle.objective});if(!synthesized.pass)return false;return synthesized.bundle.selected.policies.join('|')===bundle.selected.policies.join('|')&&sameCost(synthesized.bundle.selected.cost,bundle.selected.cost)&&synthesized.bundle.invariantCertificate.root===bundle.invariantCertificate.root;}catch{return false;}
}

export function proveInvariantCompilerKernel(){
  const compiled=compileInvariantCoordination({resources:[{id:'stock',type:'bounded-counter',min:0,max:2},{id:'lineage-name',type:'unique-register'},{id:'rebirth-token',type:'single-use-token'},{id:'discoveries',type:'grow-only-set'}],operations:[
    {id:'reserve-a',effects:{stock:{delta:-1}}},{id:'reserve-b',effects:{stock:{delta:-1}}},{id:'name-a',effects:{'lineage-name':{assign:'A'}}},{id:'name-b',effects:{'lineage-name':{assign:'B'}}},{id:'rebirth-a',effects:{'rebirth-token':{consume:true}},irreversible:true,requiresCrashSurvival:true,kind:OP_KIND.CANON},{id:'rebirth-b',effects:{'rebirth-token':{consume:true}},irreversible:true,requiresCrashSurvival:true,kind:OP_KIND.CANON},{id:'discover-a',effects:{discoveries:{add:'x'}},mergeable:true},{id:'discover-b',effects:{discoveries:{add:'y'}},mergeable:true},
  ]});
  const edges=new Set(compiled.conflicts.map(row=>row.key)),safe=new Set(compiled.safePairs.map(row=>row.key)),expectedConflicts=['reserve-a::reserve-b','name-a::name-b','rebirth-a::rebirth-b'];
  const witnessMinimal=expectedConflicts.every(key=>edges.has(key)&&compiled.conflicts.find(row=>row.key===key)?.witnesses.length>0),growOnlySafe=safe.has('discover-a::discover-b');
  const reserveOps=compiled.semanticOperations.filter(op=>op.id.startsWith('reserve-')),discoverOps=compiled.semanticOperations.filter(op=>op.id.startsWith('discover-')),conservativeEscalation=reserveOps.every(op=>op.requiresTotalOrder&&!op.rollbackAllowed)&&discoverOps.every(op=>!op.requiresTotalOrder&&op.rollbackAllowed);
  const preserved=compileInvariantCoordination({resources:[{id:'x',type:'grow-only-set'}],operations:[{id:'external',effects:{x:{add:'a'}},kind:OP_KIND.EXTERNAL_TXN,requiresExternalOrder:true,requiresByzantine:true,requiresCrashSurvival:true,requiresPartitionAvailability:true,requiresGuaranteedTermination:true,rollbackAllowed:false,recoveryBytes:99,latencyBudgetMs:123}]}).semanticOperations[0];
  const guaranteePreservation=preserved.requiresExternalOrder&&preserved.requiresByzantine&&preserved.requiresCrashSurvival&&preserved.requiresPartitionAvailability&&preserved.requiresGuaranteedTermination&&preserved.rollbackAllowed===false&&preserved.recoveryBytes===99&&preserved.latencyBudgetMs===123;
  const certificateValid=verifyInvariantCoordinationCertificate(compiled.certificate),tampered=clone(compiled.certificate);tampered.conflicts=[];const tamperRejected=verifyInvariantCoordinationCertificate(tampered)===false;
  return{pass:witnessMinimal&&growOnlySafe&&conservativeEscalation&&guaranteePreservation&&certificateValid&&tamperRejected,compiled,checks:{witnessMinimal,growOnlySafe,conservativeEscalation,guaranteePreservation,certificateValid,tamperRejected},limits:['exact only for the declared bounded-counter, grow-only-set, unique-register and single-use-token resource models','unsafe pairs are conservatively escalated to total order; this is a safety compiler, not proof that total order is always the cheapest coordination primitive','cross-resource application semantics outside declared effects still require a separate invariant model']};
}

export function proveCompiledSemanticFrontier(){
  const resources=[{id:'stock',type:'bounded-counter',min:0,max:1},{id:'discoveries',type:'grow-only-set'}],operations=[{id:'reserve-a',effects:{stock:{delta:-1}},bytes:64,recipients:2},{id:'reserve-b',effects:{stock:{delta:-1}},bytes:64,recipients:2},{id:'discover',effects:{discoveries:{add:'x'}},bytes:48,recipients:4,mergeable:true}],environment={players:30,trustedAuthority:true,crashReplicas:3,rttMs:80,jitterMs:20};
  const compiled=compileInvariantCoordination({resources,operations}),result=semanticFrontier(compiled.semanticOperations,environment),hasPlan=result.frontier.length>0;
  const unsafeNeverWeak=result.frontier.every(plan=>plan.rows.filter((_,i)=>compiled.semanticOperations[i].id.startsWith('reserve-')).every(row=>!['crdt','gossip','causal-blue','presence-datagram','state-sync','rollback'].includes(row.policy)));
  const mergeableCanStayWeak=result.frontier.some(plan=>{const index=compiled.semanticOperations.findIndex(op=>op.id==='discover');return['crdt','gossip','causal-blue'].includes(plan.rows[index]?.policy);});
  const synthesized=synthesizeProofCarryingPlan({resources,operations,environment,objective:['latencyMs','wireBytes','connections','coordination','cpuWork','infraUnits','rollbackExposure']}),proofCarrying=synthesized.pass&&verifyProofCarryingPlan(synthesized.bundle),tampered=clone(synthesized.bundle);if(tampered?.selected?.policies?.length)tampered.selected.policies[0]='crdt';const tamperedPlanRejected=synthesized.pass&&verifyProofCarryingPlan(tampered)===false;
  return{pass:hasPlan&&unsafeNeverWeak&&mergeableCanStayWeak&&proofCarrying&&tamperedPlanRejected,hasPlan,unsafeNeverWeak,mergeableCanStayWeak,proofCarrying,tamperedPlanRejected,frontierPoints:result.frontier.length,compiled,result,synthesized};
}
