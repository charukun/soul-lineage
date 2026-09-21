import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { workerPreviewUrl } from './staging-preview.mjs';

const SHA=/^[0-9a-f]{40}$/;
const VERSION=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const RUN_KEY=/^[a-z0-9][a-z0-9-]{2,47}$/;
const PHASES=new Set(['before','after']);
const GAMES=Object.freeze({
  village:Object.freeze({game:'village',app:'village'}),
  kuumetsu:Object.freeze({game:'kuumetsu',app:'demon'}),
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
async function main(){
  const args=process.argv.slice(2),command=args[0];
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
  if(command==='bind'){
    const plan=isolatedPublicationPlan({
      game:option(args,'--game'),
      sourceSha:option(args,'--sha'),
      runKey:option(args,'--run-key'),
      iteration:option(args,'--iteration','1'),
      iterations:option(args,'--iterations','1'),
      phase:option(args,'--phase','before'),
    });
    process.stdout.write(JSON.stringify(bindImmutableVersion({plan,versionId:option(args,'--version')}),null,2)+'\n');
    return;
  }
  throw new Error('Usage: node scripts/autonomous-run-controller.mjs <plan|bind> --game <village|kuumetsu> --sha <40-hex> --run-key <key> --iteration <n> --iterations <n> --phase <before|after> [--version <worker-version-id>]');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)await main();
