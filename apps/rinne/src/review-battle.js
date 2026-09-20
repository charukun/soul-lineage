import {createTidebreakRuntime} from '@soul/tidebreak-combat';
import {CAUSAL_ANSWERS,INSPIRATION_QUESTIONS} from '@soul/game-data';
import {REVIEW_BATTLE_MODELS,createReviewBattleStage} from './review-battle-stage.js';
import {tidebreakWeaponFor} from './rebuild/combat.js';
import {applyChoreographyImpact,combatBodySnapshot,COMBAT_BODY_PARTS,strategyForState} from './rebuild/combat-choreography.js';
import {tidebreakMindsetFromVector} from './rebuild/combat-tactics.js';
import {advanceReviewFinisher,createReviewFinisher,reviewBattleLoopDue,reviewBattlePhaseState} from './review-battle-state.js';
import {REVIEW_INSPIRATION_TIMELINE,generatedReviewInspirationCandidates,pickGeneratedReviewInspiration,pickReviewInspiration} from './review-battle-inspiration.js';
import {addTechniqueToReviewChain,createReviewTechniqueComposition,flattenReviewTechniqueChain,reviewChainLabel,reviewTechniqueStages} from './review-technique-composition.js';
import {syncCombatSequence} from '@soul/shared-ui/combat-sequence';
import '@soul/shared-ui/combat-sequence.css';
import {createCombatSfx} from '@soul/audio/combat-sfx';
import {SwipeInput} from '@soul/input';
import {mountRinneReviewShell} from './review-lab-shell.js';
mountRinneReviewShell('battle');

const q=id=>document.getElementById(id);
const enemyModel='skeleton-minion',weaponSelect=q('battle-weapon');
const modelLabel=id=>REVIEW_BATTLE_MODELS.find(row=>row.id===id)?.label||id;
const phasePanel=q('battle-phase'),phaseMeta=q('phase-meta'),phaseHistory=q('phase-history'),soundButton=q('battle-sound'),historyNode=q('battle-inspiration-history'),historyList=q('battle-inspiration-history-list'),historyOpen=q('battle-history-open'),historyClose=q('battle-history-close'),historyCount=q('battle-history-count');
const battleSfx=createCombatSfx(),loopEnabled=true,followCamera=true;
let encounterMode='duel',cameraSystem='rinne',battleStage=null,battleStagePromise=null,inspirationMode='normal',lastInspirationPhase='',selectedWeapon='sword',inspirationSequenceActive=false;
let strategyA='balanced',strategyB='patient',strategyVariant='A',reviewSeed=6197,reviewInjury='none',reviewHeroBody=null,reviewEnemyBody=null;
let runtime=null,last=performance.now(),lastCore=null,finishedAt=0,finisher=null,lastSequenceAction='',lastSequencePhase='',lastAudioAttacks=new Map(),signTimer=0,bulbTimer=0;
const INSPIRATION_BULB_HOLD_MS=550;
const insightHistory=[],reviewTechniqueSeen=new Map(),learnedSlots={jo:null,ha:null,kyu:null};
let techniqueComposition=createReviewTechniqueComposition(),compositionWeapon='';
// Shared with Demon and Rinne gameplay: one swipe parser owns drag, deadzone and terminal flick semantics after develop reconciliation.
const reviewSwipe=new SwipeInput();
let insightHistoryOpen=false;
const phaseLabel=phase=>({jo:'序',ha:'破',kyu:'急'})[phase]||'破';
const runtimeWeapon=()=>tidebreakWeaponFor(selectedWeapon);
function renderTechniqueComposition(){
  const root=q('battle-technique-composition');if(!root)return;
  const sections=['jo','ha','kyu'].map(phase=>{
    const section=document.createElement('section');section.className='technique-chain';section.dataset.chainPhase=phase;
    const head=document.createElement('header'),label=document.createElement('b'),preview=document.createElement('button');label.textContent=reviewChainLabel(phase,techniqueComposition[phase].length);preview.type='button';preview.textContent='試演';preview.setAttribute('data-chain-preview',phase);head.append(label,preview);
    const flow=document.createElement('div');flow.className='technique-chain__flow';
    for(const [index,technique] of techniqueComposition[phase].entries()){
      if(index){const arrow=document.createElement('i');arrow.textContent='›';arrow.setAttribute('aria-hidden','true');flow.append(arrow);}
      const card=document.createElement('article');card.className='technique-card';card.title=technique.name;
      const name=document.createElement('strong');name.textContent=technique.name;
      const stages=document.createElement('span');stages.className='technique-card__stages';
      for(const stage of reviewTechniqueStages(technique)){const chip=document.createElement('small');chip.textContent=stage.label;chip.title=stage.kind;stages.append(chip);}
      card.append(name,stages);flow.append(card);
    }
    section.append(head,flow);return section;
  });
  root.replaceChildren(...sections);
}
function ensureTechniqueComposition(loadout){
  if(compositionWeapon!==selectedWeapon){compositionWeapon=selectedWeapon;techniqueComposition=createReviewTechniqueComposition();for(const phase of ['jo','ha','kyu'])learnedSlots[phase]=null;}
  for(const phase of ['jo','ha','kyu'])if(!techniqueComposition[phase].length){const recipe=loadout?.[phase];addTechniqueToReviewChain(techniqueComposition,phase,{id:`base-${selectedWeapon}-${phase}`,name:recipe?.name||'基本技',steps:recipe?.steps||[]});}
  renderTechniqueComposition();
}
async function previewTechniqueChain(phase){
  if(inspirationSequenceActive)return;const chain=techniqueComposition[phase]||[],steps=flattenReviewTechniqueChain(chain);if(!steps.length)return;
  inspirationSequenceActive=true;try{const stage=await ensureBattleStage();stage.triggerInspiration({id:`review-chain-${phase}`,name:reviewChainLabel(phase,chain.length),steps,phase});}catch{inspirationSequenceActive=false;hideInspirationBulb();}
}
function hideInspirationBanner(){const banner=q('battle-inspiration');if(!banner)return;banner.hidden=true;delete banner.dataset.burst;delete banner.dataset.sequence;}
function hideInspirationBulb(){clearTimeout(bulbTimer);bulbTimer=0;const bulb=q('battle-lightbulb');if(bulb)bulb.hidden=true;}
function showInspirationBulb(){const bulb=q('battle-lightbulb');if(!bulb)return;clearTimeout(bulbTimer);bulb.hidden=true;void bulb.offsetWidth;bulb.hidden=false;bulbTimer=setTimeout(hideInspirationBulb,INSPIRATION_BULB_HOLD_MS);}
function hideReviewSign(){const sign=q('battle-sign');if(sign)sign.hidden=true;clearTimeout(signTimer);}
function showReviewSign(technique){
  const sign=q('battle-sign'),row=CAUSAL_ANSWERS.find(item=>item.id===technique?.id);if(!sign)return;
  const question=technique?.sign||row?.questions?.map(id=>INSPIRATION_QUESTIONS[id]).find(Boolean)||row?.mechanic||'この間なら、届くかもしれない。';
  clearTimeout(signTimer);sign.hidden=true;sign.textContent=question;void sign.offsetWidth;sign.hidden=false;sign.dataset.signState='兆し';signTimer=setTimeout(()=>{sign.hidden=true;},2350);
}
function handleInspirationCue(cue,payload={}){
  const banner=q('battle-inspiration');
  if(cue==='spark'){inspirationSequenceActive=true;hideInspirationBanner();hideReviewSign();showInspirationBulb();battleSfx.inspiration('spark');return;}
  if(cue==='camera'){battleSfx.inspiration('camera');return;}
  if(cue==='spacing'){showReviewSign(payload);battleSfx.inspiration('anticipation');return;}
  if(cue==='stagger'){battleSfx.inspiration('stagger');return;}
  if(cue==='reveal'&&banner){hideReviewSign();const chainPreview=String(payload.id||'').startsWith('review-chain-');q('battle-inspiration-name').textContent=payload.name||'';q('battle-inspiration-phase').textContent=chainPreview?`${phaseLabel(payload.phase)}の連 · ${(payload.steps||[]).length}段を通し試演`:`${phaseLabel(payload.phase)} · ${selectedWeapon}の型から閃いた`;banner.hidden=false;banner.dataset.burst='true';banner.dataset.sequence='reveal';battleSfx.inspiration('reveal');return;}
  if(cue==='execute'){battleSfx.inspiration('execute');return;}
  if(cue==='done'){inspirationSequenceActive=false;hideInspirationBulb();setTimeout(hideInspirationBanner,280);}
}

function syncModelLabels(){if(q('enemy-name'))q('enemy-name').textContent='スケルトン';}
async function ensureBattleStage(){
  if(battleStage)return battleStage;if(battleStagePromise)return battleStagePromise;
  q('battle-model-status').textContent='モデル準備中';
  battleStagePromise=createReviewBattleStage({canvas:q('battle-canvas'),onStatus:text=>{q('battle-model-status').textContent=text;},onInspirationCue:handleInspirationCue})
    .then(stage=>{battleStage=stage;stage.setModel('enemy',enemyModel);stage.setEncounterMode(encounterMode);stage.setWeapon(selectedWeapon);return stage;})
    .catch(error=>{q('battle-model-status').textContent=`モデル読込失敗 · ${error.message}`;q('battle-canvas').dataset.battleModels='failed';throw error;});
  return battleStagePromise;
}
function syncSoundButton(){if(!soundButton)return;soundButton.dataset.enabled=String(battleSfx.enabled);soundButton.dataset.unlocked=String(battleSfx.unlocked);soundButton.setAttribute('aria-pressed',String(battleSfx.enabled));soundButton.textContent=`音 ${battleSfx.enabled?(battleSfx.unlocked?'ON':'TAP'):'OFF'}`;}

function runtimeRecipe(technique,phase,weapon){
  if(!technique)return null;
  const steps=(technique.steps||[]).slice(0,3).map(step=>({kind:step.kind,footwork:step.footwork||'stay',charge:step.charge||'none'}));
  while(steps.length<3)steps.push({kind:'ready',footwork:'stay',charge:'none'});
  return{id:`review-${phase}-${technique.id}`,name:technique.name,type:'normal',weapon,element:'none',rhythm:'flow',tempo:1,aura:'none',steps};
}
function runtimeLoadout(engine,weapon){
  const current=engine.loadout(),templates=engine.templates().filter(row=>row.weapon===weapon&&row.type!=='reaction'),result={uke:current.uke};
  for(const [index,phase] of ['jo','ha','kyu'].entries())result[phase]=runtimeRecipe(learnedSlots[phase],phase,weapon)||structuredClone(templates[index%Math.max(1,templates.length)]||current[phase]);
  return result;
}
function makeReviewBody(role,strategy){
  const state={seed:reviewSeed+(role==='enemy'?101:0),generation:1,ageSeconds:0,maxHp:role==='hero'?230:180,injuries:{},combatStrategy:strategy};
  if(reviewInjury!=='none'&&role==='hero')state.injuries[reviewInjury]={severity:.72,at:0};
  combatBodySnapshot(state);return state;
}
function syncBodyReadout(){
  const node=q('battle-body-readout');if(!node||!reviewHeroBody)return;const snapshot=combatBodySnapshot(reviewHeroBody);
  node.textContent=COMBAT_BODY_PARTS.map(part=>`${snapshot[part].label} ${snapshot[part].durability}`).join(' · ');
}
function resetBattle(){
  reviewSwipe.cancel();lastCore=null;finishedAt=0;finisher=null;hideReviewSign();hideInspirationBulb();inspirationSequenceActive=false;lastSequenceAction='';lastSequencePhase='';lastAudioAttacks.clear();phaseHistory?.replaceChildren();battleStage?.resetRound();battleSfx.reset();if(battleSfx.unlocked)battleSfx.draw();
  const weapon=runtimeWeapon(),group=encounterMode==='one-v-three',strategy=strategyVariant==='A'?strategyA:strategyB;reviewHeroBody=makeReviewBody('hero',strategy);reviewEnemyBody=makeReviewBody('enemy','balanced');
  runtime=createTidebreakRuntime({seed:reviewSeed+(group?31:0),weapon,onImpact:impact=>{battleStage?.presentImpact?.(impact);battleSfx.impact({guard:Boolean(impact?.guard),power:Number(impact?.power)||.7});}});
  const loadout=runtimeLoadout(runtime,weapon);ensureTechniqueComposition(loadout);const positions=group
    ?{hero:{x:-2.65,z:0},enemy:{x:2.65,z:0},enemies:[{x:2.65,z:0},{x:2.45,z:-1.75},{x:2.45,z:1.75}]}
    :{hero:{x:-2.65,z:0},enemy:{x:2.65,z:0}};
  runtime.configure({weapon,loadout,opponent:group?'group':'duel',hp:230,maxhp:230,enemyHp:180,enemyWeapon:'sword',enemyStyle:'balanced',mindset:tidebreakMindsetFromVector(strategyForState(reviewHeroBody)),positions,...(group?{enemies:[{weapon:'sword',hp:180},{weapon:'spear',hp:165},{weapon:'axe',hp:195}]}:{})});
  lastCore=runtime.state();last=performance.now();battleStage?.setEncounterMode(encounterMode);syncBodyReadout();
}
function renderPhase(core){
  const state=reviewBattlePhaseState(core);syncCombatSequence(phasePanel,state.phase);const footPhase=q('battle-foot-phase');if(footPhase)footPhase.dataset.phase=state.phase||'idle';const action=core?.hero?.attack||state.skill||'間合いを測る';phaseMeta.textContent=action;
  for(const chain of document.querySelectorAll('#battle-technique-composition [data-chain-phase]'))chain.dataset.active=String(chain.dataset.chainPhase===state.heroPhase);
  if(action!==lastSequenceAction||state.phase!==lastSequencePhase){if(lastSequenceAction){const item=document.createElement('span');item.textContent=`${phaseLabel(lastSequencePhase)} · ${lastSequenceAction}`;phaseHistory?.prepend(item);while(phaseHistory?.children.length>3)phaseHistory.lastElementChild?.remove();setTimeout(()=>item.remove(),2700);}lastSequenceAction=action;lastSequencePhase=state.phase;}
}
function syncBattleAudio(core){
  const actors=[['hero',core?.hero],...(core?.enemies||[]).map((actor,index)=>[`enemy-${index}`,actor])];
  for(const [key,actor] of actors){const segment=actor?.weaponSegment,active=Boolean(segment?.active),attack=`${actor?.slot||''}:${actor?.attack||''}`,previous=lastAudioAttacks.get(key)||{active:false,attack:''};if(active&&(!previous.active||previous.attack!==attack))battleSfx.swing({weapon:segment?.weapon||selectedWeapon,power:.55+Math.min(.4,Number(actor?.progress)||0)});lastAudioAttacks.set(key,{active,attack});}
}

function weightedTechnique(phase){
  const key=`${selectedWeapon}:${phase}`,seen=reviewTechniqueSeen.get(key)||new Set();reviewTechniqueSeen.set(key,seen);
  let technique=pickGeneratedReviewInspiration({weapon:selectedWeapon,phase,seenIds:[...seen],encounterMode},Math.random);
  if(!technique&&generatedReviewInspirationCandidates({weapon:selectedWeapon,phase,encounterMode}).length){seen.clear();technique=pickGeneratedReviewInspiration({weapon:selectedWeapon,phase,encounterMode},Math.random);}
  if(!technique){technique=pickReviewInspiration(CAUSAL_ANSWERS,{weapon:selectedWeapon,phase,learnedIds:[...seen],encounterMode},Math.random);if(!technique){seen.clear();technique=pickReviewInspiration(CAUSAL_ANSWERS,{weapon:selectedWeapon,phase,encounterMode},Math.random);}}
  if(technique)seen.add(technique.id);return technique;
}
function copyRepairRequest(row){
  const text=`閃き技「${row.name}」の修整依頼です。武器: ${selectedWeapon} / 技ID: ${row.id} / モーション: ${row.steps.map(step=>step.kind).join(' → ')} / 序破急: ${row.phases.join(', ')}。モーション・VFX・SFX・接触・カメラをこの技について確認して修整してください。`;
  navigator.clipboard?.writeText(text).catch(()=>{});
}
function renderInsightHistory(){
  if(historyCount)historyCount.textContent=String(insightHistory.length);
  if(historyNode)historyNode.hidden=!insightHistoryOpen;
  if(!historyList)return;
  if(!insightHistory.length){const empty=document.createElement('p');empty.className='inspiration-history__empty';empty.textContent='この戦闘では、まだ閃きは記録されていません。';historyList.replaceChildren(empty);return;}
  historyList.replaceChildren(...insightHistory.map(row=>{const item=document.createElement('div');item.className='inspiration-history__row';const name=document.createElement('strong');name.textContent=`${row.name} · ${row.weaponLabel}`;const replay=document.createElement('button');replay.type='button';replay.textContent='再発動';replay.addEventListener('click',()=>activateInsight(row.technique,true,row.phase));const copy=document.createElement('button');copy.type='button';copy.textContent='修整依頼をコピー';copy.addEventListener('click',()=>copyRepairRequest(row.technique));item.append(name,replay,copy);return item;}));
}
function activateInsight(technique,replay=false,phase='ha'){
  if(!technique||inspirationSequenceActive)return;
  inspirationSequenceActive=true;
  if(!replay){learnedSlots[phase]=technique;addTechniqueToReviewChain(techniqueComposition,phase,technique);renderTechniqueComposition();}
  void ensureBattleStage().then(stage=>stage.triggerInspiration({id:technique.id,name:technique.name,steps:technique.steps,phase,duration:REVIEW_INSPIRATION_TIMELINE.end})).catch(()=>{inspirationSequenceActive=false;hideInspirationBulb();});
  if(!replay){insightHistory.unshift({technique,name:technique.name,phase,weapon:selectedWeapon,weaponLabel:weaponSelect.selectedOptions[0]?.textContent||selectedWeapon});if(insightHistory.length>8)insightHistory.length=8;renderInsightHistory();}
}
function maybeInspire(phase){
  if(!phase||phase===lastInspirationPhase||inspirationSequenceActive)return;lastInspirationPhase=phase;const chance=inspirationMode==='boost'?.82:.16;
  if(Math.random()<chance){const technique=weightedTechnique(phase);if(technique)activateInsight(technique,false,phase);}
}

function syncBattle(dt){
  const core=lastCore||runtime?.state?.();if(!core)return;
  const enemies=core.enemies||[core.enemy].filter(Boolean),heroWon=enemies.length>0&&enemies.every(enemy=>enemy.dead),finished=Boolean(core.done);
  q('battle-time').textContent=`${Number(core.time||0).toFixed(1)}秒`;q('battle-result').textContent=finished?(heroWon?'主人公 勝利':'敵 勝利'):(encounterMode==='one-v-three'?'1v3 戦闘中':'戦闘中');
  syncBattleAudio(core);renderPhase(core);const phase=reviewBattlePhaseState(core).phase;if(phase)maybeInspire(phase);else lastInspirationPhase='';battleStage?.sync(core,dt,{followCamera,encounterMode,cameraSystem});
}
function advanceBattle(dt){
  if(!runtime)return;
  if(finisher){
    const frame=advanceReviewFinisher(finisher,dt);finisher=frame.run;lastCore=frame.core;
    if(frame.impact){battleSfx.slash();battleStage?.presentFinisherImpact?.(lastCore,frame.targetIndex);}
    return;
  }
  const angle=battleStage?.cameraAngle?.()||0,input=reviewSwipe.vector(angle);
  runtime.input(input.screenX,input.screenY,input.amount,angle);const previous=lastCore,next=runtime.step(dt);
  const heroLoss=Math.max(0,(Number(previous?.hero?.hp)||0)-(Number(next?.hero?.hp)||0)),enemyLoss=Math.max(0,(Number(previous?.enemy?.hp)||0)-(Number(next?.enemy?.hp)||0));
  if(heroLoss>.001)applyChoreographyImpact(reviewHeroBody,{damage:heroLoss,maxIntegrity:230,sector:'front',sourceId:'review-enemy',phase:next?.enemy?.slot||'ha'});
  if(enemyLoss>.001)applyChoreographyImpact(reviewEnemyBody,{damage:enemyLoss,maxIntegrity:180,sector:'front',sourceId:'review-hero',phase:next?.hero?.slot||'ha'});
  syncBodyReadout();const ending=createReviewFinisher(next,previous);
  if(ending){finisher=ending;const frame=advanceReviewFinisher(finisher,0);finisher=frame.run;lastCore=frame.core;}
  else lastCore=next;
}
function frame(now){
  const dt=Math.min(.05,Math.max(0,(now-last)/1000));last=now;const finished=Boolean(lastCore?.done);
  if(runtime&&!finished&&!inspirationSequenceActive)advanceBattle(dt);
  const nextFinished=Boolean(lastCore?.done);if(nextFinished&&!finishedAt)finishedAt=now;else if(!nextFinished)finishedAt=0;
  if(reviewBattleLoopDue({loopEnabled,playing:true,finished:nextFinished,finishedAt,now}))resetBattle();syncBattle(dt);requestAnimationFrame(frame);
}

const battleCanvas=q('battle-canvas');
battleCanvas?.addEventListener('pointerdown',event=>{if((event.pointerType==='mouse'&&event.button!==0)||!reviewSwipe.down(event.pointerId,event.clientX,event.clientY,performance.now()))return;battleCanvas.setPointerCapture?.(event.pointerId);event.preventDefault();},{passive:false});
battleCanvas?.addEventListener('pointermove',event=>{if(!reviewSwipe.move(event.pointerId,event.clientX,event.clientY,performance.now()))return;event.preventDefault();},{passive:false});
battleCanvas?.addEventListener('pointerup',event=>{if(reviewSwipe.id!==event.pointerId)return;event.preventDefault();reviewSwipe.up(event.pointerId,event.clientX,event.clientY,performance.now());if(battleCanvas.hasPointerCapture?.(event.pointerId))battleCanvas.releasePointerCapture(event.pointerId);},{passive:false});
const cancelReviewSwipe=()=>reviewSwipe.cancel();
battleCanvas?.addEventListener('pointercancel',cancelReviewSwipe,{passive:true});battleCanvas?.addEventListener('lostpointercapture',()=>{if(reviewSwipe.id!==null)reviewSwipe.cancel();},{passive:true});
q('camera-zoom-in')?.addEventListener('click',()=>void ensureBattleStage().then(stage=>stage.zoomBy(-.14)));
q('camera-zoom-out')?.addEventListener('click',()=>void ensureBattleStage().then(stage=>stage.zoomBy(.14)));
q('battle-technique-composition')?.addEventListener('click',event=>{const button=event.target.closest?.('[data-chain-preview]');if(button)void previewTechniqueChain(button.getAttribute('data-chain-preview'));});

for(const button of document.querySelectorAll('[data-battle-mode]'))button.addEventListener('click',()=>{encounterMode=button.dataset.battleMode==='one-v-three'?'one-v-three':'duel';for(const item of document.querySelectorAll('[data-battle-mode]'))item.setAttribute('aria-pressed',String(item===button));resetBattle();});
for(const button of document.querySelectorAll('[data-battle-skin]'))button.addEventListener('click',()=>{cameraSystem=button.dataset.battleSkin==='jinku'?'demon':'rinne';phasePanel.dataset.skin=button.dataset.battleSkin;for(const item of document.querySelectorAll('[data-battle-skin]'))item.setAttribute('aria-pressed',String(item===button));});
for(const button of document.querySelectorAll('[data-inspiration-mode]'))button.addEventListener('click',()=>{inspirationMode=button.dataset.inspirationMode==='boost'?'boost':'normal';lastInspirationPhase='';for(const item of document.querySelectorAll('[data-inspiration-mode]'))item.setAttribute('aria-pressed',String(item===button));document.body.dataset.inspirationMode=inspirationMode;});
weaponSelect?.addEventListener('change',()=>{selectedWeapon=weaponSelect.value;lastInspirationPhase='';document.body.dataset.weapon=selectedWeapon;resetBattle();});
q('battle-strategy-a')?.addEventListener('change',event=>{strategyA=event.target.value;strategyVariant='A';q('battle-ab-toggle').textContent='A';resetBattle();});
q('battle-strategy-b')?.addEventListener('change',event=>{strategyB=event.target.value;strategyVariant='B';q('battle-ab-toggle').textContent='B';resetBattle();});
q('battle-ab-toggle')?.addEventListener('click',event=>{strategyVariant=strategyVariant==='A'?'B':'A';event.currentTarget.textContent=strategyVariant;resetBattle();});
q('battle-review-seed')?.addEventListener('change',event=>{reviewSeed=Math.max(1,Number(event.target.value)||6197);resetBattle();});
q('battle-injury-preset')?.addEventListener('change',event=>{reviewInjury=event.target.value;resetBattle();});
historyOpen?.addEventListener('click',()=>{insightHistoryOpen=true;renderInsightHistory();});historyClose?.addEventListener('click',()=>{insightHistoryOpen=false;renderInsightHistory();});
document.addEventListener('pointerdown',()=>{battleSfx.unlock();syncSoundButton();},{passive:true});
soundButton?.addEventListener('click',event=>{event.stopPropagation();battleSfx.toggle();syncSoundButton();});window.addEventListener('pagehide',()=>{battleStage?.dispose();battleSfx.dispose();},{once:true});
syncModelLabels();phasePanel.dataset.skin='rinne';syncSoundButton();renderTechniqueComposition();renderInsightHistory();resetBattle();void ensureBattleStage();requestAnimationFrame(frame);
