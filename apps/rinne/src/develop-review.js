import {
  inspirationCatalogRevision,
  INSPIRATION_WEAPON_ARTS,
  INSPIRATION_WEAPONS,
  INSPIRATION_MOTION_IDS,
} from '@soul/game-data';
import {assetCatalog,publicWebAssetCatalog} from '@soul/assets';
import {KAYKIT_FAMILY_ID,KAYKIT_MODEL_BY_KEY,KAYKIT_RIG_ID,PROTAGONIST_VILLAGER_MODEL_ID} from '@soul/characters';
import {RaidHost} from '@soul/network/raid-host';
import {REVIEW_BATTLE_MODELS,createReviewBattleStage} from './review-battle-stage.js';
import './develop-review.css';

const q=selector=>document.querySelector(selector);
const qa=selector=>[...document.querySelectorAll(selector)];
const weaponLabels=Object.freeze({sword:'片手剣',great:'大剣',spear:'槍',axe:'戦斧',fist:'拳',katana:'刀'});
const phaseLabels=Object.freeze({open:'序候補',middle:'破候補',finish:'急候補'});
const appLabels=Object.freeze({rinne:'輪廻転焦',village:'MURAAAAAAA',demon:'尽喰廻遊'});
const appContexts=Object.freeze({
  rinne:{model:PROTAGONIST_VILLAGER_MODEL_ID,detail:'主人公・母・敵は同じKayKit family / Rig_Mediumから解決。',camera:'通常カメラ'},
  village:{model:`${KAYKIT_MODEL_BY_KEY.rogue.id} / ${KAYKIT_MODEL_BY_KEY.knight.id}`,detail:'住民は人物IDでモデルを固定し、role変更は装備側へ分離。',camera:'Village通常距離'},
  demon:{model:KAYKIT_MODEL_BY_KEY.knight.id,detail:'人間NPCは共通KayKit基盤。魔物プレイヤーは別contract。',camera:'Demon通常距離'}
});

const build=typeof __BUILD_INFO__==='object'&&__BUILD_INFO__?__BUILD_INFO__:{branch:'develop',commit:'local'};
q('#build-source').textContent=`${build.branch||'develop'} · ${String(build.commit||'local').slice(0,12)}`;
q('#catalog-revision').textContent=inspirationCatalogRevision;
q('#motion-count').textContent=`${INSPIRATION_MOTION_IDS.length} 基礎動作`;
q('#foundation-id').textContent=KAYKIT_FAMILY_ID;
q('#foundation-rig').textContent=KAYKIT_RIG_ID;

autoPopulateCanon();

function autoPopulateCanon(){
  let selectedWeapon=INSPIRATION_WEAPONS[0];
  const renderCatalog=()=>{
    q('#weapon-tabs').replaceChildren(...INSPIRATION_WEAPONS.map(weapon=>{
      const button=document.createElement('button');button.type='button';button.textContent=weaponLabels[weapon]||weapon;button.dataset.weapon=weapon;
      button.classList.toggle('active',weapon===selectedWeapon);button.addEventListener('click',()=>{selectedWeapon=weapon;renderCatalog();});return button;
    }));
    const arts=INSPIRATION_WEAPON_ARTS[selectedWeapon];
    q('#inspiration-phases').replaceChildren(...['open','middle','finish'].map(phase=>{
      const card=document.createElement('article'),heading=document.createElement('h3'),list=document.createElement('ol');heading.textContent=phaseLabels[phase];
      arts[phase].forEach(id=>{const item=document.createElement('li'),code=document.createElement('code');code.textContent=id;item.append(code);list.append(item);});card.append(heading,list);return card;
    }));
  };
  renderCatalog();
  q('#app-status-grid').replaceChildren(...Object.entries(appContexts).map(([app,row])=>{
    const article=document.createElement('article');article.dataset.appStatus=app;
    const heading=document.createElement('div'),title=document.createElement('strong'),badge=document.createElement('span'),model=document.createElement('code'),detail=document.createElement('p');
    title.textContent=appLabels[app];badge.textContent=`${KAYKIT_RIG_ID} · shared`;heading.append(title,badge);model.textContent=row.model;detail.textContent=row.detail;article.append(heading,model,detail);return article;
  }));
  const objectRows=[
    ...Object.entries(assetCatalog).map(([id,row])=>[id,{...row,status:'SHARED PACKAGE',apps:['rinne','village','demon']}]),
    ...Object.entries(publicWebAssetCatalog).filter(([,row])=>['3d','pbr-material'].includes(row.category)&&row.status==='MATERIALIZED')
  ].slice(0,12);
  q('#world-object-grid').replaceChildren(...objectRows.map(([id,row])=>{
    const card=document.createElement('article'),title=document.createElement('code'),meta=document.createElement('span');
    title.textContent=id;meta.textContent=`${row.category||row.type||'asset'} · ${row.status||'shared'} · ${(row.apps||[]).join(' / ')||'shared'}`;card.append(title,meta);return card;
  }));
}

let selectedApp='rinne';
function applyEmbeddedContext(frame){
  try{
    const win=frame?.contentWindow,doc=frame?.contentDocument;if(!win||!doc)return;
    const mapped=selectedApp==='village'?'village':selectedApp==='demon'?'demon':'studio',select=doc.getElementById('quality-context');
    if(select&&select.value!==mapped){select.value=mapped;select.dispatchEvent(new win.Event('change',{bubbles:true}));}
    const studio=win.characterStudio;if(studio?.review?.ready)studio.review.aim(selectedApp==='village'?'village':selectedApp==='demon'?'demon':'front');
  }catch{/* A still-loading embedded tool keeps its own defaults. */}
}
function renderAppContext(){
  qa('[data-app-context]').forEach(button=>button.classList.toggle('active',button.dataset.appContext===selectedApp));
  qa('[data-app-status]').forEach(card=>card.classList.toggle('active',card.dataset.appStatus===selectedApp));
  q('#focus-app-context').value=selectedApp;const row=appContexts[selectedApp];q('#context-summary').textContent=`${appLabels[selectedApp]} · ${row.camera}`;
  qa('iframe[src]').forEach(applyEmbeddedContext);
}
function setAppContext(app){if(!Object.hasOwn(appContexts,app))return;selectedApp=app;renderAppContext();}
qa('[data-app-context]').forEach(button=>button.addEventListener('click',()=>setAppContext(button.dataset.appContext)));
q('#focus-app-context').addEventListener('change',event=>setAppContext(event.target.value));
renderAppContext();

const focusShell=q('#focus-shell'),focusTitle=q('#focus-title'),focusOpen=q('#focus-open');let focusedView='';
function enterFocus(name){
  const panel=q(`[data-panel="${name}"]`);if(!panel)return;
  focusedView=name;qa('[data-panel]').forEach(row=>row.classList.toggle('active',row===panel));
  focusTitle.textContent=panel.dataset.title||name;focusOpen.href=panel.dataset.open||'#';focusOpen.hidden=!panel.dataset.open;
  q('#review-home').hidden=true;focusShell.hidden=false;document.body.dataset.reviewMode='focused';document.body.dataset.reviewTarget=name;
  const frame=panel.querySelector('iframe[data-src]');
  if(frame&&!frame.getAttribute('src')){frame.addEventListener('load',()=>applyEmbeddedContext(frame),{once:true});frame.setAttribute('src',frame.dataset.src);}else if(frame)applyEmbeddedContext(frame);
  if(name==='battle')void ensureBattleStage();last=performance.now();
}
function leaveFocus(){
  focusedView='';qa('[data-panel]').forEach(row=>row.classList.remove('active'));focusShell.hidden=true;q('#review-home').hidden=false;
  document.body.dataset.reviewMode='chooser';delete document.body.dataset.reviewTarget;
}
qa('[data-view]').forEach(button=>button.addEventListener('click',()=>enterFocus(button.dataset.view)));
q('#focus-back').addEventListener('click',leaveFocus);
document.body.dataset.reviewMode='chooser';

const heroSelect=q('#battle-hero-model'),enemySelect=q('#battle-enemy-model');
for(const select of [heroSelect,enemySelect])select.replaceChildren(...REVIEW_BATTLE_MODELS.map(row=>{const option=document.createElement('option');option.value=row.id;option.textContent=row.label;return option;}));
heroSelect.value='kaykit.rogue.v1';enemySelect.value='kaykit.knight.v1';
let battleStage=null,battleStagePromise=null;
async function ensureBattleStage(){
  if(battleStage)return battleStage;if(battleStagePromise)return battleStagePromise;
  q('#battle-model-status').textContent='モデル準備中';
  battleStagePromise=createReviewBattleStage({canvas:q('#battle-canvas'),onStatus:text=>{q('#battle-model-status').textContent=text;}})
    .then(stage=>{battleStage=stage;stage.setModel('hero',heroSelect.value);stage.setModel('enemy',enemySelect.value);return stage;})
    .catch(error=>{q('#battle-model-status').textContent=`モデル読込失敗 · ${error.message}`;q('#battle-canvas').dataset.battleModels='failed';console.error(error);throw error;});
  return battleStagePromise;
}
heroSelect.addEventListener('change',()=>{void ensureBattleStage().then(stage=>stage.setModel('hero',heroSelect.value));});
enemySelect.addEventListener('change',()=>{void ensureBattleStage().then(stage=>stage.setModel('enemy',enemySelect.value));});

const memory=new Map();
const storage={getItem:key=>memory.has(key)?memory.get(key):null,setItem:(key,value)=>memory.set(key,String(value))};
let host=null,playing=true,last=performance.now(),lastCore=null;
function resetBattle(){
  memory.clear();lastCore=null;host=new RaidHost({villageId:'develop-visual-review',storage,now:()=>Date.now()});
  host.join('demon',{type:'join',app:'demon',role:'demon',playerId:'review-demon',name:'Demon'});
  host.join('human',{type:'join',app:'rinne',role:'human',playerId:'review-human',name:'Human'});
  host.input('demon',{type:'state',x:-1.2,z:0,yaw:Math.PI/2,state:'combat',action:null});
  host.input('human',{type:'state',x:1.2,z:0,yaw:-Math.PI/2,state:'combat',action:null});host.tick(1/60);
  lastCore=host.battle?.core?.state?.()||null;playing=true;q('#battle-toggle').textContent='一時停止';last=performance.now();
}
resetBattle();
function syncBattle(dt){
  const battle=host.battle,currentCore=battle?.core?.state?.();if(currentCore)lastCore=currentCore;const core=currentCore||lastCore;if(!core)return;
  q('#hero-action').textContent=core.hero.attack||'構え';q('#enemy-action').textContent=core.enemy.attack||'構え';
  q('#hero-hp').value=Math.max(0,core.hero.hp/core.hero.maxhp);q('#enemy-hp').value=Math.max(0,core.enemy.hp/core.enemy.maxhp);
  q('#hero-meta').textContent=`${Math.ceil(core.hero.hp)} / ${core.hero.maxhp} HP · ${core.hero.weapon}`;q('#enemy-meta').textContent=`${Math.ceil(core.enemy.hp)} / ${core.enemy.maxhp} HP · ${core.enemy.weapon}`;
  q('#battle-time').textContent=`${(battle?.time||0).toFixed(1)}秒`;q('#battle-result').textContent=battle?.finished?`${battle.winner==='demon'?'DEMON':'HUMAN'} 勝利`:'戦闘中';
  battleStage?.sync(core,dt);
}
function frame(now){
  const dt=Math.min(.05,Math.max(0,(now-last)/1000));last=now;
  if(focusedView==='battle'){
    if(playing&&host?.battle&&!host.battle.finished)host.tick(dt);
    syncBattle(dt);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
q('#battle-restart').addEventListener('click',resetBattle);
q('#battle-toggle').addEventListener('click',()=>{playing=!playing;q('#battle-toggle').textContent=playing?'一時停止':'再開';last=performance.now();});
window.addEventListener('pagehide',()=>battleStage?.dispose(),{once:true});
