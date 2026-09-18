import {mountReviewGroup,mountReviewSelect} from './review-slot-picker.js';

const byId=id=>document.getElementById(id);
const qs=selector=>document.querySelector(selector);

function row(id,className,parent,before=null){
  let node=byId(id);
  if(node||!parent)return node;
  node=document.createElement('div');
  node.id=id;
  node.className=className;
  if(before)parent.insertBefore(node,before);else parent.append(node);
  return node;
}

function move(shell,target){if(shell&&target&&!target.contains(shell))target.append(shell);}

function installStageCameraSlot(){
  if(!document.body.classList.contains('simple-review')||byId('review-stage-camera-options'))return;
  const actions=qs('.stage-actions');
  if(!actions)return;
  const cameraButtons=[...actions.querySelectorAll('[data-camera="front"],[data-camera="side"],[data-camera="back"],[data-camera="face"]')];
  if(cameraButtons.length<2)return;
  const group=document.createElement('div');
  group.id='review-stage-camera-options';
  group.setAttribute('aria-label','向き');
  cameraButtons.forEach((button,index)=>{
    button.hidden=false;
    button.removeAttribute('aria-hidden');
    button.setAttribute('aria-pressed',String(index===0));
    button.addEventListener('click',()=>cameraButtons.forEach(candidate=>candidate.setAttribute('aria-pressed',String(candidate===button))));
    group.append(button);
  });
  const cycle=byId('camera-cycle');
  if(cycle)cycle.hidden=true;
  actions.prepend(group);
  const shell=mountReviewGroup(group,'向き');
  actions.classList.add('review-slot-stage-actions');
  if(shell)actions.prepend(shell);
}

function installCharacterSlots(){
  if(!document.body.classList.contains('simple-review'))return;
  installStageCameraSlot();
  const mode=document.body.dataset.reviewMode;
  if(mode==='character'){
    const panel=byId('panel-parts');
    if(!panel)return;
    const slotRow=row('simple-character-slots','review-slot-row',panel,panel.firstElementChild);
    move(mountReviewGroup(byId('character-model-options'),'キャラクター'),slotRow);
    move(mountReviewGroup(byId('slot-tabs'),'部位'),slotRow);
    move(mountReviewGroup(byId('part-options'),'候補'),slotRow);
  }
  if(mode==='motion'){
    const basics=byId('simple-motion-controls');
    if(!basics)return;
    const slotRow=row('simple-motion-slots','simple-motion-slot-row',basics,basics.firstElementChild);
    move(mountReviewSelect(byId('qa-motion'),'動き'),slotRow);
    move(mountReviewSelect(byId('qa-speed'),'速度'),slotRow);
    move(mountReviewGroup(byId('qa-cameras'),'角度'),slotRow);
  }
}

function installAssetSlots(){
  if(!byId('asset-stage'))return;
  const modelOptions=byId('model-options');
  mountReviewGroup(modelOptions,'キャラクター');
  const slotGrid=qs('.slot-grid');
  if(slotGrid)slotGrid.classList.add('asset-slot-row');
  const slots=[['main','右手'],['off','左手'],['back','背中']];
  for(const [id,label] of slots){
    const select=byId(`slot-${id}`);
    const shell=mountReviewSelect(select,label);
    if(shell&&slotGrid)slotGrid.append(shell);
    if(select&&shell&&select.dataset.reviewResetSync!=='true'){
      select.dataset.reviewResetSync='true';
      byId('asset-reset')?.addEventListener('click',()=>queueMicrotask(()=>{
        const option=select.selectedOptions?.[0]||select.options[0];
        const value=shell.querySelector('.review-slot-value');
        if(value)value.textContent=option?.textContent?.trim()||'選択';
      }));
    }
  }
}

function installEffectSlots(){
  if(!byId('fx-stage'))return;
  const controls=qs('.controls');
  if(!controls)return;
  const slotRow=row('fx-review-slots','fx-slot-row',controls,controls.firstElementChild);
  move(mountReviewGroup(qs('.preset-grid'),'エフェクト'),slotRow);
  move(mountReviewSelect(byId('fx-speed'),'速度'),slotRow);
  move(mountReviewSelect(byId('fx-tier'),'品質'),slotRow);
}

function installBattleSlots(){
  if(!byId('battle-canvas'))return;
  const pickers=qs('.pickers');
  if(!pickers)return;
  pickers.classList.add('review-slot-row');
  move(mountReviewSelect(byId('battle-hero-model'),'自プレイヤー'),pickers);
  move(mountReviewGroup(qs('.skin-switch'),'UI'),pickers);
  const modes=qs('.review-modes');
  if(modes&&!modes.querySelector('.review-slot-picker'))modes.hidden=true;
}

function install(){
  installCharacterSlots();
  installAssetSlots();
  installEffectSlots();
  installBattleSlots();
}

let queued=false;
function schedule(){
  if(queued)return;
  queued=true;
  requestAnimationFrame(()=>{queued=false;install();});
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class','data-review-mode','aria-pressed']});
