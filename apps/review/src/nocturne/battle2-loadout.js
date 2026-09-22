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
export const BATTLE2_TECHNIQUE_OPTIONS=Object.freeze({
  jo:Object.freeze([Object.freeze({id:'action.feint',label:'誘い'}),Object.freeze({id:'action.side-step',label:'外し歩'})]),
  ha:Object.freeze([Object.freeze({id:'action.guard-step',label:'受け流し歩法'}),Object.freeze({id:'action.counter',label:'返し'})]),
  kyu:Object.freeze([Object.freeze({id:'action.crash',label:'打ち崩し'}),Object.freeze({id:'action.precision',label:'一点通し'})])
});
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
const TECH_IDS=Object.fromEntries(PHASES.map(([phase])=>[phase,new Set(BATTLE2_TECHNIQUE_OPTIONS[phase].map(row=>row.id))]));
const clone=value=>JSON.parse(JSON.stringify(value));
const labelFor=(rows,id)=>rows.find(row=>row.id===id)?.label||id||'未設定';

export function normalizeBattle2Loadout(value={}){
  const heart=Array.isArray(value?.heart?.active)?value.heart.active.filter(id=>HEART_IDS.has(id)).slice(0,HEART_LIMIT):[];
  const active=[...new Set(heart.length?heart:BATTLE2_LOADOUT_DEFAULT.heart.active)];
  const technique=Object.fromEntries(PHASES.map(([phase])=>[phase,TECH_IDS[phase].has(value?.technique?.[phase])?value.technique[phase]:BATTLE2_LOADOUT_DEFAULT.technique[phase]]));
  const body={};
  for(const kind of ['stance','style','zanshin'])body[kind]=optionIds(kind).has(value?.body?.[kind])?value.body[kind]:BATTLE2_LOADOUT_DEFAULT.body[kind];
  const weapon=['sword','great'].includes(value?.equipment?.weapon)?value.equipment.weapon:'sword';
  return{heart:{active},technique,body,equipment:{weapon,shield:weapon==='sword'&&Boolean(value?.equipment?.shield)}};
}
export function battle2LoadoutKey(value){
  const row=normalizeBattle2Loadout(value);
  return[row.heart.active.join('.'),row.technique.jo,row.technique.ha,row.technique.kyu,row.body.stance,row.body.style,row.body.zanshin,row.equipment.weapon,row.equipment.shield?'shield':'bare'].join('~');
}
function readStored(){
  try{return normalizeBattle2Loadout(JSON.parse(globalThis.localStorage?.getItem(STORAGE_KEY)||'{}'));}catch{return normalizeBattle2Loadout();}
}
function writeStored(value){try{globalThis.localStorage?.setItem(STORAGE_KEY,JSON.stringify(value));}catch{}}
function choiceButton(label,meta,{active=false,group='',value='' }={}){
  return '<button type="button" class="battle2-loadout-choice" data-pick="'+value+'" data-group="'+group+'" data-active="'+String(active)+'"><strong>'+label+'</strong><small>'+meta+'</small></button>';
}

export function createBattle2LoadoutUI({stage,onChange=()=>{}}={}){
  if(!stage)throw new TypeError('battle2 stage required');
  let value=readStored(),section='',techniqueTarget='jo',bodyTarget='stance',equipmentTarget='weapon';
  const shell=document.createElement('div');shell.className='battle2-loadout-shell';
  shell.innerHTML='<nav class="rinne-bottom-controls rinne-primary-four battle2-loadout-nav" aria-label="心技体装">'+
    '<button data-heart class="upgrade-control is-heart" type="button"><i aria-hidden="true">心</i><span>心得</span></button>'+
    '<button data-techniques class="upgrade-control is-technique" type="button"><i aria-hidden="true">技</i><span>技</span></button>'+
    '<button data-body class="upgrade-control is-body" type="button"><i aria-hidden="true">体</i><span>身法</span></button>'+
    '<button data-items class="upgrade-control is-items" type="button"><i aria-hidden="true">装</i><span>武具</span></button>'+
    '</nav><section class="battle2-loadout-panel" hidden aria-live="polite"><header><div><small>百年転生 LOADOUT</small><strong data-loadout-title></strong></div><button type="button" data-loadout-close aria-label="閉じる">×</button></header><div data-loadout-body></div></section>';
  stage.append(shell);
  const nav=shell.querySelector('.battle2-loadout-nav'),panel=shell.querySelector('.battle2-loadout-panel'),title=panel.querySelector('[data-loadout-title]'),body=panel.querySelector('[data-loadout-body]');
  const navButtons={heart:nav.querySelector('[data-heart]'),technique:nav.querySelector('[data-techniques]'),body:nav.querySelector('[data-body]'),items:nav.querySelector('[data-items]')};
  const emit=()=>{value=normalizeBattle2Loadout(value);writeStored(value);onChange(clone(value));render();};
  const slotRow=(rows,activeKey,group)=>'<section class="battle2-loadout-slots">'+rows.map(row=>'<button type="button" data-slot="'+row.id+'" data-group="'+group+'" data-active="'+String(row.id===activeKey)+'"><span>'+row.label+'</span><strong>'+row.value+'</strong><small>'+row.meta+'</small></button>').join('')+'</section>';

  function renderHeart(){
    title.textContent='心 · 心得';
    const slots=[0,1,2].map(index=>({id:String(index),label:'心得 '+(index+1),value:labelFor(BATTLE2_HEART_OPTIONS,value.heart.active[index]),meta:'戦闘判断'}));
    body.innerHTML='<p class="battle2-loadout-lead">戦闘へ持ち込む心得を3つまで選ぶ</p>'+slotRow(slots,'','heart-slot')+
      '<section class="battle2-loadout-library"><header><strong>心得</strong><small>タップで装着 / 解除</small></header><div class="battle2-loadout-grid">'+
      BATTLE2_HEART_OPTIONS.map(row=>choiceButton(row.label,row.meta,{active:value.heart.active.includes(row.id),group:'heart',value:row.id})).join('')+'</div></section>';
  }
  function renderTechnique(){
    title.textContent='技 · 序破急';
    const slots=PHASES.map(([phase,label])=>({id:phase,label,value:labelFor(BATTLE2_TECHNIQUE_OPTIONS[phase],value.technique[phase]),meta:phase===techniqueTarget?'選択先':'装着中'}));
    const choices=BATTLE2_TECHNIQUE_OPTIONS[techniqueTarget];
    body.innerHTML='<p class="battle2-loadout-lead">序・破・急それぞれに実際の技仕様を装着</p>'+slotRow(slots,techniqueTarget,'technique-target')+
      '<section class="battle2-loadout-library"><header><strong>'+PHASES.find(row=>row[0]===techniqueTarget)[1]+'の技</strong><small>足運び込みで実戦へ反映</small></header><div class="battle2-loadout-grid">'+
      choices.map(row=>choiceButton(row.label,row.id,{active:value.technique[techniqueTarget]===row.id,group:'technique',value:row.id})).join('')+'</div></section>';
  }
  function renderBody(){
    title.textContent='体 · 身法';
    const labels={stance:'構え',style:'戦法',zanshin:'残心'};
    const slots=['stance','style','zanshin'].map(kind=>({id:kind,label:labels[kind],value:labelFor(BATTLE2_BODY_OPTIONS[kind],value.body[kind]),meta:kind===bodyTarget?'選択先':'装着中'}));
    const choices=BATTLE2_BODY_OPTIONS[bodyTarget];
    body.innerHTML='<p class="battle2-loadout-lead">構え・戦法・残心を戦闘テンポへ反映</p>'+slotRow(slots,bodyTarget,'body-target')+
      '<section class="battle2-loadout-library"><header><strong>'+labels[bodyTarget]+'</strong><small>百年転生の身体設定</small></header><div class="battle2-loadout-grid">'+
      choices.map(row=>choiceButton(row.label,row.meta,{active:value.body[bodyTarget]===row.id,group:'body',value:row.id})).join('')+'</div></section>';
  }
  function renderItems(){
    title.textContent='装 · 武具';
    const weaponLabel=value.equipment.weapon==='great'?'大剣':'剣',shieldLabel=value.equipment.shield?'盾あり':'盾なし';
    const slots=[{id:'weapon',label:'武器',value:weaponLabel,meta:equipmentTarget==='weapon'?'選択先':'装備中'},{id:'shield',label:'盾',value:shieldLabel,meta:equipmentTarget==='shield'?'選択先':'装備中'},{id:'armor',label:'防具',value:'重装',meta:'固定'}];
    const rows=equipmentTarget==='shield'?[{id:'off',label:'盾なし',meta:'両手を自由に'},{id:'on',label:'盾あり',meta:'片手剣のみ'}]:[{id:'sword',label:'剣',meta:'片手剣'},{id:'great',label:'大剣',meta:'両手武器'}];
    body.innerHTML='<p class="battle2-loadout-lead">装備変更は次の交換から即時反映</p>'+slotRow(slots,equipmentTarget,'equipment-target')+
      '<section class="battle2-loadout-library"><header><strong>'+(equipmentTarget==='shield'?'盾':'武器')+'</strong><small>レビュー用装備</small></header><div class="battle2-loadout-grid">'+
      rows.map(row=>choiceButton(row.label,row.meta,{active:equipmentTarget==='shield'?(value.equipment.shield===(row.id==='on')):value.equipment.weapon===row.id,group:'equipment',value:row.id})).join('')+'</div></section>';
  }
  function render(){
    for(const [key,node] of Object.entries(navButtons))node.dataset.active=String(section===key);
    panel.hidden=!section;if(!section)return;
    if(section==='heart')renderHeart();else if(section==='technique')renderTechnique();else if(section==='body')renderBody();else renderItems();
  }

  for(const [key,node] of Object.entries(navButtons))node.onclick=()=>{section=section===key?'':key;render();};
  panel.querySelector('[data-loadout-close]').onclick=()=>{section='';render();};
  panel.addEventListener('click',event=>{
    const target=event.target.closest('button');if(!target)return;
    const group=target.dataset.group,pick=target.dataset.pick,slot=target.dataset.slot;
    if(group==='technique-target'&&slot){techniqueTarget=slot;render();return;}
    if(group==='body-target'&&slot){bodyTarget=slot;render();return;}
    if(group==='equipment-target'&&slot&&slot!=='armor'){equipmentTarget=slot;render();return;}
    if(group==='heart'&&pick){
      const rows=[...value.heart.active],index=rows.indexOf(pick);
      if(index>=0)rows.splice(index,1);else if(rows.length<HEART_LIMIT)rows.push(pick);else rows.splice(0,1,pick);
      value.heart.active=rows;emit();return;
    }
    if(group==='technique'&&pick){value.technique[techniqueTarget]=pick;emit();return;}
    if(group==='body'&&pick){value.body[bodyTarget]=pick;emit();return;}
    if(group==='equipment'&&pick){
      if(equipmentTarget==='weapon'){value.equipment.weapon=pick;if(pick==='great')value.equipment.shield=false;}
      else value.equipment.shield=pick==='on'&&value.equipment.weapon==='sword';
      emit();
    }
  });
  render();
  return Object.freeze({get value(){return clone(value);},close(){section='';render();},destroy(){shell.remove();}});
}
