const SHA=/^[0-9a-f]{40}$/;
const RUN_KEY=/^[a-z0-9][a-z0-9-]{2,47}$/;
const GAMES=new Set(['village','kuumetsu','rinne']);
const STEP_STATES=new Set(['pending','running','done','skipped','problem']);
const OVERALL_STATES=new Set(['running','problem','complete']);
const MARKER=/<!-- autonomous-iteration-telemetry:v1:([A-Za-z0-9_-]+) -->/;
const MAX_ROOT_CAUSES=8,MAX_CHANGES=12,MAX_PATHS=48;
const invariant=(condition,message)=>{if(!condition)throw new Error(message);};

export const ITERATION_TELEMETRY_SCHEMA='soul-lineage.autonomous-iteration-telemetry.v1';
export const ITERATION_STEPS=Object.freeze([
  Object.freeze({id:'observation',label:'観測'}),
  Object.freeze({id:'investigation',label:'原因分析'}),
  Object.freeze({id:'implementation',label:'実装'}),
  Object.freeze({id:'causalValidation',label:'Causal'}),
  Object.freeze({id:'astraValidation',label:'Astra'}),
  Object.freeze({id:'afterObservation',label:'After'}),
  Object.freeze({id:'verdict',label:'Verdict'}),
  Object.freeze({id:'freshness',label:'Freshness'}),
  Object.freeze({id:'merge',label:'Merge'}),
  Object.freeze({id:'devPublish',label:'DEV'}),
]);
const STEP_INDEX=new Map(ITERATION_STEPS.map((step,index)=>[step.id,index]));

const iso=value=>{
  const parsed=Date.parse(value||'');
  invariant(Number.isFinite(parsed),'telemetry timestamp must be an ISO-compatible date');
  return new Date(parsed).toISOString();
};
const clean=(value,limit=500)=>String(value??'').replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,limit);
const strings=(value,max,limit)=>Array.isArray(value)?value.map(item=>clean(item,limit)).filter(Boolean).slice(0,max):[];
const roots=value=>Array.isArray(value)?value.slice(0,MAX_ROOT_CAUSES).map(item=>({
  key:clean(item?.key,120),
  summary:clean(item?.summary,400),
})).filter(item=>item.key||item.summary):[];
const duration=(start,end)=>Math.max(0,Date.parse(end)-Date.parse(start));
function encodeBase64Url(text){
  const bytes=new TextEncoder().encode(text);
  let binary='';
  for(let i=0;i<bytes.length;i+=0x8000)binary+=String.fromCharCode(...bytes.subarray(i,i+0x8000));
  return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function decodeBase64Url(value){
  const raw=String(value),pad=(4-(raw.length%4))%4;
  const binary=atob(raw.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat(pad));
  return new TextDecoder().decode(Uint8Array.from(binary,char=>char.charCodeAt(0)));
}

export function iterationTelemetryId(runKey,iteration){
  const key=String(runKey||'').toLowerCase(),n=Number(iteration);
  invariant(RUN_KEY.test(key),'telemetry runKey must match the autonomous run key contract');
  invariant(Number.isSafeInteger(n)&&n>=1&&n<=12,'telemetry iteration must be 1..12');
  return key+':'+n;
}

export function createIterationTelemetry({runKey,game,iteration=1,iterations=1,sourceSha,startedAt=new Date().toISOString()}={}){
  const key=String(runKey||'').toLowerCase(),selected=String(game||'').toLowerCase();
  const current=Number(iteration),total=Number(iterations),sha=String(sourceSha||'').toLowerCase(),at=iso(startedAt);
  invariant(RUN_KEY.test(key),'telemetry runKey must match the autonomous run key contract');
  invariant(GAMES.has(selected),'unsupported telemetry game');
  invariant(Number.isSafeInteger(total)&&total>=1&&total<=12,'telemetry iterations must be 1..12');
  invariant(Number.isSafeInteger(current)&&current>=1&&current<=total,'telemetry iteration is out of range');
  invariant(SHA.test(sha),'telemetry sourceSha must be exact');
  const steps=Object.fromEntries(ITERATION_STEPS.map(step=>[step.id,Object.freeze({
    id:step.id,label:step.label,state:step.id==='observation'?'running':'pending',
    startedAt:step.id==='observation'?at:null,completedAt:null,durationMs:null,
  })]));
  return Object.freeze({
    schema:ITERATION_TELEMETRY_SCHEMA,
    iterationId:iterationTelemetryId(key,current),
    runKey:key,game:selected,iteration:current,iterations:total,sourceSha:sha,
    status:'running',currentStep:'observation',startedAt:at,updatedAt:at,completedAt:null,
    experimentId:null,themeKey:null,theme:null,improvementSummary:null,
    rootCauses:[],changes:[],changedPaths:[],
    verdict:null,prNumber:null,validatedHead:null,mergeSha:null,
    steps:Object.freeze(steps),
  });
}

export function patchIterationTelemetry(state,patch={}){
  invariant(state?.schema===ITERATION_TELEMETRY_SCHEMA,'telemetry state is required');
  return Object.freeze({...state,
    experimentId:patch.experimentId===undefined?state.experimentId:clean(patch.experimentId,180)||null,
    themeKey:patch.themeKey===undefined?state.themeKey:clean(patch.themeKey,180)||null,
    theme:patch.theme===undefined?state.theme:clean(patch.theme,300)||null,
    improvementSummary:patch.improvementSummary===undefined?state.improvementSummary:clean(patch.improvementSummary,900)||null,
    rootCauses:patch.rootCauses===undefined?state.rootCauses:roots(patch.rootCauses),
    changes:patch.changes===undefined?state.changes:strings(patch.changes,MAX_CHANGES,400),
    changedPaths:patch.changedPaths===undefined?state.changedPaths:strings(patch.changedPaths,MAX_PATHS,260),
    verdict:patch.verdict===undefined?state.verdict:clean(patch.verdict,40)||null,
    prNumber:patch.prNumber===undefined?state.prNumber:(Number.isSafeInteger(Number(patch.prNumber))?Number(patch.prNumber):null),
    validatedHead:patch.validatedHead===undefined?state.validatedHead:(SHA.test(String(patch.validatedHead||''))?String(patch.validatedHead).toLowerCase():null),
    mergeSha:patch.mergeSha===undefined?state.mergeSha:(SHA.test(String(patch.mergeSha||''))?String(patch.mergeSha).toLowerCase():null),
  });
}

export function advanceIterationTelemetry(state,{from=state?.currentStep,to=null,at=new Date().toISOString(),patch={},completedState='done'}={}){
  invariant(state?.schema===ITERATION_TELEMETRY_SCHEMA,'telemetry state is required');
  invariant(STEP_INDEX.has(from),'telemetry current step is invalid');
  if(to!==null){
    invariant(STEP_INDEX.has(to),'telemetry next step is invalid');
    invariant(STEP_INDEX.get(to)===STEP_INDEX.get(from)+1,'telemetry steps must advance in canonical order');
  }
  invariant(['done','skipped'].includes(completedState),'completedState must be done or skipped');
  invariant(state.currentStep===from,'telemetry can only advance the current step');
  const boundary=iso(at),current=state.steps[from];
  invariant(current?.state==='running','current telemetry step must be running');
  const steps={...state.steps,[from]:Object.freeze({
    ...current,state:completedState,completedAt:boundary,durationMs:duration(current.startedAt,boundary),
  })};
  let status='running',completedAt=null,currentStep=to;
  if(to){
    const target=steps[to];
    invariant(target?.state==='pending','next telemetry step must be pending');
    steps[to]=Object.freeze({...target,state:'running',startedAt:boundary});
  }else{
    status='complete';
    completedAt=boundary;
    currentStep=null;
  }
  const patched=patchIterationTelemetry(state,patch);
  return Object.freeze({...patched,steps:Object.freeze(steps),status,currentStep,updatedAt:boundary,completedAt});
}

export function markIterationProblem(state,{at=new Date().toISOString(),summary=null}={}){
  invariant(state?.schema===ITERATION_TELEMETRY_SCHEMA,'telemetry state is required');
  const boundary=iso(at),id=state.currentStep;
  if(!id)return Object.freeze({...state,status:'problem',updatedAt:boundary});
  const current=state.steps[id],steps={...state.steps,[id]:Object.freeze({
    ...current,state:'problem',completedAt:boundary,durationMs:current.startedAt?duration(current.startedAt,boundary):null,
    ...(summary?{summary:clean(summary,500)}:{}),
  })};
  return Object.freeze({...state,steps:Object.freeze(steps),status:'problem',updatedAt:boundary});
}

export function normalizeIterationTelemetry(value){
  if(!value||value.schema!==ITERATION_TELEMETRY_SCHEMA)return null;
  try{
    const base=createIterationTelemetry({
      runKey:value.runKey,game:value.game,iteration:value.iteration,iterations:value.iterations,
      sourceSha:value.sourceSha,startedAt:value.startedAt,
    });
    const patched=patchIterationTelemetry(base,value),steps={};
    for(const definition of ITERATION_STEPS){
      const raw=value.steps?.[definition.id]||base.steps[definition.id],state=STEP_STATES.has(raw?.state)?raw.state:'pending';
      const startedAt=raw?.startedAt?iso(raw.startedAt):null,completedAt=raw?.completedAt?iso(raw.completedAt):null;
      steps[definition.id]=Object.freeze({
        id:definition.id,label:definition.label,state,startedAt,completedAt,
        durationMs:raw?.durationMs!==null&&raw?.durationMs!==undefined&&raw?.durationMs!==''&&Number.isFinite(Number(raw.durationMs))?Math.max(0,Number(raw.durationMs)):(startedAt&&completedAt?duration(startedAt,completedAt):null),
        ...(raw?.summary?{summary:clean(raw.summary,500)}:{}),
      });
    }
    const currentStep=STEP_INDEX.has(value.currentStep)?value.currentStep:null;
    const status=OVERALL_STATES.has(value.status)?value.status:(currentStep?'running':'complete');
    return Object.freeze({
      ...patched,status,currentStep,steps:Object.freeze(steps),
      updatedAt:value.updatedAt?iso(value.updatedAt):patched.updatedAt,
      completedAt:value.completedAt?iso(value.completedAt):null,
    });
  }catch{return null;}
}

export function encodeIterationTelemetry(value){
  const normalized=normalizeIterationTelemetry(value);
  invariant(Boolean(normalized),'valid telemetry is required');
  return encodeBase64Url(JSON.stringify(normalized));
}
export function telemetryMarker(value){
  return '<!-- autonomous-iteration-telemetry:v1:'+encodeIterationTelemetry(value)+' -->';
}
export function readIterationTelemetry(body=''){
  const match=String(body||'').match(MARKER);
  if(!match)return null;
  try{return normalizeIterationTelemetry(JSON.parse(decodeBase64Url(match[1])));}
  catch{return null;}
}
export function upsertIterationTelemetry(body='',value){
  const marker=telemetryMarker(value),text=String(body||'').replace(MARKER,'').trimEnd();
  return (text?text+'\n\n':'')+marker+'\n';
}
