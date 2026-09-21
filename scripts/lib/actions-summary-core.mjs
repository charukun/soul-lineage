import { readdirSync } from 'node:fs';
import { basename } from 'node:path';
import {
  affectedForDev,
  workspaceManifestPath,
  devGlobalBuildPath,
  toolingPath,
} from '../workspaces.mjs';

const statusRank=new Map([['error',5],['failure',4],['pending',3],['success',2],['expected',1]]);
const HEAVY_TEST_PATTERNS=[
  /(?:^|\/)browser(?:[-.]|\/)/i,
  /(?:^|[-.])integration(?:[-.]|\.test\.mjs$)/i,
  /apps\/rinne\/tests\/character-presentation-runtime\.test\.mjs$/i,
];

export function classifyWorkflow(name=''){
  const value=String(name).toLowerCase();
  if(value.includes('dev publish')||value.includes('per-app dev publish'))return 'dev_publish';
  if(value.includes('browser')||value.includes('playwright'))return 'browser_review';
  if(value.includes('astra work validation')||value.includes('final-head validation')||value.includes('pr checks'))return 'validation';
  return 'other';
}

export function classifyStep(name=''){
  const value=String(name).toLowerCase();
  return {
    test:/\b(test|tests|spec|unit|integration)\b/.test(value),
    build:/\b(build|compile|bundle|package)\b/.test(value),
    browser:/browser|playwright|chromium|webgl/i.test(value),
    publish:/publish|deploy|wrangler/i.test(value),
  };
}

export function extractMajorErrors(log='',limit=12){
  const lines=String(log).split(/\r?\n/).map(line=>line.trim()).filter(Boolean);
  const picked=lines.filter(line=>/\b(error|failed|failure|fatal|exception|timed out|timeout|assert)\b/i.test(line));
  const source=picked.length?picked:lines.slice(-limit);
  return [...new Set(source)].slice(-limit);
}

export function statusByContext(statuses,context){
  return (statuses||[]).filter(row=>row.context===context).sort((a,b)=>{
    const time=String(b.updated_at||'').localeCompare(String(a.updated_at||''));
    return time||(statusRank.get(b.state)||0)-(statusRank.get(a.state)||0);
  })[0]||null;
}

const compactStatus=row=>row?{
  context:row.context,state:row.state,description:row.description||null,
  target_url:row.target_url||null,updated_at:row.updated_at||null,
}:null;

export function parseValidationDirectives(message=''){
  const plan={none:false,checks:[],tests:[],builds:[]};
  for(const line of String(message).split(/\r?\n/)){
    const match=line.match(/^Astra-(Validation|Check|Test|Build):\s*(.+?)\s*$/);
    if(!match)continue;
    const [,kind,value]=match;
    if(kind==='Validation'&&value==='none')plan.none=true;
    if(kind==='Check')plan.checks.push(value);
    if(kind==='Test')plan.tests.push(value);
    if(kind==='Build')plan.builds.push(value);
  }
  return {
    none:plan.none,
    checks:[...new Set(plan.checks)],
    tests:[...new Set(plan.tests)],
    builds:[...new Set(plan.builds)],
    source:'commit-message',
  };
}

export function affectedScope(nodes,paths=[]){
  const clean=[...new Set(paths)].filter(Boolean);
  const apps=affectedForDev(nodes,clean);
  const packages=[...nodes.values()]
    .filter(node=>node.group==='packages'&&clean.some(path=>path.startsWith(node.dir+'/')&&!path.endsWith('/README.md')))
    .map(node=>node.name).sort();
  const infrastructure=clean.some(path=>workspaceManifestPath(path)||devGlobalBuildPath(path));
  const control_plane=clean.some(toolingPath)&&!infrastructure;
  return {paths:clean,apps,packages,infrastructure,control_plane};
}

function testTokens(path){
  const name=basename(path).replace(/\.(?:test\.)?(?:c|m)?js$/,'').replace(/[^a-z0-9]+/gi,' ').trim().toLowerCase();
  return name.split(/\s+/).filter(token=>token.length>=4);
}

export function affectedTestPlan({paths=[],scope={},testsIndex=null}={}){
  let inventory=testsIndex;
  if(!inventory){
    try{inventory=readdirSync('tests').filter(name=>name.endsWith('.test.mjs')).map(name=>'tests/'+name);}
    catch{inventory=[];}
  }
  const changedTests=paths.filter(path=>path.endsWith('.test.mjs'));
  const checks=paths.filter(path=>/\.(?:c|m)?js$/.test(path)&&!path.endsWith('.test.mjs')&&!path.startsWith('.github/')).slice(0,12);
  const tokens=[...new Set(paths.flatMap(testTokens))];
  const matched=(inventory||[]).filter(test=>!changedTests.includes(test)&&tokens.some(token=>test.toLowerCase().includes(token)));
  const lightTests=[...new Set([...changedTests,...matched])].filter(test=>!HEAVY_TEST_PATTERNS.some(pattern=>pattern.test(test))).slice(0,8);
  const heavyTests=[...new Set([...changedTests,...matched])].filter(test=>HEAVY_TEST_PATTERNS.some(pattern=>pattern.test(test))).slice(0,8);
  const builds=[...(scope.apps||[])];
  const directives=[
    ...checks.map(path=>'Astra-Check: '+path),
    ...lightTests.map(path=>'Astra-Test: '+path),
  ];
  return {
    advisory:true,
    checks,
    tests:lightTests,
    heavy_test_candidates:heavyTests,
    build_candidates:builds,
    recommended_directives:directives.length?directives:['Astra-Validation: none'],
    manual_selection_required:Boolean((scope.apps||[]).length&&!checks.length&&!lightTests.length),
    note:'Selection aid only. Existing Astra planner and Fast DEV heavy-validation rules remain authoritative.',
  };
}

export function explicitHold(pr){
  if(!pr)return {active:false,reasons:[]};
  const labels=(pr.labels||[]).map(label=>typeof label==='string'?label:label?.name).filter(Boolean);
  const reasons=[];
  for(const label of labels)if(['integration:hold','integration:manual','do-not-merge'].includes(label))reasons.push('label:'+label);
  const body=String(pr.body||'');
  const marker=body.match(/^Integration-Hold:\s*(.+)$/im);
  if(marker)reasons.push('Integration-Hold:'+marker[1].trim());
  return {active:reasons.length>0,reasons};
}

function overlap(a=[],b=[]){const set=new Set(b);return a.filter(value=>set.has(value));}

export function resolveFreshness({
  sha,latestDevelopSha,validationBaseSha,pr,workScope={},driftScope={},freshnessStatus=null,
  developContainedInHead=null,compareStatus=null,
}={}){
  const app_overlap=overlap(workScope.apps,driftScope.apps);
  const package_overlap=overlap(workScope.packages,driftScope.packages);
  const merge_conflict=pr?.mergeable===false||pr?.mergeable_state==='dirty';
  const shared_drift=Boolean(driftScope.infrastructure||driftScope.control_plane);
  const has_drift=Boolean(latestDevelopSha&&validationBaseSha&&latestDevelopSha!==validationBaseSha&&!developContainedInHead);
  const related=shared_drift||app_overlap.length>0||package_overlap.length>0;
  const independent_drift=Boolean(has_drift&&!merge_conflict&&!related);
  const reconcile_required=Boolean(merge_conflict||(has_drift&&related));
  const revalidation_required=reconcile_required;
  let result='unknown';
  if(developContainedInHead===true&&!merge_conflict)result='fresh';
  else if(independent_drift)result='independent-drift';
  else if(reconcile_required)result='reconcile-required';
  else if(freshnessStatus?.state==='success')result='status-success';
  return {
    result,
    latest_develop_sha:latestDevelopSha||null,
    validation_base_sha:validationBaseSha||null,
    changed_paths:{work:workScope.paths||[],develop_drift:driftScope.paths||[]},
    affected_scope_overlap:{apps:app_overlap,packages:package_overlap,shared_control:shared_drift},
    merge_conflict,
    independent_drift,
    reconcile_required,
    revalidation_required,
    develop_contained_in_head:developContainedInHead,
    compare_status:compareStatus||null,
    recorded_status:compactStatus(freshnessStatus),
  };
}

function classifyFailure(job,errors=[]){
  const text=[job.name,...(job.failed_steps||[]),...errors].join(' ');
  let probable_scope='validation';
  if(/browser|playwright|chromium|webgl/i.test(text))probable_scope='browser';
  else if(/publish|deploy|wrangler|cloudflare/i.test(text))probable_scope='publish';
  else if(/build|compile|bundle/i.test(text))probable_scope='build';
  else if(/test|assert|spec/i.test(text))probable_scope='test';
  else if(/checkout|setup-node|npm ci|install|network/i.test(text))probable_scope='infrastructure';
  const retryable=/cancel|timed?_?out|timeout|HTTP\s*(?:429|5\d\d)|rate.?limit|ECONNRESET|EAI_AGAIN|network/i.test(text);
  const nonRepairable=/permission denied|resource not accessible|bad credentials|secret.*missing|authentication failed/i.test(text);
  return {probable_scope,retryable,repairable:!retryable&&!nonRepairable,classification:'advisory-heuristic'};
}

export function failureDigest(runs=[]){
  const rows=[];
  for(const run of runs)for(const job of run.jobs||[]){
    if(!['failure','cancelled','timed_out','action_required'].includes(job.conclusion))continue;
    const failed_steps=(job.steps||[]).filter(step=>step.conclusion==='failure').map(step=>step.name);
    const errors=job.major_errors||[];
    const disposition=classifyFailure({...job,failed_steps},errors);
    rows.push({
      workflow:run.workflow,run_id:run.run_id,workflow_url:run.url,
      job:job.name,job_id:job.id,job_url:job.url||null,conclusion:job.conclusion,
      failed_steps,major_errors:errors,...disposition,
    });
  }
  return rows;
}

function artifactType(name=''){
  const value=String(name).toLowerCase();
  if(/screenshot|image|snapshot/.test(value))return 'screenshot';
  if(/trace/.test(value))return 'trace';
  if(/video/.test(value))return 'video';
  if(/browser|playwright|evidence|report/.test(value))return 'evidence';
  if(/dev-|distribution|artifact/.test(value))return 'build-artifact';
  if(/pr-fast/.test(value))return 'validation-receipt';
  return 'artifact';
}

function appFromArtifact(name=''){
  return String(name).match(/^(?:dev|browser|evidence)-([a-z0-9-]+)-/i)?.[1]||null;
}

export function artifactIndex(runs=[]){
  return runs.flatMap(run=>(run.artifacts||[]).map(artifact=>({
    id:artifact.id,
    name:artifact.name,
    type:artifactType(artifact.name),
    source_sha:run.head_sha||null,
    workflow:run.workflow,
    run_id:run.run_id,
    app:appFromArtifact(artifact.name),
    evidence_purpose:/browser|playwright|screenshot|trace|video|evidence|report/i.test(artifact.name||'')?'review/diagnostic':null,
    expired:Boolean(artifact.expired),
    artifact_url:artifact.browser_url||artifact.archive_download_url||null,
  })));
}

function logLines(job){return String(job.diagnostic_log||'').split(/\r?\n/).map(line=>line.trim()).filter(Boolean);}
function firstMatch(lines,regex){for(const line of lines){const match=line.match(regex);if(match)return match;}return null;}

export function devPublishReceipts(runs=[],statuses=[]){
  const rows=[];
  for(const run of runs.filter(run=>run.kind==='dev_publish')){
    for(const job of run.jobs||[]){
      const app=job.name?.match(/^Publish\s+(.+?)\s+DEV$/i)?.[1]?.trim()||null;
      if(!app)continue;
      const lines=logLines(job);
      const version=firstMatch(lines,/(?:Current\s+)?Version\s+ID\s*[:=]\s*([a-z0-9-]{8,})/i)?.[1]||null;
      const immutable=firstMatch(lines,/(https:\/\/\S*(?:version|preview)\S*workers\.dev\S*)/i)?.[1]||null;
      const url=firstMatch(lines,/(https:\/\/[^\s]+\.workers\.dev\/?)/i)?.[1]||null;
      const devStatus=statusByContext(statuses,'dev/'+app);
      const verify=(job.steps||[]).find(step=>/Diagnose public app source/i.test(step.name));
      rows.push({
        app,
        source_sha:run.head_sha||null,
        workflow:run.workflow,
        run_id:run.run_id,
        job_id:job.id,
        worker_version_id:version,
        immutable_preview_url:immutable,
        latest_url:devStatus?.target_url&&/workers\.dev/.test(devStatus.target_url)?devStatus.target_url:url,
        version_verification:verify?.conclusion||null,
        publish_result:job.conclusion||run.conclusion||null,
        status:compactStatus(devStatus),
      });
    }
  }
  return rows;
}

function metricLines(lines){
  const metrics={p50:null,p95:null,p99:null};
  for(const line of lines)for(const key of ['p50','p95','p99']){
    const match=line.match(new RegExp('\\b'+key+'\\b\\s*[:=]\\s*([0-9.]+)\\s*(ms|s)?','i'));
    if(match)metrics[key]={value:Number(match[1]),unit:match[2]||null,line};
  }
  return metrics;
}

export function browserEvidenceSummary(runs=[],artifacts=[]){
  const browserJobs=[];
  for(const run of runs)for(const job of run.jobs||[]){
    const isBrowser=run.kind==='browser_review'||/browser|playwright|chromium/i.test(job.name||'')||(job.steps||[]).some(step=>classifyStep(step.name).browser);
    if(isBrowser)browserJobs.push({run,job});
  }
  const lines=browserJobs.flatMap(({job})=>logLines(job));
  const browserArtifacts=artifacts.filter(item=>['screenshot','trace','video','evidence'].includes(item.type));
  const screenshots=browserArtifacts.filter(item=>item.type==='screenshot');
  const traces=browserArtifacts.filter(item=>item.type==='trace');
  const videos=browserArtifacts.filter(item=>item.type==='video');
  const console_errors=lines.filter(line=>/console.*error|pageerror/i.test(line)).slice(-20);
  const request_failures=lines.filter(line=>/request.*fail|net::ERR_|failed to (?:fetch|load)/i.test(line)).slice(-20);
  const webgl=lines.filter(line=>/webgl|swiftshader|gpu/i.test(line)).slice(-20);
  const long_tasks=lines.filter(line=>/long task|longtask/i.test(line)).slice(-20);
  const key_assertions=lines.filter(line=>/assert|expect\(|passed|failed/i.test(line)).slice(-20);
  return {
    result:browserJobs.length?(browserJobs.every(({job})=>job.conclusion==='success'||job.conclusion==='skipped')?'success':'failure'):null,
    runs:[...new Set(browserJobs.map(({run})=>run.run_id))],
    screenshots,
    traces,
    videos,
    console_errors,
    request_failures,
    webgl,
    performance:metricLines(lines),
    long_tasks,
    key_assertions,
    evidence_urls:[...new Set(browserArtifacts.map(item=>item.artifact_url).filter(Boolean))],
    note:browserJobs.length?'Derived from existing browser jobs/artifacts; no browser work is triggered by this summary.':'No browser evidence was found for the inspected SHA(s).',
  };
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
  const freshnessStatus=statusByContext(statuses,'astra/merge-freshness');
  const pr=input.pr||null;
  const hold=explicitHold(pr);
  const artifacts=artifactIndex(input.runs||[]);
  const failures=failureDigest(input.runs||[]);
  const receipts=devPublishReceipts(input.runs||[],statuses);
  const browser=browserEvidenceSummary(input.runs||[],artifacts);
  const validationSha=input.validation_sha||input.sha;
  const validatedHead=focused?.state==='success'?validationSha:null;
  const exactHead={
    validated_exact_head:validatedHead,
    current_pr_head:pr?.head?.sha||null,
    merge_target_head:pr?.merged_at?(pr.head?.sha||null):(pr?.head?.sha||input.sha),
    matches:Boolean(validatedHead&&(!pr||validatedHead===pr.head?.sha)),
  };
  const blockers=[];
  if(!pr)blockers.push('PR_NOT_FOUND');
  else{
    if(pr.state!=='open'&&!pr.merged_at)blockers.push('PR_NOT_OPEN');
    if(!pr.merged_at&&pr.head?.sha!==input.sha)blockers.push('PR_HEAD_MISMATCH');
    if(pr.mergeable===false||pr.mergeable_state==='dirty')blockers.push('PR_NOT_MERGEABLE');
    if(hold.active)blockers.push('EXPLICIT_HOLD');
  }
  if(!pr?.merged_at){
    if(contract?.state!=='success')blockers.push('FAST_DEV_CONTRACT_NOT_SUCCESS');
    if(focused?.state!=='success')blockers.push('FOCUSED_VALIDATION_NOT_SUCCESS');
    if(input.freshness?.revalidation_required)blockers.push('REVALIDATION_REQUIRED');
    else if(freshnessStatus?.state!=='success'&&input.freshness?.result!=='fresh'&&input.freshness?.result!=='independent-drift')blockers.push('MERGE_FRESHNESS_NOT_SUCCESS');
    if(!exactHead.matches)blockers.push('EXACT_HEAD_MISMATCH');
  }
  const tests=[],builds=[];
  for(const run of input.runs||[])for(const job of run.jobs||[])for(const step of job.steps||[]){
    const cls=classifyStep(step.name);
    const item={run_id:run.run_id,job_id:job.id,job:job.name,step:step.name,conclusion:step.conclusion||null};
    if(cls.test)tests.push(item);
    if(cls.build)builds.push(item);
  }
  const evidenceLinks=[...new Set(artifacts.map(item=>item.artifact_url).filter(Boolean))];
  const mergeReceipt=pr?.merged_at?{
    pr:pr.number,
    validated_head:validatedHead,
    merge_commit:pr.merge_commit_sha||null,
    validation_base:input.freshness?.validation_base_sha||null,
    freshness_result:input.freshness?.result||null,
    related_dev_publish_run_ids:[...new Set(receipts.map(row=>row.run_id))],
    evidence_links:evidenceLinks,
  }:null;
  const ready={
    validation:focused?.state||null,
    fast_dev_contract:contract?.state||null,
    freshness:input.freshness?.result||freshnessStatus?.state||null,
    hold,
    browser_evidence:{required:input.required_evidence?.browser?.required??false,result:browser.result,runs:browser.runs},
    affected_scope:input.session_manifest?.affected_scope||null,
    exact_head_match:exactHead.matches,
    blockers,
    ready:!pr?.merged_at&&blockers.length===0,
    mergeable_now:!pr?.merged_at&&blockers.length===0&&pr?.draft===false,
  };
  return {
    schema:'soul-lineage.fast-dev-session.v2',
    generated_at:new Date().toISOString(),
    repository:input.repo,
    commit_sha:input.sha,
    pr:pr?{
      number:pr.number,url:pr.html_url||null,state:pr.state,draft:Boolean(pr.draft),merged_at:pr.merged_at||null,
      head_sha:pr.head?.sha||null,base_ref:pr.base?.ref||null,base_sha:pr.base?.sha||null,
      merge_commit_sha:pr.merge_commit_sha||null,mergeable:pr.mergeable??null,mergeable_state:pr.mergeable_state||null,
    }:null,
    session_manifest:input.session_manifest,
    workflow_runs:(input.runs||[]).map(run=>({
      workflow:run.workflow,kind:run.kind,run_id:run.run_id,run_attempt:run.run_attempt,event:run.event,
      status:run.status,conclusion:run.conclusion,head_sha:run.head_sha,url:run.url,created_at:run.created_at,updated_at:run.updated_at,
      jobs:(run.jobs||[]).map(job=>({...job,diagnostic_log:undefined})),artifacts:run.artifacts,
    })),
    validation:{
      result:focused?.state||null,
      required:input.required_validation,
      fast_dev_contract:compactStatus(contract),
      focused_validation:compactStatus(focused),
      validated_exact_head:validatedHead,
    },
    test:{result:tests.length?(tests.every(row=>['success','skipped'].includes(row.conclusion))?'success':'failure'):null,steps:tests},
    build:{result:builds.length?(builds.every(row=>['success','skipped'].includes(row.conclusion))?'success':'failure'):null,steps:builds},
    failure_digest:failures,
    freshness:input.freshness,
    exact_head_gate:exactHead,
    affected_test_planner:input.test_plan,
    pr_ready_snapshot:ready,
    artifact_index:artifacts,
    dev_publish:{...workflowSummary(input.runs||[],'dev_publish'),receipts},
    browser_evidence:browser,
    merge_receipt:mergeReceipt,
    decision:{
      blockers,
      can_mark_ready:ready.ready&&Boolean(pr?.draft),
      can_merge_now:ready.mergeable_now,
      merged_to_develop:Boolean(pr?.merged_at&&pr?.base?.ref==='develop'),
    },
  };
}
