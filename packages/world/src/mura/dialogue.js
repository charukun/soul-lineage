import {defs} from './catalog.js';

const freezeTopic=(id,label,form,fact,kinds)=>Object.freeze({id,label,form,fact,kinds:Object.freeze([...kinds])});

export const MURA_DIALOGUE_TOPICS=Object.freeze({
  'village-square':freezeTopic('village-square','広場','place','遊んだり、食事や語らいで村のみんなが顔を合わせる場所',['campfire']),
  'home-life':freezeTopic('home-life','家','place','朝も夜も、暮らす人が帰って休む場所',['mayor','tent','home','lodge','clanManor']),
  'school-learning':freezeTopic('school-learning','学び舎','place','文字や昔のこと、仕事の知恵を学ぶ場所',['school']),
  books:freezeTopic('books','本','thing','会ったことのない人の知恵まで残してくれるもの',['school']),
  prayer:freezeTopic('prayer','教会','place','旅の無事や日々の安心を祈る場所',['chapel']),
  training:freezeTopic('training','稽古場','place','身体の使い方を覚え、村を守る力を養う場所',['dojo']),
  smithing:freezeTopic('smithing','鍛冶場','place','鉄を鍛え、道具や武具を作る場所',['smith','weapons']),
  healing:freezeTopic('healing','治療所','place','薬を作り、けがをした人を休ませて治す場所',['clinic']),
});

export const MURA_SPEECH_INTENTS=Object.freeze([
  Object.freeze({id:'greet',label:'あいさつ',text:'こんにちは'}),
  Object.freeze({id:'ask-place',label:'ここは？',text:'ここはどんな場所？'}),
  Object.freeze({id:'offer-help',label:'手伝う',text:'何か手伝える？'}),
  Object.freeze({id:'thanks',label:'感謝',text:'ありがとう'}),
  Object.freeze({id:'agree',label:'うん',text:'うん'}),
  Object.freeze({id:'farewell',label:'またね',text:'またね'}),
]);

export function muraFacilityMeaning(kind){
  const definition=kind&&defs[kind];
  if(!definition)return null;
  return Object.freeze({kind,label:definition.label,trait:definition.trait||'',effect:definition.effect||null});
}

export function muraDialogueTopic(topicId,{kind=null}={}){
  const topic=topicId&&MURA_DIALOGUE_TOPICS[topicId];
  if(!topic)return null;
  const facility=kind?muraFacilityMeaning(kind):null;
  const compatible=!kind||topic.kinds.includes(kind);
  return Object.freeze({...topic,kinds:[...topic.kinds],kind:kind||null,facility,compatible});
}

export function muraSpeechIntent(intentId){
  const row=MURA_SPEECH_INTENTS.find(item=>item.id===intentId);
  return row?{...row}:null;
}

export function muraSpeechPhrases(){return MURA_SPEECH_INTENTS.map(item=>({...item}));}
