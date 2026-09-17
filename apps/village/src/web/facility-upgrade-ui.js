import {defs,ready,capacityOf,jobsOf,RESOURCE_NAMES} from '../game/core.js';

const MAX_LEVEL=3;
const clampLevel=value=>Math.max(1,Math.min(MAX_LEVEL,Math.floor(Number(value)||1)));
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const amount=value=>Number.isInteger(value)?String(value):Number(value).toFixed(2).replace(/\.00$/,'');

export function isFacilityUpgradeTarget(object){
 const definition=object&&defs[object.kind];
 return !!definition?.building&&ready(object)&&object.kind!=='campfire'&&!definition.reserved;
}

export function facilityUpgradePreview(world,object){
 if(!isFacilityUpgradeTarget(object))return null;
 const definition=defs[object.kind],level=clampLevel(object.level),nextLevel=Math.min(MAX_LEVEL,level+1);
 const cost=world.upgradeCost(object),next={...object,level:nextLevel},effects=[];

 if(definition.capacity){
  effects.push({label:'定員',from:`${capacityOf(object)}人`,to:`${capacityOf(next)}人`});
 }
 if(definition.jobs){
  effects.push({label:'就労枠',from:`${jobsOf(object)}人`,to:`${jobsOf(next)}人`});
 }
 if(definition.produce&&Object.keys(definition.produce).length){
  effects.push({label:'生産効率',from:`×${(1+(level-1)*.45).toFixed(2)}`,to:`×${(1+(nextLevel-1)*.45).toFixed(2)}`});
 }
 if(definition.defense){
  effects.push({label:'守り（就労時）',from:amount(definition.defense*level),to:amount(definition.defense*nextLevel)});
 }
 if(object.kind==='storage'){
  effects.push({label:'保管上限への加算',from:`+${level*300}`,to:`+${nextLevel*300}`});
 }
 if(['comfort','rest','learning'].includes(definition.effect)){
  effects.push({label:'暮らしの余裕',from:`+${level*2}`,to:`+${nextLevel*2}`});
 }
 if(object.kind==='dojo'){
  effects.push({label:'護衛の鍛錬',from:`+${level*2}`,to:`+${nextLevel*2}`});
 }

 const bonuses=[];
 if(object.kind==='quarry'&&level<2&&nextLevel>=2)bonuses.push('2段階目から、採掘を重ねると輝石も見つかるようになります。');

 return{
  level,
  nextLevel,
  maxed:level>=MAX_LEVEL,
  upgrading:!!object.upgrade,
  progress:Math.max(0,Math.min(1,Number(object.upgrade?.progress)||0)),
  cost,
  costText:Object.entries(cost).map(([key,value])=>`${RESOURCE_NAMES[key]||key} ${Math.ceil(value)}`).join(' · ')||'建材不要',
  affordable:world.canAfford(cost),
  deficit:world.deficit(cost),
  effects,
  bonuses
 };
}

function installFacilityUpgradeUI(village){
 const actions=document.querySelector('#context .actions'),details=document.getElementById('details');
 if(!actions||!details||document.getElementById('facilityUpgrade'))return;
 const button=document.createElement('button');
 button.id='facilityUpgrade';button.type='button';button.textContent='強化';button.hidden=true;
 actions.insertBefore(button,details);

 const selectedObject=()=>{
  if(village.ui.selectedRoom||!village.ui.selected)return null;
  return village.world.object(village.ui.selected)||null;
 };

 let lastSignature='';
 const sync=()=>{
  const object=selectedObject(),preview=object&&facilityUpgradePreview(village.world,object);
  if(!preview){button.hidden=true;lastSignature='';return;}
  const signature=[object.id,preview.level,preview.maxed,preview.upgrading,Math.floor(preview.progress*100)].join(':');
  if(signature===lastSignature)return;
  lastSignature=signature;button.hidden=false;
  if(preview.upgrading){button.disabled=true;button.textContent=`強化中 ${Math.floor(preview.progress*100)}%`;button.title=`${preview.level}段階目から${object.upgrade.target}段階目へ強化中`;}
  else if(preview.maxed){button.disabled=true;button.textContent='最大強化';button.title='この施設は3段階目まで強化済みです';}
  else{button.disabled=false;button.textContent='強化';button.title=`${preview.level}段階目 → ${preview.nextLevel}段階目`;}
 };

 const openDialog=()=>{
  const object=selectedObject(),preview=object&&facilityUpgradePreview(village.world,object);
  if(!object||!preview||preview.upgrading||preview.maxed)return;
  const definition=defs[object.kind],dialog=document.getElementById('dialog'),content=document.getElementById('dialogContent'),back=document.getElementById('muraDialogBack');
  if(!dialog||!content)return;
  const effects=preview.effects.length
   ?`<div class="factGrid">${preview.effects.map(effect=>`<span>${esc(effect.label)}<b>${esc(effect.from)} → ${esc(effect.to)}</b></span>`).join('')}</div>`
   :'<p class="muted">施設段階が上がり、外観と今後の施設効果の基準になります。</p>';
  const bonuses=preview.bonuses.map(text=>`<p>${esc(text)}</p>`).join('');
  const shortage=preview.affordable?'必要な資材がそろっています。':`不足：${esc(preview.deficit.join('・'))}`;
  content.innerHTML=`<span class="eyebrow">施設を強化</span><h2>${esc(definition.label)}</h2><p>${preview.level}段階目 → <b>${preview.nextLevel}段階目</b></p>${effects}${bonuses}<p><b>必要資材</b><br>${esc(preview.costText)}</p><p class="muted">${shortage}<br>配置・内装・住民との紐付けを保ったまま強化します。</p><button id="confirmFacilityUpgrade" class="wide" ${preview.affordable?'':'disabled'}>強化を始める</button>`;
  if(back)back.hidden=true;
  village.ui.dialogPage='facility-upgrade';
  if(!dialog.open)dialog.showModal();
  village.view.interacting=true;village.activity();
  const confirm=document.getElementById('confirmFacilityUpgrade');
  if(confirm)confirm.onclick=()=>{
   const result=village.world.upgrade(object.id);
   if(result.error){village.toast(result.error);return;}
   dialog.close();void village.save();village.toast(`${definition.label}の強化を始めました`);lastSignature='';sync();
  };
 };

 button.onclick=openDialog;
 let lastSync=0;
 const hook=now=>{if(now-lastSync<160)return;lastSync=now;sync();};
 village.frameHooks.add(hook);sync();
}

function installWhenVillageReady(){
 const canvas=document.getElementById('game');
 if(!canvas)return;
 const tryInstall=()=>{if(!window.village)return false;installFacilityUpgradeUI(window.village);return true;};
 if(tryInstall())return;
 const observer=new MutationObserver(()=>{
  if(tryInstall()||canvas.dataset.renderer==='error')observer.disconnect();
 });
 observer.observe(canvas,{attributes:true,attributeFilter:['data-renderer']});
}

if(typeof window!=='undefined'&&typeof document!=='undefined')installWhenVillageReady();
