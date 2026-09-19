import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { appNode, graph, inputHash } from './workspaces.mjs';
import { assertBuildableTarget, distributionTarget } from './distribution-targets.mjs';
import { materializeStaticArtifact } from './distribution-artifacts.mjs';

const npm=process.platform==='win32'?'npm.cmd':'npm';
const PULSE_APP='pulse';
const git=(root,args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();

function option(args,name,fallback=null){
  const index=args.indexOf(name);
  return index>=0?args[index+1]:fallback;
}

export function targetInputHash(root,nodes,app,targetId){
  const target=assertBuildableTarget(targetId,app);
  const environment=target.environment||'dev';
  if(app===PULSE_APP){
    const files=git(root,['ls-files','ops-board','wrangler.dev.pulse.jsonc','scripts/prepare-pulse-worker.mjs','scripts/notify-fast-dev.mjs'])
      .split(/\r?\n/).filter(Boolean).sort();
    const source=createHash('sha256').update('pulse-worker-v1\0');
    for(const file of files)source.update(file).update('\0').update(readFileSync(resolve(root,file))).update('\0');
    return createHash('sha256').update('distribution-target-v1\0').update(target.id).update('\0').update(source.digest('hex')).digest('hex');
  }
  const hash=createHash('sha256').update('distribution-target-v1\0').update(target.id).update('\0').update(inputHash(root,nodes,app,environment));
  return hash.digest('hex');
}

export function buildCommandForTarget(app,targetOrId){
  const target=assertBuildableTarget(targetOrId,app);
  if(app===PULSE_APP)return Object.freeze({command:process.execPath,args:['scripts/prepare-pulse-worker.mjs'],environment:target.environment,branch:target.branch});
  return Object.freeze({command:npm,args:['run','build','--workspace',`@soul/${app}`],environment:target.environment,branch:target.branch});
}

export async function buildDistributionTarget({root=process.cwd(),app,target:targetId,artifactRoot='.artifacts',runBuild=true}={}){
  const nodes=graph(root),node=app===PULSE_APP?null:appNode(nodes,app),target=assertBuildableTarget(distributionTarget(targetId),app);
  const sourceSha=git(root,['rev-parse','HEAD']),sourceBranch=git(root,['branch','--show-current'])||target.branch||'detached';
  const input=targetInputHash(root,nodes,app,target.id),command=buildCommandForTarget(app,target);
  if(runBuild)execFileSync(command.command,command.args,{cwd:root,stdio:'inherit',env:{...process.env,APP_ENV:command.environment,APP_BRANCH:command.branch}});
  const sourceDir=app===PULSE_APP?resolve(root,'ops-board/public'):resolve(root,'dist',app);
  return materializeStaticArtifact({
    sourceDir,artifactRoot:resolve(root,artifactRoot),app,target:target.id,sourceSha,sourceBranch,inputHash:input,
    packageName:node?.pkg.name||'@soul/pulse',displayName:node?.pkg.displayName||'PULSE',builtAt:new Date().toISOString(),runId:process.env.GITHUB_RUN_ID||null,
  });
}

async function main(){
  const args=process.argv.slice(2),app=option(args,'--app'),target=option(args,'--target'),artifactRoot=option(args,'--artifact-root','.artifacts');
  if(!app||!target)throw new Error('Usage: node scripts/build-target.mjs --app <app> --target <target> [--artifact-root <dir>] [--no-build]');
  const result=await buildDistributionTarget({app,target,artifactRoot,runBuild:!args.includes('--no-build')});
  console.log(JSON.stringify({artifactDir:result.artifactDir,reused:result.reused,receipt:result.receipt},null,2));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)await main();
