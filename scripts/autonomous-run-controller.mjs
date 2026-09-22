import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { stagingObservation, workerPreviewUrl } from './staging-preview.mjs';
import {
  ITERATION_TELEMETRY_SCHEMA,
  advanceIterationTelemetry,
  createIterationTelemetry,
  iterationTelemetryId,
  telemetryMarker,
} from './autonomous-iteration-telemetry.mjs';

const SHA=/^[0-9a-f]{40}$/;
const VERSION=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const RUN_KEY=/^[a-z0-9][a-z0-9-]{2,47}$/;
const PHASES=new Set(['before','after']);
const GAMES=Object.freeze({
  village:Object.freeze({game:'village',app:'village'}),
  kuumetsu:Object.freeze({game:'kuumetsu',app:'demon'}),
  rinne:Object.freeze({game:'rinne',app:'rinne'}),
});

export function autonomousGame(value){
  const game=GAMES[String(value||'').toLowerCase()];
  assert.ok(game,`Unsupported autonomous game: ${value}`);
  return game;
}
export function exactSha(value){
  const sha=String(value||'').toLowerCase();
  assert.match(sha,SHA,'Exact 40-character source SHA is required');
  return sha;
}
export function runKey(value){
  const key=String(value||'').toLowerCase();
  assert.match(key,RUN_KEY,'run key must be 3-48 lowercase letters, digits, or hyphens');
  return key;
}
export function iterationNumber(value,{max=50}={}){
  const n=Number(value);
  assert.ok(Number.isSafeInteger(n)&&n>=1&&n<=max,`iteration must be between 1 and ${max}`);
  return n;
}
export function iterationCount(value){
  const n=Number(value);
  assert.ok(Number.isSafeInteger(n)&&n>=1&&n<=12,'iterations must be between 1 and 12');
  return n;
}
export function stagingPhase(value){
  const phase=String(value||'').toLowerCase();
  assert.ok(PHASES.has(phase),'phase must be before or after');
  return phase;
}

export function isolatedPublicationPlan({
  game,sourceSha,runKey:rawRunKey,iterations=1,iteration=1,phase='before'
}={}){
  const selected=autonomousGame(game),sha=exactSha(sourceSha),key=runKey(rawRunKey);
  const total=iterationCount(iterations),current=iterationNumber(iteration,{max:total}),stage=stagingPhase(phase);
  return Object.freeze({
    schemaVersion:1,
    runKey:key,
    game:selected.game,
    app:selected.app,
    iterations:total,
    iteration:current,
    phase:stage,
    sourceSha:sha,
    telemetry:Object.freeze({
      schema:ITERATION_TELEMETRY_SCHEMA,
      iterationId:iterationTelemetryId(key,current),
      runKey:key,
      iteration:current,
      iterations:total,
    }),
    dispatch:Object.freeze({
      workflow:'dev-app-publish.yml',
      ref:sha,
      inputs:Object.freeze({app:selected.app,source_sha:sha}),
      retrySameSourceIfCancelled:true,
    }),
    isolation:Object.freeze({
      source:'exact-sha',
      observation:'cloudflare-worker-version-preview',
      mutableLatestDevForbidden:true,
      developDriftIgnoredUntilMergeFreshness:true,
    }),
  });
}

export function bindImmutableVersion({plan,versionId,deploymentUrl}={}){
  assert.ok(plan&&typeof plan==='object','publication plan is required');
  assert.match(String(versionId||'').toLowerCase(),VERSION,'Cloudflare Worker version ID is required');
  const url=workerPreviewUrl({app:plan.app,versionId:String(versionId).toLowerCase(),deploymentUrl});
  return Object.freeze({
    ...plan,
    versionId:String(versionId).toLowerCase(),
    reference:url,
    verifiedSourceSha:plan.sourceSha,
    immutable:true,
  });
}

export async function verifyImmutableVersion({
  binding,fetchImpl=globalThis.fetch,observedAt=new Date().toISOString(),conditions={},notVerified=[]
}={}){
  assert.ok(binding?.immutable===true,'immutable version binding is required');
  assert.equal(typeof fetchImpl,'function','fetch implementation is required');
  const versionUrl=new URL('version.json',binding.reference).href;
  const response=await fetchImpl(versionUrl,{headers:{accept:'application/json'}});
  assert.ok(response?.ok,`version.json request failed: ${response?.status??'unknown'}`);
  const version=await response.json();
  const commit=exactSha(version?.commit);
  assert.equal(commit,binding.sourceSha,`version.json.commit mismatch: expected ${binding.sourceSha}, got ${commit}`);
  const observation=stagingObservation({
    app:binding.app,
    sourceSha:binding.sourceSha,
    versionId:binding.versionId,
    deploymentUrl:binding.reference.replace(binding.versionId.slice(0,8)+'-',''),
    observedAt,
    conditions,
    notVerified,
  });
  return Object.freeze({
    ...observation,
    runKey:binding.runKey,
    game:binding.game,
    app:binding.app,
    iteration:binding.iteration,
    iterations:binding.iterations,
    phase:binding.phase,
    verification:Object.freeze({
      versionUrl,
      commit,
      environment:version?.environment??null,
      matched:true,
    }),
  });
}

export function nextIteration({state,mergeSha}={}){
  assert.ok(state&&typeof state==='object','current state is required');
  const merged=exactSha(mergeSha);
  const total=iterationCount(state.iterations),current=iterationNumber(state.iteration,{max:total});
  assert.equal(stagingPhase(state.phase),'after','next iteration starts only after the current After observation');
  if(current===total)return Object.freeze({...state,status:'complete',mergeSha:merged});
  return isolatedPublicationPlan({
    game:state.game,
    sourceSha:merged,
    runKey:state.runKey,
    iterations:total,
    iteration:current+1,
    phase:'before',
  });
}

function option(args,name,fallback=null){
  const i=args.indexOf(name);
  return i>=0?args[i+1]:fallback;
}
function jsonOption(args,name,fallback){
  const value=option(args,name,null);
  return value===null?fallback:JSON.parse(value);
}
async function main(){
  const args=process.argv.slice(2),command=args[0];
  if(command==='telemetry-init'){
    const telemetry=createIterationTelemetry({
      game:option(args,'--game'),
      sourceSha:option(args,'--sha'),
      runKey:option(args,'--run-key'),
      iteration:option(args,'--iteration','1'),
      iterations:option(args,'--iterations','1'),
      startedAt:option(args,'--at',new Date().toISOString()),
    });
    process.stdout.write(JSON.stringify(telemetry,null,2)+'\n');
    return;
  }
  if(command==='telemetry-advance'){
    const state=JSON.parse(option(args,'--telemetry-json','{}'));
    const next=advanceIterationTelemetry(state,{
      from:option(args,'--from',state.currentStep),
      to:option(args,'--to',null),
      at:option(args,'--at',new Date().toISOString()),
      completedState:option(args,'--completed-state','done'),
      patch:jsonOption(args,'--patch-json',{}),
    });
    process.stdout.write(JSON.stringify(next,null,2)+'\n');
    return;
  }
  if(command==='telemetry-marker'){
    process.stdout.write(telemetryMarker(JSON.parse(option(args,'--telemetry-json','{}')))+'\n');
    return;
  }
  if(command==='plan'){
    const plan=isolatedPublicationPlan({
      game:option(args,'--game'),
      sourceSha:option(args,'--sha'),
      runKey:option(args,'--run-key'),
      iteration:option(args,'--iteration','1'),
      iterations:option(args,'--iterations','1'),
      phase:option(args,'--phase','before'),
    });
    process.stdout.write(JSON.stringify(plan,null,2)+'\n');
    return;
  }
  if(command==='bind'||command==='verify'){
    const plan=isolatedPublicationPlan({
      game:option(args,'--game'),
      sourceSha:option(args,'--sha'),
      runKey:option(args,'--run-key'),
      iteration:option(args,'--iteration','1'),
      iterations:option(args,'--iterations','1'),
      phase:option(args,'--phase','before'),
    });
    const binding=bindImmutableVersion({
      plan,
      versionId:option(args,'--version'),
      deploymentUrl:option(args,'--deployment-url',undefined),
    });
    if(command==='bind'){
      process.stdout.write(JSON.stringify(binding,null,2)+'\n');
      return;
    }
    const verified=await verifyImmutableVersion({
      binding,
      conditions:jsonOption(args,'--conditions-json',{}),
      notVerified:jsonOption(args,'--not-verified-json',[]),
    });
    process.stdout.write(JSON.stringify(verified,null,2)+'\n');
    return;
  }
  throw new Error('Usage: node scripts/autonomous-run-controller.mjs <plan|bind|verify|telemetry-init|telemetry-advance|telemetry-marker> ...');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)await main();
