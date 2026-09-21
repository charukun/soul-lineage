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
  const explicit=/\bautonomous\s+iteration\b|\biteration\s*\d+\b|自律改善|Observation[- ]First|immutable\s+Before/i.test(text);
  if(!explicit)return null;
  const targets=Array.isArray(pr?.targetApps)?pr.targetApps:[];
  const targetIds=new Set(targets.map(target=>target.id));
  const game=targetIds.has('demon')||/kuumetsu|喰滅廻遊/i.test(text)?'kuumetsu'
    :targetIds.has('village')||/village|村づくり/i.test(text)?'village'
      :targetIds.has('rinne')||/rinne|百年転生/i.test(text)?'rinne':null;
  const number=title.match(/(?:iteration|イテレーション)\s*#?\s*(\d+)/i)?.[1]||body.match(/(?:iteration|イテレーション)\s*#?\s*(\d+)/i)?.[1]||null;
  const observationRecorded=/immutable\s+Before|Observation[- ]First|observation first|staging/i.test(text);
  return Object.freeze({kind:'autonomous',game,number:number?Number(number):null,observationRecorded});
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
    const iterationSteps=autonomous?Object.freeze([
      step('observation','観測',autonomous.observationRecorded?'done':'waiting'),
      step('implementation','実装',implementationState),
      step('validation','検証',runState(validationRun,{required:true}),validationRun),
      step('after','After',browserState,browserRun),
      step('merge','merge',merged?'done':state==='Closed'?'problem':'waiting'),
      step('publish','DEV',merged?runState(publishRun,{required:true}):'waiting',publishRun),
    ]):null;
    const failedAttempts=validations.filter(run=>FAILED.has(run.conclusion)).length;
    const updatedAt=[pr.updated_at,pr.merged_at,...matched.map(run=>run.updated_at||run.created_at)].filter(Boolean).sort((a,b)=>at(b)-at(a))[0]||null;
    sessions.push(Object.freeze({
      pr:Object.freeze({number:pr.number,url:pr.html_url||null}),
      title:pr.title||('PR #'+pr.number),state,status:sessionStatus(steps,merged),branch:pr.head?.ref||null,
      headSha:head,mergeSha:merge,validatedExactHead:exactSuccess?.head_sha||null,browserRequired:needsBrowser,
      autonomous,iterationSteps,
      repairAttempts:failedAttempts,targets:(pr.targetApps||[]).slice(0,4).map(target=>({id:target.id,label:target.label})),
      updatedAt,steps:Object.freeze(steps),
    }));
    if(sessions.length>=limit)break;
  }
  return Object.freeze(sessions);
}
