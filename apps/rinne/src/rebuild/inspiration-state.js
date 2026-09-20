import { CAUSAL_ANSWERS, CAUSAL_ANSWER_BY_ID, INSPIRATION_QUESTIONS, inspirationTechniqueName } from '@soul/game-data';
import { INSPIRATION_LIMITS, MOTIFS, ensureInspiration, synchronizeKnownSkills } from './inspiration-persistence.js';
import { faithProfile } from './skill-system.js';
export { INSPIRATION_VERSION, INSPIRATION_LIMITS, ensureInspiration, synchronizeKnownSkills, validateInspiration, inspirationImprint } from './inspiration-persistence.js';

const ACTIVITY_MOTIFS=Object.freeze({play:['balance','space','timing'],pray:['patience','breath'],forge:['tool','observation'],train:['observation','timing'],study:['observation','precision'],read:['patience','observation'],care:['care','patience'],observe:['observation','patience'],track:['space','observation'],maintain:['tool','handling'],voyage:['balance','patience'],rest:['breath','patience'],breathe:['breath'],balance:['balance'],fall:['balance','space'],focus:['precision','patience'],sense:['observation','space'],repeat:['handling','timing'],distance:['space','observation'],adapt:['balance','space'],practice:['handling','timing']});
const ACTIVITY_QUESTIONS=Object.freeze({play:'balance',balance:'balance',fall:'balance',adapt:'balance',voyage:'balance',breathe:'fatigue',rest:'fatigue',pray:'fatigue',forge:'tool',maintain:'tool',care:'care',observe:'opening',train:'opening',study:'opening',read:'opening',sense:'opening',track:'reach',distance:'reach',focus:'opening',repeat:'rhythm',practice:'recovery'});
const LABELS=Object.freeze({play:'遊び',pray:'祈り',forge:'鍛冶の見学',train:'稽古の見学',study:'学び',read:'読書',care:'手伝い',observe:'観察',track:'足跡を追う',maintain:'得物の手入れ',voyage:'船上で過ごす',rest:'休息',breathe:'呼吸を整える',balance:'姿勢を整える',fall:'受身を試す',focus:'一点へ集中する',sense:'気配を読む',repeat:'反復する',distance:'間合いを見る',adapt:'足場に馴染む',practice:'型を試す'});
const safe=value=>String(value??'').replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,96);
const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,Number.isFinite(Number(v))?Number(v):a));
const unique=values=>[...new Set(values)];
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o||{},k);
const answer=id=>own(CAUSAL_ANSWER_BY_ID,id)?CAUSAL_ANSWER_BY_ID[id]:null;
function hash(text){let h=2166136261;for(const c of String(text)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
function unit(seed,key){return hash(`${seed}:${key}`)/4294967295;}
export function inspirationAffinityChance(state,affinity){
  const score=Math.max(0,Number(faithProfile(state)?.[affinity])||0);
  return clamp(1-Math.exp(-score),0,.82);
}
export function chooseInspirationEffectAffinity(state,answerId){
  const entries=Object.entries(faithProfile(state)).filter(([,score])=>Number(score)>0),total=entries.reduce((sum,[,score])=>sum+Number(score),0);
  if(!(total>0))return null;
  const chance=clamp(1-Math.exp(-total),0,.82);
  if(unit(state?.seed??0,`faith-effect:${answerId}:gate`)>=chance)return null;
  let roll=unit(state?.seed??0,`faith-effect:${answerId}:pick`)*total;
  for(const [affinity,score] of entries){roll-=Number(score);if(roll<=0)return affinity;}
  return entries.at(-1)?.[0]||null;
}
function sourceKind(kind){return ['practice','repeat','balance','breathe','focus','fall','distance'].includes(kind)?'practice':['observe','train','study','read','forge'].includes(kind)?'observation':'life';}

export function inspirationEffortScale(state){const s=ensureInspiration(state),age=Number(state.ageYears)||0,ageEffort=age<7?1.18:age>65?1+Math.min(.22,(age-65)*.006):1;return clamp(ageEffort/(.6+s.body.endurance*.25+s.body.drive*.15),.86,1.3);}
export function answerAvailability(state,id,{context=null,ignoreResources=false}={}){
  const row=answer(id),s=ensureInspiration(state);if(!row)return {usable:false,reason:'未登録の技'};
  if(state.ended||state.down)return {usable:false,reason:'今は身体を動かせない'};
  if(row.executor&&!(context?.capabilities||[]).includes(row.executor))return {usable:false,reason:'対応する得物・実行器が必要'};
  const weapon=state.equipment?.weapon||'fist',action=['technique','variant'].includes(row.kind);
  if(row.weapons.length&&!row.weapons.includes(weapon))return {usable:false,reason:'今の得物では使えない'};
  if(action&&Number(state.ageYears)<7)return {usable:false,reason:'武具と実戦の身体操作は7歳から'};
  const severity=part=>clamp(state.injuries?.[part]?.severity),arms=Math.max(severity('leftArm'),severity('rightArm')),legs=Math.max(severity('leftLeg'),severity('rightLeg'));
  if(action&&((row.limbs==='twoArms'&&arms>.76)||(row.limbs==='legs'&&legs>.65)||severity('rightArm')>.92))return {usable:false,reason:'負傷した部位を休ませる必要がある'};
  if(context&&row.space==='retreat'&&context.retreatBlocked)return {usable:false,reason:'引く足の余地がない'};
  if(context&&row.space==='side'&&context.sideBlocked)return {usable:false,reason:'横へ動く余地がない'};
  const base={fist:5,sword:9,dagger:6,great:16,spear:11,axe:14,staff:10,bow:10}[weapon]||9;
  const cost=Math.ceil(base*1.25*inspirationEffortScale(state)*row.effort*Math.max(1,row.steps.length));
  if(action&&!ignoreResources&&Number(state.stamina)<cost)return {usable:false,reason:'一連の動きを終えるため、息を戻す必要がある',cost};
  if(s.records[id]?.archived)return {usable:false,reason:'古技として技譜に収めている',cost};return {usable:true,reason:'',cost};
}
function contextKey(state,context={}){return safe([context.zone||state.zone||'village',context.terrain||'open',context.encounter||'life',context.distanceBand||'none',state.equipment?.weapon||'fist'].join(':'));}
function useContextKey(state,context={}){return safe([context.zone||state.zone||'village',context.terrain||'open',context.encounter||'life',context.stage??state.front??0,state.equipment?.weapon||'fist'].join(':'));}
function trimTraces(s){const important=new Set(Object.values(s.questions).map(q=>q.traceId));for(const motif of MOTIFS){const first=s.traces.find(t=>t.motifs.includes(motif));if(first)important.add(first.id);}while(s.traces.length>INSPIRATION_LIMITS.traces){const index=s.traces.findIndex(t=>!important.has(t.id));s.traces.splice(index<0?0:index,1);}}
function recordTrace(state,{kind,motifs,text,context={},question=null,sourceId='',sourceName='',relation=''}={}){
  const s=ensureInspiration(state),key=safe([kind,question||'',contextKey(state,context),context.activity||'',relation||''].join('|'));if(s.seen.includes(key))return null;
  const trace={id:`trace-${++s.serial}`,kind,motifs:unique(motifs.filter(m=>MOTIFS.includes(m))).slice(0,6),text:safe(text),age:clamp(state.ageYears,0,100),place:safe(context.place||state.interior?.buildingId||state.birthVillageId||state.zone),key,semanticKey:safe(`${kind}:${context.activity||question||text}`),sourceId:safe(sourceId),sourceName:safe(sourceName),relation:safe(relation)};
  s.seen.push(key);if(s.seen.length>INSPIRATION_LIMITS.seen)s.seen.shift();s.traces.push(trace);s.revision++;
  if(question&&own(INSPIRATION_QUESTIONS,question)){if(!own(s.questions,question)&&Object.keys(s.questions).length>=INSPIRATION_LIMITS.questions)delete s.questions[Object.keys(s.questions)[0]];s.questions[question]={traceId:trace.id,age:trace.age,context:contextKey(state,context)};}
  trimTraces(s);return trace;
}
function materialProof(s,row){
  const found=[],identity=t=>t.semanticKey||`${t.kind}:${t.text}`;
  for(const group of row.materials){const traces=s.traces.filter(trace=>trace.motifs.some(m=>group.includes(m)));if(!traces.length)return null;found.push(traces.find(t=>!found.some(f=>identity(f)===identity(t)))||traces.at(-1));}
  if(unique(found.map(identity)).length<2)return null;return unique(found).slice(0,4);
}
function candidateScore(state,row,context){
  const s=ensureInspiration(state),mind=context.mind||{},body=s.body;let score=1;
  for(const [key,value]of Object.entries(row.intent))score+=(Number(mind[key])||0)*value;
  for(const [key,value]of Object.entries(row.bodyAffinity))score+=(body[key]-1)*value*2;
  const motifs=unique(s.traces.flatMap(t=>t.motifs));score+=row.motifs.filter(m=>motifs.includes(m)).length*.12;
  score+=Math.min(.3,s.heritage.filter(h=>row.motifs.includes(h.motif)).reduce((n,h)=>n+h.strength*.15,0));score+=unit(state.seed,`aptitude:${row.family}`)*.08;return score;
}
export function inspirationCandidates(state,context={}){
  const s=ensureInspiration(state),window=context.window||'combat',questions=context.questions||Object.keys(s.questions),rows=[];
  for(const row of CAUSAL_ANSWERS){
    if(own(s.records,row.id)||s.legacySkills.includes(row.id))continue;
    if(row.requiresFamily&&!Object.values(s.records).some(r=>r.family===row.requiresFamily))continue;
    if(!row.questions.some(q=>questions.includes(q)&&own(s.questions,q)))continue;
    const action=['technique','variant'].includes(row.kind);if(action&&window!=='combat')continue;if(!action&&!row.windows.includes(window))continue;
    if(row.kind==='link'&&!Object.values(context.combo||{}).some(id=>answer(id)?.motifs.some(m=>row.motifs.includes(m))))continue;
    if(!answerAvailability(state,row.id,{context}).usable)continue;const proof=materialProof(s,row);if(!proof)continue;
    rows.push({id:row.id,score:candidateScore(state,row,context),proof:proof.map(t=>t.id),question:row.questions.find(q=>questions.includes(q)&&own(s.questions,q))});
  }
  return rows.sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id));
}
function provenanceFor(state,candidate,context){
  const s=ensureInspiration(state),row=answer(candidate.id),proof=[];
  for(const id of candidate.proof){const trace=s.traces.find(t=>t.id===id);if(trace)proof.push({type:trace.kind,text:`${Math.floor(trace.age)}歳 · ${trace.text}`,traceId:id});}
  const q=s.questions[candidate.question];if(q)proof.push({type:'question',text:INSPIRATION_QUESTIONS[candidate.question],traceId:q.traceId});
  const ancestor=s.heritage.filter(h=>row.motifs.includes(h.motif)).sort((a,b)=>b.strength-a.strength)[0];if(ancestor)proof.push({type:'lineage',text:`${ancestor.sourceName||`${ancestor.generation}代目`}の系譜に残る ${ancestor.motif}`,sourceLifeId:ancestor.sourceLifeId});
  proof.push({type:'moment',text:safe(context.description||`${state.zone==='frontier'?'前線':'村'}で、その答えを実行した`)});return proof.slice(0,6);
}
function equippedIds(state){const l=state.combatLoadout;return new Set([...(l?.heart?.active||[]),...(l?.technique?.combos||[]).flatMap(c=>Object.values(c.slots||{})),l?.technique?.oneMotion]);}
function enforceActiveLimit(state){
  const s=ensureInspiration(state),rows=Object.values(s.records).filter(r=>!r.archived),families=unique(rows.map(r=>r.family)),equipped=equippedIds(state);
  while(families.length>INSPIRATION_LIMITS.activeFamilies){const family=families.find(f=>rows.filter(r=>r.family===f).every(r=>!equipped.has(r.answerId)));if(!family)break;for(const r of rows)if(r.family===family)r.archived=true;families.splice(families.indexOf(family),1);}
}
function commitAnswer(state,candidate,context={}){
  const s=ensureInspiration(state),row=answer(candidate.id);if(!row||own(s.records,row.id)||state.ended||state.down||Object.keys(s.records).length>=INSPIRATION_LIMITS.records)return null;
  const record={answerId:row.id,family:row.family,name:inspirationTechniqueName(row),age:clamp(state.ageYears,0,100),kind:row.kind,stable:false,archived:false,contexts:[useContextKey(state,context)],provenance:provenanceFor(state,candidate,context),motifs:[...row.motifs]};
  if(['technique','variant'].includes(row.kind)){const effectAffinity=chooseInspirationEffectAffinity(state,row.id);if(effectAffinity)record.effectAffinity=effectAffinity;}
  if(row.kind==='link'&&context.combo)record.combo={...context.combo};
  s.records[row.id]=record;s.lastNamed=s.clock;s.revision++;enforceActiveLimit(state);synchronizeKnownSkills(state);
  const event={type:'inspiration',id:row.id,name:record.name,kind:row.kind,family:row.family,age:record.age,provenance:record.provenance,effectAffinity:record.effectAffinity||null};state.events??=[];state.events.unshift({type:'inspiration',worldSecond:Math.floor(Number(state.ageSeconds)||0),text:`${record.name}を閃いた。`,inspirationId:row.id});state.events.length=Math.min(state.events.length,80);return event;
}
export function recordLifeExperience(state,kind,context={}){
  if(state.ended||state.down||Number(state.ageYears)<4||!own(ACTIVITY_MOTIFS,kind))return [];
  const s=ensureInspiration(state);recordTrace(state,{kind:sourceKind(kind),motifs:ACTIVITY_MOTIFS[kind],text:context.description||LABELS[kind],context:{...context,activity:kind},question:ACTIVITY_QUESTIONS[kind]});
  const candidates=inspirationCandidates(state,{...context,window:kind});updateInspirationSigns(state,context);
  // Dedupe evidence, not a later opportunity to realize an already prepared answer.
  if(s.clock-s.lastNamed<INSPIRATION_LIMITS.namedGap)return [];
  const event=candidates[0]?commitAnswer(state,candidates[0],{...context,description:LABELS[kind]}):null;return event?[event]:[];
}
export function observeTechnique(state,{actorId,actorName,techniqueId,visible=false,relation='observer',context={}}={}){
  const row=answer(techniqueId);if(!visible||!actorId||!row||state.ended||state.down)return null;
  const trace=recordTrace(state,{kind:'observation',motifs:unique(['observation',...row.motifs]),text:`${safe(actorName)||'目の前の人物'}の${inspirationTechniqueName(row)}を見た`,context:{...context,activity:`observe:${row.family}`},question:'opening',sourceId:actorId,sourceName:actorName,relation});updateInspirationSigns(state,context);return trace;
}
function signBlockedHint(reason=''){
  if(reason.includes('実行器'))return '感覚は近い。ただ、今の得物ではまだ形にできない。';
  if(reason.includes('得物'))return '今の得物では、答えの輪郭だけが残っている。';
  if(reason.includes('7歳'))return '意味は見えかけている。身体が育てば、違う答えになるかもしれない。';
  if(reason.includes('負傷'))return '形は見えているが、傷がその続きを止めている。';
  if(reason.includes('息'))return '答えは見えかけている。まず息を戻したい。';
  if(reason.includes('余地'))return '答えは見えている。今は、その動きを通す場所がない。';
  return '別々の経験が、つながりかけている。';
}
function signCandidate(state,question,context={}){
  const s=ensureInspiration(state),rows=CAUSAL_ANSWERS.filter(row=>row.kind!=='link'&&row.questions.includes(question)&&!own(s.records,row.id)&&(!row.requiresFamily||Object.values(s.records).some(r=>r.family===row.requiresFamily)));
  let blocked=null;
  for(const row of rows){
    if(!materialProof(s,row))continue;
    const availability=answerAvailability(state,row.id,{context});
    if(availability.usable)return {row,ready:true,hint:'別々の経験が、ひとつの動きになりかけている。'};
    blocked??={row,ready:false,hint:signBlockedHint(availability.reason)};
  }
  return blocked;
}
export function updateInspirationSigns(state,context={}){
  const s=ensureInspiration(state),rows=[];
  for(const [id,q]of Object.entries(s.questions)){
    const remaining=CAUSAL_ANSWERS.some(row=>row.kind!=='link'&&row.questions.includes(id)&&!own(s.records,row.id));if(!remaining)continue;
    const candidate=signCandidate(state,id,context);
    rows.push({question:id,text:INSPIRATION_QUESTIONS[id],hint:candidate?.hint||'稽古や暮らしの中で、別の手掛かりを探している。',age:q.age,ready:Boolean(candidate?.ready)});
  }
  s.signs=rows.sort((a,b)=>Number(b.ready)-Number(a.ready)||b.age-a.age).slice(0,3);return s.signs;
}
export function advanceInspirationTime(state,dt){if(state.ended||!Number.isFinite(dt)||dt<0)return;const s=ensureInspiration(state);s.clock=Math.min(1e9,s.clock+Math.min(dt,.25));}
export function recordCombatQuestion(state,id,context={}){
  if(state.ended||state.down||!own(INSPIRATION_QUESTIONS,id))return null;
  const motifs=id==='fatigue'?['breath']:id==='guard'?['precision']:id==='crowd'?['space']:id==='opening'?['observation','timing']:id==='close'?['space']:['handling'];return recordTrace(state,{kind:'combat',motifs,text:INSPIRATION_QUESTIONS[id],question:id,context});
}
export function prepareCombatInspiration(state,context={},dt=0){
  const s=ensureInspiration(state);
  if(s.pending){const p=s.pending;p.elapsed+=Math.max(0,Number(dt)||0);p.context={...p.context,...context};const pose=state.combat?.tidebreakPose,finished=p.committed&&pose&&pose.skill!==p.runtimeName;if(state.ended||state.down||p.failed||p.elapsed>INSPIRATION_LIMITS.attemptSeconds||p.targetId!==context.targetId||finished)s.pending=null;else return p;}
  if(state.ended||state.down||state.attacking||Number(state.ageYears)<7||!context.targetId)return null;
  for(const q of context.questions||[])recordCombatQuestion(state,q,context);updateInspirationSigns(state,context);if(s.clock-s.lastNamed<INSPIRATION_LIMITS.namedGap)return null;
  const candidate=inspirationCandidates(state,{...context,window:'combat'})[0];if(!candidate)return null;s.pending={...candidate,targetId:context.targetId,elapsed:0,committed:false,armed:false,started:false,cursor:0,contact:false,failed:false,runtimeName:inspirationTechniqueName(answer(candidate.id)),context:{...context}};return s.pending;
}
export function inspirationRecipe(state,id,phase,targetId=null,context=null){
  const s=ensureInspiration(state),p=s.pending,usingPending=p&&p.targetId===targetId,chosen=usingPending?p.id:id,row=answer(chosen);
  if(!row||!row.steps.length||!['technique','variant'].includes(row.kind))return null;if(!usingPending&&!own(s.records,chosen))return null;
  if(!answerAvailability(state,chosen,{context:context||p?.context,ignoreResources:!usingPending||p.started}).usable)return null;
  if(usingPending){const preferred=row.phases.includes('jo')?'jo':row.phases[0];if(phase!==preferred)return null;p.armed=true;p.phase=phase;}
  return {id:chosen,name:usingPending?p.runtimeName:inspirationTechniqueName(row),steps:row.steps.map(step=>({...step})),effort:row.effort,family:row.family,phaseAffinity:row.phases.includes(phase)};
}
function rememberUse(state,id,context){const s=ensureInspiration(state),r=s.records[id];if(!r)return null;const key=useContextKey(state,context);if(r.contexts.includes(key))return null;const wasStable=Boolean(r.stable);if(r.contexts.length<INSPIRATION_LIMITS.contexts)r.contexts.push(key);r.stable=r.contexts.length>=3;s.revision++;if(wasStable||!r.stable)return null;const event={type:'inspiration-stabilized',id:r.answerId,name:r.name,kind:r.kind,family:r.family,age:clamp(state.ageYears,0,100)};state.events??=[];state.events.unshift({type:'inspiration-stabilized',worldSecond:Math.floor(Number(state.ageSeconds)||0),text:`${r.name}が身体に馴染んだ。`,inspirationId:r.answerId});state.events.length=Math.min(state.events.length,80);return event;}
function matchesAttempt(event,p){return event.targetId===p.targetId&&event.phase===p.phase&&(event.techniqueId?event.techniqueId===p.id:event.skill===p.runtimeName);}
function observePerformedAnswer(state,context,events){
  const s=ensureInspiration(state),p=s.pending;if(!p||!p.armed||p.committed||state.ended||state.down)return null;
  // A target may die and clear combat in this tick. Keep the executor-owned final frame, not a made-up replay.
  const row=answer(p.id),pose=s.execution||state.combat?.tidebreakPose;
  const hits=events.filter(e=>e.type==='player-hit'&&e.engine==='tidebreak'&&matchesAttempt(e,p));
  if(hits.some(e=>e.blockedByTerrain)||s.execution?.paid===false){p.failed=true;return null;}if(hits.some(e=>e.damage>0))p.contact=true;
  if(!pose||pose.targetId!==p.targetId||pose.slot!==p.phase||(pose.techniqueId?pose.techniqueId!==p.id:pose.skill!==p.runtimeName))return null;
  p.started=true;const expected=row.steps[p.cursor],kind=pose.attack,progress=clamp(pose.progress);
  if(p.lastKind!==kind||progress<(p.lastProgress??0)-.15)p.completedKind=null;
  if(expected&&kind===expected.kind&&p.completedKind!==kind&&(progress>=.8||hits.some(e=>e.damage>0))){p.cursor++;p.completedKind=kind;}
  p.lastKind=kind;p.lastProgress=progress;
  if(p.cursor<row.steps.length||!p.contact||(!(state.stamina>0)&&s.execution?.paid!==true))return null;
  const learned=commitAnswer(state,p,{...context,description:`${INSPIRATION_QUESTIONS[p.question]}。一連の身体操作と接触が実戦で成立した。`});if(learned)p.committed=true;return learned;
}
export function recordCombatAnswers(state,context={},events=[]){
  const s=ensureInspiration(state),result=[];
  for(const event of events){if(event.type==='enemy-hit')recordCombatQuestion(state,event.sector==='back'?'crowd':'recovery',context);if(event.type==='weapon-blocked')recordCombatQuestion(state,'guard',context);if(event.type==='evaded')recordCombatQuestion(state,'opening',context);}
  const learned=observePerformedAnswer(state,context,events);if(learned)result.push(learned);
  for(const event of events){
    if(event.type!=='player-hit'||!(event.damage>0)||event.blockedByTerrain||event.engine!=='tidebreak')continue;
    const used=event.techniqueId?s.records[event.techniqueId]:Object.values(s.records).find(r=>r.name===event.skill||answer(r.answerId)?.name===event.skill);if(used){const stabilized=rememberUse(state,used.answerId,context);if(stabilized)result.push(stabilized);}
    if(['jo','ha','kyu'].includes(event.phase)){
      const last=s.sequence.at(-1);if(last?.phase!==event.phase)s.sequence.push({phase:event.phase,skillId:used?.answerId||`basic.${state.equipment?.weapon||'fist'}`});s.sequence=s.sequence.slice(-3);
      if(s.sequence.length===3&&s.sequence.map(r=>r.phase).join(',')==='jo,ha,kyu'&&unique(s.sequence.map(r=>r.skillId)).length>=2){recordCombatQuestion(state,'rhythm',context);const combo=Object.fromEntries(s.sequence.map(r=>[r.phase,r.skillId])),c=inspirationCandidates(state,{...context,window:'sequence',questions:['rhythm'],combo})[0];if(c&&s.clock-s.lastNamed>=INSPIRATION_LIMITS.namedGap){const e=commitAnswer(state,c,{...context,combo,description:'序・破・急の実行が、ひとつの連としてつながった。'});if(e)result.push(e);}}
    }
  }
  if(state.ended||state.down)s.pending=null;s.execution=null;updateInspirationSigns(state,context);return result;
}
export function inspirationName(state,id,fallback=id){const row=answer(id);return row?inspirationTechniqueName(row):fallback;}
export function archiveInspiration(state,id,archived=true){const s=ensureInspiration(state),r=s.records[id];if(!r||(archived&&equippedIds(state).has(id)))return false;r.archived=Boolean(archived);s.revision++;if(!archived)enforceActiveLimit(state);return r.archived===Boolean(archived);}
export function inspirationSummary(state){const s=ensureInspiration(state),families=unique(Object.values(s.records).map(r=>r.family));return {families:families.length,records:Object.keys(s.records).length,signs:updateInspirationSigns(state),heritage:s.heritage,body:s.body,faith:faithProfile(state),legacy:s.legacySkills.length};}
