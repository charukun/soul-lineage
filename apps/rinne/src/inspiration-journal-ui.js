import { CAUSAL_ANSWER_BY_ID, INSPIRATION_KINDS } from '@soul/game-data';
import { ensureCombatLoadout, activeCombo, addCombo, removeCombo, setActiveCombo, setComboSkill, setHeartSlot, setBodyChoice, unlockedBodyOptions, learnedHeartSkills, learnedTechniqueSkills, techniqueName, PHASES, MAX_COMBOS } from './combat-loadout.js';
import { ensureInspiration, updateInspirationSigns, renameInspiration, archiveInspiration, answerAvailability, inspirationName } from './rebuild/inspiration-state.js';
import { tidebreakMindVectorFor } from './rebuild/combat-tactics.js';
import { inspirationJournalModel, equippedInspirationIds, canRenameInspiration, motifName } from './inspiration-journal-model.js';
import './inspiration-journal.css';

const PAGE=5;
const VIEWS=new Set(['record','heart','technique','body']);
const MIND=[['attack','攻勢','#b98662'],['guard','守り','#a7b596'],['spacing','間合い','#859bba'],['counter','反撃','#bc9fc0'],['mobility','機動','#83b7ad'],['survival','生存','#c7b883']];
const BODY_LABELS={reach:['間合い','長い間合いに馴染む','懐で動きやすい'],drive:['力のかけ方','重さを前へ伝える','小さな動きで合わせる'],balance:['重心','揺れから軸を戻す','足場を選んで支える'],endurance:['息持ち','息を残して続ける','休みを挟んで動く'],coordination:['身体のまとまり','細かな動きをつなぐ','ひとつずつ確かめる']};

export function installInspirationUI(ui,{gameScreen,audio}){
  const doc=gameScreen.ownerDocument,win=doc.defaultView||globalThis.window;
  const original={open:ui.open,refresh:ui.refresh,bindState:ui.bindState,dispose:ui.dispose};
  let state=null,lifeId=null,known=new Set(),stableKnown=new Map(),readySigns=new Set(),section='signs',page=0,heartSlot=0,phase='jo',focusId=null,renderKey='',noticeTimer=0,disposed=false;
  const listeners=[];
  const on=(node,type,fn,options)=>{node.addEventListener(type,fn,options);listeners.push(()=>node.removeEventListener(type,fn,options));};
  const el=(tag,text,cls)=>{const n=doc.createElement(tag);if(text!==undefined&&text!==null)n.textContent=String(text);if(cls)n.className=cls;return n;};
  const button=(text,fn,{disabled=false,label=null}={})=>{const b=el('button',text);b.type='button';b.disabled=disabled;if(label)b.setAttribute('aria-label',label);b.onclick=fn;return b;};
  const readonly=()=>Boolean(!state||state.ended||state.down||state.combat||gameScreen.querySelector('#game')?.dataset.coopPlayer||doc.getElementById('game')?.dataset.coopPlayer);
  const message=text=>{status.textContent=text;status.hidden=false;};
  const changed=()=>{audio?.item?.();renderKey='';render();};
  const status=el('p',null,'inspiration-status');status.setAttribute('role','status');status.hidden=true;
  const notice=el('aside',null,'inspiration-reveal');notice.hidden=true;notice.setAttribute('role','status');notice.setAttribute('aria-live','polite');notice.dataset.inspirationReveal='';
  const noticeKind=el('span'),noticeName=el('strong'),noticeOrigin=el('p'),noticeOpen=button('技譜へ',()=>{section='techniques';ui.open('record');notice.hidden=true;}),noticeClose=button('閉じる',()=>{notice.hidden=true;});
  notice.append(noticeKind,noticeName,noticeOrigin,noticeOpen,noticeClose);ui.root.append(notice);
  let signTimer=0;const signFloat=el('output',null,'inspiration-sign-float');signFloat.hidden=true;signFloat.setAttribute('role','status');signFloat.setAttribute('aria-live','polite');ui.root.append(signFloat);
  function showSignFloat(text){clearTimeout(signTimer);signFloat.hidden=true;signFloat.textContent=text;void signFloat.offsetWidth;signFloat.hidden=false;signTimer=setTimeout(()=>{signFloat.hidden=true;},2600);}

  function heading(title,copy){const header=el('header',null,'inspiration-heading');header.append(el('span',`${state.name} · ${Math.floor(state.ageYears)}歳`),el('h2',title),el('p',copy));return header;}
  function empty(text){return el('p',text,'inspiration-empty');}
  function pager(total){const count=Math.max(1,Math.ceil(total/PAGE));page=Math.min(page,count-1);if(count<=1)return null;const nav=el('nav',null,'inspiration-pager');nav.setAttribute('aria-label','記録のページ');nav.append(button('前へ',()=>{page--;render();},{disabled:page===0}),el('span',`${page+1} / ${count}`),button('次へ',()=>{page++;render();},{disabled:page>=count-1}));return nav;}
  function bodyTraits(model){const box=el('section',null,'inspiration-body-traits');box.append(el('h3','この身体の傾向'));for(const [key,labels]of Object.entries(BODY_LABELS)){const p=el('p');p.append(el('b',labels[0]),el('span',model.body[key]>1.04?labels[1]:model.body[key]<.96?labels[2]:'偏りの少ない身体'));box.append(p);}box.append(el('small','身体は答えの形を変える。血だけで技は会得しない。'));return box;}
  function mindPanel(){
    const v=tidebreakMindVectorFor(state),sum=MIND.reduce((n,[key])=>n+v[key],0)||1,box=el('section',null,'inspiration-mind'),pie=el('div',null,'inspiration-mind-disc'),labels=el('div');
    let cursor=0;const stops=[];for(const [key,label,color]of MIND){const start=cursor;cursor+=v[key]/sum*100;stops.push(`${color} ${start.toFixed(2)}% ${cursor.toFixed(2)}%`);const row=el('p');row.append(el('b',label),el('span',v[key]>.7?'強く向いている':v[key]>.45?'意識している':'控えめ'));labels.append(row);}
    pie.style.background=`conic-gradient(${stops.join(',')})`;pie.setAttribute('role','img');pie.setAttribute('aria-label','現在の意識バランス。隣の文章でも確認できます。');box.append(pie,labels);return box;
  }
  function provenance(details,rows){const list=el('ol',null,'inspiration-provenance');for(const p of rows){const li=el('li',p.text);li.dataset.origin=p.type;list.append(li);}details.append(list);}
  function selectAction(id){
    if(readonly()){message('戦闘を離れてから編成できます。共有世界の記録は閲覧専用です。');return;}
    const row=CAUSAL_ANSWER_BY_ID[id];
    if(row?.kind==='link')return useLink(id);
    if(ui.panel.dataset.type==='heart'){if(!setHeartSlot(state,heartSlot,id)){message('この枠には置けません。');return;}}
    else if(ui.panel.dataset.type==='technique'){const combo=activeCombo(state);if(!setComboSkill(state,combo.id,phase,id)){message('今の得物ではこの型を使えません。');return;}}
    else{focusId=id;ui.open(row?.kind==='body'?'body':row?.kind==='heart'?'heart':'technique');return;}
    changed();
  }
  function useLink(id){
    if(readonly())return;const r=state.inspiration.records[id],slots=r?.combo;if(!slots)return;
    for(const [p,skill]of Object.entries(slots)){const row=CAUSAL_ANSWER_BY_ID[skill];if(!PHASES.some(([id])=>id===p)||!state.knownSkills.includes(skill)||(row?.weapons.length&&!row.weapons.includes(state.equipment.weapon))){message('この連は、記録された得物と技が揃うと組めます。');return;}}
    const combo=addCombo(state);if(!combo){message('連の枠が一杯です。不要な編成を整理してください。');return;}
    combo.name=r.name;for(const [p,skill]of Object.entries(slots))setComboSkill(state,combo.id,p,skill);setActiveCombo(state,combo.id);ui.open('technique');audio?.item?.();
  }
  function recordCard(item,{manage=false}={}){
    const card=el('article',null,'inspiration-technique-card');card.dataset.inspirationId=item.id;card.dataset.focus=String(item.id===focusId);card.dataset.archived=String(item.archived);
    const top=el('header'),stateLabel=item.archived?'古技':item.stable?'定着':'会得';top.append(el('span',`${item.kindLabel} · ${stateLabel}`),el('small',`${Math.floor(item.age)}歳`));
    card.append(top,el('h3',item.name),el('p',item.story,'inspiration-causal-story'),el('p',item.purpose,'inspiration-purpose'),el('p',item.tradeoff,'inspiration-tradeoff'));
    const row=CAUSAL_ANSWER_BY_ID[item.id];if(row.steps.length)card.append(el('small',`役割適性: ${item.phases.map(p=>({jo:'序',ha:'破',kyu:'急'})[p]).join('・')}。適性は技の格ではありません。`));
    if(!item.availability.usable&&!state.ended)card.append(el('p',item.availability.reason,'inspiration-unavailable'));
    const detail=el('details');detail.append(el('summary','この答えが生まれた理由'));provenance(detail,item.provenance);card.append(detail);
    const actions=el('div',null,'inspiration-actions');
    if(row.kind==='body'&&row.bodyChoice){const choice=row.bodyChoice;actions.append(button('身法に取り入れる',()=>{if(setBodyChoice(state,choice.kind,choice.id))changed();},{disabled:readonly()||item.archived}));}
    else if(row.kind==='link')actions.append(button('この連を編成する',()=>useLink(item.id),{disabled:readonly()||item.archived}));
    else actions.append(button(ui.panel.dataset.type==='heart'?`心の${heartSlot+1}枠へ`:ui.panel.dataset.type==='technique'?`${({jo:'序',ha:'破',kyu:'急'})[phase]}へ組む`:'編成へ',()=>selectAction(item.id),{disabled:readonly()||item.archived||(row.weapons.length&&!row.weapons.includes(state.equipment.weapon))}));
    card.append(actions);
    if(manage){
      const edit=el('details');edit.append(el('summary','名前と保管'));const form=el('form',null,'inspiration-rename'),label=el('label','技の呼び名'),input=el('input');input.value=item.name;input.maxLength=24;input.disabled=readonly();input.setAttribute('aria-label',`${item.name}の呼び名`);label.append(input);const submit=el('button','名を記す');submit.type='submit';submit.disabled=readonly();form.append(label,submit);
      form.onsubmit=e=>{e.preventDefault();if(readonly())return;if(!canRenameInspiration(state,item.id,input.value)){message('ほかの技と重ならない、24文字以内の名前を付けてください。');return;}renameInspiration(state,item.id,input.value);changed();};edit.append(form);
      const equipped=equippedInspirationIds(state).has(item.id);edit.append(button(item.archived?'現役へ戻す':'古技として収める',()=>{if(readonly()||equipped)return;archiveInspiration(state,item.id,!item.archived);changed();},{disabled:readonly()||equipped}));if(equipped)edit.append(el('small','編成中の技は、その枠から外してから保管できます。'));card.append(edit);
    }
    return card;
  }
  function basicCard(id){const card=el('article',null,'inspiration-technique-card');card.append(el('span','基礎'),el('h3',techniqueName(id,state)),el('p','得物を使うための基本の型。閃きとして数えません。'));card.append(button(`${({jo:'序',ha:'破',kyu:'急'})[phase]}へ組む`,()=>selectAction(id),{disabled:readonly()}));return card;}
  function legacyCard(id){const card=el('article',null,'inspiration-technique-card');card.dataset.legacyId=id;card.append(el('span','移行前からの技'),el('h3',techniqueName(id,state)),el('p','以前の保存で習得・編成していた技。会得の出来事は記録されていません。'));card.append(button('選択した枠へ',()=>selectAction(id),{disabled:readonly()}));return card;}
  function familyList(model,filter=null,manage=false){
    const groups=model.families.map(f=>({...f,variants:f.variants.filter(v=>!filter||filter(v))})).filter(f=>f.variants.length),wrap=el('div',null,'inspiration-families'),nav=pager(groups.length);page=Math.min(page,Math.max(0,Math.ceil(groups.length/PAGE)-1));
    for(const f of groups.slice(page*PAGE,page*PAGE+PAGE)){const family=el('section',null,'inspiration-family');family.dataset.family=f.id;if(f.variants.length>1)family.append(el('p','同じ技脈から生まれた型','inspiration-family-caption'));for(const item of f.variants)family.append(recordCard(item,{manage}));wrap.append(family);}
    if(!groups.length)wrap.append(empty('まだ形になった答えはありません。暮らしや稽古で、違う手掛かりに触れてみてください。'));
    if(nav)wrap.append(nav);return wrap;
  }
  function renderSigns(model,root){
    root.append(heading('まだ、名のない感覚','繰り返しの回数ではなく、経験のつながりを見つめる。'));
    if(!model.signs.length)root.append(empty('今は世界を知る時期。遊び、見学、手入れ、稽古。それぞれ違う経験が残ります。'));
    for(const sign of model.signs){const card=el('article',null,'inspiration-sign');card.append(el('span',`${Math.floor(sign.age)}歳からの問い`),el('h3',sign.text),el('p',sign.hint));root.append(card);}
    root.append(el('p','命を危険にさらす必要はありません。瀕死や同じ相手への反復では、閃きを買えません。','inspiration-footnote'));
  }
  function renderLife(model,root){
    root.append(heading('今生の足跡','技になる前の経験にも、その人だけの場所がある。'));
    const clock=doc.getElementById('clock-rate'),controls=el('div',null,'inspiration-actions');for(const rate of [1,5,10,20]){const b=button(`${rate}×`,()=>{clock.value=String(rate);clock.textContent=`${rate}×`;clock.onchange?.({target:clock});render();},{disabled:!clock||clock.disabled});b.dataset.active=String(state.clockRate===rate);controls.append(b);}root.append(el('h3','人生の時計'),controls,el('small','時間倍率だけでは、新しい経験や閃きは増えません。'));
    const nav=pager(model.traces.length);if(!model.traces.length)root.append(empty('まだ記録はありません。村での実際の行動から足跡が残ります。'));
    for(const trace of model.traces.slice(page*PAGE,page*PAGE+PAGE)){const article=el('article',null,'inspiration-life-trace');article.append(el('span',`${Math.floor(trace.age)}歳 · ${trace.place}`),el('h3',trace.text),el('p',trace.motifs.map(motifName).join('・')));root.append(article);}if(nav)root.append(nav);
  }
  function renderLineage(model,root){
    root.append(heading('姿ではなく、解き方を継ぐ','受け継ぐのは身体の傾向と技脈。誰かの技が、そのまま手に入るわけではない。'),bodyTraits(model));
    if(model.heritage.length){const list=el('section',null,'inspiration-heritage');list.append(el('h3','今の身体に残る技脈'));for(const h of model.heritage.slice(0,5)){const p=el('p');p.append(el('b',h.label),el('span',`${h.sourceName||'先代'} · ${h.generation}代目`));list.append(p);}root.append(list);}else root.append(empty('まだ受け継いだ技脈はありません。この人生の経験から、一族の最初の答えが生まれます。'));
    const rows=[...(state.lineage||[])].reverse(),nav=pager(rows.length);for(const ancestor of rows.slice(page*PAGE,page*PAGE+PAGE)){const card=el('article',null,'inspiration-ancestor');card.append(el('span',`${ancestor.generation}代目 · ${ancestor.age}歳まで`),el('h3',ancestor.name||'旅人'));const imprint=ancestor.inspirationImprint;card.append(el('p',imprint?.motifs?.length?imprint.motifs.map(m=>motifName(m.id)).join('・'):'この世代には技脈の記録がありません。'));const techniques=imprint?.techniques||[];if(techniques.length){const d=el('details');d.append(el('summary','この生涯の技譜'));for(const t of techniques){d.append(el('h4',t.name),el('p',`${Math.floor(t.age)}歳 · ${(t.origin||[]).join(' / ')}`));}card.append(d);}root.append(card);}if(nav)root.append(nav);
    if(model.earlierGenerations)root.append(el('small',`さらに前の${model.earlierGenerations}世代は、残響として要約されています。`));root.append(el('p','系譜の記録と、目の前で教わった記録は別々です。会っていない祖先の記憶を、見たことにはしません。','inspiration-footnote'));
  }
  function renderHeart(model,root){
    root.append(heading('心に置くもの','何を大切に戦うか。意識は今の判断であり、経験値ではない。'),mindPanel());
    const slots=el('div',null,'inspiration-slots');for(let i=0;i<3;i++){const id=state.combatLoadout.heart.active[i],b=button(`${i+1} · ${id?techniqueName(id,state):'空き'}`,()=>{heartSlot=i;render();});b.dataset.active=String(i===heartSlot);b.dataset.heartSlot=String(i);slots.append(b);}root.append(slots,button('選んだ枠を空ける',()=>{setHeartSlot(state,heartSlot,null);changed();},{disabled:readonly()}));
    root.append(familyList(model,item=>item.kind==='heart'&&!item.archived));
    for(const id of learnedHeartSkills(state).filter(id=>state.inspiration.legacySkills.includes(id)))root.append(legacyCard(id));
  }
  function renderTechnique(model,root){
    root.append(heading('三手に、生き方が出る','序で探り、破で変え、急で収める。技の格ではなく、連の役割。'));
    const l=state.combatLoadout.technique,combo=activeCombo(state),nav=el('div',null,'inspiration-combo-nav'),select=el('select');select.setAttribute('aria-label','主軸の連');select.disabled=readonly();
    for(const c of l.combos){const o=el('option',c.name);o.value=c.id;o.selected=c.id===combo.id;select.append(o);}select.onchange=()=>{setActiveCombo(state,select.value);changed();};
    nav.append(select,button('連を追加',()=>{const c=addCombo(state);if(c)setActiveCombo(state,c.id);changed();},{disabled:readonly()||l.combos.length>=MAX_COMBOS}),button('この連を外す',()=>{removeCombo(state,combo.id);changed();},{disabled:readonly()||l.combos.length<2}));root.append(nav);
    const slots=el('div',null,'inspiration-slots');for(const [id,label]of PHASES){const b=button(`${label} · ${techniqueName(combo.slots[id],state)}`,()=>{phase=id;render();});b.dataset.active=String(phase===id);b.dataset.techniquePhase=id;slots.append(b);}root.append(slots,el('p',`${({jo:'序',ha:'破',kyu:'急'})[phase]}へ組む技を選択。使わない型も、技譜から失われません。`));
    root.append(basicCard(`basic.${state.equipment.weapon}`),familyList(model,item=>['technique','variant'].includes(item.kind)&&!item.archived));
    for(const id of learnedTechniqueSkills(state).filter(id=>state.inspiration.legacySkills.includes(id)))root.append(legacyCard(id));
  }
  function renderBody(model,root){
    root.append(heading('この身体で、どう応じるか','年齢や負傷で使える動きは変わる。知った技まで消えるわけではない。'),bodyTraits(model));
    for(const [kind,label]of [['stance','構え'],['style','戦法'],['zanshin','残心']]){const box=el('section',null,'inspiration-body-options');box.append(el('h3',label));for(const option of unlockedBodyOptions(state,kind)){const b=button(`${option.label} · ${option.description}`,()=>{setBodyChoice(state,kind,option.id);changed();},{disabled:readonly()});b.dataset.active=String(state.combatLoadout.body[kind]===option.id);box.append(b);}root.append(box);}
    root.append(familyList(model,item=>item.kind==='body'&&!item.archived));
  }
  function render(){
    if(disposed||!state||ui.panel.hidden||!VIEWS.has(ui.panel.dataset.type))return;
    ensureCombatLoadout(state);const type=ui.panel.dataset.type,model=inspirationJournalModel(state),root=el('div',null,'inspiration-journal');root.dataset.inspirationView=type;ui.title.textContent=({record:'譜 · 人生と技脈',heart:'心 · 意識と心得',technique:'技 · 序破急',body:'体 · 身体と身法'})[type];
    ui.body.replaceChildren(root);if(type==='record'){
      const tabs=el('nav',null,'inspiration-tabs');tabs.setAttribute('aria-label','技譜の分類');for(const [id,label]of [['signs','兆し'],['techniques','技譜'],['life','今生'],['lineage','系譜']]){const b=button(label,()=>{section=id;page=0;focusId=null;render();});b.dataset.active=String(section===id);b.dataset.inspirationTab=id;b.setAttribute('aria-current',section===id?'page':'false');tabs.append(b);}root.append(tabs);
      if(section==='signs')renderSigns(model,root);else if(section==='life')renderLife(model,root);else if(section==='lineage')renderLineage(model,root);else{root.append(heading('この人が見つけた答え',`${model.families.length}の技脈。派生は同じ系統に収め、数だけを増やさない。`),familyList(model,null,true));if(model.legacySkills.length)root.append(el('p',`移行前からの${model.legacySkills.length}の技は、心・技の編成画面から使えます。`));}
    }else if(type==='heart')renderHeart(model,root);else if(type==='technique')renderTechnique(model,root);else renderBody(model,root);
    if(readonly())root.append(el('p',state.ended?'この生涯の記録を読んでいます。':state.combat?'戦闘中は閲覧できます。編成は戦闘を離れてから。':'共有世界の編成変更は閲覧専用です。','inspiration-readonly'));
    status.hidden=true;root.append(status);onInputKey(root);
  }
  function onInputKey(root){root.addEventListener('keydown',e=>{if(e.target.closest('input,textarea,select'))e.stopPropagation();});}
  function announce(record){
    const row=CAUSAL_ANSWER_BY_ID[record.answerId];noticeKind.textContent=`閃き · ${INSPIRATION_KINDS[record.kind]}`;noticeName.textContent=record.name;noticeOrigin.textContent=record.provenance.find(p=>p.type==='question')?.text||row?.mechanic||'経験がひとつの答えになった。';notice.hidden=false;notice.dataset.kind=record.kind;audio?.item?.();clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>{notice.hidden=true;},6500);
  }
  function announceStabilized(record){
    noticeKind.textContent='定着';noticeName.textContent=record.name;noticeOrigin.textContent=`${record.name}が、身体に馴染んだ。`;notice.hidden=false;notice.dataset.kind='stable';audio?.item?.();clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>{notice.hidden=true;},5200);
  }
  function enhanceInheritance(){
    const dialog=doc.querySelector('.life-end-dialog'),keep=dialog?.querySelector('[data-keep]'),reset=dialog?.querySelector('[data-reset]');if(!state||!dialog||!keep||dialog.dataset.inspirationLife===state.id)return;
    dialog.dataset.inspirationLife=state.id;keep.replaceChildren(...['一族の記録と帰還した故郷','身体の傾向と、この人生が刻んだ技脈','実際に見聞きした経験は、本人の技譜に残る'].map(text=>el('li',text)));
    if(reset)reset.replaceChildren(...['年齢・体力・装備は新しい人生へ','技そのものと戦技編成はコピーされない'].map(text=>el('li',text)));
  }
  ui.open=(type,options={})=>{if(VIEWS.has(type)){page=0;focusId=options.skillId||focusId;}original.open(type,options);if(VIEWS.has(type))render();};
  ui.refresh=()=>{original.refresh();render();};
  ui.bindState=next=>{
    original.bindState(next);state=next;if(!state)return;const s=ensureInspiration(state),ids=Object.keys(s.records);
    const currentSigns=updateInspirationSigns(state),currentReady=new Set(currentSigns.filter(row=>row.ready).map(row=>row.question));
    if(lifeId!==state.id){lifeId=state.id;known=new Set(ids);stableKnown=new Map(ids.map(id=>[id,Boolean(s.records[id].stable)]));readySigns=currentReady;page=0;section='signs';notice.hidden=true;signFloat.hidden=true;renderKey='';}
    else{for(const id of ids){if(!known.has(id)){known.add(id);stableKnown.set(id,Boolean(s.records[id].stable));announce(s.records[id]);continue;}if(s.records[id].stable&&!stableKnown.get(id)){stableKnown.set(id,true);announceStabilized(s.records[id]);}}for(const sign of currentSigns)if(sign.ready&&!readySigns.has(sign.question)){showSignFloat(sign.text);break;}readySigns=currentReady;}
    ui.record.dataset.hasSign=String(Object.keys(s.questions).length>0);ui.record.setAttribute('aria-label','兆し・技譜・人生・系譜を開く');
    const key=[lifeId,s.revision,Math.floor(state.ageYears),state.equipment.weapon,Boolean(state.combat),Boolean(state.down),state.ended].join(':');
    if(renderKey!==key){renderKey=key;if(!ui.body.contains(doc.activeElement)||!doc.activeElement?.matches('input,textarea'))render();}
    enhanceInheritance();
  };
  for(const [node,type]of [[ui.record,'record'],[ui.heart,'heart'],[ui.techniques,'technique'],[ui.bodyButton,'body']])node.onclick=()=>{if(!ui.panel.hidden&&ui.panel.dataset.type===type)ui.close();else ui.open(type);};
  const glyph=ui.record.querySelector('b'),caption=ui.record.querySelector('small');if(glyph)glyph.textContent='譜';if(caption)caption.textContent='技譜';
  const observer=new win.MutationObserver(enhanceInheritance);observer.observe(doc.body,{childList:true,subtree:true});
  ui.dispose=()=>{disposed=true;clearTimeout(noticeTimer);clearTimeout(signTimer);observer.disconnect();for(const off of listeners)off();notice.remove();signFloat.remove();original.dispose();};
  return ui;
}
