const q=s=>document.querySelector(s);
const make=(tag,text='',className='')=>{const n=document.createElement(tag);n.textContent=text;n.className=className;return n;};
function button(label,action){const b=make('button',label);b.type='button';b.addEventListener('click',action);return b;}
export function installFocusedReviewUI(){
 if(q('#focused-review'))return;
 const quick=make('section','','quick-review');quick.id='focused-review';quick.setAttribute('aria-label','再生と確認');
 const transport=make('div','','quick-transport');
 for(const id of ['play-toggle','restart','speed']){const n=document.getElementById(id);if(n){if(id==='restart'){n.textContent='先頭';n.setAttribute('aria-label','先頭へ戻す');}if(id==='speed')n.setAttribute('aria-label','再生速度');transport.append(n);}}
 const loop=q('#loop-toggle');if(loop?.closest('label'))transport.append(loop.closest('label'));
 quick.append(transport);
 const phases=make('div','','phase-controls');phases.setAttribute('aria-label','動作の確認位置');
 for(let i=0;i<4;i++){const b=button(['構え','打ち出し','打点','戻り'][i],()=>document.dispatchEvent(new CustomEvent('review-phase',{detail:{index:i}})));b.dataset.phase=String(i);b.disabled=true;phases.append(b);}quick.append(phases);
 const camera=q('.camera-strip');if(camera){quick.append(camera);const report=q('#copy-motion');if(report)camera.append(report);camera.setAttribute('aria-label','確認角度');}
 // Keep the renderer fixed at 70%; every review control scrolls inside the 30% dock.
 const dock=make('section','','review-controls-dock');dock.setAttribute('aria-label','レビュー操作');
 q('.viewport').after(dock);dock.append(quick,q('.panel'));
 const head=q('.notebook-head');head?.querySelector('.book-title')?.setAttribute('hidden','');head?.querySelector('.transport-mini')?.setAttribute('hidden','');
 // Restore the original purpose tabs. Skill composition is the primary review surface.
 const tabs=q('.review-tabs');if(tabs){tabs.hidden=false;tabs.setAttribute('aria-label','モーション確認タブ');tabs.addEventListener('click',event=>{if(event.target.closest('[data-review-tab]'))dock.scrollTop=0;});}
 const oldQuick=q('.weapon-quick');if(oldQuick)oldQuick.hidden=true;
 const advanced=q('[data-review-page="advanced"]');
 const equipment=make('div','','review-equipment');equipment.append(make('label','武器'));
 if(equipment.querySelector('label'))equipment.querySelector('label').htmlFor='weapon-select';
 const weaponSelect=q('#weapon-select'),weaponToggle=q('#weapon-toggle')?.closest('label');if(weaponSelect)equipment.append(weaponSelect);if(weaponToggle)equipment.append(weaponToggle);
 if(tabs)tabs.after(equipment);else head?.after(equipment);
 const notice=make('p','','compatibility-notice');notice.id='compatibility-notice';equipment.after(notice);
 const availability=make('details','','asset-readiness');availability.append(make('summary','素材の準備状況'));const issues=make('div');availability.append(issues);const retry=button('素材を再読込',()=>q('#retry')?.click());availability.append(retry);advanced?.prepend(availability);
 let problemKey='',phaseKey='';
 document.addEventListener('review-state-change',event=>{const{state,meta,problems=[]}=event.detail;
  const name=q('#motion-name'),desc=q('#motion-meta');if(name)name.textContent=state.clip||'元モデル';if(desc)desc.textContent=state.sequence?.length>1?`${state.sequence.length}段の連続再生`:(state.clip?'選択中のモーション':'元モデル静止比較');
  const key=JSON.stringify(meta?.phases||[]);if(key!==phaseKey){phaseKey=key;phases.querySelectorAll('button').forEach((b,i)=>{b.disabled=!meta?.phases?.[i];b.textContent=meta?.phases?.[i]?.[0]||['構え','打ち出し','打点','戻り'][i];b.title=meta?.phases?.[i]?`${meta.phases[i][1].toFixed(3)}秒`:'この動作には確認区間が未定義です';});}
  const incompatible=meta?.category==='unarmed'&&state.weaponEnabled;notice.textContent=incompatible?'徒手動作に武器を重ねた比較です。武器専用の動作ではありません。':'';notice.hidden=!incompatible;
  const pk=JSON.stringify(problems);if(pk!==problemKey){problemKey=pk;issues.replaceChildren(...(problems.length?problems.map(p=>make('p',`${p.id}: ${p.reason}`)):[make('p','読込済みの素材にエラーはありません。追加素材は順次準備します。')]));availability.querySelector('summary').textContent=problems.length?`一部のみ準備完了・${problems.length}件を確認`:'素材の準備状況';}
 });
 let returnFocus=null;
 document.addEventListener('click',event=>{if(event.target.closest('[data-picker-for],.model-select-trigger'))returnFocus=event.target.closest('button');});
 document.addEventListener('keydown',event=>{
  const modal=[...document.querySelectorAll('.picker-backdrop,.model-picker-backdrop')].find(n=>!n.hidden);if(!modal)return;
  if(event.key==='Escape'){event.preventDefault();modal.hidden=true;returnFocus?.focus();}
  if(event.key==='Tab'){const items=[...modal.querySelectorAll('button,input,select,[tabindex]')].filter(n=>n.getClientRects().length&&!n.disabled);if(!items.length)return;const first=items[0],last=items.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}
 },true);
 const skill=q('[data-review-tab="skill"]');if(skill){skill.click();dock.scrollTop=0;}
}
