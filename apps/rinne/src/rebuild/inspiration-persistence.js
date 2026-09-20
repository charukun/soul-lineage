import { CAUSAL_ANSWER_BY_ID, INSPIRATION_QUESTIONS, inspirationTechniqueName } from '@soul/game-data';

/** Persistence, migration and lineage compression are separate from live learning decisions. */
export const INSPIRATION_VERSION=1;
export const INSPIRATION_LIMITS=Object.freeze({traces:48,seen:192,records:80,questions:16,heritage:16,activeFamilies:12,contexts:4,lineage:24,namedGap:90,attemptSeconds:12});
export const MOTIFS=Object.freeze(['balance','space','timing','handling','observation','patience','care','tool','force','breath','precision','return','angle','wait','read','advance']);
const BODY_KEYS=['reach','drive','balance','endurance','coordination'];
const BASIC=/^basic\.(fist|sword|dagger|great|spear|axe|staff|bow)$/;
const safe=value=>String(value??'').replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,96);
const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,Number.isFinite(Number(v))?Number(v):a));
const unique=values=>[...new Set(values)];
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o||{},k);
const answer=id=>own(CAUSAL_ANSWER_BY_ID,id)?CAUSAL_ANSWER_BY_ID[id]:null;
function hash(text){let h=2166136261;for(const c of String(text)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
function unit(seed,key){return hash(`${seed}:${key}`)/4294967295;}
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
    boundedArray(row.contexts,INSPIRATION_LIMITS.contexts,'定着');row.contexts=unique(row.contexts.map(safe));row.name=inspirationTechniqueName(definition);
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
export function inspirationImprint(state){
  const s=ensureInspiration(state),weights=new Map();for(const r of Object.values(s.records)){const row=answer(r.answerId);if(!row)continue;for(const m of row.motifs)weights.set(m,Math.min(1,(weights.get(m)||0)+(r.stable?.4:.25)));}
  for(const motif of MOTIFS){const categories=unique(s.traces.filter(t=>t.motifs.includes(motif)).map(t=>t.kind));if(categories.length>1)weights.set(motif,Math.max(weights.get(motif)||0,Math.min(.45,categories.length*.15)));}
  return {version:1,body:{...s.body},motifs:[...weights].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,5).map(([id,strength])=>({id,strength})),heritage:s.heritage.map(row=>({...row})),techniques:Object.values(s.records).map(r=>({id:r.answerId,name:inspirationTechniqueName(answer(r.answerId)),family:r.family,kind:r.kind,age:r.age,stable:r.stable,origin:r.provenance.slice(0,2).map(p=>p.text)}))};
}
