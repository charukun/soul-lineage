import {defs} from './catalog.js';

const topic=(id,{label=null,form='place',kinds,line=null})=>Object.freeze({id,label,form,kinds:Object.freeze([...kinds]),line});

/**
 * Shared meanings for village conversation. Facility wording comes from the
 * same MURA catalog used by the Village app; only non-facility concepts keep
 * a small authored line here.
 */
export const MURA_DIALOGUE_TOPICS=Object.freeze({
  'village-square':topic('village-square',{kinds:['campfire'],line:'ここは村の広場。ごはんを食べたり、みんなで話したりする場所だよ。'}),
  'home-life':topic('home-life',{label:'家',kinds:['mayor','tent','home','lodge','clanManor'],line:'ここはわたしたちの家。ごはんを食べたり、休んだりして、毎日を過ごす場所だよ。'}),
  'school-learning':topic('school-learning',{kinds:['school'],line:'ここは学校。文字を覚えたり、村の仕事を学んだりする場所だよ。'}),
  books:topic('books',{label:'本',form:'thing',kinds:['school'],line:'本には、会ったことのない人の知恵まで残っている。'}),
  prayer:topic('prayer',{kinds:['chapel'],line:'ここは教会。静かに祈ったり、心を落ち着けたりする場所だよ。'}),
  training:topic('training',{kinds:['dojo'],line:'ここは道場。体を鍛えたり、身を守る術を学んだりする場所だよ。'}),
  smithing:topic('smithing',{kinds:['smith','weapons'],line:'ここは鍛冶場。鉄を打って、道具や武具をこしらえる場所だよ。'}),
  healing:topic('healing',{kinds:['clinic'],line:'ここは治療所。けがや病気の人を診てもらう場所だよ。'}),
});

/** Shared village utterances. Apps own speaker, timing and styling. */
export const MURA_SHARED_LINES=Object.freeze({
  'first-outing':'お外は初めてだね。今日は一緒に村を見てまわろう。',
  'walk-alone':'さあ、地面へ。今日からは自分の足で歩けるよ。',
  'reaction.growth':'村が少し育ったね',
  'reaction.unlock':'新しい仕事ができそう',
  'reaction.danger':'みんな、気をつけて',
  'reaction.event':'村で何か起きている',
});

/** Portable player utterances. Browser/device input stays in the app adapter. */
export const MURA_SPEECH_INTENTS=Object.freeze([
  Object.freeze({id:'greet',label:'あいさつ',text:'こんにちは'}),
  Object.freeze({id:'ask-place',label:'ここは？',text:'ここはどんな場所？'}),
  Object.freeze({id:'offer-help',label:'手伝う',text:'何か手伝える？'}),
  Object.freeze({id:'thanks',label:'感謝',text:'ありがとう'}),
  Object.freeze({id:'agree',label:'うん',text:'うん'}),
  Object.freeze({id:'farewell',label:'またね',text:'またね'}),
]);

export function muraSharedLine(id){
  return typeof id==='string'&&Object.hasOwn(MURA_SHARED_LINES,id)?MURA_SHARED_LINES[id]:null;
}

export function muraSpeechIntent(intentId){
  const row=MURA_SPEECH_INTENTS.find(item=>item.id===intentId);
  return row?{...row}:null;
}

export function muraSpeechPhrases(){return MURA_SPEECH_INTENTS.map(item=>({...item}));}

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
