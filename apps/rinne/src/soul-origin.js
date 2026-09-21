import { ORIGIN_QUESTIONS, normalizeOriginDraft, chooseOriginAnswer, advanceOriginDraft, originFromAnswers, clanPresentation } from './rebuild/clan-origin.js';
import { memoryImage, familyMemory, clanCrest } from './soul-origin-art.js';
import './soul-origin.css';

/** Browser/storage boundary. A draft is separate from the authoritative life save. */
export function createSoulOrigin({document,storage,storageKey,onConfirm,onOpen=()=>{},onCancel=()=>{},motionEnabled=()=>true}) {
  const win=document.defaultView,draftKey=storageKey.replace(/life-v2$/,'origin-draft-v1');
  const dialog=document.createElement('dialog');dialog.id='soul-origin';dialog.className='soul-origin';
  dialog.setAttribute('aria-labelledby','origin-question');
  dialog.innerHTML='<div class="origin-water" aria-hidden="true"><div class="origin-rays"></div><div class="origin-caustics"></div><div class="origin-particles"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div><div class="origin-soul"><i></i><b></b></div></div><div class="origin-surface"><header class="origin-header"><span>百年転生</span><button type="button" data-origin-close aria-label="問答を閉じてタイトルへ戻る">戻る</button></header><div class="origin-content"></div><p class="origin-status" role="alert" aria-live="polite"></p><nav class="origin-nav" aria-label="記憶をたどる"><button type="button" data-origin-back>ひとつ前へ</button><button type="button" data-origin-next>この記憶へ</button><button type="button" data-origin-confirm hidden>この家に、生まれる</button></nav></div>';
  document.body.append(dialog);
  const content=dialog.querySelector('.origin-content'),status=dialog.querySelector('.origin-status'),back=dialog.querySelector('[data-origin-back]'),next=dialog.querySelector('[data-origin-next]'),confirm=dialog.querySelector('[data-origin-confirm]');
  let draft=normalizeOriginDraft(null),expectedSave=null,busy=false,completed=false,raf=0,pointer={x:50,y:45},returnFocus=null;
  const reduced=win.matchMedia('(prefers-reduced-motion: reduce)');
  function syncMotion(){dialog.dataset.motion=reduced.matches||!motionEnabled()?'off':'on';}
  function persist(){try{storage.setItem(draftKey,JSON.stringify(draft));}catch{status.textContent='記憶を一時保存できません。端末の保存設定をご確認ください。';}}
  function syncButtons(){
    const question=ORIGIN_QUESTIONS[draft.step],replacement=dialog.querySelector('[data-origin-replace]');
    back.hidden=draft.step===0;next.hidden=!question;confirm.hidden=Boolean(question);
    next.disabled=busy||!question||!draft.answers[question.key];back.disabled=busy;
    confirm.disabled=busy||Boolean(replacement&&!replacement.checked);
    dialog.querySelector('[data-origin-close]').disabled=busy;
    for(const button of dialog.querySelectorAll('[data-origin-choice]'))button.disabled=busy;
    if(replacement)replacement.disabled=busy;
    dialog.setAttribute('aria-busy',String(busy));
  }
  function render(){
    status.textContent='';dialog.dataset.step=String(draft.step);dialog.dataset.departing='false';
    const question=ORIGIN_QUESTIONS[draft.step];content.replaceChildren();
    const caption=document.createElement('p');caption.className='origin-memory-index';caption.textContent=question?`${['一','二','三'][draft.step]} / 三　${question.memory}`:'あなたを待つ家';
    const heading=document.createElement('h2');heading.id='origin-question';heading.tabIndex=-1;heading.textContent=question?.title||'ここから、百年。';content.append(caption,heading);
    if(question){
      const choices=document.createElement('div');choices.className='origin-choices';choices.setAttribute('role','group');choices.setAttribute('aria-labelledby','origin-question');
      for(const choice of question.choices){
        const button=document.createElement('button');button.type='button';button.dataset.originChoice=choice.id;button.className='origin-memory';button.setAttribute('aria-pressed',String(draft.answers[question.key]===choice.id));
        button.innerHTML=`<span class="origin-memory-picture">${memoryImage(choice.image)}</span><span class="origin-memory-name"></span>`;button.querySelector('.origin-memory-name').textContent=choice.label;choices.append(button);
      }
      content.append(choices);
    }else{
      const clan=clanPresentation(originFromAnswers(draft.answers)),preview=document.createElement('section');preview.className='origin-family';preview.setAttribute('aria-label','生まれる一族');
      preview.innerHTML=`<div class="origin-family-home">${familyMemory(clan.culture)}</div><div class="origin-family-crest">${clanCrest(clan.crest)}</div><h3></h3><p class="origin-family-culture"></p><q></q><div class="origin-heirloom">${memoryImage(clan.art)}<span></span></div>`;
      preview.querySelector('h3').textContent=clan.family;preview.querySelector('.origin-family-culture').textContent=clan.cultureLabel;preview.querySelector('q').textContent=clan.motto;preview.querySelector('.origin-heirloom span').textContent=clan.label;content.append(preview);
      if(expectedSave!==null){
        const label=document.createElement('label');label.className='origin-replace';const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.dataset.originReplace='';const text=document.createElement('span');text.textContent='今の一族の保存を置き換えて、新しく始める';label.append(checkbox,text);content.append(label);
      }
    }
    syncButtons();heading.focus({preventScroll:true});
  }
  function open(){
    if(dialog.open||busy)return;completed=false;returnFocus=document.activeElement;
    try{expectedSave=storage.getItem(storageKey);const raw=storage.getItem(draftKey);draft=normalizeOriginDraft(raw&&raw.length<4096?JSON.parse(raw):null);}catch{draft=normalizeOriginDraft(null);try{expectedSave=storage.getItem(storageKey);}catch{expectedSave=undefined;}}
    onOpen();syncMotion();dialog.showModal();render();
    if(expectedSave===undefined){status.textContent='保存データを読めません。保存設定を確認してから、もう一度お試しください。';confirm.disabled=true;}
  }
  async function commit(){
    if(busy||draft.step!==ORIGIN_QUESTIONS.length||confirm.disabled)return;
    if(expectedSave===undefined){status.textContent='保存データを読めないため、人生を始められません。';return;}
    busy=true;status.textContent='';dialog.dataset.departing='true';syncButtons();
    try{
      const result=await onConfirm({clanOrigin:originFromAnswers(draft.answers),expectedSave});
      if(result===false)throw Error('人生を始められませんでした。もう一度お試しください。');
      completed=true;try{storage.removeItem(draftKey);}catch{}dialog.close();
    }catch(error){dialog.dataset.departing='false';status.textContent=error?.message||'保存できませんでした。もう一度お試しください。';}
    finally{busy=false;syncButtons();}
  }
  function click(event){
    const button=event.target.closest?.('button');if(!button||button.disabled)return;
    if(button.hasAttribute('data-origin-close')){dialog.close();return;}
    if(button.hasAttribute('data-origin-choice')){
      draft=chooseOriginAnswer(draft,button.dataset.originChoice);
      for(const candidate of dialog.querySelectorAll('[data-origin-choice]'))candidate.setAttribute('aria-pressed',String(candidate===button));
      persist();syncButtons();return;
    }
    if(button.hasAttribute('data-origin-next')){draft=advanceOriginDraft(draft);persist();render();}
    else if(button.hasAttribute('data-origin-back')){draft.step=Math.max(0,draft.step-1);persist();render();}
    else if(button.hasAttribute('data-origin-confirm'))void commit();
  }
  function move(event){
    if(dialog.dataset.motion==='off'||!dialog.open)return;
    const box=dialog.getBoundingClientRect();pointer={x:Math.max(0,Math.min(100,(event.clientX-box.left)/Math.max(1,box.width)*100)),y:Math.max(0,Math.min(100,(event.clientY-box.top)/Math.max(1,box.height)*100))};
    if(!raf)raf=win.requestAnimationFrame(()=>{raf=0;dialog.style.setProperty('--origin-x',`${pointer.x}%`);dialog.style.setProperty('--origin-y',`${pointer.y}%`);});
  }
  function ripple(event){
    if(dialog.dataset.motion==='off')return;const layer=dialog.querySelector('.origin-water');
    if(layer.querySelectorAll('.origin-ripple').length>=4)return;
    const box=dialog.getBoundingClientRect(),ring=document.createElement('i');ring.className='origin-ripple';ring.style.left=`${event.clientX-box.left}px`;ring.style.top=`${event.clientY-box.top}px`;layer.append(ring);ring.addEventListener('animationend',()=>ring.remove(),{once:true});
  }
  function close(){win.cancelAnimationFrame(raf);raf=0;if(!completed){onCancel();returnFocus?.focus?.({preventScroll:true});}}
  dialog.addEventListener('click',click);dialog.addEventListener('change',syncButtons);dialog.addEventListener('pointermove',move,{passive:true});dialog.addEventListener('pointerdown',ripple,{passive:true});
  dialog.addEventListener('keydown',event=>event.stopPropagation());dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();});dialog.addEventListener('close',close);reduced.addEventListener?.('change',syncMotion);
  return {open,get active(){return dialog.open;},dispose(){win.cancelAnimationFrame(raf);reduced.removeEventListener?.('change',syncMotion);dialog.removeEventListener('close',close);dialog.remove();}};
}

export function renderClanTitle(title,saved){
  let clan=null;try{clan=clanPresentation(saved?.clanOrigin);}catch{}
  let memory=title.querySelector('.title-clan-memory');
  if(!clan){memory?.remove();delete title.dataset.clanCulture;return;}
  if(!memory){memory=title.ownerDocument.createElement('div');memory.className='title-clan-memory';title.querySelector('.title-world').append(memory);}
  const key=`${clan.culture}:${clan.ethos}:${clan.art}:${saved.generation}`;
  if(memory.dataset.clanKey!==key){memory.dataset.clanKey=key;memory.innerHTML=`${familyMemory(clan.culture)}<div class="title-clan-caption"><strong></strong><span></span></div>`;memory.querySelector('strong').textContent=clan.family;memory.querySelector('span').textContent=`${clan.label} · ${Math.max(1,Number(saved.generation)||1)}代目`;}
  title.dataset.clanCulture=clan.culture;
}
