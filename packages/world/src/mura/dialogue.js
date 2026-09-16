import {defs} from './catalog.js';

const topic=(id,{label=null,form='place',kinds,line=null})=>Object.freeze({id,label,form,kinds:Object.freeze([...kinds]),line});

/**
 * Shared meanings for village conversation. Facility wording comes from the
 * same MURA catalog used by the Village app; only non-facility concepts keep
 * a small authored line here.
 */
export const MURA_DIALOGUE_TOPICS=Object.freeze({
  'village-square':topic('village-square',{kinds:['campfire']}),
  'home-life':topic('home-life',{label:'家',kinds:['mayor','tent','home','lodge','clanManor']}),
  'school-learning':topic('school-learning',{kinds:['school']}),
  books:topic('books',{label:'本',form:'thing',kinds:['school'],line:'本には、会ったことのない人の知恵まで残っている。'}),
  prayer:topic('prayer',{kinds:['chapel']}),
  training:topic('training',{kinds:['dojo']}),
  smithing:topic('smithing',{kinds:['smith','weapons']}),
  healing:topic('healing',{kinds:['clinic']}),
});

/** Existing/shared village utterances. Apps own speaker, timing and styling. */
export const MURA_SHARED_LINES=Object.freeze({
  'first-outing':'お外は初めてだね。今日は一緒に村を見てまわろう。',
  'walk-alone':'さあ、地面へ。今日からは自分の足で歩けるよ。',
  settle:'ここに暮らそう',
  'guard-patrol':'見回りに行こう',
  'reaction.growth':'村が少し育ったね',
  'reaction.unlock':'新しい仕事ができそう',
  'reaction.danger':'みんな、気をつけて',
  'reaction.event':'村で何か起きている',
});

export function muraSharedLine(id){
  return typeof id==='string'&&Object.hasOwn(MURA_SHARED_LINES,id)?MURA_SHARED_LINES[id]:null;
}

export function muraFacilityMeaning(kind){
  const definition=kind&&defs[kind];
  if(!definition)return null;
  return Object.freeze({kind,label:definition.label,trait:definition.trait||'',effect:definition.effect||null});
}

export function muraDialogueTopic(topicId,{kind=null}={}){
  const source=topicId&&MURA_DIALOGUE_TOPICS[topicId];
  if(!source)return null;
  const resolvedKind=kind||source.kinds[0]||null,compatible=!resolvedKind||source.kinds.includes(resolvedKind),facility=compatible&&resolvedKind?muraFacilityMeaning(resolvedKind):null;
  return Object.freeze({
    id:source.id,
    label:source.label||facility?.label||'',
    form:source.form,
    kinds:[...source.kinds],
    kind:resolvedKind,
    compatible,
    facility,
    line:source.line,
  });
}

export function muraTopicLine(topicId,{kind=null}={}){
  const current=muraDialogueTopic(topicId,{kind});
  if(!current||current.compatible===false)return null;
  if(current.line)return current.line;
  const fact=current.facility?.trait?.trim();if(!fact)return null;
  const label=current.label||current.facility?.label;if(!label)return null;
  return current.form==='thing'?`${label}には、${fact}`:`ここは${label}。${fact}`;
}

export function muraResidentReactionLine(tone){return muraSharedLine(`reaction.${tone}`);}
