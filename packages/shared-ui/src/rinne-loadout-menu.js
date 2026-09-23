const SIGIL_PATHS=Object.freeze({
  breath:'<path d="M5 10c3-4 7-4 10-1M4 14c4-3 9-2 12 0M7 18c3-2 6-1 8 0"/>',
  eye:'<path d="M3 12c4-6 14-6 18 0-4 6-14 6-18 0Z"/><circle cx="12" cy="12" r="2.2"/>',
  guard:'<path d="M12 3 19 6v5c0 5-3 8-7 10-4-2-7-5-7-10V6l7-3Z"/><path d="M8.5 12h7"/>',
  step:'<path d="M7 18c2-1 3-3 4-6l2-6c.7-2 3-1.5 3 .5 0 3-1 6-2 8 2 0 4 .5 5 1.5-3 3-7 4-12 2Z"/>',
  focus:'<circle cx="12" cy="12" r="3"/><path d="M12 3v4M12 17v4M3 12h4M17 12h4"/>',
  blade:'<path d="M5 19 18 5l1-2 2 2-2 1L6 20 5 19Z"/><path d="m8 16 2 2M6 20l-2 1 1-2"/>',
  flow:'<path d="M6 8c2-3 7-4 10-2 2 1 3 3 3 5M18 16c-2 3-7 4-10 2-2-1-3-3-3-5"/><path d="m16 5 3 1-1 3M8 19l-3-1 1-3"/>',
  heal:'<path d="M12 20v-7M12 13c-4 0-6-2-6-6 4 0 6 2 6 6ZM12 16c4 0 6-2 6-6-4 0-6 2-6 6Z"/>',
  stance:'<circle cx="12" cy="6" r="2"/><path d="M12 8v5M7 11l5 2 5-2M9 20l3-7 3 7"/>',
  empty:'<path d="M7 12h10M12 7v10"/>'
});
const LONG_PRESS_MS=480;
const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
function bindLoadoutPress(button,{onClick=null,onLongPress=null}={}){
  let timer=0,longPressed=false;
  const cancel=()=>{if(timer){clearTimeout(timer);timer=0;}};
  if(onLongPress){
    button.addEventListener('pointerdown',event=>{if(event.button!=null&&event.button!==0)return;cancel();longPressed=false;timer=setTimeout(()=>{timer=0;longPressed=true;onLongPress(event);},LONG_PRESS_MS);});
    for(const type of ['pointerup','pointercancel','pointerleave'])button.addEventListener(type,cancel);
    button.addEventListener('contextmenu',event=>event.preventDefault());
  }
  button.onclick=event=>{cancel();if(longPressed){longPressed=false;event.preventDefault();return;}onClick?.(event);};
}
export function rinneSkillSigilKind(id,effects={}){
  const key=String(id||'');
  if(/breath|calm|recovery/.test(key))return'breath';if(/observe|read|danger|peripheral|weapon-eye/.test(key))return'eye';if(/guard|balance|fall|endure|resolve/.test(key))return'guard';if(/step|trail|distance|lunge|slip|circle/.test(key))return'step';if(/focus|center|precision|tempo|poise/.test(key))return'focus';if(/edge|grip|counter|finish|crash|draw|basic\.(sword|dagger|great|spear|axe)/.test(key))return'blade';if(/flow|rhythm|repeat|adapt|copy-form/.test(key))return'flow';if(/care|heal/.test(key)||Number(effects.recovery)>0)return'heal';if(key)return Number(effects.damage)>Number(effects.mitigation)?'blade':Number(effects.evasion)>0?'step':'flow';return'empty';
}
export function rinneSkillSigilMarkup(kind='empty'){const safe=SIGIL_PATHS[kind]?kind:'empty';return '<i class="skill-sigil" data-sigil="'+safe+'" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false">'+SIGIL_PATHS[safe]+'</svg></i>';}
export function rinneLoadoutPanelMarkup({ariaLabel='旅人の手帳',kicker='旅人の手帳'}={}){return '<section data-panel class="rinne-core-menu" hidden aria-modal="true" aria-label="'+esc(ariaLabel)+'"><header class="rinne-core-menu-head"><span class="rinne-core-menu-mark" aria-hidden="true">✦</span><div><small>'+esc(kicker)+'</small><strong data-title></strong></div><button data-close aria-label="閉じる">×</button></header><div data-body class="rinne-core-menu-body"></div></section>';}
export function createRinneMenuLead(text,{documentRef=document}={}){const node=documentRef.createElement('p');node.className='rinne-menu-lead';node.textContent=String(text||'');return node;}
export function createRinneLoadoutSlotRow({swapMode=false,layout='',documentRef=document}={}){const node=documentRef.createElement('section');node.className='loadout-slot-row';node.dataset.swapMode=String(swapMode);if(layout)node.dataset.layout=layout;return node;}
export function createRinneLoadoutSlot({label='',value='',meta='タップして選択',selected=false,empty=false,icon='empty',swapMode=false,swapSource=false,onClick=null,onLongPress=null,documentRef=document}={}){
  const button=documentRef.createElement('button');button.type='button';button.className='loadout-slot';button.dataset.selected=String(selected);button.dataset.empty=String(empty);button.dataset.swapMode=String(swapMode);button.dataset.swapSource=String(swapSource);button.innerHTML=rinneSkillSigilMarkup(icon)+'<span></span><strong></strong><small></small>';button.querySelector('span').textContent=label;button.querySelector('strong').textContent=value||'空き';button.querySelector('small').textContent=meta;bindLoadoutPress(button,{onClick,onLongPress});return button;
}
export function createRinneLoadoutGridItem({label='',meta='選択可',active=false,focus=false,icon='empty',onClick=null,documentRef=document}={}){const button=documentRef.createElement('button');button.type='button';button.className='loadout-grid-item';button.dataset.active=String(active);button.dataset.focus=String(focus);button.innerHTML=rinneSkillSigilMarkup(icon)+'<strong></strong><small></small>';button.querySelector('strong').textContent=label;button.querySelector('small').textContent=meta||'選択可';if(onClick)button.onclick=onClick;return button;}
export function createRinneLoadoutGridSection(title,copy,{documentRef=document}={}){const section=documentRef.createElement('section');section.className='loadout-library';section.innerHTML='<header><strong></strong><small></small></header><div class="loadout-grid"></div>';section.querySelector('header strong').textContent=title;section.querySelector('header small').textContent=copy;return section;}
export function createRinneLoadoutDetail({icon='empty',kicker='詳細',title='候補を選択',summary='',status='',note='',actionLabel='',actionDisabled=false,onAction=null,documentRef=document}={}){
  const section=documentRef.createElement('section');section.className='loadout-detail';section.innerHTML=rinneSkillSigilMarkup(icon)+'<div class="loadout-detail-copy"><small data-detail-kicker></small><strong data-detail-title></strong><span data-detail-summary></span><em data-detail-note></em></div><div class="loadout-detail-action"><small data-detail-status></small><button type="button" data-detail-apply></button></div>';
  section.querySelector('[data-detail-kicker]').textContent=kicker;section.querySelector('[data-detail-title]').textContent=title;section.querySelector('[data-detail-summary]').textContent=summary;section.querySelector('[data-detail-status]').textContent=status;
  const noteNode=section.querySelector('[data-detail-note]');noteNode.textContent=note;noteNode.hidden=!note;
  const action=section.querySelector('[data-detail-apply]');action.textContent=actionLabel||'選択';action.disabled=Boolean(actionDisabled);action.hidden=!actionLabel;if(onAction)action.onclick=onAction;
  return section;
}
export function createRinneSwapHint(text='入れ替える枠を選択',{documentRef=document}={}){const node=documentRef.createElement('p');node.className='loadout-swap-hint';node.textContent=text;return node;}
