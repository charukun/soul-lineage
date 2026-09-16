export const FRONTIER_COST_KEYS=Object.freeze(['wireBytes','latencyMs','coordination','connections','cpuWork','infraUnits','rollbackExposure']);

const finiteCost=(plan,key)=>{const value=Number(plan?.cost?.[key]);if(!Number.isFinite(value)||value<0)throw Error(`Invalid frontier cost: ${key}`);return value;};
const signature=plan=>`${(plan?.policies||[]).join('|')}::${FRONTIER_COST_KEYS.map(key=>finiteCost(plan,key)).join(',')}`;

export function weaklyDominatesCost(left,right){return FRONTIER_COST_KEYS.every(key=>finiteCost(left,key)<=finiteCost(right,key)+1e-9);}
export function strictlyDominatesCost(left,right){return weaklyDominatesCost(left,right)&&FRONTIER_COST_KEYS.some(key=>finiteCost(left,key)<finiteCost(right,key)-1e-9);}
export function equalFrontierCost(left,right){return FRONTIER_COST_KEYS.every(key=>Math.abs(finiteCost(left,key)-finiteCost(right,key))<1e-9);}

export function genericParetoFrontier(plans=[]){
  const rows=plans.map(plan=>structuredClone(plan)),out=[];
  for(let i=0;i<rows.length;i++){
    let beaten=false;
    for(let j=0;j<rows.length&&!beaten;j++)if(i!==j&&strictlyDominatesCost(rows[j],rows[i]))beaten=true;
    if(!beaten&&!out.some(row=>signature(row)===signature(rows[i])))out.push(rows[i]);
  }
  return out;
}

function witness(frontier,point){return frontier.find(row=>weaklyDominatesCost(row,point))||null;}

export function proveParetoSupersetClosure({baselineFrontiers={},candidatePlans=[]}={}){
  const frontier=genericParetoFrontier(candidatePlans),families={};let totalPoints=0,coveredPoints=0;
  for(const[name,points]of Object.entries(baselineFrontiers)){
    const rows=Array.isArray(points)?points:[];totalPoints+=rows.length;let covered=0,strict=0;const misses=[];
    for(const point of rows){const found=witness(frontier,point);if(found){covered++;coveredPoints++;if(strictlyDominatesCost(found,point))strict++;}else misses.push(structuredClone(point));}
    families[name]={points:rows.length,covered,strict,pass:covered===rows.length,misses};
  }
  return{pass:coveredPoints===totalPoints,totalPoints,coveredPoints,frontier,families};
}

export function proveMonotoneObjectiveNoRegret({baselineFrontiers={},candidatePlans=[],weightVectors=[]}={}){
  const vectors=weightVectors.length?weightVectors:[
    {wireBytes:1,latencyMs:1,coordination:1,connections:1,cpuWork:1,infraUnits:1,rollbackExposure:1},
    {wireBytes:1000,latencyMs:1,coordination:1,connections:1,cpuWork:1,infraUnits:100,rollbackExposure:10},
    {wireBytes:1,latencyMs:1000,coordination:100,connections:1,cpuWork:10,infraUnits:1,rollbackExposure:100},
    {wireBytes:1,latencyMs:1,coordination:1,connections:1000,cpuWork:100,infraUnits:10,rollbackExposure:1},
  ];
  const score=(plan,weights)=>FRONTIER_COST_KEYS.reduce((sum,key)=>sum+finiteCost(plan,key)*Math.max(0,Number(weights[key]??0)),0);
  const cases=[];
  for(const[name,points]of Object.entries(baselineFrontiers))for(const weights of vectors){
    if(!points?.length)continue;
    const baseline=Math.min(...points.map(plan=>score(plan,weights))),candidate=candidatePlans.length?Math.min(...candidatePlans.map(plan=>score(plan,weights))):Infinity;
    cases.push({family:name,baseline,candidate,pass:candidate<=baseline+1e-9});
  }
  return{pass:cases.every(row=>row.pass),cases};
}

export function absorbExternalFamily(candidatePlans=[],name='external-family',familyPlans=[]){
  const combined=[...candidatePlans.map(plan=>structuredClone(plan)),...familyPlans.map(plan=>structuredClone(plan))];
  const closure=proveParetoSupersetClosure({baselineFrontiers:{[name]:familyPlans},candidatePlans:combined});
  return{combined,closure};
}

export function proveCatalogAgnosticClosure(){
  const plan=(policy,cost)=>({policies:[policy],cost:{wireBytes:0,latencyMs:0,coordination:0,connections:0,cpuWork:0,infraUnits:0,rollbackExposure:0,...cost}});
  const known={
    alpha:[plan('alpha-low-wire',{wireBytes:10,latencyMs:100,connections:4}),plan('alpha-low-latency',{wireBytes:80,latencyMs:10,connections:4})],
    beta:[plan('beta-balanced',{wireBytes:30,latencyMs:30,connections:3,cpuWork:2})],
  };
  const composition=plan('semantic-composition',{wireBytes:20,latencyMs:20,connections:2,cpuWork:1});
  const basePlans=Object.values(known).flat().concat(composition),initial=proveParetoSupersetClosure({baselineFrontiers:known,candidatePlans:basePlans});
  const future=[plan('future-zero-latency',{wireBytes:500,latencyMs:0,connections:1,cpuWork:10}),plan('future-zero-wire',{wireBytes:0,latencyMs:500,connections:10,cpuWork:.1})];
  const absorbed=absorbExternalFamily(basePlans,'future',future),all={...known,future};
  const final=proveParetoSupersetClosure({baselineFrontiers:all,candidatePlans:absorbed.combined}),objectives=proveMonotoneObjectiveNoRegret({baselineFrontiers:all,candidatePlans:absorbed.combined});
  const strictExpansion=Object.values(initial.families).some(row=>row.strict>0);
  return{pass:initial.pass&&absorbed.closure.pass&&final.pass&&objectives.pass&&strictExpansion,initial,absorbed:absorbed.closure,final,objectives,strictExpansion};
}
