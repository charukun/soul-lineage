import {RaidHost} from '@soul/network/raid-host';
import {REVIEW_BATTLE_MODELS,createReviewBattleStage} from './review-battle-stage.js';
import {REVIEW_BATTLE_PHASE_LABELS,reviewBattleLoopDue,reviewBattlePhaseState} from './review-battle-state.js';

const q=id=>document.getElementById(id);
const heroSelect=q('battle-hero-model'),enemySelect=q('battle-enemy-model');
for(const select of [heroSelect,enemySelect])select.replaceChildren(...REVIEW_BATTLE_MODELS.map(row=>{const option=document.createElement('option');option.value=row.id;option.textContent=row.label;return option;}));
heroSelect.value='kaykit.rogue.v1';enemySelect.value='kaykit.knight.v1';

const phasePanel=q('battle-phase'),phaseBrand=q('phase-brand'),phaseCurrent=q('phase-current'),phaseMeta=q('phase-meta'),phaseHistory=q('phase-history');
const phaseSteps=[...document.querySelectorAll('[data-phase-step]')];
const skinButtons=[...document.querySelectorAll('[data-battle-skin]')];
const skinLabels=Object.freeze({rinne:'輪廻転焦',jinku:'尽喰廻遊'});

let battleStage=null,battleStagePromise=null;
async function ensureBattleStage(){
  if(battleStage)return battleStage;
  if(battleStagePromise)return battleStagePromise;
  q('battle-model-status').textContent='モデル準備中';
  battleStagePromise=createReviewBattleStage({canvas:q('battle-canvas'),onStatus:text=>{q('battle-model-status').textContent=text;}})
    .then(stage=>{battleStage=stage;stage.setModel('hero',heroSelect.value);stage.setModel('enemy',enemySelect.value);return stage;})
    .catch(error=>{q('battle-model-status').textContent=`モデル読込失敗 · ${error.message}`;q('battle-canvas').dataset.battleModels='failed';throw error;});
  return battleStagePromise;
}

heroSelect.addEventListener('change',()=>{void ensureBattleStage().then(stage=>stage.setModel('hero',heroSelect.value));});
enemySelect.addEventListener('change',()=>{void ensureBattleStage().then(stage=>stage.setModel('enemy',enemySelect.value));});

const memory=new Map();
const storage={getItem:key=>memory.has(key)?memory.get(key):null,setItem:(key,value)=>memory.set(key,String(value))};
const loopEnabled=true,followCamera=true;
let host=null,playing=true,last=performance.now(),lastCore=null,uiSkin='jinku',finishedAt=0,lastJinkuAction='',lastJinkuPhase='';

function setPressed(button,pressed,label){
  button.setAttribute('aria-pressed',String(pressed));
  button.textContent=`${label} ${pressed?'ON':'OFF'}`;
}

function setUiSkin(next){
  if(!skinLabels[next])return;
  uiSkin=next;phasePanel.dataset.skin=next;phaseBrand.textContent=skinLabels[next];lastJinkuAction='';lastJinkuPhase='';phaseHistory?.replaceChildren();
  for(const button of skinButtons)button.setAttribute('aria-pressed',String(button.dataset.battleSkin===next));
}

function resetBattle({preservePlaying=false}={}){
  const resume=preservePlaying?playing:true;
  memory.clear();lastCore=null;finishedAt=0;lastJinkuAction='';lastJinkuPhase='';phaseHistory?.replaceChildren();battleStage?.resetRound();
  host=new RaidHost({villageId:'develop-visual-review',storage,now:()=>Date.now()});
  host.join('demon',{type:'join',app:'demon',role:'demon',playerId:'review-demon',name:'Demon'});
  host.join('human',{type:'join',app:'rinne',role:'human',playerId:'review-human',name:'Human'});
  host.input('demon',{type:'state',x:-1.2,z:0,yaw:Math.PI/2,state:'combat',action:null});
  host.input('human',{type:'state',x:1.2,z:0,yaw:-Math.PI/2,state:'combat',action:null});
  host.tick(1/60);lastCore=host.battle?.core?.state?.()||null;playing=resume;q('battle-toggle').textContent=playing?'一時停止':'再開';last=performance.now();
}

function renderPhase(core){
  const state=reviewBattlePhaseState(core);
  phasePanel.dataset.phase=state.phase||'idle';phaseCurrent.textContent=REVIEW_BATTLE_PHASE_LABELS[state.phase]||'待';
  for(const step of phaseSteps){const active=step.dataset.phaseStep===state.phase;step.dataset.active=String(active);step.setAttribute('aria-current',active?'step':'false');}
  const left=REVIEW_BATTLE_PHASE_LABELS[state.heroPhase]||'—',right=REVIEW_BATTLE_PHASE_LABELS[state.enemyPhase]||'—';
  const action=core?.hero?.attack||state.skill||'間合いを測る';
  phaseMeta.textContent=uiSkin==='jinku'?action:`LEFT ${left} · RIGHT ${right}${state.skill?` · ${state.skill}`:''}`;
  if(uiSkin==='jinku'&&(action!==lastJinkuAction||state.phase!==lastJinkuPhase)){
    if(lastJinkuAction){const item=document.createElement('span');item.textContent=lastJinkuAction;phaseHistory?.prepend(item);setTimeout(()=>item.remove(),2700);}
    const link=state.phase==='jo'?phasePanel.querySelector('[data-review-phase-link="jo-ha"]'):state.phase==='ha'?phasePanel.querySelector('[data-review-phase-link="ha-kyu"]'):null;
    if(link){link.classList.remove('pulse-once');void link.offsetWidth;link.classList.add('pulse-once');}
    lastJinkuAction=action;lastJinkuPhase=state.phase;
  }
}

function syncBattle(dt){
  const battle=host?.battle,currentCore=battle?.core?.state?.();if(currentCore)lastCore=currentCore;const core=currentCore||lastCore;if(!core)return;
  const heroMax=Math.max(1,Number(core.hero.maxhp)||1),enemyMax=Math.max(1,Number(core.enemy.maxhp)||1);
  q('hero-action').textContent=core.hero.attack||'構え';q('enemy-action').textContent=core.enemy.attack||'構え';
  q('hero-hp').value=Math.max(0,(Number(core.hero.hp)||0)/heroMax);q('enemy-hp').value=Math.max(0,(Number(core.enemy.hp)||0)/enemyMax);
  q('hero-meta').textContent=`${Math.ceil(Number(core.hero.hp)||0)} / ${heroMax} HP`;
  q('enemy-meta').textContent=`${Math.ceil(Number(core.enemy.hp)||0)} / ${enemyMax} HP`;
  q('battle-time').textContent=`${(battle?.time||0).toFixed(1)}秒`;
  q('battle-result').textContent=battle?.finished?`${battle.winner==='demon'?'LEFT':'RIGHT'} 勝利`:'戦闘中';
  renderPhase(core);battleStage?.sync(core,dt,{followCamera});
}

function advanceBattle(dt){
  const runtime=host?.battle?.core;if(!runtime)return;
  const before=runtime.state?.();if(before)lastCore=before;
  host.tick(dt);
  const after=runtime.state?.();if(after)lastCore=after;
}

function frame(now){
  const dt=Math.min(.05,Math.max(0,(now-last)/1000));last=now;
  if(playing&&host?.battle&&!host.battle.finished)advanceBattle(dt);
  const finished=Boolean(host?.battle?.finished);
  if(finished&&!finishedAt)finishedAt=now;else if(!finished)finishedAt=0;
  if(reviewBattleLoopDue({loopEnabled,playing,finished,finishedAt,now})){resetBattle({preservePlaying:true});}
  syncBattle(dt);requestAnimationFrame(frame);
}

q('battle-restart').addEventListener('click',()=>resetBattle());
q('battle-toggle').addEventListener('click',()=>{playing=!playing;q('battle-toggle').textContent=playing?'一時停止':'再開';last=performance.now();});
window.addEventListener('pagehide',()=>battleStage?.dispose(),{once:true});

setPressed(q('battle-loop'),loopEnabled,'ループ');setPressed(q('battle-camera'),followCamera,'追従');setUiSkin(uiSkin);
resetBattle();void ensureBattleStage();requestAnimationFrame(frame);
