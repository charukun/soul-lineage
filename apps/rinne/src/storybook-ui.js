import {BOOK_PAGES,BOOK_BODY,BOOK_TRAITS,buildStorybookModel,storybookRowLock} from './storybook-model.js';
import {setHeartSlot,setComboSkill,setBodyChoice,setActiveCombo,addCombo,removeCombo,activeCombo,toggleFavored,setOneMotion,learnedTechniqueSkills,techniqueName,MAX_COMBOS} from './combat-loadout.js';
import {RINNE_UI_VERSION} from './ui-version.js';
import './storybook-ui.css';
import './storybook-polish.css';
import './storybook-calibration.css';

const PAGE_SIZE=12;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const asset=name=>`${import.meta.env.BASE_URL}ui/storybook/${encodeURIComponent(name)}.webp`;
const art=(name,cls='',alt='')=>`<img class="${cls}" src="${asset(name)}" alt="${esc(alt)}" draggable="false">`;
const action=(key,label,disabled=false,cls='')=>`<button type="button" class="${cls}" data-book-action="${key}" ${disabled?'disabled':''}>${label}</button>`;
const pageIcon=page=>({heart:'heart',technique:'wind',body:'stance',items:'sword'})[page];
const defaults=key=>({slot:key==='heart'?0:key==='technique'?'jo':key==='body'?'stance':'weapon',category:'all',filter:'all',query:'',sort:'learned',id:null,page:0});

/** The reference provides artwork, not invented rules. Every write uses the existing game setter. */
export function installStorybookUI(ui,{gameScreen,audio,requestEquip}){
  const doc=gameScreen.ownerDocument;
  const previous={open:ui.open,close:ui.close,bindState:ui.bindState,refresh:ui.refresh,dispose:ui.dispose};
  const views=Object.keys(BOOK_PAGES),selection=Object.fromEntries(views.map(key=>[key,defaults(key)]));
  let state=null,disposed=false,renderKey='',lifeKey='',status='',help=false;
  const isCore=()=>!ui.panel.hidden&&views.includes(ui.panel.dataset.type);
  const coop=()=>Boolean(doc.getElementById('game')?.dataset.coopPlayer);
  function cleanup(){delete ui.panel.dataset.storybook;delete gameScreen.dataset.storybookOpen;delete ui.root.dataset.storybookOpen;help=false;}
  const currentModel=()=>buildStorybookModel(state,ui.panel.dataset.type,{...selection[ui.panel.dataset.type],coop:coop()});
  function update(message=''){status=message;audio?.ui?.();renderKey='';render();}
  function mutate(fn,message){
    const model=currentModel();if(model.readonly){update(model.readonly);return;}
    if(fn()===false){update('この設定は適用できません。');return;}
    audio?.item?.();gameScreen.dispatchEvent(new CustomEvent('rinne:loadout-changed',{detail:{page:model.page}}));update(message);
  }
  function choose(id){
    const model=currentModel(),s=selection[model.page],row=model.allRows.find(r=>r.id===id);
    if(!row)return;s.id=id;if(row.category)s.slot=row.category;status='';render({resetDetail:true});
  }
  function apply(remove=false){
    const model=currentModel(),s=selection[model.page],row=model.allRows.find(r=>r.id===s.id),reason=remove?model.readonly:storybookRowLock(model,row);
    if(reason){update(reason);return;}
    if(model.page==='heart')mutate(()=>setHeartSlot(state,s.slot,remove?null:row.id),remove?'心得を外しました。':'心得を心の枠に置きました。');
    else if(model.page==='technique')mutate(()=>setComboSkill(state,activeCombo(state).id,s.slot,remove?`basic.${state.equipment.weapon}`:row.id),'連技の編成を更新しました。');
    else if(model.page==='body')mutate(()=>setBodyChoice(state,row.category,row.choice),'身法を更新しました。');
    else{
      const kind=remove?s.slot:row.category,value=remove?({weapon:'fist',armor:'cloth',shield:false})[kind]:row.value;
      const result=requestEquip?.(kind,value)||{ok:false,reason:'いまは武具を変更できません。'};
      if(!result.ok){update(result.reason);return;}audio?.item?.();update(result.changed?'武具を変更しました。':'すでに装備しています。');
    }
  }
  function mind(model,row){
    let preview=model,changed=false;
    if(row?.known&&!model.readonly){const copy=structuredClone(state);if(setHeartSlot(copy,selection.heart.slot,row.id)){preview=buildStorybookModel(copy,'heart');changed=preview.mind.some((v,i)=>Math.abs(v.value-model.mind[i].value)>.0001);}}
    let cursor=0;const colors=['#bd886d','#a5bb97','#89aeca','#c0a3c7','#8bb9ae','#d6bf7d'];
    const stops=preview.mind.map((v,i)=>{const a=cursor;cursor+=v.value*100;return `${colors[i]} ${a}% ${cursor}%`;});
    return `<h3>${changed?'セット後の意識バランス':'現在の意識バランス'}</h3><div class="rb-mind" aria-label="意識バランスの比較"><div role="img" aria-label="意識バランス" style="background:conic-gradient(${stops.join(',')})"></div><dl>${preview.mind.map((v,i)=>`<div><dt>${v.label}</dt><dd>${changed?`<s>${Math.round(model.mind[i].value*100)}%</s> `:''}${Math.round(v.value*100)}%</dd></div>`).join('')}</dl></div>`;
  }
  function bodyChart(model){
    const axes=BOOK_TRAITS.map(([key,label],i)=>{const a=(i*72-90)*Math.PI/180,r=Math.max(.35,Math.min(1.25,Number(model.body[key])||1))*.7;return {label,value:model.body[key]||1,x:50+40*Math.cos(a)*r,y:50+40*Math.sin(a)*r};});
    return `<section class="rb-body-chart"><h3>現在の身体の傾向</h3><div><svg viewBox="0 0 100 100" role="img" aria-label="身体の傾向。生来の標準を100として表示"><path d="M50 10L88 38L73 82L27 82L12 38Z M50 30L69 44L61 66L39 66L31 44Z" fill="none" stroke="#b89e75" stroke-width=".7"/><polygon points="${axes.map(v=>`${v.x},${v.y}`).join(' ')}" fill="#bba9d6aa" stroke="#9682bb" stroke-width="1"/>${axes.map(v=>`<circle cx="${v.x}" cy="${v.y}" r="1.5" fill="#8772ad"/>`).join('')}</svg><dl>${axes.map(v=>`<div><dt>${v.label}</dt><dd>${Math.round(v.value*100)}</dd></div>`).join('')}</dl></div><small>生来の傾向 · 標準100</small></section>`;
  }
  function slotMarkup(model,s){return `<button type="button" class="rb-slot" data-book-slot="${s.key}" aria-pressed="${String(s.key)===String(selection[model.page].slot)}"><span class="rb-slot-label">${esc(s.label)}</span>${s.row?art('icon-'+s.row.icon,'rb-slot-art'):art('icon-'+pageIcon(model.page),'rb-slot-art rb-quiet')}<strong>${esc(s.row?.name||'まだ空いています')}</strong><small>${esc(s.row?.purpose||'会得した心得をここに置く')}</small><span class="rb-change">↻ 変更</span></button>`;}
  function selectedDetail(model,row){
    if(!row)return `<article class="rb-detail rb-empty-detail"><div class="rb-detail-picture">${art(model.page+'-hero','rb-detail-art')}</div><div class="rb-detail-copy"><h2>これからの旅で</h2><p>まだ習得したものがありません。</p><p>暮らし、見学、稽古で得た経験が、この人生の心得や技になります。</p></div><footer>${action('signs','兆しを確かめる',false,'rb-primary')}</footer></article>`;
    const lock=storybookRowLock(model,row),equipped=model.equipped.has(row.id),target=model.slots.find(v=>String(v.key)===String(selection[model.page].slot))||model.slots[0];
    const call=model.page==='heart'?`${target.label}に置く`:model.page==='technique'?`${target.label}に組む`:model.page==='body'?'この身法を使う':'装備する';
    let details='';
    if(model.page==='heart')details=mind(model,row);
    if(model.page==='body')details=`<h3>身法の働き</h3><dl class="rb-facts">${row.facts.map(v=>{const old=target.row?.facts?.find(f=>f.key===v.key);return `<div><dt>${esc(v.label)}</dt><dd>${old&&old.value!==v.value?`<s>${esc(old.value)}</s> → `:''}${esc(v.value)}</dd></div>`;}).join('')}</dl>`;
    if(model.page==='technique')details=`<h3>連の中での役割</h3><p>${row.phases.length?row.phases.map(p=>({jo:'序',ha:'破',kyu:'急'})[p]).join('・'):'基礎の動作'}${row.weapons.length?' / '+row.weapons.map(v=>({sword:'片手剣',fist:'素手',staff:'杖',great:'大剣',spear:'槍',axe:'戦斧',dagger:'短剣'})[v]||v).join('・'):''}</p><small>序破急は技の格ではなく、連の役割です。</small>`;
    if(model.page==='items')details=`<h3>装備の比較</h3><dl class="rb-facts"><div><dt>いま</dt><dd>${esc(target.row?.name||'なし')}</dd></div><div><dt>選択中</dt><dd>${esc(row.name)}</dd></div></dl><p class="rb-constraint">武具の変更は7歳から。村の武具置き場の近くで。</p>`;
    const removeDisabled=Boolean(model.readonly||(model.page==='items'&&model.age<7));
    return `<article class="rb-detail"><div class="rb-detail-picture" data-gear="${model.page==='items'}">${art(model.page==='items'?'icon-'+row.icon:model.page+'-hero','rb-detail-art')}<span class="rb-ribbon">${equipped?'設定中':esc(row.status)}</span></div><div class="rb-detail-copy"><h2>${esc(row.name)}</h2><p>${esc(row.purpose)}</p>${row.tradeoff?`<p class="rb-tradeoff">${esc(row.tradeoff)}</p>`:''}${details}<details class="rb-origin"><summary>${model.page==='items'?'この武具について':'この人生で生まれた理由'}</summary><p>${esc(row.story)}</p>${(row.provenance||[]).map(p=>`<p>${esc(p.text)}</p>`).join('')}</details></div><footer><p class="rb-lock" ${lock?'':'hidden'}>${esc(lock)}</p>${['heart','technique','items'].includes(model.page)?action('remove','はずす',removeDisabled,'rb-secondary'):''}${action('equip',esc(call)+' ›',Boolean(lock),'rb-primary')}</footer></article>`;
  }
  function render({resetDetail=false}={}){
    if(disposed||!state||!isCore())return;
    const scroll={library:ui.body.querySelector('.rb-library')?.scrollTop||0,detail:resetDetail?0:ui.body.querySelector('.rb-detail-copy')?.scrollTop||0};
    const model=currentModel(),s=selection[model.page];
    if(!model.allRows.some(r=>r.id===s.id))s.id=model.selectedSlot.id||model.rows[0]?.id||null;
    const row=model.allRows.find(r=>r.id===s.id),pages=Math.max(1,Math.ceil(model.rows.length/PAGE_SIZE));s.page=Math.min(s.page,pages-1);
    const subset=model.rows.slice(s.page*PAGE_SIZE,(s.page+1)*PAGE_SIZE),categories=model.page==='body'?BOOK_BODY.map(([k,v])=>[k,v]):model.page==='items'?[['weapon','武器'],['armor','防具'],['shield','盾']]:[];
    ui.panel.dataset.storybook='true';ui.panel.setAttribute('role','region');ui.panel.removeAttribute('aria-modal');gameScreen.dataset.storybookOpen='true';ui.root.dataset.storybookOpen='true';
    ui.title.textContent=`${model.glyph} · ${model.title}`;
    ui.body.innerHTML=`<section class="rb-page" data-book-page="${model.page}" aria-label="${model.glyph}・${model.title}"><div class="rb-scenery"></div><div class="rb-layout"><header class="rb-masthead">${art('masthead-'+model.page,'rb-masthead-art','百年転生。一人の人生が終わっても、世界と血は続く。')}<div class="rb-person"><small>${model.generation}代目</small><b>${model.age}歳</b><span>${esc(model.name)}</span></div></header><section class="rb-book"><header class="rb-book-head">${art('crest-'+model.page,'rb-crest')}<div><h1>${model.title}</h1><p>${model.subtitle}</p></div>${action('help','▤ '+model.glyph+'の解説',false,'rb-help')}${action('close','×',false,'rb-close')}</header><section class="rb-current"><div class="rb-section-bar"><h2>${model.section}</h2><small>${model.hint}</small>${model.page==='technique'?`<select aria-label="主軸の連" data-book-combo>${model.combos.map(c=>`<option value="${esc(c.id)}" ${c.id===model.combo.id?'selected':''}>${esc(c.name)}</option>`).join('')}</select>`:''}</div><div class="rb-slots">${model.slots.map(slot=>slotMarkup(model,slot)).join('')}</div></section><section class="rb-main"><div class="rb-library">${model.page==='body'?bodyChart(model):''}<nav class="rb-filters" aria-label="一覧の絞り込み">${(categories.length?[['all','すべて'],...categories]:[['all','すべて'],['learned','習得済'],['unlearned','未習得']]).map(([id,label])=>`<button type="button" data-book-filter="${id}" aria-pressed="${(categories.length?s.category:s.filter)===id}">${label}</button>`).join('')}</nav><div class="rb-library-tools"><label><span class="rb-sr">名前で探す</span><input data-book-search placeholder="名前で探す" value="${esc(s.query)}"></label><select data-book-sort aria-label="並び順"><option value="learned" ${s.sort==='learned'?'selected':''}>習得順</option><option value="name" ${s.sort==='name'?'selected':''}>名前順</option><option value="equipped" ${s.sort==='equipped'?'selected':''}>設定中</option></select></div><div class="rb-grid">${subset.map(r=>`<button type="button" class="rb-tile" data-book-id="${esc(r.id)}" aria-pressed="${r.id===s.id}" ${!r.known?'data-locked="true"':''}>${art('icon-'+r.icon)}${model.equipped.has(r.id)?'<span class="rb-equipped">設定中</span>':''}<strong>${r.known?esc(r.name):'未習得'}</strong><small>${r.known?esc(r.categoryLabel||r.status):'これからの経験で'}</small></button>`).join('')||'<p class="rb-empty">ここにはまだ記録がありません。<br>見学や稽古で、違う経験に触れてみよう。</p>'}</div><nav class="rb-pager" aria-label="一覧のページ">${action('prev','‹',s.page===0)}<span>${s.page+1} / ${pages}　${model.rows.length}件</span>${action('next','›',s.page>=pages-1)}</nav></div>${selectedDetail(model,row)}</section>${model.page==='technique'?`<section class="rb-signs"><strong>閃きの兆し</strong><p>${esc(model.signs[0]?.hint||'暮らしや稽古で、異なる経験を重ねよう。')}</p>${action('signs','兆しを見る ›')}</section>`:''}<output class="rb-status" role="status" aria-live="polite">${esc(status||model.readonly)}</output></section><footer class="rb-space" aria-hidden="true"></footer></div><small class="rb-version">UI ${RINNE_UI_VERSION}</small>${help?helpMarkup(model):''}</section>`;
    for(const b of ui.body.querySelectorAll('[data-book-id]'))b.onclick=()=>choose(b.dataset.bookId);
    for(const b of ui.body.querySelectorAll('[data-book-slot]'))b.onclick=()=>{s.slot=model.page==='heart'?Number(b.dataset.bookSlot):b.dataset.bookSlot;const found=model.slots.find(v=>String(v.key)===String(s.slot));s.id=found?.id||s.id;if(categories.length)s.category=String(s.slot);s.page=0;update();};
    for(const b of ui.body.querySelectorAll('[data-book-filter]'))b.onclick=()=>{s[categories.length?'category':'filter']=b.dataset.bookFilter;s.page=0;update();};
    const search=ui.body.querySelector('[data-book-search]');search.onchange=()=>{s.query=search.value.trim();s.page=0;update();};
    ui.body.querySelector('[data-book-sort]').onchange=e=>{s.sort=e.target.value;s.page=0;update();};
    const combo=ui.body.querySelector('[data-book-combo]');if(combo){combo.disabled=Boolean(model.readonly);combo.onchange=()=>mutate(()=>setActiveCombo(state,combo.value),'主軸の連を変更しました。');}
    const one=ui.body.querySelector('[data-book-one-motion]');if(one)one.onchange=()=>mutate(()=>setOneMotion(state,one.value||null),'手動奥義を変更しました。');
    for(const b of ui.body.querySelectorAll('[data-book-action]'))b.onclick=()=>{
      const a=b.dataset.bookAction;
      if(a==='close')ui.close();else if(a==='equip')apply();else if(a==='remove')apply(true);else if(a==='help'){help=!help;render();}else if(a==='signs'){cleanup();ui.open('record');}else if(a==='prev'||a==='next'){s.page+=a==='prev'?-1:1;render();}else if(a==='add-combo')mutate(()=>{const c=addCombo(state);return c&&setActiveCombo(state,c.id);},'連を追加しました。');else if(a==='remove-combo')mutate(()=>removeCombo(state,model.combo.id),'連を外しました。');else if(a.startsWith('favored-'))mutate(()=>{toggleFavored(state,model.combo.id,a.slice(8));return true;},'得意技の設定を更新しました。');
    };
    ui.body.querySelector('.rb-library').scrollTop=scroll.library;
    const detail=ui.body.querySelector('.rb-detail-copy');if(detail)detail.scrollTop=scroll.detail;
  }
  function helpMarkup(model){return `<aside class="rb-help-dialog" role="dialog" aria-label="${model.glyph}の解説"><h2>${model.glyph}・${model.title}</h2><p>${model.hint}</p><p>上の枠を選び、一覧から候補を確認します。効果を見比べ、確定ボタンで反映します。候補を見ただけでは変更されません。</p>${model.page==='technique'?`<div class="rb-extra">${action('add-combo','連を追加',model.combos.length>=MAX_COMBOS||Boolean(model.readonly))}${action('remove-combo','この連を外す',model.combos.length<2||Boolean(model.readonly))}${['jo','ha','kyu'].map(p=>action('favored-'+p,({jo:'序',ha:'破',kyu:'急'})[p]+'を得意技にする',Boolean(model.readonly))).join('')}<label>手動奥義<select data-book-one-motion ${model.readonly?'disabled':''}><option value="">使わない</option>${learnedTechniqueSkills(state,{oneMotion:true}).map(id=>`<option value="${esc(id)}" ${id===model.oneMotion?'selected':''}>${esc(techniqueName(id,state))}</option>`).join('')}</select></label></div>`:''}${action('help','閉じる',false,'rb-primary')}</aside>`;}
  ui.open=(type,options={})=>{if(!views.includes(type))cleanup();previous.open(type,options);if(views.includes(type)){status='';help=false;if(options.skillId)selection[type].id=options.skillId;renderKey='';render({resetDetail:true});}};
  ui.close=()=>{cleanup();previous.close();};
  ui.bindState=next=>{
    state=next;previous.bindState(next);
    if(!next||ui.panel.hidden){cleanup();return;}
    const identity=`${next.id}:${next.generation}`;if(lifeKey!==identity){lifeKey=identity;for(const v of views)selection[v]=defaults(v);help=false;}
    const key=JSON.stringify([identity,next.inspiration?.revision,next.knownSkills,next.combatLoadout,next.equipment,Math.floor(next.ageYears||0),Boolean(next.combat),next.down,next.ended]);
    if(key!==renderKey){renderKey=key;render();}else if(isCore()&&!ui.body.querySelector('.rb-page'))render();
  };
  ui.refresh=()=>{previous.refresh();renderKey='';render();};
  for(const [key,b]of [['heart',ui.heart],['technique',ui.techniques],['body',ui.bodyButton],['items',ui.items]])b.onclick=()=>{if(isCore()&&ui.panel.dataset.type===key)ui.close();else ui.open(key);};
  const menuClick=ui.menu.onclick;ui.menu.onclick=e=>{if(isCore())ui.close();menuClick?.call(ui.menu,e);};
  const onEscape=e=>{if(e.key==='Escape'&&isCore()){e.preventDefault();e.stopImmediatePropagation();if(help){help=false;render();}else ui.close();}};
  doc.addEventListener('keydown',onEscape,true);
  ui.dispose=()=>{disposed=true;cleanup();doc.removeEventListener('keydown',onEscape,true);previous.dispose();};
  return ui;
}
