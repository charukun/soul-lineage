import {rinnePrimaryFourMarkup} from '@soul/shared-ui/rinne-primary-four';
import {createRinneLoadoutGridItem,createRinneLoadoutGridSection,createRinneLoadoutSlot,createRinneLoadoutSlotRow,createRinneMenuLead,rinneLoadoutPanelMarkup,rinneSkillSigilKind,rinneSkillSigilMarkup} from '@soul/shared-ui/rinne-loadout-menu';
import '@soul/shared-ui/rinne-primary-four.css';
import '@soul/shared-ui/rinne-loadout-menu.css';
import {BATTLE2_COMBO_PRESETS,BATTLE2_TECHNIQUE_CATALOG,battle2ComboSelection,battle2SelectionAllowed,battle2SelectionLabel,battle2TechniqueLabel} from './battle2-technique-catalog.js';

const STORAGE_KEY='battle2.loadout.v1';
const HEART_LIMIT=3;
const PHASES=Object.freeze([['jo','序'],['ha','破'],['kyu','急']]);

export const BATTLE2_HEART_OPTIONS=Object.freeze([
  Object.freeze({id:'skill.breath',label:'調息',meta:'息を整える'}),
  Object.freeze({id:'skill.observe',label:'観眼',meta:'攻めを読む'}),
  Object.freeze({id:'skill.balance',label:'体幹',meta:'受けを安定'}),
  Object.freeze({id:'skill.focus',label:'集中',meta:'一撃を研ぐ'}),
  Object.freeze({id:'skill.danger',label:'危険察知',meta:'見切りを優先'})
]);
export const BATTLE2_TECHNIQUE_OPTIONS=Object.freeze(Object.fromEntries(PHASES.map(([phase])=>[phase,Object.freeze(BATTLE2_TECHNIQUE_CATALOG.map(row=>Object.freeze({id:row.id,label:row.label,meta:row.meta})))])));
export const BATTLE2_BODY_OPTIONS=Object.freeze({
  stance:Object.freeze([
    Object.freeze({id:'seigan',label:'正眼',meta:'癖のない基本構え'}),
    Object.freeze({id:'chinshin',label:'沈身',meta:'受けを厚くする'}),
    Object.freeze({id:'ryu',label:'流構え',meta:'角度を変え続ける'}),
    Object.freeze({id:'kosei',label:'攻勢',meta:'前へ圧を掛ける'})
  ]),
  style:Object.freeze([
    Object.freeze({id:'balanced',label:'中庸',meta:'標準の間合い'}),
    Object.freeze({id:'distance',label:'間合い重視',meta:'遠めから入る'}),
    Object.freeze({id:'counter',label:'迎撃',meta:'相手の踏み込み待ち'}),
    Object.freeze({id:'pressure',label:'圧迫',meta:'近間へ詰める'}),
    Object.freeze({id:'flow',label:'流動',meta:'正面を外す'})
  ]),
  zanshin:Object.freeze([
    Object.freeze({id:'still',label:'静止残心',meta:'崩さず戻る'}),
    Object.freeze({id:'breath',label:'呼吸残心',meta:'戻りを速める'}),
    Object.freeze({id:'pursuit',label:'追い残心',meta:'一歩だけ追う'}),
    Object.freeze({id:'guard',label:'守り残心',meta:'守りへ戻る'})
  ])
});
export const BATTLE2_LOADOUT_DEFAULT=Object.freeze({
  heart:Object.freeze({active:Object.freeze(['skill.observe','skill.balance','skill.focus'])}),
  technique:Object.freeze({jo:'action.feint',ha:'action.guard-step',kyu:'action.crash'}),
  body:Object.freeze({stance:'seigan',style:'balanced',zanshin:'still'}),
  equipment:Object.freeze({weapon:'sword',shield:false})
});
const HEART_IDS=new Set(BATTLE2_HEART_OPTIONS.map(row=>row.id));
const optionIds=kind=>new Set((BATTLE2_BODY_OPTIONS[kind]||[]).map(row=>row.id));
const TECH_IDS=Object.fromEntries(PHASES.map(([phase])=>[phase,new Set([...BATTLE2_TECHNIQUE_OPTIONS[phase].map(row=>row.id),...BATTLE2_COMBO_PRESETS.map(row=>battle2ComboSelection(row.id))])]));
const clone=value=>JSON.parse(JSON.stringify(value));
const labelFor=(rows,id)=>rows.find(row=>row.id===id)?.label||battle2TechniqueLabel(id)||id||'未設定';

export function normalizeBattle2Loadout(value={}){
  const heart=Array.isArray(value?.heart?.active)?value.heart.active.filter(id=>HEART_IDS.has(id)).slice(0,HEART_LIMIT):[];
  const active=[...new Set(heart.length?heart:BATTLE2_LOADOUT_DEFAULT.heart.active)];
  const technique=Object.fromEntries(PHASES.map(([phase])=>{const candidate=value?.technique?.[phase];return[phase,TECH_IDS[phase].has(candidate)&&battle2SelectionAllowed(candidate)?candidate:BATTLE2_LOADOUT_DEFAULT.technique[phase]];}));
  const body={};
  for(const kind of ['stance','style','zanshin'])body[kind]=optionIds(kind).has(value?.body?.[kind])?value.body[kind]:BATTLE2_LOADOUT_DEFAULT.body[kind];
  const weapon=['sword','great'].includes(value?.equipment?.weapon)?value.equipment.weapon:'sword';
  return{heart:{active},technique,body,equipment:{weapon,shield:weapon==='sword'&&Boolean(value?.equipment?.shield)}};
}
export function battle2LoadoutKey(value){
  const row=normalizeBattle2Loadout(value),raw=[row.heart.active.join('.'),row.technique.jo,row.technique.ha,row.technique.kyu,row.body.stance,row.body.style,row.body.zanshin,row.equipment.weapon,row.equipment.shield?'shield':'bare'].join('~');
  let hash=2166136261;for(let i=0;i<raw.length;i++){hash^=raw.charCodeAt(i);hash=Math.imul(hash,16777619);}
  return(hash>>>0).toString(36).padStart(7,'0').slice(-7);
}
function readStored(){
  try{return normalizeBattle2Loadout(JSON.parse(globalThis.localStorage?.getItem(STORAGE_KEY)||'{}'));}catch{return normalizeBattle2Loadout();}
}
function writeStored(value){try{globalThis.localStorage?.setItem(STORAGE_KEY,JSON.stringify(value));}catch{}}
export function createBattle2LoadoutUI({stage,onChange=()=>{}}={}){
  if(!stage)throw new TypeError('battle2 stage required');
  let value=readStored(),section='',heartTarget=0,techniqueTarget='jo',techniqueTab='combo',bodyTarget='stance',equipmentTarget='weapon';
  const shell=document.createElement('div');shell.className='battle2-loadout-shell';
  shell.innerHTML=rinnePrimaryFourMarkup({ariaLabel:'心技体装',extraClass:'battle2-loadout-nav'})+rinneLoadoutPanelMarkup();
  stage.append(shell);
  const nav=shell.querySelector('.battle2-loadout-nav'),panel=shell.querySelector('[data-panel]'),title=panel.querySelector('[data-title]'),body=panel.querySelector('[data-body]');
  const navButtons={heart:nav.querySelector('[data-heart]'),technique:nav.querySelector('[data-techniques]'),body:nav.querySelector('[data-body]'),items:nav.querySelector('[data-items]')};
  const emit=()=>{value=normalizeBattle2Loadout(value);writeStored(value);onChange(clone(value));render();};

  const appendSlots=(rows,activeKey,onSelect)=>{const slots=createRinneLoadoutSlotRow();for(const row of rows)slots.append(createRinneLoadoutSlot({label:row.label,value:row.value,meta:row.meta,selected:row.id===activeKey,icon:row.icon||'empty',onClick:()=>onSelect(row.id)}));body.append(slots);};
  const appendLibrary=(titleText,copy,rows,onSelect)=>{const library=createRinneLoadoutGridSection(titleText,copy),grid=library.querySelector('.loadout-grid');for(const row of rows)grid.append(createRinneLoadoutGridItem({label:row.label,meta:row.meta,active:row.active,icon:row.icon||rinneSkillSigilKind(row.id),onClick:()=>onSelect(row.id)}));body.append(library);};
  function renderHeart(){title.textContent='心 · 心得';body.replaceChildren(createRinneMenuLead('戦闘で意識する心得を3つまで選ぶ'));const slots=[0,1,2].map(index=>{const id=value.heart.active[index];return{id:String(index),label:'心得 '+(index+1),value:labelFor(BATTLE2_HEART_OPTIONS,id),meta:index===heartTarget?'選択先':'意識中',icon:rinneSkillSigilKind(id)};});appendSlots(slots,String(heartTarget),id=>{heartTarget=Number(id)||0;renderHeart();});appendLibrary('心得一覧','選択中の心得枠で意識する',BATTLE2_HEART_OPTIONS.map(row=>({...row,active:value.heart.active[heartTarget]===row.id,icon:rinneSkillSigilKind(row.id)})),id=>{const rows=[...value.heart.active],existing=rows.indexOf(id);if(existing>=0&&existing!==heartTarget){const displaced=rows[heartTarget];rows[heartTarget]=id;rows[existing]=displaced;}else if(heartTarget<rows.length)rows[heartTarget]=id;else rows.push(id);value.heart.active=rows.filter(Boolean).slice(0,HEART_LIMIT);emit();});}

  function techniqueTabs(){
    const nav=document.createElement('nav');nav.className='loadout-technique-tabs';nav.setAttribute('aria-label','技一覧の表示');
    for(const [id,label] of [['combo','連技一覧'],['basic','基本技一覧']]){const button=document.createElement('button');button.type='button';button.textContent=label;button.dataset.active=String(techniqueTab===id);button.onclick=()=>{techniqueTab=id;renderTechnique();};nav.append(button);}return nav;
  }
  function comboCard(row){
    const selection=battle2ComboSelection(row.id),button=document.createElement('button');button.type='button';button.className='loadout-combo-card';button.dataset.active=String(value.technique[techniqueTarget]===selection);
    const header=document.createElement('header'),name=document.createElement('strong'),count=document.createElement('small');name.textContent=row.label;count.textContent=row.techniques.length+'技';header.append(name,count);
    const members=document.createElement('div');members.className='loadout-combo-members';
    for(let index=0;index<3;index++){const id=row.techniques[index],card=document.createElement('span');card.className='loadout-combo-member';card.dataset.empty=String(!id);const ordinal=document.createElement('b');ordinal.textContent=String(index+1);card.append(ordinal);if(id){card.insertAdjacentHTML('beforeend',rinneSkillSigilMarkup(rinneSkillSigilKind(id)));const label=document.createElement('strong');label.textContent=battle2TechniqueLabel(id);card.append(label);}else{const empty=document.createElement('strong');empty.textContent='空き';card.append(empty);}members.append(card);}
    button.append(header,members);button.onclick=()=>{value.technique[techniqueTarget]=selection;emit();};return button;
  }
  function renderTechnique(){
    title.textContent='技 · 序破急';body.replaceChildren(createRinneMenuLead('序・破・急の選択枠へ、連技または基本技をセットする'));
    const slots=PHASES.map(([phase,label])=>{const selection=value.technique[phase];return{id:phase,label,value:battle2SelectionLabel(selection),meta:phase===techniqueTarget?'選択先':'装着中',icon:String(selection).startsWith('combo:')?'flow':rinneSkillSigilKind(selection)};});appendSlots(slots,techniqueTarget,id=>{techniqueTarget=id;renderTechnique();});
    body.append(techniqueTabs());
    if(techniqueTab==='combo'){const section=document.createElement('section');section.className='loadout-combo-list';for(const row of BATTLE2_COMBO_PRESETS)section.append(comboCard(row));body.append(section);return;}
    appendLibrary('基本技一覧','選択中の序破急スロットへセット',BATTLE2_TECHNIQUE_CATALOG.map(row=>({id:row.id,label:row.label,meta:row.meta,active:value.technique[techniqueTarget]===row.id,icon:rinneSkillSigilKind(row.id)})),id=>{value.technique[techniqueTarget]=id;emit();});
  }

  function renderBody(){title.textContent='体 · 身法';body.replaceChildren(createRinneMenuLead('いまの身体に合う型を選ぶ'));const labels={stance:'構え',style:'戦法',zanshin:'残心'},slots=['stance','style','zanshin'].map(kind=>{const id=value.body[kind];return{id:kind,label:labels[kind],value:labelFor(BATTLE2_BODY_OPTIONS[kind],id),meta:kind===bodyTarget?'選択先':'装着中',icon:'stance'};});appendSlots(slots,bodyTarget,id=>{bodyTarget=id;renderBody();});appendLibrary('習得した身体技',labels[bodyTarget]+'を選ぶ',BATTLE2_BODY_OPTIONS[bodyTarget].map(row=>({...row,active:value.body[bodyTarget]===row.id,icon:'stance'})),id=>{value.body[bodyTarget]=id;emit();});}
  function renderItems(){title.textContent='装 · 武具';body.replaceChildren(createRinneMenuLead('装備変更は次の交換から即時反映'));const weaponLabel=value.equipment.weapon==='great'?'大剣':'剣',shieldLabel=value.equipment.shield?'盾あり':'盾なし',slots=[{id:'weapon',label:'武器',value:weaponLabel,meta:equipmentTarget==='weapon'?'選択先':'装備中',icon:'blade'},{id:'shield',label:'盾',value:shieldLabel,meta:equipmentTarget==='shield'?'選択先':'装備中',icon:'guard'},{id:'armor',label:'防具',value:'重装',meta:'固定',icon:'guard'}];appendSlots(slots,equipmentTarget,id=>{if(id!=='armor'){equipmentTarget=id;renderItems();}});const rows=equipmentTarget==='shield'?[{id:'off',label:'盾なし',meta:'両手を自由に',icon:'guard',active:!value.equipment.shield},{id:'on',label:'盾あり',meta:'片手剣のみ',icon:'guard',active:value.equipment.shield}]:[{id:'sword',label:'剣',meta:'片手剣',icon:'blade',active:value.equipment.weapon==='sword'},{id:'great',label:'大剣',meta:'両手武器',icon:'blade',active:value.equipment.weapon==='great'}];appendLibrary(equipmentTarget==='shield'?'盾':'武器','レビュー用装備',rows,id=>{if(equipmentTarget==='weapon'){value.equipment.weapon=id;if(id==='great')value.equipment.shield=false;}else value.equipment.shield=id==='on'&&value.equipment.weapon==='sword';emit();});}
  function render(){
    for(const [key,node] of Object.entries(navButtons))node.dataset.active=String(section===key);
    panel.hidden=!section;if(!section){delete panel.dataset.type;return;}panel.dataset.type=section;
    if(section==='heart')renderHeart();else if(section==='technique')renderTechnique();else if(section==='body')renderBody();else renderItems();
  }

  for(const [key,node] of Object.entries(navButtons))node.onclick=()=>{section=section===key?'':key;render();};
  panel.querySelector('[data-close]').onclick=()=>{section='';render();};
  render();
  return Object.freeze({get value(){return clone(value);},close(){section='';render();},destroy(){shell.remove();}});
}
