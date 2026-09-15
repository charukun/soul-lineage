import {DAYS_YEAR} from './game/core.js';
const village=window.village,{world,ui,activity,resetVillage}=village;
const $=id=>document.getElementById(id);

function open(){
 if($('muraEntry'))return;
 ui.entryOpen=true;document.body.classList.add('mura-entry-open');
 const panel=document.createElement('section');panel.id='muraEntry';panel.setAttribute('aria-label','タイトル');
 const pop=world.population();
 panel.innerHTML=`<div id="muraEntryCard"><h2>MURAAAAAAA</h2><p class="muraEntryLead">小さな暮らしを、見守る。</p><div id="muraEntryFacts"><span>${Math.floor(world.state.clock/DAYS_YEAR)+1}年</span><span>${pop.people}人</span></div><button id="muraEnterVillage">村へ入る</button>${village.info.environment!=='prod'?'<button id="muraResetVillage">村を初期化</button>':''}<small class="muraEntryHint">自動保存で、続きから。</small></div>`;
 document.body.append(panel);
 $('muraEnterVillage').onclick=()=>{ui.entryOpen=false;document.body.classList.remove('mura-entry-open');panel.remove();activity();village.view.lastInteraction=performance.now();};
 if($('muraResetVillage'))$('muraResetVillage').onclick=resetConfirm;
 $('muraEnterVillage').focus({preventScroll:true});
}
function resetConfirm(){
 let dialog=$('muraResetConfirm');
 if(!dialog){dialog=document.createElement('dialog');dialog.id='muraResetConfirm';document.body.append(dialog);}
 dialog.innerHTML='<h2>村を初期化</h2><p>今の村を退避して、最初から始めます。</p><p data-error role="alert" hidden></p><div class="muraResetActions"><button data-cancel>戻る</button><button class="danger" data-reset>初期化</button></div>';
 dialog.querySelector('[data-cancel]').onclick=()=>dialog.close();
 dialog.querySelector('[data-reset]').onclick=async()=>{
  const button=dialog.querySelector('[data-reset]');button.disabled=true;button.textContent='初期化中';
  try{await resetVillage();}
  catch(error){button.disabled=false;button.textContent='初期化';const message=dialog.querySelector('[data-error]');message.hidden=false;message.textContent=`初期化できませんでした。今の村は残しています。${error.message||''}`;}
 };
 dialog.showModal();dialog.querySelector('[data-cancel]').focus();
}
window.__MURA_ENTRY_POLISH__={version:2,open};
open();
