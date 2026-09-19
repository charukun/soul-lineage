import { CAUSAL_ANSWERS, CAUSAL_ANSWER_BY_ID, INSPIRATION_QUESTIONS } from '@soul/game-data';

export const INSPIRATION_VERSION=1;
export const INSPIRATION_LIMITS=Object.freeze({traces:48,seen:192,records:80,questions:16,heritage:16,activeFamilies:12,contexts:4,lineage:24,namedGap:90,attemptSeconds:12});
const BODY_KEYS=['reach','drive','balance','endurance','coordination'];
const MOTIFS=['balance','space','timing','handling','observation','patience','care','tool','force','breath','precision','return','angle','wait','read','advance'];
const ACTIVITY_MOTIFS=Object.freeze({play:['balance','space','timing'],pray:['patience','breath'],forge:['tool','observation'],train:['observation','timing'],study:['observation','precision'],read:['patience','observation'],care:['care','patience'],observe:['observation','patience'],track:['space','observation'],maintain:['tool','handling'],voyage:['balance','patience'],rest:['breath','patience'],breathe:['breath'],balance:['balance'],fall:['balance','space'],focus:['precision','patience'],sense:['observation','space'],repeat:['handling','timing'],distance:['space','observation'],adapt:['balance','space'],practice:['handling','timing']});
const ACTIVITY_QUESTIONS=Object.freeze({play:'balance',balance:'balance',fall:'balance',adapt:'balance',voyage:'balance',breathe:'fatigue',rest:'fatigue',pray:'fatigue',forge:'tool',maintain:'tool',care:'care',observe:'opening',train:'opening',study:'opening',read:'opening',sense:'opening',track:'reach',distance:'reach',focus:'opening',repeat:'rhythm',practice:'recovery'});
const LABELS=Object.freeze({play:'遊び',pray:'祈り',forge:'鍛冶の見学',train:'稽古の見学',study:'学び',read:'読書',care:'手伝い',observe:'観察',track:'足跡を追う',maintain:'得物の手入れ',voyage:'船上で過ごす',rest:'休息',breathe:'呼吸を整える',balance:'姿勢を整える',fall:'受身を試す',focus:'一点へ集中する',sense:'気配を読む',repeat:'反復する',distance:'間合いを見る',adapt:'足場に馴染む',practice:'型を試す'});
const BASIC=/^basic\.(fist|sword|dagger|great|spear|axe|staff|bow)$/;
const safe=value=>String(value??'').replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,96);
const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,Number.isFinite(Number(v))?Number(v):a));
const unique=values=>[...new Set(values)];
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o||{},k);
const answer=id=>own(CAUSAL_ANSWER_BY_ID,id)?CAUSAL_ANSWER_BY_ID[id]:null;
function hash(text){let h=2166136261;for(const c of String(text)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
function unit(seed,key){return hash(`${seed}:${key}`)/4294967295;}
function sourceKind(kind){return ['practice','repeat','balance','breathe','focus','fall','distance'].includes(kind)?'practice':['observe','train','study','read','forge'].includes(kind)?'observation':'life';}
function selectedLegacy(state){
  const l=state.combatLoadout,ids=[...(state.knownSkills||[]),...(l?.heart?.active||[])];
  for(const combo of l?.technique?.combos||[])ids.push(...Object.values(combo.slots||{}));
  ids.push(l?.technique?.oneMotion);
  const requirements={chinshin:'skill.balance',ryu:'skill.flow-step',kosei:'skill.step',distance:'skill.distance',counter:'skill.read',pressure:'skill.resolve',flow:'skill.flow-step',breath:'skill.recovery-breath',pursuit:'skill.trail',guard:'skill.guard-sense'};
  for(const value of Object.values(l?.body||{}))if(requirements[value])ids.push(requirements[value]);
  return unique(ids.filter(id=>typeof id==='string'&&/^(skill|action)\.[a-z-]+$/.test(id))).slice(0,64);
}
function inheritedFrom(state){
  const previous=(state.lineage||[]).at(-1),imprint=previous?.inspirationImprint;if(!imprint)return [];
  const rows=[];
  for(const motif of (imprint.motifs||[]).slice(0,5))if(MOTIFS.includes(motif.id))rows.push({motif:motif.id,strength:clamp(motif.strength)*.65,depth:1,sourceLifeId:safe(previous.lifeId||`generation-${previous.generation}`),sourceName:safe(previous.name),generation:Number(previous.generation)||1,relation:'lineage'});
  for(const row of (imprint.heritage||[]).slice(0,INSPIRATION_LIMITS.heritage))if(MOTIFS.includes(row.motif)&&row.depth<6)rows.push({...row,strength:clamp(row.strength)*.6,depth:row.depth+1});
  const seen=new Set();return rows.sort((a,b)=>b.strength-a.strength||a.motif.localeCompare(b.motif)).filter(row=>{const key=`${row.sourceLifeId}:${row.motif}`;if(seen.has(key))return false;seen.add(key);return true;}).slice(0,INSPIRATION_LIMITS.heritage);
}
export function ensureInspiration(state,{fresh=false}={}){
  if(!state||typeof state!=='object')throw Error('人生がありません。');
  if(state.inspiration){if(state.inspiration.version!==INSPIRATION_VERSION)throw Error('閃きの保存形式が違います。');return state.inspiration;}
  const previous=(state.lineage||[]).at(-1)?.inspirationImprint,body={};
  for(const key of BODY_KEYS){const born=.83+unit(state.seed,key)*.34,parent=Number(previous?.body?.[key]);body[key]=Number((Number.isFinite(parent)?born*.6+clamp(parent,.7,1.3)*.4:born).toFixed(4));}
  state.inspiration={version:INSPIRATION_VERSION,revision:0,clock:0,serial:0,lastNamed:-INSPIRATION_LIMITS.namedGap,body,heritage:inheritedFrom(state),traces:[],seen:[],questions:{},records:{},legacySkills:fresh?[]:selectedLegacy(state),pending:null,execution:null,sequence:[],signs:[],lastLifeId:state.id||''};
  synchronizeKnownSkills(state);return state.inspiration;
}
export function synchronizeKnownSkills(state){
  const s=state.inspiration;if(!s)return;
  const basic=(state.knownSkills||[]).filter(id=>BASIC.test(id));if(!basic.length)basic.push('basic.fist');
  state.knownSkills=unique([...basic,...s.legacySkills,...Object.keys(s.records).filter(id=>answer(id)&&answer(id).kind!=='link')]);state.combatCatalog=state.knownSkills.filter(id=>!BASIC.test(id));
}
function finiteField(value,lo,hi,label){if(!Number.isFinite(value)||value<lo||value>hi)throw Error(`閃きの${label}が不正です。`);return value;}
function boundedArray(value,max,label){if(!Array.isArray(value)||value.length>max)throw Error(`閃きの${label}が大きすぎます。`);return value;}
export function validateInspiration(state){
  const s=ensureInspiration(state);
  for(const key of BODY_KEYS)finiteField(s.body?.[key],.7,1.3,'身体');
  finiteField(s.clock,0,1e9,'時間');finiteField(s.serial,0,1e9,'記録');finiteField(s.revision,0,1e9,'版');finiteField(s.lastNamed,-1e9,1e9,'発現時刻');
  boundedArray(s.traces,INSPIRATION_LIMITS.traces,'経験');boundedArray(s.seen,INSPIRATION_LIMITS.seen,'経験署名');boundedArray(s.heritage,INSPIRATION_LIMITS.heritage,'系譜');boundedArray(s.legacySkills,64,'移行技');
  if(!s.records||Array.isArray(s.records)||typeof s.records!=='object'||Object.keys(s.records).length>INSPIRATION_LIMITS.records)throw Error('技譜が不正です。');
  if(!s.questions||Array.isArray(s.questions)||typeof s.questions!=='object'||Object.keys(s.questions).length>INSPIRATION_LIMITS.questions)throw Error('問いが不正です。');
  const traceIds=new Set();
  for(const trace of s.traces){if(!trace||typeof trace.id!=='string'||traceIds.has(trace.id)||!Array.isArray(trace.motifs)||trace.motifs.length>6||trace.motifs.some(m=>!MOTIFS.includes(m)))throw Error('経験の由来が不正です。');traceIds.add(trace.id);for(const key of ['id','kind','text','place','key','semanticKey','sourceId','sourceName','relation'])trace[key]=safe(trace[key]);finiteField(trace.age,0,100,'経験年齢');}
  for(const [id,row] of Object.entries(s.records)){
    const definition=answer(id);if(!definition||row?.answerId!==id||!Array.isArray(row.provenance)||row.provenance.length>6)throw Error('技の由来が不正です。');
    boundedArray(row.contexts,INSPIRATION_LIMITS.contexts,'定着');row.contexts=unique(row.contexts.map(safe));row.name=safe(row.name).slice(0,24)||definition.name;
    row.family=definition.family;row.kind=definition.kind;row.motifs=[...definition.motifs];row.archived=Boolean(row.archived);row.stable=Boolean(row.stable);finiteField(row.age,0,100,'会得年齢');
    row.provenance=row.provenance.map(p=>({type:safe(p.type),text:safe(p.text),traceId:safe(p.traceId),sourceLifeId:safe(p.sourceLifeId)}));
    if(row.combo)row.combo=Object.fromEntries(['jo','ha','kyu'].map(p=>[p,typeof row.combo[p]==='string'&&(BASIC.test(row.combo[p])||answer(row.combo[p]))?row.combo[p]:'basic.fist']));
  }
  for(const [id,q] of Object.entries(s.questions)){if(!own(INSPIRATION_QUESTIONS,id)||typeof q?.traceId!=='string')throw Error('問いの由来が不正です。');q.traceId=safe(q.traceId);q.age=clamp(q.age,0,100);q.context=safe(q.context);}
  s.seen=unique(s.seen.map(safe));s.legacySkills=unique(s.legacySkills.filter(id=>/^(skill|action)\.[a-z-]+$/.test(id)));
  s.heritage=s.heritage.filter(row=>MOTIFS.includes(row?.motif)).map(row=>({motif:row.motif,strength:clamp(row.strength),depth:Math.round(clamp(row.depth,1,6)),sourceLifeId:safe(row.sourceLifeId),sourceName:safe(row.sourceName),generation:Math.max(1,Math.floor(Number(row.generation)||1)),relation:row.relation==='parent'?'parent':'lineage'}));
  // A saved in-flight action or pose is not evidence that its contact actually occurred.
  s.pending=null;s.execution=null;s.sequence=[];s.signs=[];s.lastLifeId=state.id||'';synchronizeKnownSkills(state);return s;
}
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
  const record={answerId:row.id,family:row.family,name:row.name,age:clamp(state.ageYears,0,100),kind:row.kind,stable:false,archived:false,contexts:[useContextKey(state,context)],provenance:provenanceFor(state,candidate,context),motifs:[...row.motifs]};if(row.kind==='link'&&context.combo)record.combo={...context.combo};
  s.records[row.id]=record;s.lastNamed=s.clock;s.revision++;enforceActiveLimit(state);synchronizeKnownSkills(state);
  const event={type:'inspiration',id:row.id,name:record.name,kind:row.kind,family:row.family,age:record.age,provenance:record.provenance};state.events??=[];state.events.unshift({type:'inspiration',worldSecond:Math.floor(Number(state.ageSeconds)||0),text:`${record.name}を閃いた。`,inspirationId:row.id});state.events.length=Math.min(state.events.length,80);return event;
}
export function recordLifeExperience(state,kind,context={}){
  if(state.ended||state.down||Number(state.ageYears)<4||!own(ACTIVITY_MOTIFS,kind))return [];
  const s=ensureInspiration(state);recordTrace(state,{kind:sourceKind(kind),motifs:ACTIVITY_MOTIFS[kind],text:context.description||LABELS[kind],context:{...context,activity:kind},question:ACTIVITY_QUESTIONS[kind]});
  const candidates=inspirationCandidates(state,{...context,window:kind});updateInspirationSigns(state);
  // Dedupe evidence, not a later opportunity to realize an already prepared answer.
  if(s.clock-s.lastNamed<INSPIRATION_LIMITS.namedGap)return [];
  const event=candidates[0]?commitAnswer(state,candidates[0],{...context,description:LABELS[kind]}):null;return event?[event]:[];
}
export function observeTechnique(state,{actorId,actorName,techniqueId,visible=false,relation='observer',context={}}={}){
  const row=answer(techniqueId);if(!visible||!actorId||!row||state.ended||state.down)return null;
  const trace=recordTrace(state,{kind:'observation',motifs:unique(['observation',...row.motifs]),text:`${safe(actorName)||'目の前の人物'}の${row.name}を見た`,context:{...context,activity:`observe:${row.family}`},question:'opening',sourceId:actorId,sourceName:actorName,relation});updateInspirationSigns(state);return trace;
}
export function updateInspirationSigns(state){
  const s=ensureInspiration(state),rows=[];
  for(const [id,q]of Object.entries(s.questions)){const ready=CAUSAL_ANSWERS.some(row=>row.questions.includes(id)&&!own(s.records,row.id)&&materialProof(s,row)&&(!row.weapons.length||row.weapons.includes(state.equipment?.weapon)));if(!CAUSAL_ANSWERS.some(row=>row.questions.includes(id)&&!own(s.records,row.id)))continue;rows.push({question:id,text:INSPIRATION_QUESTIONS[id],hint:ready?'別々の経験が、つながりかけている。':'稽古や暮らしの中で、別の手掛かりを探している。',age:q.age,ready});}
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
  for(const q of context.questions||[])recordCombatQuestion(state,q,context);updateInspirationSigns(state);if(s.clock-s.lastNamed<INSPIRATION_LIMITS.namedGap)return null;
  const candidate=inspirationCandidates(state,{...context,window:'combat'})[0];if(!candidate)return null;s.pending={...candidate,targetId:context.targetId,elapsed:0,committed:false,armed:false,started:false,cursor:0,contact:false,failed:false,runtimeName:answer(candidate.id).name,context:{...context}};return s.pending;
}
export function inspirationRecipe(state,id,phase,targetId=null,context=null){
  const s=ensureInspiration(state),p=s.pending,usingPending=p&&p.targetId===targetId,chosen=usingPending?p.id:id,row=answer(chosen);
  if(!row||!row.steps.length||!['technique','variant'].includes(row.kind))return null;if(!usingPending&&!own(s.records,chosen))return null;
  if(!answerAvailability(state,chosen,{context:context||p?.context,ignoreResources:!usingPending||p.started}).usable)return null;
  if(usingPending){const preferred=row.phases.includes('jo')?'jo':row.phases[0];if(phase!==preferred)return null;p.armed=true;p.phase=phase;}
  return {id:chosen,name:usingPending?p.runtimeName:(s.records[chosen]?.name||row.name),steps:row.steps.map(step=>({...step})),effort:row.effort,family:row.family,phaseAffinity:row.phases.includes(phase)};
}
function rememberUse(state,id,context){const s=ensureInspiration(state),r=s.records[id];if(!r)return;const key=useContextKey(state,context);if(r.contexts.includes(key))return;if(r.contexts.length<INSPIRATION_LIMITS.contexts)r.contexts.push(key);r.stable=r.contexts.length>=3;s.revision++;}
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
    const used=event.techniqueId?s.records[event.techniqueId]:Object.values(s.records).find(r=>r.name===event.skill||answer(r.answerId)?.name===event.skill);if(used)rememberUse(state,used.answerId,context);
    if(['jo','ha','kyu'].includes(event.phase)){
      const last=s.sequence.at(-1);if(last?.phase!==event.phase)s.sequence.push({phase:event.phase,skillId:used?.answerId||`basic.${state.equipment?.weapon||'fist'}`});s.sequence=s.sequence.slice(-3);
      if(s.sequence.length===3&&s.sequence.map(r=>r.phase).join(',')==='jo,ha,kyu'&&unique(s.sequence.map(r=>r.skillId)).length>=2){recordCombatQuestion(state,'rhythm',context);const combo=Object.fromEntries(s.sequence.map(r=>[r.phase,r.skillId])),c=inspirationCandidates(state,{...context,window:'sequence',questions:['rhythm'],combo})[0];if(c&&s.clock-s.lastNamed>=INSPIRATION_LIMITS.namedGap){const e=commitAnswer(state,c,{...context,combo,description:'序・破・急の実行が、ひとつの連としてつながった。'});if(e)result.push(e);}}
    }
  }
  if(state.ended||state.down)s.pending=null;s.execution=null;updateInspirationSigns(state);return result;
}
export function inspirationName(state,id,fallback=id){return state?.inspiration?.records?.[id]?.name||answer(id)?.name||fallback;}
export function renameInspiration(state,id,name){const s=ensureInspiration(state),r=s.records[id],clean=safe(name).slice(0,24);if(!r||!clean)return false;if(Object.values(s.records).some(other=>other.answerId!==id&&(other.name===clean||answer(other.answerId)?.name===clean)))return false;r.name=clean;s.revision++;return true;}
export function archiveInspiration(state,id,archived=true){const s=ensureInspiration(state),r=s.records[id];if(!r||(archived&&equippedIds(state).has(id)))return false;r.archived=Boolean(archived);s.revision++;if(!archived)enforceActiveLimit(state);return r.archived===Boolean(archived);}
export function inspirationImprint(state){
  const s=ensureInspiration(state),weights=new Map();for(const r of Object.values(s.records)){const row=answer(r.answerId);if(!row)continue;for(const m of row.motifs)weights.set(m,Math.min(1,(weights.get(m)||0)+(r.stable?.4:.25)));}
  for(const motif of MOTIFS){const categories=unique(s.traces.filter(t=>t.motifs.includes(motif)).map(t=>t.kind));if(categories.length>1)weights.set(motif,Math.max(weights.get(motif)||0,Math.min(.45,categories.length*.15)));}
  return {version:1,body:{...s.body},motifs:[...weights].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,5).map(([id,strength])=>({id,strength})),heritage:s.heritage.map(row=>({...row})),techniques:Object.values(s.records).map(r=>({id:r.answerId,name:r.name,family:r.family,kind:r.kind,age:r.age,stable:r.stable,origin:r.provenance.slice(0,2).map(p=>p.text)}))};
}
export function inspirationSummary(state){const s=ensureInspiration(state),families=unique(Object.values(s.records).map(r=>r.family));return {families:families.length,records:Object.keys(s.records).length,signs:updateInspirationSigns(state),heritage:s.heritage,body:s.body,legacy:s.legacySkills.length};}
