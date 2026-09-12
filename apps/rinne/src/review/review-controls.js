const q=s=>document.querySelector(s);
const make=(tag,text='',className='')=>{const n=document.createElement(tag);n.textContent=text;n.className=className;return n;};
function button(label,action,className=''){const b=make('button',label,className);b.type='button';b.addEventListener('click',action);return b;}
export function installFocusedReviewUI(){
 if(q('#review-controls-toggle'))return;
 const viewport=q('.viewport'),panel=q('.panel'),notebook=q('.notebook-scroll'),head=q('.notebook-head');
 if(!viewport||!panel||!notebook||!head)return;
 const dock=make('section','','review-controls-dock');dock.id='review-controls-dock';dock.dataset.open='false';dock.setAttribute('aria-hidden','true');dock.setAttribute('aria-label','動作をセット');
 const scrim=button('',()=>setOpen(false),'review-controls-scrim');scrim.setAttribute('aria-label','操作を閉じる');scrim.tabIndex=-1;
 const toggle=button('操作',()=>setOpen(true),'review-controls-toggle');toggle.id='review-controls-toggle';toggle.setAttribute('aria-controls',dock.id);toggle.setAttribute('aria-expanded','false');
 const drawerHead=make('header','','review-drawer-head');const title=make('div');title.append(make('strong','動作をセット'),make('small','SET → REVIEW → REPEAT'));
 const feedback=q('#copy-motion');if(feedback){feedback.textContent='指摘する';feedback.classList.add('review-feedback-short');}
 const feedbackFloat=feedback?button('指摘',()=>feedback.click(),'review-feedback-toggle'):null;
 if(feedbackFloat){feedbackFloat.setAttribute('aria-label','現在の確認内容を指摘する');feedbackFloat.title='現在のモーション情報を付けて指摘する';}
 const close=button('閉じる',()=>setOpen(false),'review-controls-close');drawerHead.append(title);if(feedback)drawerHead.append(feedback);drawerHead.append(close);
 const overlays=[scrim];if(feedbackFloat)overlays.push(feedbackFloat);overlays.push(toggle,dock);viewport.after(...overlays);dock.append(drawerHead,panel);
 function setOpen(open){dock.dataset.open=String(open);dock.setAttribute('aria-hidden',String(!open));scrim.dataset.open=String(open);toggle.setAttribute('aria-expanded',String(open));toggle.textContent=open?'操作中':'操作';document.body.classList.toggle('review-controls-open',open);if(open)close.focus();else toggle.focus();}
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&dock.dataset.open==='true'){event.preventDefault();setOpen(false);}},true);
 head.querySelector('.book-title')?.setAttribute('hidden','');head.querySelector('.transport-mini')?.setAttribute('hidden','');
 const footer=q('.panel-footer');if(footer)footer.hidden=true;
 const skillPage=q('[data-review-page="skill"]'),advanced=q('[data-review-page="advanced"]'),tabs=q('.review-tabs');
 const skillTab=q('[data-review-tab="skill"]'),advancedTab=q('[data-review-tab="advanced"]');
 if(skillTab)skillTab.hidden=true;if(advancedTab)advancedTab.hidden=true;
 if(skillPage)notebook.prepend(skillPage);
 for(const play of skillPage?.querySelectorAll('[data-play-select]')||[]){
  play.textContent='↻ 確認';play.setAttribute('title','この段階まで繰り返し確認');
  play.addEventListener('click',()=>queueMicrotask(()=>{const loop=q('#loop-toggle');if(!loop)return;loop.checked=true;loop.dispatchEvent(new Event('change',{bubbles:true}));}));
 }
 for(const copy of skillPage?.querySelectorAll('.copy-slot')||[])copy.hidden=true;
 skillPage?.querySelector('.stage-titles')?.setAttribute('hidden','');
 const help=skillPage?.querySelector('.sequence-help');if(help)help.textContent='序・破・急を選び「確認」。選んだ範囲を止めるまで繰り返します。';
 const secondary=make('details','','review-secondary-disclosure');secondary.append(make('summary','その他の動作'));
 if(tabs){secondary.append(tabs);for(const page of [...document.querySelectorAll('.review-page')])if(!['skill','advanced'].includes(page.dataset.reviewPage))secondary.append(page);notebook.append(secondary);}
 secondary.addEventListener('toggle',()=>{if(!secondary.open&&skillTab&&!skillTab.classList.contains('active'))skillTab.click();});
 const advancedDetails=make('details','','review-advanced-disclosure');advancedDetails.append(make('summary','詳細設定'));
 const quick=make('section','','quick-review');quick.id='focused-review';quick.setAttribute('aria-label','再生と確認');
 const transport=make('div','','quick-transport');
 for(const id of ['play-toggle','restart','speed']){const n=document.getElementById(id);if(n){if(id==='restart'){n.textContent='先頭';n.setAttribute('aria-label','先頭へ戻す');}if(id==='speed')n.setAttribute('aria-label','再生速度');transport.append(n);}}
 const loop=q('#loop-toggle');if(loop?.closest('label'))transport.append(loop.closest('label'));quick.append(transport);
 const phases=make('div','','phase-controls');phases.setAttribute('aria-label','動作の確認位置');
 for(let i=0;i<4;i++){const b=button(['構え','打ち出し','打点','戻り'][i],()=>document.dispatchEvent(new CustomEvent('review-phase',{detail:{index:i}})));b.dataset.phase=String(i);b.disabled=true;phases.append(b);}quick.append(phases);
 const camera=q('.camera-strip');if(camera){quick.append(camera);camera.setAttribute('aria-label','確認角度');}
 advancedDetails.append(quick);if(advanced)advancedDetails.append(advanced);notebook.append(advancedDetails);
 const equipment=make('div','','review-equipment');equipment.append(make('label','武器'));equipment.querySelector('label').htmlFor='weapon-select';
 const weaponSelect=q('#weapon-select'),weaponToggle=q('#weapon-toggle')?.closest('label');if(weaponSelect)equipment.append(weaponSelect);if(weaponToggle)equipment.append(weaponToggle);head.after(equipment);
 const notice=make('p','','compatibility-notice');notice.id='compatibility-notice';equipment.after(notice);
 const availability=make('details','','asset-readiness');availability.append(make('summary','素材の準備状況'));const issues=make('div');availability.append(issues);availability.append(button('素材を再読込',()=>q('#retry')?.click()));advanced?.prepend(availability);
 let problemKey='',phaseKey='';
 document.addEventListener('review-state-change',event=>{const{state,meta,problems=[]}=event.detail;
  const name=q('#motion-name'),desc=q('#motion-meta');if(name)name.textContent=state.clip||'元モデル';if(desc)desc.textContent=state.sequence?.length>1?`${state.sequence.length}段を${state.loop?'繰り返し確認':'連続再生'}`:(state.clip?(state.loop?'繰り返し確認':'選択中'):'静止比較');
  document.body.classList.toggle('review-looping',Boolean(state.loop&&state.playing));
  const key=JSON.stringify(meta?.phases||[]);if(key!==phaseKey){phaseKey=key;phases.querySelectorAll('button').forEach((b,i)=>{b.disabled=!meta?.phases?.[i];b.textContent=meta?.phases?.[i]?.[0]||['構え','打ち出し','打点','戻り'][i];b.title=meta?.phases?.[i]?`${meta.phases[i][1].toFixed(3)}秒`:'この動作には確認区間が未定義です';});}
  const incompatible=meta?.category==='unarmed'&&state.weaponEnabled;notice.textContent=incompatible?'徒手動作に武器を重ねた比較です。':'';notice.hidden=!incompatible;
  const pk=JSON.stringify(problems);if(pk!==problemKey){problemKey=pk;issues.replaceChildren(...(problems.length?problems.map(p=>make('p',`${p.id}: ${p.reason}`)):[make('p','読込済み素材にエラーはありません。')]));availability.querySelector('summary').textContent=problems.length?`素材の準備状況・${problems.length}件確認`:'素材の準備状況';}
 });
 let returnFocus=null;
 document.addEventListener('click',event=>{if(event.target.closest('[data-picker-for],.model-select-trigger'))returnFocus=event.target.closest('button');});
 document.addEventListener('keydown',event=>{
  const modal=[...document.querySelectorAll('.picker-backdrop,.model-picker-backdrop')].find(n=>!n.hidden);if(!modal)return;
  if(event.key==='Escape'){event.preventDefault();modal.hidden=true;returnFocus?.focus();}
  if(event.key==='Tab'){const items=[...modal.querySelectorAll('button,input,select,[tabindex]')].filter(n=>n.getClientRects().length&&!n.disabled);if(!items.length)return;const first=items[0],last=items.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}
 },true);
 if(skillTab)skillTab.click();
}
