#!/usr/bin/env node
import { writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const API='https://api.github.com';
const statusRank=new Map([['error',5],['failure',4],['pending',3],['success',2],['expected',1]]);

function parseArgs(argv){
  const out={};
  for(let i=0;i<argv.length;i++){
    const arg=argv[i];
    if(!arg.startsWith('--'))continue;
    const key=arg.slice(2);
    const next=argv[i+1];
    out[key]=next && !next.startsWith('--') ? argv[++i] : true;
  }
  return out;
}

function localHead(value){
  if(value && value!=='HEAD')return value;
  try{return execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();}
  catch{return process.env.GITHUB_SHA||'';}
}

async function request(path,{token,accept='application/vnd.github+json'}={}){
  const response=await fetch(API+path,{headers:{
    accept,
    'x-github-api-version':'2022-11-28',
    ...(token?{authorization:'Bearer '+token}:{})
  }});
  if(!response.ok)throw new Error('GitHub API '+response.status+' '+path+': '+(await response.text()).slice(0,500));
  const type=response.headers.get('content-type')||'';
  return type.includes('application/json') ? response.json() : response.text();
}

async function paged(path,token){
  const rows=[];
  for(let page=1;page<=10;page++){
    const join=path.includes('?')?'&':'?';
    const data=await request(path+join+'per_page=100&page='+page,{token});
    const batch=Array.isArray(data)?data:(data.workflow_runs||data.jobs||data.artifacts||[]);
    rows.push(...batch);
    if(batch.length<100)break;
  }
  return rows;
}

export function classifyWorkflow(name=''){
  const value=String(name).toLowerCase();
  if(value.includes('astra work validation')||value.includes('pr checks'))return 'validation';
  if(value.includes('dev publish')||value.includes('per-app dev publish'))return 'dev_publish';
  if(value.includes('browser')||value.includes('playwright'))return 'browser_review';
  return 'other';
}

export function classifyStep(name=''){
  const value=String(name).toLowerCase();
  return {
    test:/\b(test|tests|spec|unit|integration)\b/.test(value),
    build:/\b(build|compile|bundle|package)\b/.test(value),
  };
}

export function extractMajorErrors(log='',limit=12){
  const lines=String(log).split(/\r?\n/).map(line=>line.trim()).filter(Boolean);
  const picked=lines.filter(line=>/\b(error|failed|failure|fatal|exception|timed out|timeout)\b/i.test(line));
  const source=picked.length?picked:lines.slice(-limit);
  return [...new Set(source)].slice(-limit);
}

function compactStatus(row){
  return row?{
    context:row.context,
    state:row.state,
    description:row.description||null,
    target_url:row.target_url||null,
    updated_at:row.updated_at||null
  }:null;
}

function statusByContext(statuses,context){
  return statuses
    .filter(row=>row.context===context)
    .sort((a,b)=>{
      const time=String(b.updated_at||'').localeCompare(String(a.updated_at||''));
      if(time)return time;
      return (statusRank.get(b.state)||0)-(statusRank.get(a.state)||0);
    })[0]||null;
}

function workflowSummary(runs,type){
  const selected=runs.filter(run=>run.kind===type);
  const latest=[...selected].sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||'')))[0]||null;
  return {
    latest:latest?{workflow:latest.workflow,run_id:latest.run_id,status:latest.status,conclusion:latest.conclusion,url:latest.url,head_sha:latest.head_sha}:null,
    runs:selected.map(run=>run.run_id),
    result:latest?.conclusion||null,
  };
}

export function buildActionsSummary(input){
  const statuses=input.statuses||[];
  const contract=statusByContext(statuses,'astra/fast-dev-contract');
  const focused=statusByContext(statuses,'astra/focused-validation');
  const freshness=statusByContext(statuses,'astra/merge-freshness');
  const pr=input.pr||null;
  const headMatches=Boolean(pr && pr.head?.sha===input.sha);
  const mergeable=pr?.mergeable;
  const blockers=[];
  if(!pr)blockers.push('PR_NOT_FOUND');
  else{
    if(pr.state!=='open')blockers.push('PR_NOT_OPEN');
    if(!headMatches)blockers.push('PR_HEAD_MISMATCH');
    if(mergeable===false || pr.mergeable_state==='dirty')blockers.push('PR_NOT_MERGEABLE');
  }
  if(contract?.state!=='success')blockers.push('FAST_DEV_CONTRACT_NOT_SUCCESS');
  if(focused?.state!=='success')blockers.push('FOCUSED_VALIDATION_NOT_SUCCESS');
  if(freshness?.state!=='success')blockers.push('MERGE_FRESHNESS_NOT_SUCCESS');

  const tests=[],builds=[],failures=[],artifacts=[],evidence=[];
  for(const run of input.runs||[]){
    for(const artifact of run.artifacts||[]){
      const item={run_id:run.run_id,id:artifact.id,name:artifact.name,expired:Boolean(artifact.expired),url:artifact.archive_download_url||null,created_at:artifact.created_at||null};
      artifacts.push(item);
      if(/evidence|playwright|screenshot|browser|review|report/i.test(artifact.name||''))evidence.push(item);
    }
    for(const job of run.jobs||[]){
      for(const step of job.steps||[]){
        const cls=classifyStep(step.name);
        const item={run_id:run.run_id,job_id:job.id,job:job.name,step:step.name,conclusion:step.conclusion||null};
        if(cls.test)tests.push(item);
        if(cls.build)builds.push(item);
      }
      if(job.conclusion==='failure'||job.conclusion==='cancelled'||job.conclusion==='timed_out'){
        failures.push({
          run_id:run.run_id,job_id:job.id,job:job.name,conclusion:job.conclusion,
          failed_steps:(job.steps||[]).filter(step=>step.conclusion==='failure').map(step=>step.name),
          major_errors:job.major_errors||[]
        });
      }
    }
  }

  return {
    schema:'soul-lineage.actions-summary.v1',
    generated_at:new Date().toISOString(),
    repository:input.repo,
    commit_sha:input.sha,
    pr:pr?{
      number:pr.number,url:pr.html_url||null,state:pr.state,draft:Boolean(pr.draft),
      head_sha:pr.head?.sha||null,base_ref:pr.base?.ref||null,base_sha:pr.base?.sha||null,
      mergeable:pr.mergeable??null,mergeable_state:pr.mergeable_state||null
    }:null,
    workflow_runs:(input.runs||[]).map(run=>({
      workflow:run.workflow,kind:run.kind,run_id:run.run_id,run_attempt:run.run_attempt,
      event:run.event,status:run.status,conclusion:run.conclusion,head_sha:run.head_sha,
      url:run.url,created_at:run.created_at,updated_at:run.updated_at,
      jobs:run.jobs,artifacts:run.artifacts
    })),
    validation:{
      result:focused?.state||null,
      fast_dev_contract:compactStatus(contract),
      focused_validation:compactStatus(focused),
      validated_exact_head:focused?.state==='success'?input.sha:null,
    },
    test:{result:tests.length?(tests.every(row=>row.conclusion==='success'||row.conclusion==='skipped')?'success':'failure'):null,steps:tests},
    build:{result:builds.length?(builds.every(row=>row.conclusion==='success'||row.conclusion==='skipped')?'success':'failure'):null,steps:builds},
    merge_freshness:{
      result:freshness?.state||null,
      status:compactStatus(freshness),
      current_develop_sha:input.develop_sha||null,
      develop_contained_in_head:input.develop_contained_in_head??null,
      compare_status:input.compare_status||null,
    },
    failures,
    dev_publish:workflowSummary(input.runs||[],'dev_publish'),
    browser_review:workflowSummary(input.runs||[],'browser_review'),
    artifacts,
    evidence,
    decision:{
      blockers,
      ready_requirements_satisfied:blockers.length===0,
      can_mark_ready:blockers.length===0 && Boolean(pr?.draft),
      can_merge_now:blockers.length===0 && Boolean(pr && !pr.draft),
    }
  };
}

async function collect({repo,sha,prNumber,token}){
  const [owner,name]=repo.split('/');
  if(!owner||!name)throw new Error('--repo must be owner/name');
  let pr=null;
  if(prNumber){
    pr=await request('/repos/'+repo+'/pulls/'+prNumber,{token});
  }else{
    const pulls=await request('/repos/'+repo+'/commits/'+sha+'/pulls',{token,accept:'application/vnd.github+json'});
    pr=pulls.find(row=>row.state==='open')||pulls[0]||null;
  }
  const [runsRaw,statusBundle,developRef]=await Promise.all([
    paged('/repos/'+repo+'/actions/runs?head_sha='+encodeURIComponent(sha),token),
    request('/repos/'+repo+'/commits/'+sha+'/status',{token}),
    request('/repos/'+repo+'/git/ref/heads/develop',{token}).catch(()=>null),
  ]);
  const runs=await Promise.all(runsRaw.map(async run=>{
    const [jobsRaw,artifacts]=await Promise.all([
      paged('/repos/'+repo+'/actions/runs/'+run.id+'/jobs',token),
      paged('/repos/'+repo+'/actions/runs/'+run.id+'/artifacts',token),
    ]);
    const jobs=await Promise.all(jobsRaw.map(async job=>{
      let major_errors=[];
      if(['failure','cancelled','timed_out'].includes(job.conclusion)){
        try{
          const log=await request('/repos/'+repo+'/actions/jobs/'+job.id+'/logs',{token,accept:'application/vnd.github+json'});
          major_errors=extractMajorErrors(log);
        }catch(error){
          major_errors=['LOG_FETCH_FAILED: '+error.message];
        }
      }
      return {
        id:job.id,name:job.name,status:job.status,conclusion:job.conclusion,
        url:job.html_url||null,started_at:job.started_at||null,completed_at:job.completed_at||null,
        steps:(job.steps||[]).map(step=>({number:step.number,name:step.name,status:step.status,conclusion:step.conclusion,started_at:step.started_at||null,completed_at:step.completed_at||null})),
        major_errors
      };
    }));
    return {
      workflow:run.name||run.display_title||String(run.workflow_id),
      kind:classifyWorkflow(run.name||run.display_title||''),
      run_id:run.id,run_attempt:run.run_attempt||1,event:run.event,status:run.status,conclusion:run.conclusion,
      head_sha:run.head_sha,url:run.html_url||null,created_at:run.created_at||null,updated_at:run.updated_at||null,jobs,artifacts
    };
  }));
  const developSha=developRef?.object?.sha||null;
  let compareStatus=null,developContained=null;
  if(developSha){
    try{
      const compare=await request('/repos/'+repo+'/compare/'+developSha+'...'+sha,{token});
      compareStatus=compare.status||null;
      developContained=compare.status==='ahead'||compare.status==='identical';
    }catch{}
  }
  return {repo,sha,pr,develop_sha:developSha,develop_contained_in_head:developContained,compare_status:compareStatus,runs,statuses:statusBundle.statuses||[]};
}

async function main(){
  const args=parseArgs(process.argv.slice(2));
  const repo=String(args.repo||process.env.GITHUB_REPOSITORY||'');
  const sha=localHead(String(args.sha||process.env.GITHUB_SHA||'HEAD'));
  const token=process.env.GH_TOKEN||process.env.GITHUB_TOKEN||'';
  if(!repo)throw new Error('Repository required: --repo owner/name or GITHUB_REPOSITORY');
  if(!/^[0-9a-f]{40}$/i.test(sha))throw new Error('Exact commit SHA required: --sha <40-hex>');
  if(!token)throw new Error('GH_TOKEN or GITHUB_TOKEN is required');
  const collected=await collect({repo,sha,prNumber:args.pr?Number(args.pr):null,token});
  const summary=buildActionsSummary(collected);
  const json=JSON.stringify(summary,null,2)+'\n';
  if(args.output)await writeFile(String(args.output),json);
  process.stdout.write(json);
  if(args.strict && summary.decision.blockers.length)process.exitCode=2;
}

const isMain=process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href;
if(isMain)main().catch(error=>{console.error(error.stack||error.message||String(error));process.exitCode=1;});
