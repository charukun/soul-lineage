import {mountReviewGroup,mountReviewSelect,mountReviewSelectGrid} from '@soul/shared-ui/review-slot-picker';
import {createReviewAutoInstaller,ensureReviewRow,installReviewStageCameraSlot,moveReviewSlot} from '@soul/shared-ui/review-auto-install';
const byId=id=>document.getElementById(id);
const qs=selector=>document.querySelector(selector);

function installStageCameraSlot(){if(!document.body.classList.contains('simple-review')||document.body.dataset.reviewMode==='motion')return;const cycle=byId('camera-cycle');if(cycle)cycle.hidden=true;installReviewStageCameraSlot({mountGroup:mountReviewGroup});}

function installCharacterSlots(){
  if(!document.body.classList.contains('simple-review'))return;
  const mode=document.body.dataset.reviewMode;
  if(mode==='character')return;
  installStageCameraSlot();
  if(mode==='motion'){
    const basics=byId('simple-motion-controls');
    if(!basics)return;
    const motionPicker=mountReviewSelectGrid(byId('qa-motion'),'選択中の動き');
    if(motionPicker&&!basics.contains(motionPicker))basics.prepend(motionPicker);
    const slotRow=ensureReviewRow({id:'simple-motion-slots',className:'simple-motion-slot-row',parent:basics});
    moveReviewSlot(mountReviewSelect(byId('qa-speed'),'速度'),slotRow);
    const loop=byId('qa-loop')?.closest('label');
    if(loop){loop.classList.add('simple-motion-loop');moveReviewSlot(loop,slotRow);}
    byId('qa-speed')?.closest('.qa-playback')?.classList.add('simple-motion-source-playback');
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
  if(!byId('fx-stage')||byId('fx-catalog'))return;
  const controls=qs('.controls');
  if(!controls)return;
  const slotRow=ensureReviewRow({id:'fx-review-slots',className:'fx-slot-row',parent:controls,before:controls.firstElementChild});
  moveReviewSlot(mountReviewGroup(qs('.preset-grid'),'エフェクト'),slotRow);
  moveReviewSlot(mountReviewSelect(byId('fx-speed'),'速度'),slotRow);
  moveReviewSlot(mountReviewSelect(byId('fx-tier'),'品質'),slotRow);
}


function install(){
  installCharacterSlots();
  installAssetSlots();
  installEffectSlots();
}

createReviewAutoInstaller(install);
