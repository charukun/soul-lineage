import { ITERATION_STEPS, readIterationTelemetry } from '../scripts/autonomous-iteration-telemetry.mjs';
import { iterationPresentation } from './public/iteration-status.mjs';
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
  const explicit=/\bautonomous\s+iteration\b|\biteration\s*#?\s*\d+\b|自律改善|Observation[- ]First|immutable\s+Before/i.test(text);
  if(!explicit)return null;
  const targets=Array.isArray(pr?.targetApps)?pr.targetApps:[];
  const targetIds=new Set(targets.map(target=>target.id));
  const targetGame=targetIds.has('demon')?'kuumetsu':targetIds.has('village')?'village':targetIds.has('rinne')?'rinne':null;
  const receiptGame=body.match(/autonomous-receipt:(kuumetsu|rinne|village):/i)?.[1]?.toLowerCase()||null;
  const titleGame=/kuumetsu|喰滅廻遊/i.test(title)?'kuumetsu':/village|村づくり/i.test(title)?'village':/rinne|百年転生/i.test(title)?'rinne':null;
  // Mentioning games or "Iteration 1" in a PULSE/framework change is not an iteration.
  if(!receiptGame&&targets.length&&!targetGame)return null;
  if(!receiptGame&&/PULSE|ops-board|自律改善(?:グラフ|カード|画面|表示)/i.test(title))return null;
  const game=receiptGame||targetGame||titleGame;
  if(!game)return null;
  const number=title.match(/(?:iteration|イテレーション)\s*#?\s*(\d+)/i)?.[1]||body.match(/(?:iteration|イテレーション)\s*#?\s*(\d+)/i)?.[1]||null;
  const observationRecorded=/immutable\s+Before|Observation[- ]First|observation first|staging/i.test(text);
  return Object.freeze({kind:'autonomous',game,number:number?Number(number):null,iterations:null,runKey:null,observationRecorded,telemetry:null});
}
function related(run,pr){
  if(!run||!pr)return false;
  const branch=pr.head?.ref||'',head=pr.head?.sha||'',merge=pr.merged_at?pr.merge_commit_sha||'':'';
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
function step(id,label,state,run=null,{startedAt=null,completedAt=null}={}){
  const start=startedAt||run?.run_started_at||run?.created_at||null;
  const end=completedAt||(run?.status==='completed'?run?.updated_at:null)||null;
  const startMs=at(start),endMs=at(end);
  return Object.freeze({id,label,state,runId:run?.id||null,url:run?.html_url||null,at:run?.updated_at||run?.created_at||end||start||null,
    startedAt:start,completedAt:end,durationMs:startMs&&endMs?Math.max(0,endMs-startMs):null});
}
function sessionStatus(steps,merged){
  if(steps.some(item=>item.state==='problem'))return 'problem';
  if(merged&&steps.find(item=>item.id==='publish')?.state==='done')return 'complete';
  if(steps.some(item=>item.state==='running'))return 'running';
  if(merged)return 'publishing';
  return 'active';
}
function failureNeedsHuman(pr,lastFailure){
  const labels=new Set((pr?.labels||[]).map(item=>String(item?.name||'').toLowerCase()).filter(Boolean));
  return lastFailure?.conclusion==='action_required'||labels.has('human-required')||labels.has('needs-human');
}
function executionState({steps=[],merged=false,state='Draft',matched=[],updatedAt=null,needsHuman=false}={}){
  const validation=steps.find(item=>item.id==='validation'),browser=steps.find(item=>item.id==='browser'),publish=steps.find(item=>item.id==='publish');
  const activeRun=latest((matched||[]).filter(run=>RUNNING.has(run.status)));
  const base={lastActivityAt:updatedAt,runId:activeRun?.id||null,url:activeRun?.html_url||null};
  if(steps.some(item=>item.state==='problem')){
    if(needsHuman)return Object.freeze({...base,state:'needs-user',label:'NEEDS USER',tone:'danger',detail:'人の判断・権限が必要'});
    return Object.freeze({...base,state:'repair',label:'AUTO REPAIR',tone:'warning',detail:'自動修復レーンで継続'});
  }
  if(validation?.state==='running')return Object.freeze({...base,runId:validation.runId,url:validation.url,state:'validating',label:'VALIDATING',tone:'progress',detail:'exact-head検証を実行中'});
  if(merged&&publish?.state==='done')return Object.freeze({...base,state:'done',label:'DONE',tone:'ok',detail:'develop merge完了'});
  if(merged&&publish?.state==='running')return Object.freeze({...base,state:'running',label:'RUNNING',tone:'progress',detail:'DEV公開処理を実行中'});
  if(!merged&&state==='Ready'&&validation?.state==='done'&&(!browser||browser.state==='done'||browser.state==='skipped')){
    return Object.freeze({...base,state:'merging',label:'MERGING',tone:'warning',detail:'検証済み・merge待ち'});
  }
  if(activeRun)return Object.freeze({...base,state:'running',label:'RUNNING',tone:'progress',detail:activeRun.name||activeRun.display_title||'GitHub Actionsを実行中'});
  return Object.freeze({...base,state:'idle',label:'IDLE',tone:'muted',detail:'GitHub上で実行中の処理なし'});
}
export function buildDevelopmentSessions(pulls=[],runs=[],{limit=8}={}){
  const ordered=[...(pulls||[])].filter(pr=>pr?.state==='open'||pr?.merged_at)
    .sort((a,b)=>at(b.updated_at||b.created_at)-at(a.updated_at||a.created_at)||Number(b.number||0)-Number(a.number||0))
    .slice(0,Math.max(limit*3,limit));
  const sessions=[];
  for(const pr of ordered){
    const matched=(runs||[]).filter(run=>related(run,pr));
    const validations=matched.filter(run=>fastDevRunKind(run)==='validation');
    // An open PR's merge_commit_sha is synthetic, not a merge fact.
    const head=pr.head?.sha||null,merge=pr.merged_at?pr.merge_commit_sha||null:null;
    const exact=validations.filter(run=>run.head_sha===head);
    const validationRun=latest(exact.filter(run=>run.conclusion!=='cancelled'))||latest(exact);
    const exactSuccess=validationRun?.status==='completed'&&validationRun.conclusion==='success'?validationRun:null;
    // Existing dispatched browser receipts may run from the dispatcher ref and identify their PR by title.
    const browsers=matched.filter(run=>fastDevRunKind(run)==='browser'&&(run.head_sha===head||Boolean(pr.title&&run.display_title===pr.title)));
    const browserRun=latest(browsers.filter(run=>run.conclusion!=='cancelled'))||latest(browsers);
    const publishes=(runs||[]).filter(run=>fastDevRunKind(run)==='publish'&&merge&&run.head_sha===merge);
    const publishRun=latest(publishes.filter(run=>run.conclusion!=='cancelled'))||latest(publishes);
    const state=pullState(pr),merged=state==='Merged',needsBrowser=browserRequired(pr),autonomous=autonomousIterationMeta(pr);
    const implementationState=validationRun?'done':state==='Draft'?'running':state==='Closed'?'problem':'done';
    const browserState=runState(browserRun,{required:needsBrowser});
    const implementationCompletedAt=validationRun?.created_at||(state==='Ready'?pr.updated_at:null);
    const steps=[
      step('implementation','実装',implementationState,null,{startedAt:pr.created_at||null,completedAt:implementationCompletedAt}),
      step('validation','検証',runState(validationRun,{required:true}),validationRun),
      step('browser','Browser',browserState,browserRun),
      step('merge','merge',merged?'done':state==='Closed'?'problem':'waiting',null,{startedAt:validationRun?.updated_at||null,completedAt:pr.merged_at||null}),
      step('publish','DEV',merged?runState(publishRun,{required:true}):'waiting',publishRun),
    ];
    let iterationSteps=null;
    if(autonomous?.telemetry){
      const telemetry=autonomous.telemetry;
      iterationSteps=Object.freeze(ITERATION_STEPS.map(definition=>{
        const raw=telemetry.steps?.[definition.id]||{};
        let stateValue=raw.state||'pending',run=null;
        if(definition.id==='astraValidation'&&validationRun){stateValue=runState(validationRun);run=validationRun;}
        if(definition.id==='merge')stateValue=merged?'done':stateValue==='done'?'pending':stateValue;
        if(definition.id==='devPublish'){
          if(merged&&publishRun){stateValue=runState(publishRun);run=publishRun;}else stateValue='pending';
        }
        const startedAt=run?(run.run_started_at||run.created_at||null):raw.startedAt||null;
        const completedAt=run?(run.status==='completed'?run.updated_at:null):definition.id==='merge'&&merged?pr.merged_at:raw.completedAt||null;
        return Object.freeze({
          id:definition.id,label:definition.label,state:stateValue,startedAt,completedAt,
          durationMs:run?(at(startedAt)&&at(completedAt)?Math.max(0,at(completedAt)-at(startedAt)):null)
            :raw.durationMs!==null&&raw.durationMs!==undefined&&raw.durationMs!==''&&Number.isFinite(Number(raw.durationMs))?Number(raw.durationMs):null,
          runId:run?.id||null,url:run?.html_url||null,...(raw.summary?{summary:raw.summary}:{}),
        });
      }));
    }else if(autonomous){
      iterationSteps=Object.freeze([
        step('observation','観測',autonomous.observationRecorded?'done':'waiting'),step('implementation','実装',implementationState),
        step('astraValidation','Astra',runState(validationRun,{required:true}),validationRun),step('afterObservation','After',browserState,browserRun),
        step('merge','Merge',merged?'done':state==='Closed'?'problem':'waiting'),step('devPublish','DEV',merged?runState(publishRun,{required:true}):'waiting',publishRun),
      ]);
    }
    const failedAttempts=validations.filter(run=>FAILED.has(run.conclusion)).length;
    const lastFailure=latest(matched.filter(run=>FAILED.has(run.conclusion)&&[head,merge].filter(Boolean).includes(run.head_sha)));
    const failureView=lastFailure?Object.freeze({workflow:lastFailure.name||lastFailure.display_title||'GitHub Actions',conclusion:lastFailure.conclusion||null,
      runId:lastFailure.id||null,url:lastFailure.html_url||null,headSha:lastFailure.head_sha||null,at:lastFailure.updated_at||lastFailure.created_at||null}):null;
    const updatedAt=[pr.updated_at,pr.merged_at,...matched.map(run=>run.updated_at||run.created_at)].filter(Boolean).sort((a,b)=>at(b)-at(a))[0]||null;
    const currentRuns=matched.filter(run=>run.head_sha===head||(merge&&run.head_sha===merge)||browsers.includes(run));
    const execution=executionState({steps,merged,state,matched:currentRuns,updatedAt,needsHuman:failureNeedsHuman(pr,lastFailure)});
    sessions.push(Object.freeze({
      pr:Object.freeze({number:pr.number,url:pr.html_url||null}),title:pr.title||('PR #'+pr.number),state,status:sessionStatus(steps,merged),branch:pr.head?.ref||null,
      headSha:head,mergeSha:merge,mergedAt:pr.merged_at||null,validatedExactHead:exactSuccess?.head_sha||null,browserRequired:needsBrowser,autonomous,iterationSteps,
      repairAttempts:failedAttempts,lastFailure:failureView,targets:(pr.targetApps||[]).slice(0,4).map(target=>({id:target.id,label:target.label})),execution,updatedAt,steps:Object.freeze(steps),
    }));
    if(sessions.length>=limit)break;
  }
  return Object.freeze(sessions);
}
function iterationView(session){
  const telemetry=session.autonomous?.telemetry||null,steps=session.iterationSteps||[],merged=session.state==='Merged';
  const publish=session.steps.find(item=>item.id==='publish');
  const publication=Object.freeze({state:!merged?'notStarted':publish?.runId?publish.state:'unknown',scope:'workflow',runId:publish?.runId||null,url:publish?.url||null});
  const actualRunning=steps.find(item=>item.state==='running'&&item.runId===session.execution?.runId&&item.runId);
  const running=steps.find(item=>item.state==='running'),pending=steps.find(item=>item.state==='waiting'||item.state==='pending');
  const problem=steps.find(item=>item.state==='problem'&&item.id!=='devPublish');
  const currentStep=merged?'merge':problem?.id||actualRunning?.id||telemetry?.currentStep||running?.id||pending?.id||null;
  const updatedAt=[telemetry?.updatedAt,session.updatedAt].filter(Boolean).sort((a,b)=>at(b)-at(a))[0]||null;
  const item={
    id:telemetry?.iterationId||('pr:'+session.pr.number),runKey:telemetry?.runKey||null,game:session.autonomous?.game||null,
    iteration:telemetry?.iteration||session.autonomous?.number||null,iterations:telemetry?.iterations||session.autonomous?.iterations||null,
    telemetry:telemetry?'recorded':'inferred',theme:telemetry?.theme||null,themeKey:telemetry?.themeKey||null,improvementSummary:telemetry?.improvementSummary||null,
    rootCauses:telemetry?.rootCauses||[],changes:telemetry?.changes||[],changedPaths:telemetry?.changedPaths||[],experimentId:telemetry?.experimentId||null,verdict:telemetry?.verdict||null,
    currentStep,merged,mergedAt:session.mergedAt,state:session.state,execution:session.execution,publication,startedAt:telemetry?.startedAt||null,
    completedAt:merged?session.mergedAt:telemetry?.completedAt||null,updatedAt,sourceSha:telemetry?.sourceSha||null,headSha:session.headSha,
    validatedHead:session.validatedExactHead||(telemetry?.validatedHead===session.headSha?telemetry.validatedHead:null),mergeSha:merged?session.mergeSha:null,
    pr:session.pr,branch:session.branch,title:session.title,repairAttempts:session.repairAttempts,lastFailure:session.lastFailure||null,targets:session.targets,steps:Object.freeze(steps),
  };
  return Object.freeze({...item,status:iterationPresentation(item).status});
}
export function buildAutonomousIterations(pulls=[],runs=[],{limit=40}={}){
  // Filter before limiting so busy non-game work cannot crowd genuine iterations out.
  const iterations=(pulls||[]).filter(pr=>autonomousIterationMeta(pr));
  return Object.freeze(buildDevelopmentSessions(iterations,runs,{limit:Math.max(limit,40)}).filter(session=>session.autonomous).map(iterationView)
    .sort((a,b)=>{
      const rank=status=>({problem:0,running:1,waiting:2,complete:3})[status]??4;
      return rank(a.status)-rank(b.status)||at(b.updatedAt)-at(a.updatedAt)||Number(b.pr?.number||0)-Number(a.pr?.number||0);
    }).slice(0,limit));
}
