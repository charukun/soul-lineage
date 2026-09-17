import { createHash } from 'node:crypto';

export const ReplayClass = Object.freeze({
  EXACT: 'exact-deterministic',
  ROBUST: 'bounded-robust',
  AUTHORITY: 'authority-only',
  UNCLASSIFIED: 'unclassified'
});

const canonical = value => JSON.stringify(
  value && typeof value === 'object' && !Array.isArray(value)
    ? Object.fromEntries(Object.keys(value).sort().map(k => [k, JSON.parse(canonical(value[k]))]))
    : value
);

export function digest(value) {
  return createHash('sha256').update(canonical(value)).digest('hex');
}

export function splitRuntimeFrameDelta(elapsedSeconds,{paused=false}={}) {
  if (!Number.isFinite(elapsedSeconds) || elapsedSeconds < 0) throw Error('invalid elapsed');
  if (paused) return {simulationDelta:0,lifeDelta:0};
  return {simulationDelta:Math.min(.05,elapsedSeconds),lifeDelta:elapsedSeconds};
}

export function integrateConstantSpeed(frameDeltas,{speed=4}={}) {
  let x=0, life=0;
  for (const elapsed of frameDeltas) {
    const {simulationDelta,lifeDelta}=splitRuntimeFrameDelta(elapsed);
    x += speed * simulationDelta;
    life += lifeDelta;
  }
  return {x,life};
}

export function framePartitionCounterexample() {
  const coarse=integrateConstantSpeed([.1]);
  const split=integrateConstantSpeed([.05,.05]);
  return {coarse,split,sameWallTime:coarse.life===split.life,sameSimulation:coarse.x===split.x};
}

export function entropyDrivenTransition(state,input,entropy) {
  if (!Number.isInteger(entropy)) throw Error('entropy must be integer');
  const roll=((entropy>>>0)%1000)/1000;
  return {...state, score:(state.score||0)+input.power, critical:roll<input.criticalChance, entropy};
}

export function entropyReplayCounterexample() {
  const state={score:0},input={power:5,criticalChance:.2};
  const first=entropyDrivenTransition(state,input,17);
  const second=entropyDrivenTransition(state,input,917);
  return {first,second,sameInput:true,sameOutcome:first.critical===second.critical};
}

export function replayWithRecordedEntropy(state,input,recordedEntropy) {
  return entropyDrivenTransition(state,input,recordedEntropy);
}

export function approximationDecision({x,threshold,epsilon=1e-15}={}) {
  const exact=Math.sin(x);
  const implementationA=exact-epsilon;
  const implementationB=exact+epsilon;
  return {
    implementationA,
    implementationB,
    decisionA:implementationA>=threshold,
    decisionB:implementationB>=threshold,
    diverges:(implementationA>=threshold)!==(implementationB>=threshold)
  };
}

export function approximationCounterexample() {
  const x=.7, center=Math.sin(x);
  return approximationDecision({x,threshold:center,epsilon:1e-15});
}

export function robustThreshold({estimate,errorBound,threshold=0,direction='gte'}={}) {
  if (![estimate,errorBound,threshold].every(Number.isFinite) || errorBound<0) throw Error('invalid robust threshold');
  const lo=estimate-errorBound,hi=estimate+errorBound;
  if (direction==='gte') {
    if (lo>=threshold) return {verdict:'TRUE',lo,hi,margin:lo-threshold};
    if (hi<threshold) return {verdict:'FALSE',lo,hi,margin:threshold-hi};
  } else if (direction==='lte') {
    if (hi<=threshold) return {verdict:'TRUE',lo,hi,margin:threshold-hi};
    if (lo>threshold) return {verdict:'FALSE',lo,hi,margin:lo-threshold};
  } else throw Error('invalid direction');
  return {verdict:'UNCERTAIN',lo,hi,margin:0};
}

export function fixedPointKernel(initial,events) {
  let state={hp:initial.hp|0,xMm:initial.xMm|0,stamina:initial.stamina|0,tick:initial.tick|0};
  const trace=[];
  for (const event of events) {
    if (!event || !Number.isInteger(event.tick) || event.tick < state.tick) throw Error('invalid event order');
    state.tick=event.tick;
    if (event.type==='move') state.xMm += event.deltaMm|0;
    else if (event.type==='damage') state.hp=Math.max(0,state.hp-(event.amount|0));
    else if (event.type==='stamina') state.stamina=Math.max(0,state.stamina+(event.delta|0));
    else throw Error('unknown event');
    trace.push(digest(state));
  }
  return {state,trace,root:digest({state,trace})};
}

export function exactReplayWitness() {
  const initial={hp:100,xMm:0,stamina:100,tick:0};
  const events=[
    {tick:1,type:'move',deltaMm:125},
    {tick:2,type:'damage',amount:37},
    {tick:3,type:'stamina',delta:-12},
    {tick:4,type:'damage',amount:63}
  ];
  const a=fixedPointKernel(initial,events);
  const b=fixedPointKernel(initial,structuredClone(events));
  return {a,b,identical:a.root===b.root};
}

export function oracleReplay({request,recordedResponse,currentResponse}) {
  const fromRecorded={request,response:recordedResponse,outcome:recordedResponse.allowed?'ALLOW':'DENY'};
  const fromCurrent={request,response:currentResponse,outcome:currentResponse.allowed?'ALLOW':'DENY'};
  return {fromRecorded,fromCurrent,stable:fromRecorded.outcome===fromCurrent.outcome};
}

export function oracleCounterexample() {
  return oracleReplay({
    request:{item:'unique-sword'},
    recordedResponse:{allowed:true,epoch:8},
    currentResponse:{allowed:false,epoch:9}
  });
}

export function classifyReplayability({deterministicKernel=false,errorBound=null,externalAuthority=false,decisionMargin=null}={}) {
  if (deterministicKernel) return ReplayClass.EXACT;
  if (Number.isFinite(errorBound) && errorBound>=0 && Number.isFinite(decisionMargin) && decisionMargin>errorBound) return ReplayClass.ROBUST;
  if (externalAuthority) return ReplayClass.AUTHORITY;
  return ReplayClass.UNCLASSIFIED;
}

export function unsafeApproximatePromotion({estimate,errorBound,threshold=0}={}) {
  // Mutation/control: treats the point estimate as exact and ignores uncertainty.
  return estimate>=threshold?'TRUE':'FALSE';
}

export function causalClosureCheck({required=[],recorded=[]}={}) {
  const have=new Set(recorded);
  const missing=required.filter(x=>!have.has(x));
  return {pass:missing.length===0,missing};
}
