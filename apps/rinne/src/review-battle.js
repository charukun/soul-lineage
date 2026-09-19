import {RaidHost} from '@soul/network/raid-host';
import {CAUSAL_ANSWERS} from '@soul/game-data';
import {REVIEW_BATTLE_MODELS,createReviewBattleStage} from './review-battle-stage.js';
import {reviewBattleLoopDue,reviewBattlePhaseState} from './review-battle-state.js';
import {syncCombatSequence} from '@soul/shared-ui/combat-sequence';
import '@soul/shared-ui/combat-sequence.css';
import {createCombatSfx} from '@soul/audio/combat-sfx';
import {mountRinneReviewShell} from './review-lab-shell.js';
mountRinneReviewShell('battle');

const q=id=>document.getElementById(id);
const enemyModel='kaykit.barbarian.v1',weaponSelect=q('battle-weapon');
const modelLabel=id=>REVIEW_BATTLE_MODELS.find(row=>row.id===id)?.label||id;
const phasePanel=q('battle-phase'),phaseMeta=q('phase-meta'),phaseHistory=q('phase-history'),soundButton=q('battle-sound'),historyNode=q('battle-inspiration-history');
const battleSfx=createCombatSfx(),loopEnabled=true,followCamera=true;
let encounterMode='duel',cameraSystem='rinne',battleStage=null,battleStagePromise=null,inspirationMode='normal',lastInspirationPhase='',selectedWeapon='sword';
let host=null,last=performance.now(),lastCore=null,finishedAt=0,lastSequenceAction='',lastSequencePhase='',lastAudioAttacks={hero:'',enemy:''};
const insightHistory=[];

function syncModelLabels(){q('hero-name').textContent='主人公';q('enemy-name').textContent='異形兵';}
async function ensureBattleStage(){
  if(battleStage)return battleStage;if(battleStagePromise)return battleStagePromise;
  q('battle-model-status').textContent='モデル準備中';
  battleStagePromise=createReviewBattleStage({canvas:q('battle-canvas'),onStatus:text=>{q('battle-model-status').textContent=text;}})
    .then(stage=>{battleStage=stage;stage.setModel('enemy',enemyModel);stage.setEncounterMode(encounterMode);stage.setWeapon(selectedWeapon);return stage;})
    .catch(error=>{q('battle-model-status').textContent=`モデル読込失敗 · ${error.message}`;q('battle-canvas').dataset.battleModels='failed';throw error;});
  return battleStagePromise;
}
const memory=new Map(),storage={getItem:key=>memory.has(key)?memory.get(key):null,setItem:(key,value)=>memory.set(key,String(value))};
function syncSoundButton(){if(!soundButton)return;soundButton.dataset.enabled=String(battleSfx.enabled);soundButton.setAttribute('aria-pressed',String(battleSfx.enabled));soundButton.textContent=`音 ${battleSfx.enabled?'ON':'OFF'}`;}

function resetBattle(){
  memory.clear();lastCore=null;finishedAt=0;lastSequenceAction='';lastSequencePhase='';lastAudioAttacks={hero:'',enemy:''};phaseHistory?.replaceChildren();battleStage?.resetRound();battleSfx.reset();if(battleSfx.unlocked)battleSfx.draw();
  host=new RaidHost({villageId:'develop-visual-review',storage,now:()=>Date.now()});
  host.join('demon',{type:'join',app:'demon',role:'demon',playerId:'review-demon',name:'Monster'});
  host.join('human',{type:'join',app:'rinne',role:'human',playerId:'review-human',name:'Hero'});
  // Camera-facing composition starts with the hero lower-left and the hostile upper-right.
  host.input('demon',{type:'state',x:1.65,z:-1.15,yaw:-Math.PI/2,state:'combat',action:null});
  host.input('human',{type:'state',x:-1.65,z:1.15,yaw:Math.PI/2,state:'combat',action:null});
  host.tick(1/60);lastCore=host.battle?.core?.state?.()||null;last=performance.now();
}
function renderPhase(core){
  const state=reviewBattlePhaseState(core);syncCombatSequence(phasePanel,state.phase);const action=core?.hero?.attack||state.skill||'間合いを測る';phaseMeta.textContent=action;
  if(action!==lastSequenceAction||state.phase!==lastSequencePhase){if(lastSequenceAction){const item=document.createElement('span');item.textContent=lastSequenceAction;phaseHistory?.prepend(item);setTimeout(()=>item.remove(),2700);}lastSequenceAction=action;lastSequencePhase=state.phase;}
}
function syncBattleAudio(core){for(const side of ['hero','enemy']){const next=String(core?.[side]?.attack||'');if(next&&next!==lastAudioAttacks[side])battleSfx.slash();lastAudioAttacks[side]=next;}}

const techniquesForWeapon=weapon=>CAUSAL_ANSWERS.filter(row=>['technique','variant'].includes(row.kind)&&row.steps?.length&&row.weapons?.includes(weapon)&&!row.executor);
function weightedTechnique(){
  const preferred=techniquesForWeapon(selectedWeapon),fallback=CAUSAL_ANSWERS.filter(row=>row.kind==='technique'&&row.steps?.length&&!row.executor);
  const pool=preferred.length?preferred:fallback;if(!pool.length)return null;
  // Review mode intentionally randomizes 心得/身体/状況 influence while weapon affinity remains the dominant bias.
  return pool[Math.floor(Math.random()*pool.length)];
}
function copyRepairRequest(row){
  const text=`閃き技「${row.name}」の修整依頼です。武器: ${selectedWeapon} / 技ID: ${row.id} / モーション: ${row.steps.map(step=>step.kind).join(' → ')} / 序破急: ${row.phases.join(', ')}。モーション・VFX・SFX・接触・カメラをこの技について確認して修整してください。`;
  navigator.clipboard?.writeText(text).catch(()=>{});
}
function renderInsightHistory(){
  historyNode.hidden=!insightHistory.length;historyNode.replaceChildren(...insightHistory.map(row=>{const item=document.createElement('div');item.className='inspiration-history__row';const name=document.createElement('strong');name.textContent=`${row.name} · ${row.weaponLabel}`;const replay=document.createElement('button');replay.type='button';replay.textContent='再発動';replay.addEventListener('click',()=>activateInsight(row.technique,true));const copy=document.createElement('button');copy.type='button';copy.textContent='修整依頼をコピー';copy.addEventListener('click',()=>copyRepairRequest(row.technique));item.append(name,replay,copy);return item;}));
}
function activateInsight(technique,replay=false){
  if(!technique)return;const phase=technique.phases[Math.floor(Math.random()*technique.phases.length)]||'ha',banner=q('battle-inspiration'),name=q('battle-inspiration-name'),phaseNode=q('battle-inspiration-phase');
  name.textContent=technique.name;phaseNode.textContent=`${({jo:'序',ha:'破',kyu:'急'})[phase]||'破'} · ${selectedWeapon}の型から閃いた`;banner.hidden=false;banner.dataset.burst='true';clearTimeout(banner._hideTimer);banner._hideTimer=setTimeout(()=>{banner.hidden=true;delete banner.dataset.burst;},1600);
  battleSfx.draw();setTimeout(()=>battleSfx.slash(),220);void ensureBattleStage().then(stage=>stage.triggerInspiration({steps:technique.steps,phase,duration:1.35}));
  if(!replay){insightHistory.unshift({technique,name:technique.name,weapon:selectedWeapon,weaponLabel:weaponSelect.selectedOptions[0]?.textContent||selectedWeapon});if(insightHistory.length>8)insightHistory.length=8;renderInsightHistory();}
}
function maybeInspire(phase){
  if(!phase||phase===lastInspirationPhase)return;lastInspirationPhase=phase;const chance=inspirationMode==='boost'?.82:.16;
  if(Math.random()<chance)activateInsight(weightedTechnique());
}

function syncBattle(dt){
  const battle=host?.battle,currentCore=battle?.core?.state?.();if(currentCore)lastCore=currentCore;const core=currentCore||lastCore;if(!core)return;
  const heroMax=Math.max(1,Number(core.hero.maxhp)||1),enemyMax=Math.max(1,Number(core.enemy.maxhp)||1);
  q('hero-action').textContent=core.hero.attack||'構え';q('enemy-action').textContent=core.enemy.attack||'構え';q('hero-hp').value=Math.max(0,(Number(core.hero.hp)||0)/heroMax);q('enemy-hp').value=Math.max(0,(Number(core.enemy.hp)||0)/enemyMax);q('hero-meta').textContent=`${Math.ceil(Number(core.hero.hp)||0)} / ${heroMax} HP`;q('enemy-meta').textContent=`${Math.ceil(Number(core.enemy.hp)||0)} / ${enemyMax} HP`;q('battle-time').textContent=`${(battle?.time||0).toFixed(1)}秒`;q('battle-result').textContent=battle?.finished?`${battle.winner==='demon'?'敵':'主人公'} 勝利`:(encounterMode==='one-v-three'?'1v3 戦闘中':'戦闘中');
  syncBattleAudio(core);renderPhase(core);const phase=reviewBattlePhaseState(core).phase;if(phase)maybeInspire(phase);else lastInspirationPhase='';battleStage?.sync(core,dt,{followCamera,encounterMode,cameraSystem});
}
function advanceBattle(dt){const runtime=host?.battle?.core;if(!runtime)return;const before=runtime.state?.();if(before)lastCore=before;host.tick(dt);const after=runtime.state?.();if(after)lastCore=after;}
function frame(now){const dt=Math.min(.05,Math.max(0,(now-last)/1000));last=now;if(host?.battle&&!host.battle.finished)advanceBattle(dt);const finished=Boolean(host?.battle?.finished);if(finished&&!finishedAt)finishedAt=now;else if(!finished)finishedAt=0;if(reviewBattleLoopDue({loopEnabled,playing:true,finished,finishedAt,now}))resetBattle();syncBattle(dt);requestAnimationFrame(frame);}

for(const button of document.querySelectorAll('[data-battle-mode]'))button.addEventListener('click',()=>{encounterMode=button.dataset.battleMode==='one-v-three'?'one-v-three':'duel';for(const item of document.querySelectorAll('[data-battle-mode]'))item.setAttribute('aria-pressed',String(item===button));battleStage?.setEncounterMode(encounterMode);resetBattle();});
for(const button of document.querySelectorAll('[data-battle-skin]'))button.addEventListener('click',()=>{cameraSystem=button.dataset.battleSkin==='jinku'?'demon':'rinne';phasePanel.dataset.skin=button.dataset.battleSkin;for(const item of document.querySelectorAll('[data-battle-skin]'))item.setAttribute('aria-pressed',String(item===button));});
for(const button of document.querySelectorAll('[data-inspiration-mode]'))button.addEventListener('click',()=>{inspirationMode=button.dataset.inspirationMode==='boost'?'boost':'normal';lastInspirationPhase='';for(const item of document.querySelectorAll('[data-inspiration-mode]'))item.setAttribute('aria-pressed',String(item===button));document.body.dataset.inspirationMode=inspirationMode;});
weaponSelect?.addEventListener('change',()=>{selectedWeapon=weaponSelect.value;lastInspirationPhase='';document.body.dataset.weapon=selectedWeapon;battleStage?.setWeapon(selectedWeapon);});
soundButton?.addEventListener('click',event=>{event.stopPropagation();battleSfx.toggle();syncSoundButton();});window.addEventListener('pagehide',()=>{battleStage?.dispose();battleSfx.dispose();},{once:true});
syncModelLabels();phasePanel.dataset.skin='rinne';syncSoundButton();resetBattle();void ensureBattleStage();requestAnimationFrame(frame);
