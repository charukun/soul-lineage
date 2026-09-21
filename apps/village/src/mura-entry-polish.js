import {DAYS_YEAR} from './game/core.js';
import {consumeFirstRunAutoplayAfterReset,hasFirstRunAutoplayAfterReset,requestFirstRunAutoplayAfterReset,shouldRunFirstRunAutoplay} from './game/first-run-onboarding.js';
import {ENTRY_SEEN_KEY,shouldSkipEntry,clearEntrySeenForReset,restoreEntrySeenAfterFailedReset} from './web/playability.js';
const village=window.village,{world,ui,activity,resetVillage}=village;
const $=id=>document.getElementById(id);

function entered(){
 ui.entryOpen=false;document.body.classList.remove('mura-entry-open');
 $('muraEntry')?.remove();activity();village.view.lastInteraction=performance.now();
 window.dispatchEvent(new CustomEvent('village:entered'));
}
function open({resume=false}={}){
 if($('muraEntry'))return;
 if(resume){
  const firstRunTutorial=shouldRunFirstRunAutoplay(world.state,{resetReplay:hasFirstRunAutoplayAfterReset(village.info.environment)});
  let skip=false;try{skip=shouldSkipEntry(localStorage.getItem(ENTRY_SEEN_KEY),{firstRunTutorial});}catch{}
  if(skip){entered();return;}
 }
 ui.entryOpen=true;document.body.classList.add('mura-entry-open');
 const panel=document.createElement('section');panel.id='muraEntry';panel.setAttribute('aria-label','タイトル');
 const pop=world.population();
 panel.innerHTML=`<div id="muraEntryCard"><h2>宝満叡智</h2><p class="muraEntryLead">小さな暮らしを、見守る。</p><div id="muraEntryFacts"><span>${Math.floor(world.state.clock/DAYS_YEAR)+1}年</span><span>${pop.people}人</span></div><button id="muraEnterVillage">村へ入る</button>${village.info.environment!=='prod'?'<button id="muraResetVillage">村を初期化</button>':''}<small class="muraEntryHint">自動保存で、続きから。</small></div>`;
 document.body.append(panel);
 $('muraEnterVillage').onclick=()=>{
  // This listener exists before post-entry modules load. Do not lose the first
  // acknowledgement by installing its persistence after the click has happened.
  try{localStorage.setItem(ENTRY_SEEN_KEY,'1');}catch{}
  entered();
 };
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
  const environment=village.info.environment;
  const entrySeen=clearEntrySeenForReset();
  requestFirstRunAutoplayAfterReset(environment);
  try{await resetVillage();}
  catch(error){restoreEntrySeenAfterFailedReset(entrySeen);consumeFirstRunAutoplayAfterReset(environment);button.disabled=false;button.textContent='初期化';const message=dialog.querySelector('[data-error]');message.hidden=false;message.textContent=`初期化できませんでした。今の村は残しています。${error.message||''}`;}
 };
 dialog.showModal();dialog.querySelector('[data-cancel]').focus();
}
window.__MURA_ENTRY_POLISH__={version:2,open};
open({resume:true});
