import './selection-detail.css';

const HOLD_MS=430,MOVE_LIMIT=12;
export function decorateSelectionDetail(node,{kicker='詳細',title='',summary='',status='',note=''}={}){
  if(!node)return node;
  node.dataset.detailTitle=String(title||'詳細');
  node.dataset.detailKicker=String(kicker||'詳細');
  node.dataset.detailSummary=String(summary||'');
  node.dataset.detailStatus=String(status||'');
  node.dataset.detailNote=String(note||'');
  return node;
}
export function installSelectionDetail({root,panel,audio}){
  const view=document.createElement('section');
  view.className='selection-detail-view';view.hidden=true;view.setAttribute('role','dialog');view.setAttribute('aria-modal','true');view.setAttribute('aria-label','選択項目の詳細');
  view.innerHTML='<div class="selection-detail-card"><span data-detail-kicker></span><strong data-detail-title></strong><p data-detail-summary></p><small data-detail-status></small><em data-detail-note></em><button type="button" data-detail-dismiss>戻る</button></div>';
  panel.append(view);
  let press=null,suppress=null;
  const clear=()=>{if(press?.timer)clearTimeout(press.timer);press=null;};
  const close=()=>{view.hidden=true;delete panel.dataset.detailOpen;};
  const open=target=>{
    view.querySelector('[data-detail-kicker]').textContent=target.dataset.detailKicker||'詳細';
    view.querySelector('[data-detail-title]').textContent=target.dataset.detailTitle||'詳細';
    view.querySelector('[data-detail-summary]').textContent=target.dataset.detailSummary||'';
    view.querySelector('[data-detail-status]').textContent=target.dataset.detailStatus||'';
    view.querySelector('[data-detail-note]').textContent=target.dataset.detailNote||'';
    view.hidden=false;panel.dataset.detailOpen='true';audio?.ui?.();
  };
  const onDown=event=>{
    const target=event.target.closest?.('[data-detail-title]');if(!target||!root.contains(target)||event.button>0)return;
    clear();press={target,id:event.pointerId,x:event.clientX,y:event.clientY,timer:setTimeout(()=>{if(!press||press.target!==target)return;suppress=target;open(target);},HOLD_MS)};
  };
  const onMove=event=>{if(!press||press.id!==event.pointerId)return;if(Math.hypot(event.clientX-press.x,event.clientY-press.y)>MOVE_LIMIT)clear();};
  const onEnd=event=>{if(press&&press.id===event.pointerId)clear();};
  const onClick=event=>{const target=event.target.closest?.('[data-detail-title]');if(target&&suppress===target){event.preventDefault();event.stopImmediatePropagation();suppress=null;}};
  const onContext=event=>{if(event.target.closest?.('[data-detail-title]'))event.preventDefault();};
  root.addEventListener('pointerdown',onDown,true);root.addEventListener('pointermove',onMove,true);root.addEventListener('pointerup',onEnd,true);root.addEventListener('pointercancel',onEnd,true);root.addEventListener('click',onClick,true);root.addEventListener('contextmenu',onContext,true);
  view.addEventListener('click',event=>{if(event.target===view||event.target.closest?.('[data-detail-dismiss]'))close();});
  return{close,dispose(){clear();root.removeEventListener('pointerdown',onDown,true);root.removeEventListener('pointermove',onMove,true);root.removeEventListener('pointerup',onEnd,true);root.removeEventListener('pointercancel',onEnd,true);root.removeEventListener('click',onClick,true);root.removeEventListener('contextmenu',onContext,true);view.remove();}};
}
