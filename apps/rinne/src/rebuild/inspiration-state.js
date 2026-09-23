import { CAUSAL_ANSWERS, INSPIRATION_QUESTIONS, inspirationTechniqueName, inspirationCombatAnswerPool, resolveInspirationAnswer, isGeneratedTechniqueId, generatedTechniqueNaming } from '@soul/game-data';
import { INSPIRATION_LIMITS, MOTIFS, ensureInspiration, synchronizeKnownSkills } from './inspiration-persistence.js';
import { faithProfile } from './skill-system.js';
import { familyAffinityForSkill } from './family-origin.js';
export { INSPIRATION_VERSION, INSPIRATION_LIMITS, ensureInspiration, synchronizeKnownSkills, validateInspiration, inspirationImprint } from './inspiration-persistence.js';

const ACTIVITY_MOTIFS=Object.freeze({play:['balance','space','timing'],pray:['patience','breath'],forge:['tool','observation'],train:['observation','timing'],study:['observation','precision'],read:['patience','observation'],care:['care','patience'],observe:['observation','patience'],track:['space','observation'],maintain:['tool','handling'],voyage:['balance','patience'],rest:['breath','patience'],breathe:['breath'],balance:['balance'],fall:['balance','space'],focus:['precision','patience'],sense:['observation','space'],repeat:['handling','timing'],distance:['space','observation'],adapt:['balance','space'],practice:['handling','timing']});
const ACTIVITY_QUESTIONS=Object.freeze({play:'balance',balance:'balance',fall:'balance',adapt:'balance',voyage:'balance',breathe:'fatigue',rest:'fatigue',pray:'fatigue',forge:'tool',maintain:'tool',care:'care',observe:'opening',train:'opening',study:'opening',read:'opening',sense:'opening',track:'reach',distance:'reach',focus:'opening',repeat:'rhythm',practice:'recovery'});
const LABELS=Object.freeze({play:'遊び',pray:'祈り',forge:'鍛冶の見学',train:'稽古の見学',study:'学び',read:'読書',care:'手伝い',observe:'観察',track:'足跡を追う',maintain:'得物の手入れ',voyage:'船上で過ごす',rest:'休息',breathe:'呼吸を整える',balance:'姿勢を整える',fall:'受身を試す',focus:'一点へ集中する',sense:'気配を読む',repeat:'反復する',distance:'間合いを見る',adapt:'足場に馴染む',practice:'型を試す'});
const SUI_MOTIF_LABELS=Object.freeze({balance:'身の軸',space:'間合い',timing:'拍子',handling:'得物さばき',observation:'観察',patience:'待ち',care:'支え',tool:'道具扱い',force:'力の通し方',breath:'呼吸',precision:'精度',return:'返し',angle:'角度',wait:'待機',read:'読み',advance:'踏み込み'});
const safe=value=>String(value??'').replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,96);
const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,Number.isFinite(Number(v))?Number(v):a));
const unique=values=>[...new Set(values)];
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o||{},k);
const answer=id=>resolveInspirationAnswer(id);
function hash(text){let h=2166136261;for(const c of String(text)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
function unit(seed,key){return hash(`${seed}:${key}`)/4294967295;}
export function inspirationAttributeChance(state,attribute){
  const score=Math.max(0,Number(faithProfile(state)?.[attribute])||0);
  return clamp(1-Math.exp(-score),0,.82);
}
export function chooseInspirationEffectAttribute(state,answerId){
  const entries=Object.entries(faithProfile(state)).filter(([,score])=>Number(score)>0),total=entries.reduce((sum,[,score])=>sum+Number(score),0);
  if(!(total>0))return null;
  const chance=clamp(1-Math.exp(-total),0,.82);
  if(unit(state?.seed??0,`faith-effect:${answerId}:gate`)>=chance)return null;
  let roll=unit(state?.seed??0,`faith-effect:${answerId}:pick`)*total;
  for(const [attribute,score] of entries){roll-=Number(score);if(roll<=0)return attribute;}
  return entries.at(-1)?.[0]||null;
}
export function inspirationMasteryProfile(state,row=null){
  const s=ensureInspiration(state),age=clamp(Number(state.ageYears)||0,0,100),records=Object.values(s.records||{});
  const stable=records.filter(record=>record.stable).length,contextDiversity=unique(records.flatMap(record=>record.contexts||[])).length;
  const heritageStrength=(s.heritage||[]).reduce((sum,item)=>sum+clamp(item.strength),0);
  const ageMaturity=age<28?age/140:age<45?.2+(age-28)/17*.55:.75+Math.min(.25,(age-45)/35*.25);
  const stableMastery=Math.min(1,stable/10),contextMastery=Math.min(1,contextDiversity/12),lineageMastery=Math.min(1,heritageStrength/4),body=s.body||{};
  const decline=Math.max(0,1-(Number(body.endurance)||1))+Math.max(0,1-(Number(body.drive)||1))*.6;
  const adaptation=Math.min(1,(age>=45?.35:age>=32?.15:0)+decline*.9+Math.abs((Number(body.balance)||1)-1)*.45);
  const continuity=Math.min(1,(row?.motifs||[]).filter(motif=>(s.heritage||[]).some(h=>h.motif===motif)).length/2);
  const suiMastery=s.talents?.includes('sui')?1:0;
  const mastery=clamp(ageMaturity*.38+stableMastery*.22+contextMastery*.14+lineageMastery*.12+adaptation*.1+continuity*.04+suiMastery*.12);
  const secretChance=clamp(.015+mastery*.34+(age>=40?.06:0),.015,.48);
  let ultimateChance=clamp(.001+Math.pow(mastery,2)*.105+(age>=45?.035:0)+(age>=60?.025:0),.001,.18);
  if(age<30)ultimateChance*=s.talents?.includes('tenyo') ? .34 : .12;else if(age<40)ultimateChance*=.42;
  return Object.freeze({age,mastery,ageMaturity,stableMastery,contextMastery,lineageMastery,adaptation,continuity,suiMastery,secretChance,ultimateChance});
}
const GENERATED_RULE_EFFECTS=Object.freeze({
  adaptive:Object.freeze({id:'adaptive-space',label:'転位継ぎ',impact:'rule',rarity:'rare'}),
  ultimate:Object.freeze({id:'formless-space',label:'無形転位',impact:'rule',rarity:'singular',unlockCondition:'長い人生の技の定着・異なる戦場経験・系譜または身体変化への適応が重なった時'}),
});
export function inspirationRuleEffectsFor(state,row){
  if(!isGeneratedTechniqueId(row?.id))return [];
  const profile=inspirationMasteryProfile(state,row),seed=state.seed??0;
  if(unit(seed,`ultimate:${row.id}:${Math.floor(profile.age)}`)<profile.ultimateChance)return [{...GENERATED_RULE_EFFECTS.ultimate}];
  if(unit(seed,`secret:${row.id}:${Math.floor(profile.age)}`)<profile.secretChance)return [{...GENERATED_RULE_EFFECTS.adaptive}];
  return [];
}
function recordRuleEffects(state,id){return Array.isArray(state?.inspiration?.records?.[id]?.specialEffects)?state.inspiration.records[id].specialEffects:[];}
function hasRuleEffect(state,id,effectId){return recordRuleEffects(state,id).some(effect=>effect?.id===effectId&&effect?.impact==='rule');}
export function initializeBirthTalents(state){
  const s=ensureInspiration(state);s.talents??=[];s.talentDetails??={};
  if(s.talents.includes('tenyo'))return s.talentDetails.tenyo||null;
  const lineageDepth=Math.min(12,Array.isArray(state.lineage)?state.lineage.length:0),heritageStrength=(s.heritage||[]).reduce((sum,item)=>sum+clamp(item.strength),0);
  const chance=clamp(.008+lineageDepth*.0012+heritageStrength*.0035,.008,.035);
  if(unit(state.seed??0,'birth-tenyo')>=chance)return null;
  const axes=['技覚','身体感覚','観察眼','間合い感覚','継承感応'],axis=axes[Math.floor(unit(state.seed??0,'birth-tenyo-axis')*axes.length)%axes.length];
  const detail={id:'tenyo',label:'天与',axis,bornAge:0,chance:Number(chance.toFixed(4))};
  s.talents.push('tenyo');s.talentDetails.tenyo=detail;s.revision++;return detail;
}
function addTalent(state,id,detail={}){
  const s=ensureInspiration(state);s.talents??=[];s.talentDetails??={};if(!s.talents.includes(id))s.talents.push(id);s.talentDetails[id]={...(s.talentDetails[id]||{}),...detail,id};s.revision++;
}
export function evaluateSuiAwakening(state,{id='',name='',motifs=[],force=false,origin='life'}={}){
  const s=ensureInspiration(state),age=clamp(Number(state.ageYears)||0,0,100);
  if(s.talents?.includes('sui'))return null;
  if(!force&&(age<12||s.traces.length<6))return null;
  const diversity=unique(s.traces.map(trace=>trace.kind)).length;if(!force&&diversity<3)return null;
  const chance=force?1:clamp(.018+Math.min(.045,s.traces.length*.0025)+Math.min(.03,diversity*.008)+(age>=30?.015:0),.018,.12);
  if(!force&&unit(state.seed??0,`sui:${id}:${Math.floor(age)}:${s.serial}`)>=chance)return null;
  const motif=motifs.find(value=>MOTIFS.includes(value))||'observation',axis=SUI_MOTIF_LABELS[motif]||'才覚';
  const detail={label:'彗',axis,motif,origin,awakenedAge:age,techniqueId:safe(id),techniqueName:safe(name),chance:Number(chance.toFixed(4))};
  addTalent(state,'sui',detail);state.events??=[];state.events.unshift({type:'village-news',scope:'village',worldSecond:Math.floor(Number(state.ageSeconds)||0),text:`${state.name||'旅人'}に「彗」が現れた。${name?`${name}を境に、`:''}${axis}の才覚が一段跳ねた。`,tag:'彗',subjectId:state.id,communityHook:{kind:'rally-around-sui',roles:['師匠','稽古仲間','共闘仲間']}});state.events.length=Math.min(state.events.length,80);return detail;
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
  if(context?.distanceBand&&row.entryBands?.length&&!row.entryBands.includes(context.distanceBand))return {usable:false,reason:'今の間合いからは、この入りへつながらない'};
  const adaptive=hasRuleEffect(state,id,'adaptive-space'),formless=hasRuleEffect(state,id,'formless-space');
  if(context&&row.space==='retreat'&&context.retreatBlocked&&!formless&&!(adaptive&&!context.sideBlocked))return {usable:false,reason:'引く足の余地がない'};
  if(context&&row.space==='side'&&context.sideBlocked&&!formless&&!(adaptive&&!context.retreatBlocked))return {usable:false,reason:'横へ動く余地がない'};
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
function generatedNamingFor(state,row,specialEffects=null){
  const s=ensureInspiration(state),motifs=unique([...(row?.motifs||[]),...s.heritage.map(h=>h.motif)]),effects=Array.isArray(specialEffects)?specialEffects:(s.records?.[row?.id]?.specialEffects||row?.specialEffects||[]);
  return generatedTechniqueNaming(row,{seed:state.seed??0,motifs,specialEffects:effects});
}
function candidateScore(state,row,context){
  const s=ensureInspiration(state),mind=context.mind||{},body=s.body;let score=1;
  for(const [key,value]of Object.entries(row.intent))score+=(Number(mind[key])||0)*value;
  for(const [key,value]of Object.entries(row.bodyAffinity))score+=(body[key]-1)*value*2;
  const motifs=unique(s.traces.flatMap(t=>t.motifs));score+=row.motifs.filter(m=>motifs.includes(m)).length*.12;
  score+=Math.min(.3,s.heritage.filter(h=>row.motifs.includes(h.motif)).reduce((n,h)=>n+h.strength*.15,0));
  // Family history bends probability; it never bypasses materials, questions, equipment, age, or availability.
  score+=familyAffinityForSkill(state.family,row);
  score+=unit(state.seed,`aptitude:${row.family}`)*.08;return score;
}
function candidateAnswerPool(state,window){
  if(window!=='combat')return CAUSAL_ANSWERS.filter(row=>row.kind!=='link');
  const weapon=state.equipment?.weapon||'fist',nonCombat=CAUSAL_ANSWERS.filter(row=>!['technique','variant','link'].includes(row.kind));
  return [...nonCombat,...inspirationCombatAnswerPool(weapon)];
}
export function inspirationCandidates(state,context={}){
  const s=ensureInspiration(state),window=context.window||'combat',questions=context.questions||Object.keys(s.questions),rows=[];
  for(const row of candidateAnswerPool(state,window)){
    if(own(s.records,row.id)||s.legacySkills.includes(row.id))continue;
    if(row.requiresFamily&&!Object.values(s.records).some(r=>r.family===row.requiresFamily))continue;
    if(!row.questions.some(q=>questions.includes(q)&&own(s.questions,q)))continue;
    const action=['technique','variant'].includes(row.kind);if(action&&window!=='combat')continue;if(!action&&!row.windows.includes(window))continue;
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
  const specialEffects=Array.isArray(candidate.specialEffects)?candidate.specialEffects:inspirationRuleEffectsFor(state,row);
  const naming=isGeneratedTechniqueId(row.id)?generatedNamingFor(state,row,specialEffects):null;
  const record={answerId:row.id,family:row.family,name:naming?.displayName||inspirationTechniqueName(row),age:clamp(state.ageYears,0,100),kind:row.kind,stable:false,archived:false,contexts:[useContextKey(state,context)],provenance:provenanceFor(state,candidate,context),motifs:[...row.motifs],specialEffects:specialEffects.map(effect=>({...effect}))};
  if(naming)record.naming={style:naming.style,grade:naming.grade,baseName:naming.baseName,signature:naming.signature};
  const youngSui=Boolean(naming?.grade==='ultimate'&&record.age<=17);
  if(['technique','variant'].includes(row.kind)){const effectAttribute=chooseInspirationEffectAttribute(state,row.id);if(effectAttribute)record.effectAttribute=effectAttribute;}
  s.records[row.id]=record;s.lastNamed=s.clock;s.revision++;enforceActiveLimit(state);synchronizeKnownSkills(state);
  const sui=evaluateSuiAwakening(state,{id:row.id,name:record.name,motifs:row.motifs,force:youngSui,origin:youngSui?'young-ultimate':'life'});
  const villageAnnouncement=sui?`${state.name||'旅人'}に「彗」が現れた。`:null;
  const event={type:'inspiration',id:row.id,name:record.name,kind:row.kind,family:row.family,age:record.age,provenance:record.provenance,effectAttribute:record.effectAttribute||null,grade:naming?.grade||'normal',sui:Boolean(sui),suiDetail:sui,villageAnnouncement};
  state.events??=[];state.events.unshift({type:'inspiration',scope:'self',worldSecond:Math.floor(Number(state.ageSeconds)||0),text:`${record.name}を閃いた。`,inspirationId:row.id,subjectId:state.id});state.events.length=Math.min(state.events.length,80);return event;
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
  const s=ensureInspiration(state),rows=candidateAnswerPool(state,'combat').filter(row=>row.kind!=='link'&&row.questions.includes(question)&&!own(s.records,row.id)&&(!row.requiresFamily||Object.values(s.records).some(r=>r.family===row.requiresFamily)));
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
    const remaining=candidateAnswerPool(state,'combat').some(row=>row.kind!=='link'&&row.questions.includes(id)&&!own(s.records,row.id));if(!remaining)continue;
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
  const candidate=inspirationCandidates(state,{...context,window:'combat'})[0];if(!candidate)return null;const candidateRow=answer(candidate.id),specialEffects=inspirationRuleEffectsFor(state,candidateRow);s.pending={...candidate,specialEffects,targetId:context.targetId,elapsed:0,committed:false,armed:false,started:false,cursor:0,contact:false,failed:false,runtimeName:isGeneratedTechniqueId(candidate.id)?generatedNamingFor(state,candidateRow,specialEffects).displayName:inspirationTechniqueName(candidateRow),context:{...context}};return s.pending;
}
export function inspirationRecipe(state,id,phase,targetId=null,context=null,{immediate=false}={}){
  const s=ensureInspiration(state),p=s.pending,usingPending=p&&!p.committed&&p.targetId===targetId,chosen=usingPending?p.id:id,row=answer(chosen);
  if(!row||!row.steps.length||!['technique','variant'].includes(row.kind))return null;if(!usingPending&&!own(s.records,chosen))return null;
  if(!answerAvailability(state,chosen,{context:context||p?.context,ignoreResources:!usingPending||p.started}).usable)return null;
  if(usingPending){const preferred=row.phases.includes('jo')?'jo':row.phases[0];if(!immediate&&phase!==preferred)return null;p.armed=true;p.phase=phase;}
  const effects=usingPending?(p.specialEffects||[]):recordRuleEffects(state,chosen);
  return {id:chosen,name:usingPending?p.runtimeName:(isGeneratedTechniqueId(chosen)?generatedNamingFor(state,row,effects).displayName:inspirationTechniqueName(row)),steps:row.steps.map(step=>({...step})),effort:row.effort,family:row.family,phaseAffinity:row.phases.includes(phase),specialEffects:effects.map(effect=>({...effect}))};
}
function rememberUse(state,id,context){const s=ensureInspiration(state),r=s.records[id];if(!r)return null;const key=useContextKey(state,context);if(r.contexts.includes(key))return null;const wasStable=Boolean(r.stable);if(r.contexts.length<INSPIRATION_LIMITS.contexts)r.contexts.push(key);r.stable=r.contexts.length>=3;s.revision++;if(wasStable||!r.stable)return null;const event={type:'inspiration-stabilized',id:r.answerId,name:r.name,kind:r.kind,family:r.family,age:clamp(state.ageYears,0,100)};state.events??=[];state.events.unshift({type:'inspiration-stabilized',worldSecond:Math.floor(Number(state.ageSeconds)||0),text:`${r.name}が身体に馴染んだ。`,inspirationId:r.answerId});state.events.length=Math.min(state.events.length,80);return event;}
function matchesAttempt(event,p){return event.targetId===p.targetId&&event.phase===p.phase&&(event.techniqueId?event.techniqueId===p.id:event.skill===p.runtimeName);}
function observePerformedAnswer(state,context,events){
  const s=ensureInspiration(state),p=s.pending;if(!p||!p.armed||p.committed||state.ended||state.down)return null;
  // The shared executor has already paid for and started the new motion. Its
  // inspiration-start event is the authoritative first use, in this battle.
  const first=events.find(e=>e.type==='inspiration-start'&&e.authority==='johakyu-battle'&&e.targetId===p.targetId&&e.techniqueId===p.id);
  if(first){
    p.started=true;
    const learned=commitAnswer(state,p,{...context,description:`${INSPIRATION_QUESTIONS[p.question]||'戦況から答えを掴んだ'}。実戦で新しい身体操作を始めた。`});
    if(learned){p.committed=true;learned.firstCast=true;learned.attackId=first.attackId;learned.targetId=first.targetId;}
    return learned;
  }
  // A target may die and clear combat in this tick. Keep the executor-owned final frame, not a made-up replay.
  const row=answer(p.id),pose=s.execution||state.combat?.tidebreakPose;
  const shared=events.filter(e=>e.authority==='johakyu-battle'&&matchesAttempt(e,p));
  if(shared.length){
    if(shared.some(e=>e.type==='execution-blocked'||e.type==='interrupted'||e.type==='weapon-blocked')){p.failed=true;return null;}
    if(shared.some(e=>e.type==='stage-start'))p.started=true;
    if(shared.some(e=>e.type==='player-hit'&&e.damage>0))p.contact=true;
    for(const e of shared.filter(e=>e.type==='stage-complete'))if(e.stageIndex===p.cursor)p.cursor++;
    if(p.cursor>=row.steps.length&&p.contact){const learned=commitAnswer(state,p,{...context,description:`${INSPIRATION_QUESTIONS[p.question]}。一連の身体操作と接触が実戦で成立した。`});if(learned)p.committed=true;return learned;}
    return null;
  }
  if(p.started&&pose?.battleAction)return null;

  const hits=events.filter(e=>e.type==='player-hit'&&['tidebreak','johakyu'].includes(e.engine)&&matchesAttempt(e,p));
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
    if(event.type!=='player-hit'||!(event.damage>0)||event.blockedByTerrain||!['tidebreak','johakyu'].includes(event.engine))continue;
    const used=event.techniqueId?s.records[event.techniqueId]:Object.values(s.records).find(r=>r.name===event.skill||answer(r.answerId)?.name===event.skill);if(used){const stabilized=rememberUse(state,used.answerId,context);if(stabilized)result.push(stabilized);}
  }
  if(state.ended||state.down)s.pending=null;s.execution=null;updateInspirationSigns(state,context);return result;
}
export function inspirationName(state,id,fallback=id){const row=answer(id);if(!row)return fallback;if(isGeneratedTechniqueId(id))return generatedNamingFor(state,row).displayName;return inspirationTechniqueName(row);}
export function archiveInspiration(state,id,archived=true){const s=ensureInspiration(state),r=s.records[id];if(!r||(archived&&equippedIds(state).has(id)))return false;r.archived=Boolean(archived);s.revision++;if(!archived)enforceActiveLimit(state);return r.archived===Boolean(archived);}
export function inspirationSummary(state){const s=ensureInspiration(state),families=unique(Object.values(s.records).map(r=>r.family));return {families:families.length,records:Object.keys(s.records).length,signs:updateInspirationSigns(state),heritage:s.heritage,body:s.body,faith:faithProfile(state),legacy:s.legacySkills.length};}
