import {RaidHost} from '@soul/network/raid-host';
import {createPhasePanel} from '@soul/shared-ui/phase-panel';
import {REVIEW_BATTLE_MODELS,createReviewBattleStage} from './review-battle-stage.js';
import {REVIEW_BATTLE_PHASE_LABELS,reviewBattleLoopDue,reviewBattlePhaseState} from './review-battle-state.js';

const q=id=>document.getElementById(id);
const PLAYER_DEFAULT='kaykit.rogue.v1';
const OPPONENT_MODEL='kaykit.knight.v1';
const AUTO_LOOP=true;
const FOLLOW_CAMERA=true;
const playerSelect=q('battle-hero-model');
playerSelect.replaceChildren(...REVIEW_BATTLE_MODELS.map(row=>{const option=document.createElement('option');option.value=row.id;option.textContent=row.label;return option;}));
playerSelect.value=PLAYER_DEFAULT;
const phasePanel=createPhasePanel(q('battle-phase'),{skin:'rinne',brand:'輪廻転焦',details:false});
const skinButtons=[...document.querySelectorAll('[data-battle-skin]')];
const skinLabels=Object.freeze({rinne:'輪廻転焦',jinku:'尽喰廻遊'});
let uiSkin='rinne';

let battleStage=null,battleStagePromise=null;
async function ensureBattleStage(){
  if(battleStage)return battleStage;
  if(battleStagePromise)return battleStagePromise;
  q('battle-model-status').textContent='モデル準備中';
  battleStagePromise=createReviewBattleStage({canvas:q('battle-canvas'),onStatus:text=>{q('battle-model-status').textContent=text;}})
    .then(stage=>{battleStage=stage;stage.setModel('hero',playerSelect.value);stage.setModel('enemy',OPPONENT_MODEL);return stage;})
    .catch(error=>{q('battle-model-status').textContent=`モデル読込失敗 · ${error.message}`;q('battle-canvas').dataset.battleModels='failed';throw error;});
  return battleStagePromise;
}

playerSelect.addEventListener('change',()=>{void ensureBattleStage().then(stage=>stage.setModel('hero',playerSelect.value));});

const memory=new Map();
const storage={getItem:key=>memory.has(key)?memory.get(key):null,setItem:(key,value)=>memory.set(key,String(value))};
let host=null,playing=true,last=performance.now(),lastCore=null,finishedAt=0;

function setUiSkin(next){
  if(!skinLabels[next])return;
  uiSkin=next;
  phasePanel.setSkin(next,skinLabels[next]);
  for(const button of skinButtons)button.setAttribute('aria-pressed',String(button.dataset.battleSkin===next));
}

function resetBattle({preservePlaying=false}={}){
  const resume=preservePlaying?playing:true;
  memory.clear();lastCore=null;finishedAt=0;battleStage?.resetRound();
  host=new RaidHost({villageId:'develop-visual-review',storage,now:()=>Date.now()});
  host.join('demon',{type:'join',app:'demon',role:'demon',playerId:'review-demon',name:'Demon'});
  host.join('human',{type:'join',app:'rinne',role:'human',playerId:'review-human',name:'Human'});
  host.input('demon',{type:'state',x:-1.2,z:0,yaw:Math.PI/2,state:'combat',action:null});
  host.input('human',{type:'state',x:1.2,z:0,yaw:-Math.PI/2,state:'combat',action:null});
  host.tick(1/60);lastCore=host.battle?.core?.state?.()||null;playing=resume;q('battle-toggle').textContent=playing?'一時停止':'再開';last=performance.now();
}

function renderPhase(core){
  const state=reviewBattlePhaseState(core);
  const heroPhase=REVIEW_BATTLE_PHASE_LABELS[state.heroPhase]||'—';
  const enemyPhase=REVIEW_BATTLE_PHASE_LABELS[state.enemyPhase]||'—';
  phasePanel.render({
    phase:state.phase,
    meta:`自分 ${heroPhase} · 相手 ${enemyPhase}`
  });
}

function syncBattle(dt){
  const battle=host?.battle,currentCore=battle?.core?.state?.();if(currentCore)lastCore=currentCore;const core=currentCore||lastCore;if(!core)return;
  q('battle-time').textContent=`${(battle?.time||0).toFixed(1)}秒`;
  q('battle-result').textContent=battle?.finished?`${battle.winner==='demon'?'自分':'相手'} 勝利`:'戦闘中';
  renderPhase(core);battleStage?.sync(core,dt,{followCamera:FOLLOW_CAMERA});
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
  if(reviewBattleLoopDue({loopEnabled:AUTO_LOOP,playing,finished,finishedAt,now}))resetBattle({preservePlaying:true});
  syncBattle(dt);requestAnimationFrame(frame);
}

q('battle-restart').addEventListener('click',()=>resetBattle());
q('battle-toggle').addEventListener('click',()=>{playing=!playing;q('battle-toggle').textContent=playing?'一時停止':'再開';last=performance.now();});
for(const button of skinButtons)button.addEventListener('click',()=>setUiSkin(button.dataset.battleSkin));
window.addEventListener('pagehide',()=>battleStage?.dispose(),{once:true});

setUiSkin(uiSkin);resetBattle();void ensureBattleStage();requestAnimationFrame(frame);
