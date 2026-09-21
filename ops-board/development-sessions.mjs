import { ITERATION_STEPS, readIterationTelemetry } from '../scripts/autonomous-iteration-telemetry.mjs';
const RUNNING=new Set(['queued','in_progress','waiting','requested','pending']);
const FAILED=new Set(['failure','timed_out','action_required','startup_failure','stale']);
const at=value=>{const time=Date.parse(value||'');return Number.isFinite(time)?time:0;};
const latest=(rows=[])=>[...rows].sort((a,b)=>at(b.updated_at||b.created_at)-at(a.updated_at||a.created_at)||Number(b.id||0)-Number(a.id||0))[0]||null;

export function fastDevRunKind(run={}){
  const value=[run.name,run.display_title,run.path].filter(Boolean).join(' ').toLowerCase();
  if(value.includes('per-app dev publish')||value.includes('dev-app-publish'))return 'publish';
  if(value.includes('browser review dispatcher')||value.includes('browser review'))return 'browser';
  if(value.includes('astra final-head validation')||value.includes('astra work validation')||value.includes('astra-work-validation'))return 'validation';
  return 'other';
}

function pullState(pr){
  if(pr?.merged_at)return 'Merged';
  if(pr?.state==='closed')return 'Closed';
  return pr?.draft?'Draft':'Ready';
}

function browserRequired(pr){
  const match=String(pr?.body||'').match(/^Browser-Playtest:\s*(.+?)\s*$/mi);
  if(!match)return false;
  return !/^(?:none|not-required|false|no)$/i.test(match[1].trim());
}

export function autonomousIterationMeta(pr={}){
  const title=String(pr?.title||''),body=String(pr?.body||''),text=title+'\n'+body;
  const telemetry=readIterationTelemetry(body);
  if(telemetry)return Object.freeze({
    kind:'autonomous',game:telemetry.game,number:telemetry.iteration,iterations:telemetry.iterations,
    runKey:telemetry.runKey,observationRecorded:telemetry.steps?.observation?.state==='done',telemetry,
  });
  const explicit=/\bautonomous\s+iteration\b|\biteration\s*\d+\b|自律改善|Observation[- ]First|immutable\s+Before/i.test(text);
  if(!explicit)return null;
  const targets=Array.isArray(pr?.targetApps)?pr.targetApps:[];
  const targetIds=new Set(targets.map(target=>target.id));
  const game=targetIds.has('demon')||/kuumetsu|喰滅廻遊/i.test(text)?'kuumetsu'
    :targetIds.has('village')||/village|村づくり/i.test(text)?'village'
      :targetIds.has('rinne')||/rinne|百年転生/i.test(text)?'rinne':null;
  const number=title.match(/(?:iteration|イテレーション)\s*#?\s*(\d+)/i)?.[1]||body.match(/(?:iteration|イテレーション)\s*#?\s*(\d+)/i)?.[1]||null;
  const observationRecorded=/immutable\s+Before|Observation[- ]First|observation first|staging/i.test(text);
  return Object.freeze({kind:'autonomous',game,number:number?Number(number):null,iterations:null,runKey:null,observationRecorded,telemetry:null});
}

function related(run,pr){
  if(!run||!pr)return false;
  const branch=pr.head?.ref||'',head=pr.head?.sha||'',merge=pr.merge_commit_sha||'';
  if(head&&run.head_sha===head)return true;
  if(merge&&run.head_sha===merge)return true;
  if(branch&&run.head_branch===branch)return true;
  return Boolean(pr.title&&run.display_title===pr.title);
}

function runState(run,{required=true}={}){
  if(!run)return required?'waiting':'skipped';
  if(RUNNING.has(run.status))return 'running';
  if(run.conclusion==='success')return 'done';
  if(run.conclusion==='cancelled')return 'waiting';
  if(FAILED.has(run.conclusion))return 'problem';
  return run.status==='completed'?'waiting':'running';
}

function step(id,label,state,run=null){
  return Object.freeze({id,label,state,runId:run?.id||null,url:run?.html_url||null,at:run?.updated_at||run?.created_at||null});
}

function sessionStatus(steps,merged){
  if(steps.some(item=>item.state==='problem'))return 'problem';
  if(merged&&steps.find(item=>item.id==='publish')?.state==='done')return 'complete';
  if(steps.some(item=>item.state==='running'))return 'running';
  if(merged)return 'publishing';
  return 'active';
}

export function buildDevelopmentSessions(pulls=[],runs=[],{limit=8}={}){
  const ordered=[...(pulls||[])].filter(pr=>pr?.state==='open'||pr?.merged_at)
    .sort((a,b)=>at(b.updated_at||b.created_at)-at(a.updated_at||a.created_at)||Number(b.number||0)-Number(a.number||0))
    .slice(0,Math.max(limit*3,limit));
  const sessions=[];
  for(const pr of ordered){
    const matched=(runs||[]).filter(run=>related(run,pr));
    const validations=matched.filter(run=>fastDevRunKind(run)==='validation');
    const head=pr.head?.sha||null,merge=pr.merge_commit_sha||null;
    const exact=validations.filter(run=>run.head_sha===head);
    const exactSuccess=latest(exact.filter(run=>run.status==='completed'&&run.conclusion==='success'));
    const validationRun=exactSuccess||latest(exact);
    const browsers=matched.filter(run=>fastDevRunKind(run)==='browser');
    const browserRun=latest(browsers.filter(run=>run.status==='completed'&&run.conclusion==='success'))||latest(browsers);
    const publishes=(runs||[]).filter(run=>fastDevRunKind(run)==='publish'&&merge&&run.head_sha===merge);
    const publishRun=latest(publishes.filter(run=>run.status==='completed'&&run.conclusion==='success'))||latest(publishes);
    const state=pullState(pr),merged=state==='Merged',needsBrowser=browserRequired(pr);
    const autonomous=autonomousIterationMeta(pr);
    const implementationState=state==='Draft'?'running':state==='Closed'?'problem':'done';
    const browserState=runState(browserRun,{required:needsBrowser});
    const steps=[
      step('implementation','実装',implementationState),
      step('validation','検証',runState(validationRun,{required:true}),validationRun),
      step('browser','Browser',browserState,browserRun),
      step('merge','merge',merged?'done':state==='Closed'?'problem':'waiting'),
      step('publish','DEV',merged?runState(publishRun,{required:true}):'waiting',publishRun),
    ];
    let iterationSteps=null;
    if(autonomous?.telemetry){
      const telemetry=autonomous.telemetry;
      iterationSteps=ITERATION_STEPS.map(definition=>{
        const raw=telemetry.steps?.[definition.id]||{};
        let stateValue=raw.state||'pending',run=null;
        if(definition.id==='astraValidation'&&validationRun){
          const actual=runState(validationRun,{required:true});
          if(stateValue==='pending'||stateValue==='running'||actual==='problem')stateValue=actual;
          run=validationRun;
        }
        if(definition.id==='merge'&&merged)stateValue='done';
        if(definition.id==='devPublish'&&merged){
          const actual=runState(publishRun,{required:true});
          if(stateValue==='pending'||stateValue==='running'||actual==='problem')stateValue=actual;
          run=publishRun;
        }
        return Object.freeze({
          id:definition.id,label:definition.label,state:stateValue,
          startedAt:raw.startedAt||run?.created_at||null,
          completedAt:raw.completedAt||run?.updated_at||null,
          durationMs:raw.durationMs!==null&&raw.durationMs!==undefined&&raw.durationMs!==''&&Number.isFinite(Number(raw.durationMs))?Number(raw.durationMs):null,
          runId:run?.id||null,url:run?.html_url||null,
          ...(raw.summary?{summary:raw.summary}:{}),
        });
      });
      iterationSteps=Object.freeze(iterationSteps);
    }else if(autonomous){
      iterationSteps=Object.freeze([
        step('observation','観測',autonomous.observationRecorded?'done':'waiting'),
        step('implementation','実装',implementationState),
        step('astraValidation','Astra',runState(validationRun,{required:true}),validationRun),
        step('afterObservation','After',browserState,browserRun),
        step('merge','Merge',merged?'done':state==='Closed'?'problem':'waiting'),
        step('devPublish','DEV',merged?runState(publishRun,{required:true}):'waiting',publishRun),
      ]);
    }
    const failedAttempts=validations.filter(run=>FAILED.has(run.conclusion)).length;
    const lastFailure=latest(matched.filter(run=>FAILED.has(run.conclusion)));
    const failureView=lastFailure?Object.freeze({
      workflow:lastFailure.name||lastFailure.display_title||'GitHub Actions',
      conclusion:lastFailure.conclusion||null,
      runId:lastFailure.id||null,
      url:lastFailure.html_url||null,
      headSha:lastFailure.head_sha||null,
      at:lastFailure.updated_at||lastFailure.created_at||null,
    }):null;
    const updatedAt=[pr.updated_at,pr.merged_at,...matched.map(run=>run.updated_at||run.created_at)].filter(Boolean).sort((a,b)=>at(b)-at(a))[0]||null;
    sessions.push(Object.freeze({
      pr:Object.freeze({number:pr.number,url:pr.html_url||null}),
      title:pr.title||('PR #'+pr.number),state,status:sessionStatus(steps,merged),branch:pr.head?.ref||null,
      headSha:head,mergeSha:merge,validatedExactHead:exactSuccess?.head_sha||null,browserRequired:needsBrowser,
      autonomous,iterationSteps,
      repairAttempts:failedAttempts,lastFailure:failureView,targets:(pr.targetApps||[]).slice(0,4).map(target=>({id:target.id,label:target.label})),
      updatedAt,steps:Object.freeze(steps),
    }));
    if(sessions.length>=limit)break;
  }
  return Object.freeze(sessions);
}


function iterationView(session){
  const telemetry=session.autonomous?.telemetry||null,steps=session.iterationSteps||[];
  const running=steps.find(item=>item.state==='running');
  const pending=steps.find(item=>item.state==='waiting'||item.state==='pending');
  const problem=steps.find(item=>item.state==='problem');
  const currentStep=telemetry?.currentStep||running?.id||(!session.mergeSha?pending?.id:null)||null;
  const status=problem?'problem':session.mergeSha&&(steps.find(item=>item.id==='devPublish')?.state==='done')?'complete'
    :session.mergeSha?'publishing':running?'running':session.status;
  return Object.freeze({
    id:telemetry?.iterationId||('pr:'+session.pr.number),
    runKey:telemetry?.runKey||null,
    game:session.autonomous?.game||null,
    iteration:telemetry?.iteration||session.autonomous?.number||null,
    iterations:telemetry?.iterations||session.autonomous?.iterations||null,
    telemetry:telemetry?'recorded':'inferred',
    theme:telemetry?.theme||null,
    themeKey:telemetry?.themeKey||null,
    improvementSummary:telemetry?.improvementSummary||null,
    rootCauses:telemetry?.rootCauses||[],
    changes:telemetry?.changes||[],
    changedPaths:telemetry?.changedPaths||[],
    experimentId:telemetry?.experimentId||null,
    verdict:telemetry?.verdict||null,
    currentStep,status,
    startedAt:telemetry?.startedAt||null,
    completedAt:telemetry?.completedAt||null,
    updatedAt:telemetry?.updatedAt||session.updatedAt,
    sourceSha:telemetry?.sourceSha||null,
    validatedHead:telemetry?.validatedHead||session.validatedExactHead||null,
    mergeSha:telemetry?.mergeSha||session.mergeSha||null,
    pr:session.pr,
    branch:session.branch,
    title:session.title,
    repairAttempts:session.repairAttempts,
    lastFailure:session.lastFailure||null,
    targets:session.targets,
    steps:Object.freeze(steps),
  });
}

export function buildAutonomousIterations(pulls=[],runs=[],{limit=40}={}){
  return Object.freeze(buildDevelopmentSessions(pulls,runs,{limit:Math.max(limit,40)})
    .filter(session=>session.autonomous)
    .map(iterationView)
    .sort((a,b)=>{
      const rank=status=>({problem:0,running:1,active:1,publishing:2,complete:3})[status]??4;
      return rank(a.status)-rank(b.status)||at(b.updatedAt)-at(a.updatedAt)||Number(b.pr?.number||0)-Number(a.pr?.number||0);
    })
    .slice(0,limit));
}
