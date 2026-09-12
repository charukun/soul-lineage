const q=s=>document.querySelector(s);
const make=(tag,text='',className='')=>{const n=document.createElement(tag);n.textContent=text;n.className=className;return n;};
function button(label,action){const b=make('button',label);b.type='button';b.addEventListener('click',action);return b;}
export function installFocusedReviewUI(){
 if(q('#focused-review'))return;
 const quick=make('section','','quick-review');quick.id='focused-review';quick.setAttribute('aria-label','再生と確認');
 const transport=make('div','','quick-transport');
 for(const id of ['play-toggle','restart','speed']){const n=document.getElementById(id);if(n){if(id==='restart'){n.textContent='先頭';n.setAttribute('aria-label','先頭へ戻す');}if(id==='speed')n.setAttribute('aria-label','再生速度');transport.append(n);}}
 const loop=q('#loop-toggle');transport.append(loop.closest('label'));
 quick.append(transport);
 const phases=make('div','','phase-controls');phases.setAttribute('aria-label','動作の確認位置');
 for(let i=0;i<4;i++){const b=button(['構え','打ち出し','打点','戻り'][i],()=>document.dispatchEvent(new CustomEvent('review-phase',{detail:{index:i}})));b.dataset.phase=String(i);b.disabled=true;phases.append(b);}quick.append(phases);
 const camera=q('.camera-strip');if(camera){quick.append(camera);camera.setAttribute('aria-label','確認角度');}
 q('.viewport').after(quick);
 const head=q('.notebook-head');head.querySelector('.book-title').hidden=true;head.querySelector('.transport-mini').hidden=true;
 const modes=make('div','','combat-mode-switch');modes.setAttribute('aria-label','通常と戦闘の切り替え');
 for(const[id,label]of [['normal','通常'],['combat','戦闘態勢']]){const b=button(label,()=>document.dispatchEvent(new CustomEvent('review-combat-mode',{detail:{mode:id}})));b.dataset.combatMode=id;b.setAttribute('aria-pressed',String(id==='normal'));modes.append(b);}head.append(modes);
 q('.review-tabs').hidden=true;const oldQuick=q('.weapon-quick');if(oldQuick)oldQuick.hidden=true;
 const notebook=q('.notebook-scroll'),advanced=q('[data-review-page="advanced"]');
 const legacy=make('details','','legacy-review');legacy.append(make('summary','技構成・系統別の詳細'));
 for(const page of [...document.querySelectorAll('.review-page')])if(page!==advanced){const d=make('details');d.append(make('summary',page.querySelector('.section-heading')?.textContent||'確認候補'));d.append(page);legacy.append(d);}
 advanced.append(legacy);advanced.prepend(q('#rest-pose'));advanced.classList.add('active');advanced.hidden=true;
 const browser=make('section','','motion-browser');browser.id='motion-browser';
 const filters=make('div','','motion-categories');filters.setAttribute('aria-label','動作の種類');
 const families=[['all','すべて'],['unarmed','徒手'],['blade','刀剣'],['defense','防御'],['move','移動'],['life','生活'],['external','外部']];let category='all',selected='',lastMeta='';
 const search=make('input');search.type='search';search.placeholder='動作名で検索';search.setAttribute('aria-label','動作名で検索');
 const list=make('div','','motion-list');list.setAttribute('aria-label','動作候補');
 function renderList(){const metadata=new Map(window.__reviewLab?.metadata?.()||[]),term=search.value.trim().toLowerCase();
  const rows=[...q('#clip').options].filter(o=>o.value&&!o.disabled).map(o=>({value:o.value,label:o.textContent,meta:metadata.get(o.value)})).filter(r=>(category==='all'||r.meta?.category===category)&&(!term||(r.value+' '+r.label).toLowerCase().includes(term)));
  rows.sort((a,b)=>(a.value==='Tidebreak / Attack'?-1:b.value==='Tidebreak / Attack'?1:0));
  list.replaceChildren(...rows.map(row=>{const b=button(row.value==='Tidebreak / Attack'?'右の直突き':row.label,()=>{const s=q('#clip');s.value=row.value;s.dispatchEvent(new Event('change',{bubbles:true}));});b.dataset.motionId=row.value;b.setAttribute('aria-pressed',String(row.value===selected));b.append(make('small',row.value));return b;}));
  if(!rows.length)list.append(make('p','該当なし、または読み込み中です。','empty-notice'));
 }
 for(const[id,label]of families){const b=button(label,()=>{category=id;filters.querySelectorAll('button').forEach(n=>n.setAttribute('aria-pressed',String(n.dataset.family===id)));renderList();});b.dataset.family=id;b.setAttribute('aria-pressed',String(id==='all'));filters.append(b);}
 search.addEventListener('input',renderList);browser.append(search,filters,list);notebook.prepend(browser);
 const primary=make('nav','','review-primary-tabs');
 for(const[id,label]of [['motions','動作を選ぶ'],['advanced','詳細調整']]){const b=button(label,()=>{const detail=id==='advanced';browser.hidden=detail;advanced.hidden=!detail;primary.querySelectorAll('button').forEach(n=>n.setAttribute('aria-pressed',String(n===b)));notebook.scrollTop=0;});b.dataset.primary=id;b.setAttribute('aria-pressed',String(id==='motions'));primary.append(b);}head.after(primary);
 const equipment=make('div','','review-equipment');equipment.append(make('label','武器'));
 equipment.querySelector('label').htmlFor='weapon-select';equipment.append(q('#weapon-select'));equipment.append(q('#weapon-toggle').closest('label'));primary.after(equipment);
 const notice=make('p','','compatibility-notice');notice.id='compatibility-notice';equipment.after(notice);
 const availability=make('details','','asset-readiness');availability.append(make('summary','素材の準備状況'));const issues=make('div');availability.append(issues);const retry=button('素材を再読込',()=>q('#retry').click());availability.append(retry);advanced.prepend(availability);
 new MutationObserver(renderList).observe(q('#clip'),{childList:true,subtree:true});
 let problemKey='',phaseKey='';
 document.addEventListener('review-state-change',event=>{const{state,meta,problems}=event.detail;
  if(selected!==state.clip){selected=state.clip;q('#motion-name').textContent=selected==='Tidebreak / Attack'?'右の直突き':selected||'元モデル';q('#motion-meta').textContent=selected;list.querySelectorAll('[data-motion-id]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.motionId===selected)));}
  const mk=String(window.__reviewLab?.metadata?.().length||0);if(mk!==lastMeta){lastMeta=mk;renderList();}
  const key=JSON.stringify(meta?.phases||[]);if(key!==phaseKey){phaseKey=key;phases.querySelectorAll('button').forEach((b,i)=>{b.disabled=!meta?.phases?.[i];b.textContent=meta?.phases?.[i]?.[0]||['構え','打ち出し','打点','戻り'][i];b.title=meta?.phases?.[i]?`${meta.phases[i][1].toFixed(3)}秒`:'この動作には確認区間が未定義です';});}
  const incompatible=meta?.category==='unarmed'&&state.weaponEnabled;
  notice.textContent=incompatible?'徒手動作に武器を重ねた比較です。武器専用の動作ではありません。':'';notice.hidden=!incompatible;
  const pk=JSON.stringify(problems);if(pk!==problemKey){problemKey=pk;issues.replaceChildren(...(problems.length?problems.map(p=>make('p',`${p.id}: ${p.reason}`)):[make('p','読込済みの素材にエラーはありません。追加素材は順次準備します。')]));availability.querySelector('summary').textContent=problems.length?`一部のみ準備完了・${problems.length}件を確認`:'素材の準備状況';}
 });
 let returnFocus=null;
 document.addEventListener('click',event=>{if(event.target.closest('[data-picker-for],.model-select-trigger'))returnFocus=event.target.closest('button');});
 document.addEventListener('keydown',event=>{
  const modal=[...document.querySelectorAll('.picker-backdrop,.model-picker-backdrop')].find(n=>!n.hidden);if(!modal)return;
  if(event.key==='Escape'){event.preventDefault();modal.hidden=true;returnFocus?.focus();}
  if(event.key==='Tab'){const items=[...modal.querySelectorAll('button,input,select,[tabindex]')].filter(n=>n.getClientRects().length&&!n.disabled);if(!items.length)return;const first=items[0],last=items.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}
 },true);
 renderList();
}
