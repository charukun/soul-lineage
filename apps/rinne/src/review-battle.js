import {RaidHost} from '@soul/network/raid-host';
import {REVIEW_BATTLE_MODELS,createReviewBattleStage} from './review-battle-stage.js';
import {REVIEW_BATTLE_PHASE_LABELS,reviewBattleLoopDue,reviewBattlePhaseState} from './review-battle-state.js';
import {syncCombatSequence} from '@soul/shared-ui/combat-sequence';
import '@soul/shared-ui/combat-sequence.css';
import {createCombatSfx} from '@soul/audio/combat-sfx';

const q=id=>document.getElementById(id);
const heroSelect=q('battle-hero-model'),enemySelect=q('battle-enemy-model');
for(const select of [heroSelect,enemySelect])select.replaceChildren(...REVIEW_BATTLE_MODELS.map(row=>{const option=document.createElement('option');option.value=row.id;option.textContent=row.label;return option;}));
heroSelect.value='kaykit.rogue.v1';enemySelect.value='kaykit.knight.v1';

const phasePanel=q('battle-phase'),phaseMeta=q('phase-meta'),phaseHistory=q('phase-history'),soundButton=q('battle-sound');
const battleSfx=createCombatSfx();

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
let encounterMode='duel',host=null,playing=true,last=performance.now(),lastCore=null,finishedAt=0,lastSequenceAction='',lastSequencePhase='',lastAudioAttacks={hero:'',enemy:''};

function syncSoundButton(){
  if(!soundButton)return;
  soundButton.dataset.enabled=String(battleSfx.enabled);
  soundButton.setAttribute('aria-pressed',String(battleSfx.enabled));
  soundButton.textContent=`音 ${battleSfx.enabled?'ON':'OFF'}`;
}

function resetBattle({preservePlaying=false}={}){
  const resume=preservePlaying?playing:true;
  memory.clear();lastCore=null;finishedAt=0;lastSequenceAction='';lastSequencePhase='';lastAudioAttacks={hero:'',enemy:''};phaseHistory?.replaceChildren();battleStage?.resetRound();battleSfx.reset();if(battleSfx.unlocked)battleSfx.draw();
  host=new RaidHost({villageId:'develop-visual-review',storage,now:()=>Date.now()});
  host.join('demon',{type:'join',app:'demon',role:'demon',playerId:'review-demon',name:'Demon'});
  host.join('human',{type:'join',app:'rinne',role:'human',playerId:'review-human',name:'Human'});
  host.input('demon',{type:'state',x:-1.2,z:0,yaw:Math.PI/2,state:'combat',action:null});
  host.input('human',{type:'state',x:1.2,z:0,yaw:-Math.PI/2,state:'combat',action:null});
  host.tick(1/60);lastCore=host.battle?.core?.state?.()||null;playing=resume;last=performance.now();
}

function renderPhase(core){
  const state=reviewBattlePhaseState(core);
  syncCombatSequence(phasePanel,state.phase);
  const action=core?.hero?.attack||state.skill||'間合いを測る';
  phaseMeta.textContent=action;
  if(action!==lastSequenceAction||state.phase!==lastSequencePhase){
    if(lastSequenceAction){const item=document.createElement('span');item.textContent=lastSequenceAction;phaseHistory?.prepend(item);setTimeout(()=>item.remove(),2700);}
    lastSequenceAction=action;lastSequencePhase=state.phase;
  }
}
function syncBattleAudio(core){
  for(const side of ['hero','enemy']){
    const next=String(core?.[side]?.attack||'');
    if(next&&next!==lastAudioAttacks[side])battleSfx.slash();
    lastAudioAttacks[side]=next;
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
  syncBattleAudio(core);renderPhase(core);battleStage?.sync(core,dt,{followCamera,encounterMode});
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
for(const button of document.querySelectorAll('[data-battle-mode]'))button.addEventListener('click',()=>{encounterMode=button.dataset.battleMode==='melee'?'melee':'duel';for(const item of document.querySelectorAll('[data-battle-mode]'))item.setAttribute('aria-pressed',String(item===button));battleStage?.setEncounterMode?.(encounterMode);resetBattle();});
soundButton?.addEventListener('click',event=>{event.stopPropagation();battleSfx.toggle();syncSoundButton();});
window.addEventListener('pagehide',()=>{battleStage?.dispose();battleSfx.dispose();},{once:true});

syncSoundButton();
resetBattle();void ensureBattleStage();requestAnimationFrame(frame);
