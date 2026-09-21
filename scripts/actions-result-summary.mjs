#!/usr/bin/env node
import { writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { graph } from './workspaces.mjs';
import { distributionPlanForDev } from './distribution-plan.mjs';
import {
  affectedScope,
  affectedTestPlan,
  buildActionsSummary,
  classifyWorkflow,
  extractMajorErrors,
  parseValidationDirectives,
  resolveFreshness,
} from './lib/actions-summary-core.mjs';

const API='https://api.github.com';

function parseArgs(argv){
  const out={};
  for(let i=0;i<argv.length;i++){
    const arg=argv[i];
    if(!arg.startsWith('--'))continue;
    const key=arg.slice(2),next=argv[i+1];
    out[key]=next&&!next.startsWith('--')?argv[++i]:true;
  }
  return out;
}

function localHead(value){
  if(value&&value!=='HEAD')return value;
  try{return execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();}
  catch{return process.env.GITHUB_SHA||'';}
}

async function request(path,{token,accept='application/vnd.github+json',allow404=false}={}){
  const response=await fetch(API+path,{headers:{
    accept,
    'x-github-api-version':'2022-11-28',
    ...(token?{authorization:'Bearer '+token}:{})
  }});
  if(allow404&&response.status===404)return null;
  if(!response.ok)throw new Error('GitHub API '+response.status+' '+path+': '+(await response.text()).slice(0,500));
  const type=response.headers.get('content-type')||'';
  return type.includes('application/json')?response.json():response.text();
}

async function paged(path,key,token){
  const rows=[];
  for(let page=1;page<=10;page++){
    const join=path.includes('?')?'&':'?';
    const data=await request(path+join+'per_page=100&page='+page,{token});
    const batch=Array.isArray(data)?data:(data?.[key]||[]);
    rows.push(...batch);
    if(batch.length<100)break;
  }
  return rows;
}

const runKind=run=>{
  const path=String(run.path||'').toLowerCase();
  if(path.includes('dev-app-publish'))return 'dev_publish';
  if(path.includes('astra-work-validation')||path.endsWith('/ci.yml'))return 'validation';
  return classifyWorkflow(run.name||run.display_title||'');
};

function diagnosticExcerpt(log=''){
  return String(log).split(/\r?\n/).filter(line=>
    /error|fail|fatal|exception|timeout|assert|expect\(|console|request|webgl|gpu|swiftshader|long.?task|\bp(?:50|95|99)\b|version\s+id|workers\.dev|preview/i.test(line)
  ).slice(-240).join('\n');
}

async function collectRuns(repo,sha,token){
  const runsRaw=await paged('/repos/'+repo+'/actions/runs?head_sha='+encodeURIComponent(sha),'workflow_runs',token);
  return Promise.all(runsRaw.map(async run=>{
    const kind=runKind(run);
    const [jobsRaw,artifactsRaw]=await Promise.all([
      paged('/repos/'+repo+'/actions/runs/'+run.id+'/jobs?filter=latest','jobs',token),
      paged('/repos/'+repo+'/actions/runs/'+run.id+'/artifacts','artifacts',token),
    ]);
    const jobs=await Promise.all(jobsRaw.map(async job=>{
      const needsLog=kind==='dev_publish'||kind==='browser_review'||/browser|playwright|chromium/i.test(job.name||'')||
        ['failure','cancelled','timed_out','action_required'].includes(job.conclusion);
      let log='',major_errors=[];
      if(needsLog){
        try{
          log=await request('/repos/'+repo+'/actions/jobs/'+job.id+'/logs',{token,accept:'application/vnd.github+json'});
          major_errors=extractMajorErrors(log);
        }catch(error){
          major_errors=['LOG_FETCH_FAILED: '+error.message];
        }
      }
      return {
        id:job.id,name:job.name,status:job.status,conclusion:job.conclusion,
        url:job.html_url||null,started_at:job.started_at||null,completed_at:job.completed_at||null,
        steps:(job.steps||[]).map(step=>({
          number:step.number,name:step.name,status:step.status,conclusion:step.conclusion,
          started_at:step.started_at||null,completed_at:step.completed_at||null,
        })),
        major_errors,
        diagnostic_log:diagnosticExcerpt(log),
      };
    }));
    const artifacts=artifactsRaw.map(artifact=>({
      ...artifact,
      browser_url:run.html_url?run.html_url+'/artifacts/'+artifact.id:null,
    }));
    return {
      workflow:run.name||run.display_title||String(run.workflow_id),
      workflow_path:run.path||null,
      kind,
      run_id:run.id,run_attempt:run.run_attempt||1,event:run.event,status:run.status,conclusion:run.conclusion,
      head_sha:run.head_sha,url:run.html_url||null,created_at:run.created_at||null,updated_at:run.updated_at||null,
      jobs,artifacts,
    };
  }));
}

function uniqueRuns(runs){
  const map=new Map();
  for(const run of runs)map.set(run.run_id,run);
  return [...map.values()].sort((a,b)=>Number(a.run_id)-Number(b.run_id));
}

function pathsFromCompare(compare){
  return (compare?.files||[]).flatMap(file=>[file.filename,file.previous_filename].filter(Boolean));
}

function requiredEvidence(pr,paths){
  const text=(pr?.title||'')+'\n'+(pr?.body||'');
  const browserPath=paths.some(path=>/browser|playwright|review-/i.test(path));
  const explicit=/browser|playtest|visual review|screenshot|webgl/i.test(text);
  return {
    browser:{
      required:browserPath||explicit,
      reason:browserPath?'browser/review implementation changed':explicit?'PR explicitly requests browser/visual evidence':'no machine-readable browser evidence requirement detected',
    },
  };
}

async function resolvePr(repo,{prNumber,sha,token}){
  if(prNumber)return request('/repos/'+repo+'/pulls/'+prNumber,{token});
  if(!sha)return null;
  const pulls=await request('/repos/'+repo+'/commits/'+sha+'/pulls',{token});
  return pulls.find(row=>row.state==='open')||pulls.find(row=>row.merged_at)||pulls[0]||null;
}

export async function collectFastDevSession({repo,sha=null,prNumber=null,token}={}){
  if(!repo||!repo.includes('/'))throw new Error('--repo must be owner/name');
  let pr=await resolvePr(repo,{prNumber,sha,token});
  let requestedSha=sha?localHead(sha):null;
  if(!requestedSha&&pr)requestedSha=pr.head?.sha||null;
  if(!requestedSha)requestedSha=localHead('HEAD');
  if(!/^[0-9a-f]{40}$/i.test(requestedSha||''))throw new Error('Exact commit SHA required, or provide --pr <number>.');

  if(!pr)pr=await resolvePr(repo,{sha:requestedSha,token});
  const headSha=pr?.head?.sha||requestedSha;
  const [headCommit,developRef,headStatusBundle]=await Promise.all([
    request('/repos/'+repo+'/commits/'+headSha,{token}),
    request('/repos/'+repo+'/git/ref/heads/develop',{token}),
    request('/repos/'+repo+'/commits/'+headSha+'/status',{token}),
  ]);
  const developSha=developRef.object.sha;
  const compareDevelopHead=await request('/repos/'+repo+'/compare/'+developSha+'...'+headSha,{token});
  const validationBase=compareDevelopHead.merge_base_commit?.sha||pr?.base?.sha||developSha;
  const [workCompare,driftCompare]=await Promise.all([
    request('/repos/'+repo+'/compare/'+validationBase+'...'+headSha,{token}),
    validationBase===developSha?Promise.resolve({files:[]}):request('/repos/'+repo+'/compare/'+validationBase+'...'+developSha,{token}),
  ]);
  const workPaths=pathsFromCompare(workCompare);
  const driftPaths=pathsFromCompare(driftCompare);
  const nodes=graph();
  const workScope=affectedScope(nodes,workPaths.filter(path=>path!=='AGENTS.md'));
  const driftScope=affectedScope(nodes,driftPaths.filter(path=>path!=='AGENTS.md'));
  const distribution=distributionPlanForDev(nodes,workPaths);
  const freshnessStatus=(headStatusBundle.statuses||[]).find(row=>row.context==='astra/merge-freshness')||null;
  const freshness=resolveFreshness({
    sha:headSha,latestDevelopSha:developSha,validationBaseSha:validationBase,pr,
    workScope,driftScope,freshnessStatus,
    developContainedInHead:['ahead','identical'].includes(compareDevelopHead.status),
    compareStatus:compareDevelopHead.status,
  });
  const validation=parseValidationDirectives(headCommit.commit?.message||headCommit.message||'');
  const evidence=requiredEvidence(pr,workPaths);
  const sessionManifest={
    base_sha:validationBase,
    head_sha:headSha,
    pr:pr?{number:pr.number,url:pr.html_url||null,state:pr.state,draft:Boolean(pr.draft)}:null,
    affected_scope:affectedScope(nodes,workPaths),
    required_validation:validation,
    publish_target:{apps:distribution.apps,targets:distribution.include},
    required_evidence:evidence,
    mergeability:{
      mergeable:pr?.mergeable??null,
      mergeable_state:pr?.mergeable_state||null,
      latest_develop_sha:developSha,
      compare_status:compareDevelopHead.status||null,
    },
  };
  const testPlan=affectedTestPlan({paths:workPaths,scope:sessionManifest.affected_scope});

  const relatedShas=[headSha];
  if(requestedSha!==headSha)relatedShas.push(requestedSha);
  if(pr?.merged_at&&pr.merge_commit_sha)relatedShas.push(pr.merge_commit_sha);
  const runs=uniqueRuns((await Promise.all([...new Set(relatedShas)].map(value=>collectRuns(repo,value,token)))).flat());
  const statusBundles=await Promise.all([...new Set(relatedShas)].map(value=>request('/repos/'+repo+'/commits/'+value+'/status',{token})));
  const statuses=statusBundles.flatMap(bundle=>bundle.statuses||[]);

  return {
    repo,
    sha:requestedSha,
    validation_sha:headSha,
    pr,
    runs,
    statuses,
    required_validation:validation,
    required_evidence:evidence,
    session_manifest:sessionManifest,
    freshness,
    test_plan:testPlan,
  };
}

async function main(){
  const args=parseArgs(process.argv.slice(2));
  const repo=String(args.repo||process.env.GITHUB_REPOSITORY||'');
  const token=process.env.GH_TOKEN||process.env.GITHUB_TOKEN||'';
  if(!repo)throw new Error('Repository required: --repo owner/name or GITHUB_REPOSITORY');
  if(!token)throw new Error('GH_TOKEN or GITHUB_TOKEN is required');
  const collected=await collectFastDevSession({
    repo,
    sha:args.sha?String(args.sha):null,
    prNumber:args.pr?Number(args.pr):null,
    token,
  });
  const summary=buildActionsSummary(collected);
  const json=JSON.stringify(summary,null,2)+'\n';
  if(args.output)await writeFile(String(args.output),json);
  process.stdout.write(json);
  if(args.strict&&summary.decision.blockers.length)process.exitCode=2;
}

const isMain=process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href;
if(isMain)main().catch(error=>{console.error(error.stack||error.message||String(error));process.exitCode=1;});
