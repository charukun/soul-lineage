import { createHash, generateKeyPairSync, sign, verify } from 'node:crypto';

export function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k, stable(value[k])]));
  return value;
}
export const canonical = value => JSON.stringify(stable(value));
export const digest = value => createHash('sha256').update(typeof value === 'string' ? value : canonical(value)).digest('hex');

export function totalOrder(events, key = 'seq') {
  return [...events].sort((a,b) => a[key]-b[key] || String(a.id).localeCompare(String(b.id)));
}

export function transitiveClosure(ids, edges) {
  const reach = new Map(ids.map(id => [id, new Set()]));
  for (const [a,b] of edges) reach.get(a)?.add(b);
  let changed = true;
  while (changed) {
    changed = false;
    for (const a of ids) for (const b of [...reach.get(a)]) for (const c of reach.get(b) || []) {
      if (!reach.get(a).has(c)) { reach.get(a).add(c); changed = true; }
    }
  }
  return reach;
}

export function lamportHappenedBefore(events) {
  const ids = events.map(e => e.id), edges = [];
  const byProcess = new Map();
  for (const e of events) {
    const rows = byProcess.get(e.process) || [];
    rows.push(e); byProcess.set(e.process, rows);
  }
  for (const rows of byProcess.values()) {
    rows.sort((a,b)=>a.local-b.local);
    for (let i=0;i+1<rows.length;i++) edges.push([rows[i].id, rows[i+1].id]);
  }
  const sends = new Map(events.filter(e=>e.kind==='send'&&e.messageId).map(e=>[e.messageId,e]));
  for (const r of events.filter(e=>e.kind==='receive'&&e.messageId)) {
    const s = sends.get(r.messageId); if (s) edges.push([s.id,r.id]);
  }
  return { ids, edges, closure: transitiveClosure(ids, edges) };
}

export function relation(hb,a,b) {
  if (a===b) return 'same';
  if (hb.closure.get(a)?.has(b)) return 'before';
  if (hb.closure.get(b)?.has(a)) return 'after';
  return 'concurrent';
}

export function vectorCompare(a,b) {
  const keys = new Set([...Object.keys(a),...Object.keys(b)]);
  let le=true, ge=true, lt=false, gt=false;
  for (const k of keys) {
    const x=a[k]||0,y=b[k]||0;
    if (x>y) le=false; if (x<y) ge=false; if (x<y) lt=true; if (x>y) gt=true;
  }
  if (le&&lt) return 'before'; if (ge&&gt) return 'after'; if (le&&ge) return 'same'; return 'concurrent';
}

export function semanticDependencyGraph(nodes, dependencies) {
  const ids = nodes.map(n=>n.id), byId = new Map(nodes.map(n=>[n.id,n]));
  for (const [child,parent] of dependencies) if (!byId.has(child)||!byId.has(parent)) throw Error('unknown dependency node');
  return { ids, byId, dependencies:[...dependencies], closure:transitiveClosure(ids, dependencies.map(([child,parent])=>[parent,child])) };
}

export function semanticAncestors(graph,id) {
  if (!graph.byId.has(id)) throw Error('unknown node');
  const reverse = new Map(graph.ids.map(x=>[x,[]]));
  for (const [child,parent] of graph.dependencies) reverse.get(child).push(parent);
  const out=new Set(), stack=[id];
  while(stack.length){const x=stack.pop();for(const p of reverse.get(x)||[])if(!out.has(p)){out.add(p);stack.push(p)}}
  return out;
}

export function causalButNotSemanticWitness() {
  const events=[
    {id:'a:send',process:'a',local:1,kind:'send',messageId:'m1'},
    {id:'b:recv',process:'b',local:1,kind:'receive',messageId:'m1'},
    {id:'b:commit',process:'b',local:2,kind:'commit'},
  ];
  const hb=lamportHappenedBefore(events);
  const semantic=semanticDependencyGraph([{id:'a:send'},{id:'b:recv'},{id:'b:commit'}],[['b:commit','b:recv']]);
  return {hbRelation:relation(hb,'a:send','b:commit'),semanticAncestors:[...semanticAncestors(semantic,'b:commit')]};
}

export function equalFinalStateDifferentHistory() {
  const initial={hp:100};
  const traceA=[{type:'damage',amount:20},{type:'heal',amount:20}];
  const traceB=[];
  const apply=(s,trace)=>trace.reduce((x,e)=>({hp:e.type==='damage'?x.hp-e.amount:x.hp+e.amount}),{...s});
  return {a:apply(initial,traceA),b:apply(initial,traceB),traceA,traceB,sameFinal:canonical(apply(initial,traceA))===canonical(apply(initial,traceB))};
}

export function commute(left,right,apply,initial) {
  const ab=apply(apply(structuredClone(initial),left),right);
  const ba=apply(apply(structuredClone(initial),right),left);
  return {ab,ba,commute:canonical(ab)===canonical(ba)};
}

export function orderSensitiveFirstClaimWitness() {
  const initial={owner:null,log:[]};
  const apply=(s,e)=>{if(e.type==='claim'&&s.owner===null)s.owner=e.actor;s.log.push(e.id);return s};
  return commute({id:'a',type:'claim',actor:'alice'},{id:'b',type:'claim',actor:'bob'},apply,initial);
}

export function independentPresentationWitness() {
  const initial={x:0,weather:'clear'};
  const apply=(s,e)=>{if(e.type==='move')s.x=e.x;if(e.type==='weather')s.weather=e.weather;return s};
  return commute({id:'move',type:'move',x:4},{id:'weather',type:'weather',weather:'rain'},apply,initial);
}

export function semanticReadWriteIndependent(a,b) {
  const ar=new Set(a.reads||[]), aw=new Set(a.writes||[]), br=new Set(b.reads||[]), bw=new Set(b.writes||[]);
  const intersects=(x,y)=>[...x].some(k=>y.has(k));
  return !intersects(aw,bw)&&!intersects(aw,br)&&!intersects(bw,ar);
}

export function clockSkewWitness() {
  const actual={send:100,receive:101};
  const clocks={senderOffset:+20,receiverOffset:-20};
  return {actual,observed:{send:actual.send+clocks.senderOffset,receive:actual.receive+clocks.receiverOffset},causal:'send-before-receive'};
}

export function multiParentWitness() {
  const nodes=[
    {id:'damage',kind:'fact',value:80},
    {id:'armor',kind:'fact',value:.25},
    {id:'policy',kind:'policy',value:'v7'},
    {id:'fatal',kind:'decision',value:false},
  ];
  const graph=semanticDependencyGraph(nodes,[['fatal','damage'],['fatal','armor'],['fatal','policy']]);
  return {parents:graph.dependencies.filter(([child])=>child==='fatal').map(([,p])=>p), ancestors:[...semanticAncestors(graph,'fatal')].sort()};
}

export function provenanceNode(payload, parents=[]) {
  return { id:digest({payload,parents:[...parents].sort()}), payload:stable(payload), parents:[...parents].sort() };
}
export function verifyProvenanceDag(nodes, rootId) {
  const map=new Map(nodes.map(n=>[n.id,n]));
  const visiting=new Set(),seen=new Set();
  function walk(id){const n=map.get(id);if(!n)return false;if(visiting.has(id))return false;if(seen.has(id))return true;if(provenanceNode(n.payload,n.parents).id!==n.id)return false;visiting.add(id);for(const p of n.parents)if(!walk(p))return false;visiting.delete(id);seen.add(id);return true}
  return walk(rootId);
}

export function signedIncompleteProvenanceWitness() {
  const {privateKey,publicKey}=generateKeyPairSync('ed25519');
  const stock=provenanceNode({kind:'fact',stock:1});
  const decision=provenanceNode({kind:'decision',action:'claim'},[stock.id]);
  const signature=sign(null,Buffer.from(decision.id),privateKey);
  const cryptographicallyValid=verify(null,Buffer.from(decision.id),publicKey,signature)&&verifyProvenanceDag([stock,decision],decision.id);
  const actualRuleNeeds=['stock','curse'];
  const represented=['stock'];
  return {cryptographicallyValid,actualRuleNeeds,represented,complete:actualRuleNeeds.every(x=>represented.includes(x))};
}

export function causalClosure(graph, roots) {
  const out=new Set(roots);
  for(const root of roots) for(const x of semanticAncestors(graph,root)) out.add(x);
  return out;
}

export function targetedRevalidationWitness() {
  const nodes=[
    {id:'move-npc',kind:'presentation'},
    {id:'damage',kind:'fact'},
    {id:'armor',kind:'fact'},
    {id:'policy',kind:'policy'},
    {id:'fatal',kind:'decision'},
    {id:'weather',kind:'presentation'},
  ];
  const g=semanticDependencyGraph(nodes,[['fatal','damage'],['fatal','armor'],['fatal','policy']]);
  return {all:nodes.map(x=>x.id),closure:[...causalClosure(g,['fatal'])].sort()};
}

export function explanationContractIssues(c) {
  const issues=[]; if(!c||typeof c!=='object')return['missing-contract'];
  const need=(x,n)=>{if(!x)issues.push(n)};
  need(c.effectId,'effect-id');need(c.semanticType,'semantic-type');need(c.policyRoot,'policy-root');need(Array.isArray(c.semanticParents),'semantic-parents');need(c.authorityGeneration,'authority-generation');need(c.operationId,'operation-id');
  if(c.randomDependent)need(c.randomnessReceipt,'randomness-receipt');
  if(c.externalEffect)need(c.sinkReceipt,'sink-receipt');
  if(c.semanticParents?.length>1)need(c.parentSetRoot,'parent-set-root');
  return issues;
}

export function linearSequenceDoesNotImplyDependency() {
  const log=[{sequence:1,id:'weather'},{sequence:2,id:'rebirth'}];
  const semantic=semanticDependencyGraph(log,[]);
  return {log,weatherAncestorOfRebirth:semanticAncestors(semantic,'rebirth').has('weather')};
}

export const witnessNames=Object.freeze([
  'total-order-false-causality','happened-before-not-semantic-causation','equal-final-state-different-history','order-sensitive-concurrent-claims','clock-skew-reverses-observed-order','multi-parent-derivation','signed-incomplete-provenance','targeted-causal-closure','linear-sequence-not-dependency'
]);
