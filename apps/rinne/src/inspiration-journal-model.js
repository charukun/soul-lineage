import { CAUSAL_ANSWER_BY_ID, INSPIRATION_KINDS, inspirationTechniquePresentation } from '@soul/game-data';
import { ensureInspiration, inspirationSummary, answerAvailability, inspirationName } from './rebuild/inspiration-state.js';

export const MOTIF_NAMES=Object.freeze({balance:'軸を戻す',space:'間を作る',timing:'拍子を読む',handling:'得物を扱う',observation:'よく見る',patience:'待つ',care:'支える',tool:'道具を知る',force:'重さを活かす',breath:'息を残す',precision:'線を合わせる',return:'引いて返す',angle:'角度を変える',wait:'相手を待つ',read:'動きを読む',advance:'前へ通す'});
export function motifName(id){return MOTIF_NAMES[id]||'受け継いだ感覚';}
const stripAge=text=>String(text||'').replace(/^\d+歳 · /,'');
function causalStory(name,provenance=[]){
  const roots=provenance.filter(p=>['life','practice','observation','combat'].includes(p.type)).slice(0,2).map(p=>stripAge(p.text)).filter(Boolean);
  const question=provenance.find(p=>p.type==='question')?.text;
  if(roots.length&&question)return `${roots.join('、')}が重なり、「${question}」という問いが${name}へつながった。`;
  if(roots.length)return `${roots.join('、')}が重なり、${name}として形になった。`;
  if(question)return `「${question}」という問いが、${name}として形になった。`;
  return `${name}には、この人物が実際に積み重ねた経験の由来が残っている。`;
}
export function equippedInspirationIds(state){
  const l=state.combatLoadout;return new Set([...(l?.heart?.active||[]),...(l?.technique?.combos||[]).flatMap(c=>Object.values(c.slots||{})),l?.technique?.oneMotion].filter(Boolean));
}
export function inspirationJournalModel(state){
  const s=ensureInspiration(state),summary=inspirationSummary(state),families=new Map();
  for(const record of Object.values(s.records)){
    const answer=CAUSAL_ANSWER_BY_ID[record.answerId];if(!answer)continue;
    const naming=inspirationTechniquePresentation(answer);const item={id:record.answerId,name:inspirationName(state,record.answerId),grade:naming.grade,attributes:[...naming.attributes],traits:[...naming.traits],family:record.family,kind:record.kind,kindLabel:INSPIRATION_KINDS[record.kind],age:record.age,stable:record.stable,archived:record.archived,status:record.archived?'古技':record.stable?'定着':'会得',purpose:answer.mechanic,tradeoff:answer.tradeoff,phases:answer.phases,availability:answerAvailability(state,record.answerId),provenance:record.provenance.map(p=>({...p,text:p.type==='lineage'?p.text.replace(/ (balance|space|timing|handling|observation|patience|care|tool|force|breath|precision|return|angle|wait|read|advance)$/,(_,id)=>`「${motifName(id)}」`):p.text})),story:causalStory(inspirationName(state,record.answerId),record.provenance),combo:record.combo||null};
    if(!families.has(record.family))families.set(record.family,[]);families.get(record.family).push(item);
  }
  return{person:state.name,generation:state.generation,age:Math.floor(state.ageYears||0),signs:summary.signs.map(({text,hint,age})=>({text,hint,age})),families:[...families].map(([id,variants])=>({id,variants:variants.sort((a,b)=>a.age-b.age)})).reverse(),heritage:s.heritage.map(h=>({...h,label:motifName(h.motif)})),body:{...s.body},traces:[...s.traces].reverse(),legacySkills:[...s.legacySkills],earlierGenerations:state.lineageArchive?.earlierGenerations||Math.max(0,state.generation-1-(state.lineage?.length||0))};
}
