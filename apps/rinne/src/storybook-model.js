import {resolveInspirationAnswer} from '@soul/game-data';
import {ensureCombatLoadout,learnedHeartSkills,learnedTechniqueSkills,techniqueName,activeCombo,unlockedBodyOptions,BODY_STANCES,BODY_FINISHERS,BODY_ZANSHIN,PHASES} from './combat-loadout.js';
import {skillDefinition} from './rebuild/skill-system.js';
import {inspirationJournalModel} from './inspiration-journal-model.js';
import {tidebreakMindVectorFor} from './rebuild/combat-tactics.js';
import {ensureProgression,WEAPON_LABELS,ARMOR_LABELS} from './gameplay-world.js';

export const BOOK_PAGES=Object.freeze({
  heart:{glyph:'心',title:'心得',subtitle:'経験から生まれた心得を、いまの心に。',section:'現在の心得',hint:'心の枠を選び、下の心得から組み替える。'},
  technique:{glyph:'技',title:'技の手帳',subtitle:'身につけた技で、道を切り拓く。',section:'現在の戦闘構成',hint:'序で探り、破で変え、急で収める。'},
  body:{glyph:'体',title:'身体',subtitle:'この身が、旅をつくる。',section:'現在の身法',hint:'構え・戦法・残心を、いまの身体に合わせる。'},
  items:{glyph:'装',title:'武具',subtitle:'旅を支える、確かな道具たち。',section:'現在の装備',hint:'武器・防具・盾を見比べて、身支度を整える。'}
});
export const BOOK_BODY=Object.freeze([['stance','構え',BODY_STANCES],['finisher','葬焉',BODY_FINISHERS],['zanshin','残心',BODY_ZANSHIN]]);
export const BOOK_MIND=Object.freeze([['attack','攻勢'],['guard','守り'],['spacing','間合い'],['counter','反撃'],['mobility','機動'],['survival','生存']]);
export const BOOK_TRAITS=Object.freeze([['reach','間合い'],['drive','力'],['balance','重心'],['endurance','息持ち'],['coordination','まとまり']]);
const EFFECTS={reachScale:'間合い',turnScale:'旋回',guardBonus:'受け',distanceScale:'保つ距離',advanceScale:'踏み込み',retreatScale:'退き',orbitScale:'回り込み',recoveryScale:'構えへの戻り',staminaRefund:'息の回復'};
const GEAR_KINDS=[['weapon','武器','weapons'],['armor','防具','armors'],['shield','盾','shields']];
const GEAR_NOTES={fist:'得物を持たない状態。',sword:'片手剣。',dagger:'短い得物。',great:'大きな両手の得物。',spear:'長い得物。',axe:'戦斧。',staff:'杖。',cloth:'旅の衣服。',light:'軽装の防具。',heavy:'重装の防具。'};
// Art is illustrative. Never label the bow in the proposal as an implemented spear.
const gearIcon=(kind,value)=>kind==='shield'?(value?'shield':'stance'):value==='fist'?'stance':value==='spear'?'staff':String(value);
const iconFor=id=>{
  const t=String(id||'');
  if(/observe|read|precision/.test(t))return 'book';
  if(/breath|calm|recover/.test(t))return 'heal';
  if(/guard|endure|patience/.test(t))return 'guard';
  if(/balance|poise/.test(t))return 'balance';
  if(/flow|soft|step/.test(t))return 'wind';
  if(/resolve|grip|edge/.test(t))return 'crossed';
  if(/distance|peripheral/.test(t))return 'mountain';
  return 'heart';
};
function knownRow(state,id,journal){
  const record=journal.families.flatMap(f=>f.variants).find(r=>r.id===id),def=skillDefinition(id),answer=resolveInspirationAnswer(id),basic=String(id).startsWith('basic.');
  return {id,name:techniqueName(id,state),kind:record?.kind||def?.type||'basic',known:true,icon:basic?gearIcon('weapon',state.equipment.weapon):iconFor(id),
    purpose:record?.purpose||answer?.mechanic||def?.description||(basic?'得物を使うための基本の型。閃きには数えません。':'この人生で身につけた心得。'),
    tradeoff:record?.tradeoff||answer?.tradeoff||'',story:record?.story||(basic?'いつでも使える基本動作。':'移行前の保存から受け継いだ習得記録です。'),
    provenance:record?.provenance||[],status:record?.status||(basic?'基礎':'習得済'),attributes:record?.attributes||[],phases:record?.phases||[],
    availability:record?.availability||{usable:true,reason:''},weapons:answer?.weapons||[],basic};
}
function bodyRow(state,kind,label,option,known){
  const facts=Object.entries(EFFECTS).filter(([key])=>typeof option[key]==='number').map(([key,name])=>({label:name,value:`${Math.round(option[key]*100)}%`,raw:option[key],key}));
  return {id:`${kind}:${option.id}`,choice:option.id,category:kind,categoryLabel:label,name:option.label,known,kind:'body',icon:kind==='stance'?'stance':kind==='finisher'?'flow':'breath',purpose:option.description,tradeoff:'',story:known?'身につけた型から選べます。':'関連する心得を会得すると選べます。',provenance:[],requires:option.requiresAny||[],facts,status:known?'習得済':'未習得',availability:{usable:known,reason:known?'':'まだ身につけていません。'}};
}
export function bookReadOnlyReason(state,{coop=false}={}){
  if(!state)return '人生を開始してから開けます。';
  if(state.ended)return 'この生涯の記録を読んでいます。';
  if(state.down)return '回復してから編成できます。';
  if(state.combat)return '戦闘を離れてから編成できます。';
  if(coop)return '共有世界では閲覧のみです。';
  return '';
}
export function buildStorybookModel(state,page,{slot=0,category='all',filter='all',query='',sort='learned',coop=false}={}){
  if(!BOOK_PAGES[page])throw new Error('Unknown core page: '+page);
  ensureCombatLoadout(state);ensureProgression(state);
  const journal=inspirationJournalModel(state),l=state.combatLoadout,combo=activeCombo(state);let rows=[],slots=[];
  if(page==='heart'){
    rows=learnedHeartSkills(state).map(id=>knownRow(state,id,journal));
    slots=Array.from({length:3},(_,index)=>({key:index,label:`心 ${index+1}`,id:l.heart.active[index]||null}));
  }else if(page==='technique'){
    rows=learnedTechniqueSkills(state).map(id=>knownRow(state,id,journal));
    slots=PHASES.map(([key,label])=>({key,label,id:combo.slots[key]}));
  }else if(page==='body'){
    for(const [kind,label,list] of BOOK_BODY){const available=new Set(unlockedBodyOptions(state,kind).map(o=>o.id));rows.push(...list.map(o=>bodyRow(state,kind,label,o,available.has(o.id))));}
    slots=BOOK_BODY.map(([kind,label])=>({key:kind,label,id:`${kind}:${l.body[kind]}`}));
  }else{
    for(const [kind,label,key]of GEAR_KINDS){for(const value of state.inventory[key]){
      const id=`${kind}:${String(value)}`,name=kind==='weapon'?(WEAPON_LABELS[value]||value):kind==='armor'?(ARMOR_LABELS[value]||value):value?'盾':'盾なし';
      rows.push({id,name,value,category:kind,categoryLabel:label,known:true,kind:'gear',icon:gearIcon(kind,value),purpose:GEAR_NOTES[value]||(value?'受けに使う盾。':'盾を持たない状態。'),tradeoff:'',story:'この人生で所持している武具。装備の変更は7歳から、村の武具置き場の近くで。',provenance:[],status:'所持',availability:{usable:state.ageYears>=7,reason:state.ageYears<7?'武具を変更できるのは7歳からです。':''}});
    }}
    slots=GEAR_KINDS.map(([key,label])=>({key,label,id:`${key}:${String(state.equipment[key])}`}));
  }
  const allRows=rows,selectedSlot=slots.find(s=>String(s.key)===String(slot))||slots[0];
  const visible=rows.filter(r=>(category==='all'||r.category===category)&&(filter==='all'||(filter==='learned'?r.known:!r.known))&&(!query||`${r.name} ${r.purpose}`.includes(query)));
  if(sort==='name')visible.sort((a,b)=>a.name.localeCompare(b.name,'ja'));else if(sort==='equipped')visible.sort((a,b)=>Number(slots.some(s=>s.id===b.id))-Number(slots.some(s=>s.id===a.id)));
  const mind=tidebreakMindVectorFor(state),total=BOOK_MIND.reduce((sum,[id])=>sum+Math.max(0,Number(mind[id])||0),0)||1;
  return {page,...BOOK_PAGES[page],weapon:state.equipment.weapon,name:state.name||'旅人',age:Math.floor(state.ageYears||0),generation:state.generation||1,rows:visible,allRows,slots:slots.map(s=>({...s,row:allRows.find(r=>r.id===s.id)||null})),selectedSlot,combo,combos:l.technique.combos,oneMotion:l.technique.oneMotion,
    readonly:bookReadOnlyReason(state,{coop}),signs:journal.signs,body:journal.body,mind:BOOK_MIND.map(([id,label])=>({id,label,value:Math.max(0,Number(mind[id])||0)/total})),equipped:new Set(slots.map(s=>s.id).filter(Boolean))};
}
export function storybookRowLock(model,row){
  if(!row)return 'まだ選択されていません。';
  if(model.readonly)return model.readonly;
  if(!row.known)return 'まだ身につけていません。';
  if(model.page==='technique'&&row.weapons?.length&&!row.weapons.includes(model.weapon))return '今の得物では使えません。';
  return row.availability?.usable===false?row.availability.reason||'いまは使用できません。':'';
}
