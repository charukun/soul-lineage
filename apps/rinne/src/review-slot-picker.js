import './review-slot-picker.css';

let serial=0;
let opened=null;

function sourceButtons(group){return [...group.querySelectorAll('button:not(.simple-review-technical)')];}

function labelOf(button){
  const explicit=button.dataset.reviewSlotOptionLabel||button.getAttribute('aria-label');
  if(explicit)return explicit.trim();
  const copy=button.cloneNode(true);
  copy.querySelectorAll('.tick,[aria-hidden="true"]').forEach(node=>node.remove());
  return (copy.textContent||'').trim()||'選択';
}

function selectedButton(group){
  const list=sourceButtons(group).filter(button=>!button.disabled);
  return list.find(button=>button.getAttribute('aria-pressed')==='true')||list.find(button=>button.classList.contains('primary'))||list[0]||null;
}

function close(shell,focus=false){
  if(!shell)return;
  const trigger=shell.querySelector('.review-slot-trigger');
  const panel=shell.querySelector('.review-slot-panel');
  panel.hidden=true;
  trigger.setAttribute('aria-expanded','false');
  shell.dataset.open='false';
  if(opened===shell)opened=null;
  if(focus)trigger.focus();
}

function position(shell){
  const rect=shell.querySelector('.review-slot-trigger').getBoundingClientRect();
  const panel=shell.querySelector('.review-slot-panel');
  if(innerHeight-rect.bottom>=210){panel.style.top=`${Math.round(rect.bottom+6)}px`;panel.style.bottom='auto';}
  else{panel.style.top='auto';panel.style.bottom=`${Math.round(innerHeight-rect.top+6)}px`;}
}

function shellFor(label,id,render){
  const shell=document.createElement('div');
  shell.className='review-slot-picker';
  shell.dataset.open='false';
  const trigger=document.createElement('button');
  trigger.type='button';trigger.className='review-slot-trigger';trigger.setAttribute('aria-haspopup','listbox');trigger.setAttribute('aria-expanded','false');
  const caption=document.createElement('span');caption.className='review-slot-label';caption.textContent=label;
  const value=document.createElement('strong');value.className='review-slot-value';value.textContent='選択';
  const caret=document.createElement('span');caret.className='review-slot-caret';caret.setAttribute('aria-hidden','true');caret.textContent='⌄';
  trigger.append(caption,value,caret);
  const panel=document.createElement('div');panel.className='review-slot-panel';panel.id=`${id||'review-slot'}-${++serial}`;panel.hidden=true;panel.setAttribute('role','listbox');panel.setAttribute('aria-label',`${label}の候補`);
  const grid=document.createElement('div');grid.className='review-slot-grid';panel.append(grid);trigger.setAttribute('aria-controls',panel.id);
  trigger.addEventListener('click',()=>{if(!panel.hidden){close(shell);return;}if(opened&&opened!==shell)close(opened);render(shell);panel.hidden=false;trigger.setAttribute('aria-expanded','true');shell.dataset.open='true';opened=shell;position(shell);});
  shell.append(trigger,panel);
  return shell;
}

export function mountReviewSelect(select,label){
  if(!select||select.dataset.reviewSlotMounted==='true')return null;
  select.dataset.reviewSlotMounted='true';
  const host=select.closest('label');
  const shell=shellFor(label||select.getAttribute('aria-label')||'選択',select.id,current=>{
    const value=current.querySelector('.review-slot-value');
    const grid=current.querySelector('.review-slot-grid');
    const selected=select.selectedOptions?.[0]||select.options[0];value.textContent=selected?.textContent?.trim()||'選択';
    grid.replaceChildren(...[...select.options].map(option=>{const button=document.createElement('button');button.type='button';button.className='review-slot-option';button.textContent=option.textContent.trim();button.disabled=option.disabled;button.setAttribute('role','option');button.setAttribute('aria-selected',String(option.value===select.value));button.addEventListener('click',()=>{select.value=option.value;select.dispatchEvent(new Event('input',{bubbles:true}));select.dispatchEvent(new Event('change',{bubbles:true}));value.textContent=option.textContent.trim();close(current,true);});return button;}));
  });
  (host||select).insertAdjacentElement('afterend',shell);if(host)host.classList.add('review-slot-source-host');else select.classList.add('review-slot-source');
  const sync=()=>{const option=select.selectedOptions?.[0]||select.options[0];shell.querySelector('.review-slot-value').textContent=option?.textContent?.trim()||'選択';};select.addEventListener('change',sync);sync();return shell;
}

export function mountReviewGroup(group,label){
  if(!group||group.dataset.reviewSlotMounted==='true')return null;
  group.dataset.reviewSlotMounted='true';
  const shell=shellFor(label||group.getAttribute('aria-label')||'選択',group.id,current=>{
    const value=current.querySelector('.review-slot-value');const grid=current.querySelector('.review-slot-grid');const sources=sourceButtons(group);const chosen=selectedButton(group);value.textContent=chosen?labelOf(chosen):'選択';
    grid.replaceChildren(...sources.map(source=>{const button=document.createElement('button');button.type='button';button.className='review-slot-option';button.textContent=labelOf(source);button.disabled=source.disabled;button.setAttribute('role','option');button.setAttribute('aria-selected',String(source===chosen));button.addEventListener('click',()=>{source.click();value.textContent=labelOf(source);close(current,true);});return button;}));
  });
  group.insertAdjacentElement('afterend',shell);group.classList.add('review-slot-source-group');group.setAttribute('aria-hidden','true');const chosen=selectedButton(group);shell.querySelector('.review-slot-value').textContent=chosen?labelOf(chosen):'選択';return shell;
}

export function mountReviewSelectGrid(select,label='選択中'){
  if(!select||select.dataset.reviewGridMounted==='true')return null;
  select.dataset.reviewGridMounted='true';
  const host=select.closest('label');
  const shell=document.createElement('section');
  shell.className='review-select-grid-picker';
  shell.setAttribute('aria-label',`${label}と候補一覧`);

  const current=document.createElement('div');
  current.className='review-select-grid-current';
  current.setAttribute('role','status');
  current.setAttribute('aria-live','polite');
  const caption=document.createElement('small');
  caption.textContent=label;
  const value=document.createElement('strong');
  value.className='review-select-grid-value';
  value.textContent='選択';
  current.append(caption,value);

  const grid=document.createElement('div');
  grid.className='review-select-grid-list';
  grid.setAttribute('role','listbox');
  grid.setAttribute('aria-label',`${label}の候補`);
  shell.append(current,grid);

  const selectedOption=()=>select.selectedOptions?.[0]||select.options[0]||null;
  const syncSelection=()=>{
    const selected=selectedOption();
    value.textContent=selected?.textContent?.trim()||'選択';
    for(const button of grid.querySelectorAll('.review-select-grid-option')){
      button.setAttribute('aria-selected',String(button.dataset.value===select.value));
    }
  };
  const render=()=>{
    const options=[...select.options];
    grid.replaceChildren(...options.map(option=>{
      const button=document.createElement('button');
      button.type='button';
      button.className='review-select-grid-option';
      button.dataset.value=option.value;
      button.textContent=option.textContent.trim();
      button.disabled=option.disabled;
      button.setAttribute('role','option');
      button.setAttribute('aria-selected',String(option.value===select.value));
      button.addEventListener('click',()=>{
        if(select.value!==option.value)select.value=option.value;
        select.dispatchEvent(new Event('input',{bubbles:true}));
        select.dispatchEvent(new Event('change',{bubbles:true}));
        syncSelection();
      });
      return button;
    }));
    syncSelection();
  };

  select.addEventListener('input',syncSelection);
  select.addEventListener('change',syncSelection);
  new MutationObserver(render).observe(select,{childList:true,subtree:true,characterData:true});
  (host||select).insertAdjacentElement('afterend',shell);
  if(host)host.classList.add('review-slot-source-host');else select.classList.add('review-slot-source');
  render();
  return shell;
}

document.addEventListener('pointerdown',event=>{if(opened&&!opened.contains(event.target))close(opened);},true);
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&opened)close(opened,true);});
window.addEventListener('resize',()=>{if(opened)position(opened);});
