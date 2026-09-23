import {ACTION_FORMS, BASIC_FORMS, adaptKind} from '@soul/game-data/combat-forms';
import {resolveInspirationAnswer, inspirationTechniqueName} from '@soul/game-data';

export const PHASES = Object.freeze(['jo','ha','kyu']);
export const PHASE_LABELS = Object.freeze({jo:'序',ha:'破',kyu:'急'});
export const BASIC_LABELS = Object.freeze({sword:'剣の型',great:'大剣の型',dagger:'短剣の型',spear:'槍の型',axe:'戦斧の型',staff:'杖の型',fist:'徒手の型'});
const LABELS = Object.freeze({'action.guard-step':'受け流し歩法','action.slip':'流し身','action.lunge':'伸び足','action.counter':'返し','action.feint':'誘い','action.flow':'連環','action.breakfall':'崩し受身','action.finish':'詰め','action.side-step':'外し歩','action.circle':'廻り込み','action.crash':'打ち崩し','action.draw':'初太刀','action.recover':'残心','action.precision':'一点通し'});
export const DEFENSIVE_KINDS = new Set(['ready','guard','brace','parry','retreat','slip']);
export const HEAVY_KINDS = new Set(['heavy','bash','pommel','oneinch','risingfist']);
export const THRUST_KINDS = new Set(['thrust','pierce','counter','dash','straight','jab']);
export const freeze = value => {
  if(value && typeof value === 'object' && !Object.isFrozen(value)){
    Object.values(value).forEach(freeze); Object.freeze(value);
  }
  return value;
};
export function techniqueName(id){
  const answer=resolveInspirationAnswer(id);
  return id?.startsWith('basic.') ? BASIC_LABELS[id.slice(6)] : LABELS[id] || (answer && inspirationTechniqueName(answer)) || id;
}

const TECHNIQUE_KIND_LABELS=Object.freeze({
  slash:'斬り',diagonal:'袈裟斬り',thrust:'突き',back:'返し',crosscut:'十字斬り',uppercut:'斬り上げ',
  bash:'打ち崩し',heavy:'打ち下ろし',round:'回し払い',dash:'踏み込み斬り',bullrush:'押し込み',meteor:'落とし',
  pommel:'柄打ち',sweep:'薙ぎ',leap:'跳び込み',sky:'穂先上げ',spearwheel:'槍回し',pierce:'貫き',
  jab:'牽制',straight:'正拳',bodyblow:'腹打ち',hook:'回し拳',risingfist:'突き上げ',oneinch:'寸勁',
  barrage:'連打',rushfist:'連環',guard:'受け',ready:'構え',brace:'踏ん張り',parry:'受け流し',
  counter:'返し突き',slip:'身かわし',spin:'回転斬り',katanaKesa:'袈裟斬り',katanaThrust:'切っ先突き',
  katanaDraw:'居合',katanaReturn:'逆袈裟'
});
const TECHNIQUE_FOOTWORK_LABELS=Object.freeze({
  stay:'その場',forward:'前へ踏み込む',chase:'追い足',retreat:'引き足',back:'引き足',
  sideL:'左へ捌く',sideR:'右へ捌く',orbitL:'左へ回る',orbitR:'右へ回る',cross:'懐へ潜る',rush:'一気に詰める'
});
export function techniqueStageText(stage){
  const action=TECHNIQUE_KIND_LABELS[stage?.kind]||'技動作';
  const rawFootwork=stage?.footwork||'stay',footwork=TECHNIQUE_FOOTWORK_LABELS[rawFootwork]||(rawFootwork==='stay'?'':'足運び');
  return footwork?`${footwork}・${action}`:action;
}
export function techniqueDetail(id,{weapon='sword',name=null,kicker=null,status='習得済み',fallbackSummary='実戦で使う技'}={}){
  const title=name||techniqueName(id),technique=resolveTechnique(id,{weapon,name:title});
  if(!technique)return freeze({id,title,kicker:kicker||(String(id||'').startsWith('basic.')?'基本技':'戦技'),summary:fallbackSummary,status});
  const answer=resolveInspirationAnswer(id),flow=technique.stages.map(techniqueStageText).join(' → '),parts=[];
  parts.push(answer?.mechanic||`${technique.label}の基本動作をつなぐ型。`);
  if(flow)parts.push(`動き: ${flow}`);
  if(answer?.tradeoff)parts.push(`注意: ${answer.tradeoff}`);
  return freeze({id,title:technique.label,kicker:kicker||(String(id||'').startsWith('basic.')?'基本技':'戦技'),summary:parts.join(' '),status});
}
// Trial-only combat presentation. These durations never modify the world clock.
export const FIRST_INSPIRATION_PRESENTATION=Object.freeze({
  protectionSeconds:.9, targetStaggerSeconds:.48, bossStaggerSeconds:.12,
  cue:'閃', effect:'finisher', trail:'slash', sound:'inspiration',
  cameraStrength:.13, cameraFov:2.3, cameraSeconds:1.45, hudSeconds:1.8,
  afterimageSeconds:.75, afterimageInterval:.085
});
export function defineTechnique(raw,{weapon='sword'}={}){
  const id=raw?.techniqueId||raw?.id,steps=raw?.stages||raw?.steps;
  if(!id || !Array.isArray(steps) || !steps.length) throw new TypeError('Technique identity and stages required');
  const compatibility=raw.weaponCompatibility||raw.weapons;
  if(compatibility?.length && !compatibility.includes(weapon)) return null;
  const stages=steps.map((row,stageIndex)=>{
    const kind=adaptKind(row.kind,weapon),footwork=row.footwork==='back'?'retreat':row.footwork||'stay',charge=row.charge||'none';
    if(!kind)throw new TypeError('Stage kind required');
    return {techniqueId:id,stageIndex,index:stageIndex,label:['一段','二段','三段'][stageIndex]||`${stageIndex+1}段`,kind,footwork,charge,
      motionIntent:kind,contactIntent:DEFENSIVE_KINDS.has(kind)?'receive':THRUST_KINDS.has(kind)?'point':'edge',
      impactIntent:HEAVY_KINDS.has(kind)?'break-posture':kind==='counter'?'reverse':'cut',presentationIntent:{techniqueId:id,stageIndex,kind},
      step:{kind,footwork,charge}};
  });
  return freeze({techniqueId:id,id,name:raw.name||techniqueName(id),label:raw.name||techniqueName(id),weapon,
    weaponCompatibility:compatibility?.length?[...compatibility]:Object.keys(BASIC_FORMS),traits:[...(raw.traits||[])],
    rhythm:raw.rhythm||'flow',tempo:Number(raw.tempo)||1,grade:raw.grade||'normal',source:raw.source||'inspiration',
    firstInspirationPresentation:raw.source==='trial'?freeze({...FIRST_INSPIRATION_PRESENTATION}):null,
    stages,steps:stages.map(({kind,footwork,charge})=>({kind,footwork,charge}))});
}
export function resolveTechnique(id,{weapon='sword',definition=null,name=null}={}){
  if(definition){if((definition.id||definition.techniqueId)!==id)throw new Error('Technique identity mismatch');return defineTechnique(definition,{weapon});}
  const basic=id===`basic.${weapon}`,form=basic?BASIC_FORMS[weapon]:ACTION_FORMS[id];
  if(form)return defineTechnique({id,name:name||techniqueName(id),...form,source:'combat-form',weapons:basic?[weapon]:Object.keys(BASIC_FORMS),
    steps:form.kinds.map((kind,i)=>({kind,footwork:form.feet[i],charge:form.charges?.[i]||'none'}))},{weapon});
  const answer=resolveInspirationAnswer(id);
  if(!answer || !['technique','variant'].includes(answer.kind) || answer.executor)return null;
  return defineTechnique({...answer,name:name||inspirationTechniqueName(answer)},{weapon});
}
export function techniqueCatalog(weapon='sword'){
  return [`basic.${weapon}`,...Object.keys(ACTION_FORMS)].map(id=>resolveTechnique(id,{weapon})).filter(Boolean);
}
export const CHAIN_PRESETS=freeze([
  {id:'combo-1',label:'壱ノ連',techniques:['action.feint','action.lunge','action.precision']},
  {id:'combo-2',label:'弐ノ連',techniques:['action.side-step','action.guard-step','action.crash']},
  {id:'combo-3',label:'参ノ連',techniques:['action.slip','action.flow','action.finish']},
  {id:'combo-4',label:'肆ノ連',techniques:['action.lunge','action.circle','action.draw']},
  {id:'combo-5',label:'伍ノ連',techniques:['action.breakfall','action.recover','action.lunge']},
  {id:'combo-6',label:'陸ノ連',techniques:['basic.sword']}
]);
export function compileBattleLoadout(loadout={},weapon='sword'){
  return freeze(Object.fromEntries(PHASES.map(phase=>{
    const selected=loadout[phase]??`basic.${weapon}`,preset=typeof selected==='string'&&selected.startsWith('combo:')?CHAIN_PRESETS.find(row=>row.id===selected.slice(6)):null;
    if(typeof selected==='string'&&selected.startsWith('combo:')&&!preset)throw new RangeError('Unknown chain');
    const ids=preset?.techniques||(Array.isArray(selected)?selected:[selected]);
    const chain=ids.map(raw=>{
      const id=typeof raw==='string'?(raw.startsWith('basic.')?`basic.${weapon}`:raw):raw.id||raw.techniqueId;
      const technique=resolveTechnique(id,{weapon,definition:typeof raw==='object'?raw:null});
      if(!technique)throw new RangeError('Unregistered or incompatible technique: '+id);
      return technique;
    });
    if(!chain.length||chain.length>3)throw new RangeError('A chain contains one to three techniques');
    return [phase,chain];
  })));
}
