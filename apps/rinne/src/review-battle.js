import {RaidHost} from '@soul/network/raid-host';
import {REVIEW_BATTLE_MODELS,createReviewBattleStage} from './review-battle-stage.js';
import {reviewBattleLoopDue,reviewBattlePhaseState} from './review-battle-state.js';
import {syncCombatSequence} from '@soul/shared-ui/combat-sequence';
import '@soul/shared-ui/combat-sequence.css';
import '@soul/shared-ui/review-surface.css';
import {createCombatSfx} from '@soul/audio/combat-sfx';
import {ACTION_SKILLS} from './rebuild/skill-system.js';
import {sequenceHudState} from './combat-sequence-hud.js';

const q=id=>document.getElementById(id);
const heroSelect=q('battle-hero-model'),enemySelect=q('battle-enemy-model');
const modelLabel=id=>REVIEW_BATTLE_MODELS.find(row=>row.id===id)?.label||id;
for(const select of [heroSelect,enemySelect])select.replaceChildren(...REVIEW_BATTLE_MODELS.map(row=>{const option=document.createElement('option');option.value=row.id;option.textContent=row.label;return option;}));
heroSelect.value='kaykit.rogue.v1';enemySelect.value='kaykit.knight.v1';

const phasePanel=q('battle-phase'),phaseMeta=q('phase-meta'),phaseHistory=q('phase-history'),soundButton=q('battle-sound');
const inspirationButton=q('battle-inspire'),inspirationBanner=q('battle-inspiration'),inspirationName=q('battle-inspiration-name'),inspirationPhase=q('battle-inspiration-phase');
const battleSfx=createCombatSfx();
const loopEnabled=true,followCamera=true,reviewPhases=Object.freeze(['jo','ha','kyu']),phaseLabel=phase=>({jo:'序',ha:'破',kyu:'急'})[phase]||'';
const techniquePool=Object.freeze(ACTION_SKILLS.filter(row=>row?.id&&String(row?.name||'').trim()));
let encounterMode='duel',cameraSystem='rinne',battleStage=null,battleStagePromise=null,inspirationPreview=null,inspirationHideTimer=0,inspirationSoundTimer=0;
let host=null,last=performance.now(),lastCore=null,finishedAt=0,lastSequenceAction='',lastSequencePhase='',lastAudioAttacks={hero:'',enemy:''};

function syncModelLabels(){
  const hero=q('hero-name'),enemy=q('enemy-name');
  if(hero)hero.textContent=modelLabel(heroSelect.value);
  if(enemy)enemy.textContent=modelLabel(enemySelect.value);
}
async function ensureBattleStage(){
  if(battleStage)return battleStage;
  if(battleStagePromise)return battleStagePromise;
  q('battle-model-status').textContent='モデル準備中';
  battleStagePromise=createReviewBattleStage({canvas:q('battle-canvas'),onStatus:text=>{q('battle-model-status').textContent=text;}})
    .then(stage=>{battleStage=stage;stage.setModel('hero',heroSelect.value);stage.setModel('enemy',enemySelect.value);stage.setEncounterMode(encounterMode);return stage;})
    .catch(error=>{q('battle-model-status').textContent=`モデル読込失敗 · ${error.message}`;q('battle-canvas').dataset.battleModels='failed';throw error;});
  return battleStagePromise;
}

heroSelect.addEventListener('change',()=>{syncModelLabels();void ensureBattleStage().then(stage=>stage.setModel('hero',heroSelect.value));});
enemySelect.addEventListener('change',()=>{syncModelLabels();void ensureBattleStage().then(stage=>stage.setModel('enemy',enemySelect.value));});

const memory=new Map();
const storage={getItem:key=>memory.has(key)?memory.get(key):null,setItem:(key,value)=>memory.set(key,String(value))};

function syncSoundButton(){
  if(!soundButton)return;
  soundButton.dataset.enabled=String(battleSfx.enabled);
  soundButton.setAttribute('aria-pressed',String(battleSfx.enabled));
  soundButton.textContent=`音 ${battleSfx.enabled?'ON':'OFF'}`;
}

function resetBattle(){
  memory.clear();lastCore=null;finishedAt=0;lastSequenceAction='';lastSequencePhase='';lastAudioAttacks={hero:'',enemy:''};phaseHistory?.replaceChildren();inspirationPreview=null;clearTimeout(inspirationHideTimer);clearTimeout(inspirationSoundTimer);if(inspirationBanner)inspirationBanner.hidden=true;battleStage?.resetRound();battleSfx.reset();if(battleSfx.unlocked)battleSfx.draw();
  host=new RaidHost({villageId:'develop-visual-review',storage,now:()=>Date.now()});
  host.join('demon',{type:'join',app:'demon',role:'demon',playerId:'review-demon',name:'Demon'});
  host.join('human',{type:'join',app:'rinne',role:'human',playerId:'review-human',name:'Human'});
  host.input('demon',{type:'state',x:-1.2,z:0,yaw:Math.PI/2,state:'combat',action:null});
  host.input('human',{type:'state',x:1.2,z:0,yaw:-Math.PI/2,state:'combat',action:null});
  host.tick(1/60);lastCore=host.battle?.core?.state?.()||null;last=performance.now();
}

function activeInspiration(now=performance.now()){
  if(inspirationPreview&&now>=inspirationPreview.until)inspirationPreview=null;
  return inspirationPreview;
}
function renderPhase(core){
  const state=reviewBattlePhaseState(core),preview=activeInspiration(),phase=preview?.phase||state.phase;
  const attack=preview?.name||core?.hero?.attack||state.skill||'',sequence=sequenceHudState({phase,attack});
  phasePanel.hidden=!phase;phasePanel.dataset.comboActive=String(sequence.comboActive);phasePanel.dataset.phase=sequence.comboActive?sequence.activePhase:'idle';
  syncCombatSequence(phasePanel,sequence.comboActive?sequence.activePhase:'',{pulse:sequence.comboActive});
  for(const node of phasePanel.querySelectorAll('[data-combat-phase]'))node.dataset.completed=String(Boolean(sequence.completed[node.dataset.combatPhase]));
  const action=sequence.action||'間合いを測る';phaseMeta.textContent=action;phaseMeta.hidden=!action;
  if(action!==lastSequenceAction||phase!==lastSequencePhase){
    if(lastSequenceAction){const item=document.createElement('span'),badge=document.createElement('b'),label=phaseLabel(lastSequencePhase);if(label){badge.textContent=label;item.append(badge);}item.append(document.createTextNode(lastSequenceAction));phaseHistory?.prepend(item);setTimeout(()=>item.remove(),2700);}
    lastSequenceAction=action;lastSequencePhase=phase;
  }
}
async function triggerInspiration(){
  if(!techniquePool.length)return;
  inspirationButton.disabled=true;battleSfx.unlock();
  try{
    const stage=await ensureBattleStage(),skill=techniquePool[Math.floor(Math.random()*techniquePool.length)],phase=reviewPhases[Math.floor(Math.random()*reviewPhases.length)];
    resetBattle();
    const cue=stage.triggerTechnique({id:skill.id,name:skill.name,phase});
    inspirationPreview={id:skill.id,name:skill.name,phase,until:performance.now()+Math.max(1400,Number(cue?.durationMs)||0)};
    inspirationName.textContent=skill.name;inspirationPhase.textContent=`${phaseLabel(phase)} · モーション / VFX / SFX`;inspirationBanner.hidden=false;
    clearTimeout(inspirationHideTimer);inspirationHideTimer=setTimeout(()=>{inspirationBanner.hidden=true;},1850);
    clearTimeout(inspirationSoundTimer);inspirationSoundTimer=setTimeout(()=>battleSfx.slash(),Math.max(80,Number(cue?.impactDelayMs)||300));
  }finally{inspirationButton.disabled=false;}
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
  q('battle-result').textContent=battle?.finished?`${battle.winner==='demon'?'LEFT':'RIGHT'} 勝利`:(encounterMode==='melee'?'乱戦中':'戦闘中');
  syncBattleAudio(core);renderPhase(core);battleStage?.sync(core,dt,{followCamera,encounterMode,cameraSystem});
}

function advanceBattle(dt){
  const runtime=host?.battle?.core;if(!runtime)return;
  const before=runtime.state?.();if(before)lastCore=before;
  host.tick(dt);
  const after=runtime.state?.();if(after)lastCore=after;
}

function frame(now){
  const dt=Math.min(.05,Math.max(0,(now-last)/1000));last=now;
  if(host?.battle&&!host.battle.finished)advanceBattle(dt);
  const finished=Boolean(host?.battle?.finished);
  if(finished&&!finishedAt)finishedAt=now;else if(!finished)finishedAt=0;
  if(reviewBattleLoopDue({loopEnabled,playing:true,finished,finishedAt,now}))resetBattle();
  syncBattle(dt);requestAnimationFrame(frame);
}

for(const button of document.querySelectorAll('[data-battle-mode]'))button.addEventListener('click',()=>{
  encounterMode=button.dataset.battleMode==='melee'?'melee':'duel';
  for(const item of document.querySelectorAll('[data-battle-mode]'))item.setAttribute('aria-pressed',String(item===button));
  battleStage?.setEncounterMode(encounterMode);resetBattle();
});
for(const button of document.querySelectorAll('[data-battle-skin]'))button.addEventListener('click',()=>{
  cameraSystem=button.dataset.battleSkin==='jinku'?'demon':'rinne';
  phasePanel.dataset.skin=button.dataset.battleSkin;
  for(const item of document.querySelectorAll('[data-battle-skin]'))item.setAttribute('aria-pressed',String(item===button));
});

q('battle-restart').addEventListener('click',resetBattle);
inspirationButton?.addEventListener('click',()=>{void triggerInspiration();});
soundButton?.addEventListener('click',event=>{event.stopPropagation();battleSfx.toggle();syncSoundButton();});
window.addEventListener('pagehide',()=>{clearTimeout(inspirationHideTimer);clearTimeout(inspirationSoundTimer);battleStage?.dispose();battleSfx.dispose();},{once:true});

syncModelLabels();phasePanel.dataset.skin='rinne';syncSoundButton();resetBattle();void ensureBattleStage();requestAnimationFrame(frame);
