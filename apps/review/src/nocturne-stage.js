import {BATTLE2_VERSION} from './battle2-version.js';
import {FIRST_INSPIRATION_PRESENTATION} from '@soul/johakyu-battle';
import {NOCTURNE_FIELD_RADAR_RANGE} from '@soul/johakyu-presentation';
import {createBattle2BodyHud} from './battle2-body-hud.js';
import {johakyuSequenceMarkup} from '@soul/shared-ui/johakyu-hud';
import {battle2SelectionLabel,battle2TechniqueLabel} from './nocturne/battle2-technique-catalog.js';
import {createBattle2LoadoutUI} from './nocturne/battle2-loadout.js';
import {createBattle2CameraPresentation} from './battle2-camera.js';
import {createBattle2MovementInput} from './battle2-movement.js';
import {rinneFieldRadarMarkup,updateRinneFieldRadar} from '@soul/shared-ui/rinne-field-radar';
import {mountReviewStageControls} from '@soul/shared-ui/review-shell';
import {createRinnePlayerHud,rinnePreviewPlayer} from '@soul/shared-ui/rinne-player-hud';
import {createDeathRebirthCinematic} from '@soul/shared-ui/death-rebirth-cinematic';
import '@soul/shared-ui/rinne-primary-four.css';
import '@soul/shared-ui/rinne-loadout-menu.css';
import '@soul/shared-ui/rinne-player-hud.css';
import '@soul/shared-ui/johakyu-hud.css';
import '@soul/shared-ui/rinne-field-radar.css';
import './battle2-field-hud.css';

const SETTINGS_KEY='battle2.settings.v1';
function normalizeBattleSettings(value={}){return{techniqueMode:value?.techniqueMode==='random'?'random':'set',inspirationRate:value?.inspirationRate==='high'?'high':'normal'};}
function readBattleSettings(){try{return normalizeBattleSettings(JSON.parse(globalThis.localStorage?.getItem(SETTINGS_KEY)||'{}'));}catch{return normalizeBattleSettings();}}
function writeBattleSettings(value){try{globalThis.localStorage?.setItem(SETTINGS_KEY,JSON.stringify(normalizeBattleSettings(value)));}catch{}}

const stage=document.querySelector('[data-review-surface="battle2"]');
const deathCinematic=createDeathRebirthCinematic({document,window,host:stage,scope:'stage'});
document.getElementById('battle-sequence-mount').innerHTML=johakyuSequenceMarkup({battle2:true});
const status=document.getElementById('battle2-status'),world=document.getElementById('world'),effects=document.getElementById('effects'),versionNode=document.getElementById('battle2-version'),startButton=document.getElementById('battle2-start');
const inspirationBanner=document.getElementById('battle2-inspiration'),inspirationName=document.getElementById('battle2-inspiration-name');
const hud=document.getElementById('battle-sequence-hud'),phasePanel=document.getElementById('battle-phase'),finisherNode=document.getElementById('battle-sequence-finisher'),currentNode=document.getElementById('battle-sequence-current'),historyNode=document.getElementById('battle-sequence-history');
const previewIdentity=rinnePreviewPlayer((Date.now()^Math.floor(Math.random()*0xffffffff))>>>0);
const playerHud=createRinnePlayerHud(document.getElementById('battle2-player-hud'),previewIdentity);
// Keep the body readout in the same layout as the actual player card.
const bodyHudRoot=document.getElementById('battle2-body-hud');
playerHud.root.append(bodyHudRoot);
const bodyHud=createBattle2BodyHud(bodyHudRoot);
stage.insertAdjacentHTML('beforeend',rinneFieldRadarMarkup({interactive:false}));
const battleRadar=stage.querySelector('[data-field-radar]');
const cameraPresentation=createBattle2CameraPresentation({stage,world});
const movementInput=createBattle2MovementInput({canvas:world,camera:()=>cameraPresentation.snapshot()});
const stageControls=mountReviewStageControls({stage,groups:['[data-battle-mode-control]','[data-battle-technique-mode-control]','[data-battle-weapon-control]','[data-battle-inspiration-rate-control]','[data-battle-inspiration-reset-control]'],label:'戦闘設定'});
const phaseNodes=[...document.querySelectorAll('[data-combat-phase]')],phaseLinks=[...document.querySelectorAll('[data-combat-link]')],techniqueLanes=new Map([...document.querySelectorAll('[data-technique-phase]')].map(node=>[node.dataset.techniquePhase,node])),modeButtons=[...document.querySelectorAll('[data-battle-mode]')],techniqueModeButtons=[...document.querySelectorAll('[data-battle-technique-mode]')],weaponButtons=[...document.querySelectorAll('[data-battle-weapon]')],inspirationRateButtons=[...document.querySelectorAll('[data-battle-inspiration-rate]')];
const resetInspirationButton=document.querySelector('[data-battle-reset-inspiration]');
const PHASE_INDEX={jo:0,ha:1,kyu:2},PHASE_LABEL={jo:'序',ha:'破',kyu:'急'},LINK_INDEX={'jo-ha':0,'ha-kyu':1};
const TECHNIQUE_DISPLAY_MS=2600,LOG_DISPLAY_MS=2400,LOG_VISIBLE_LIMIT=4,NARRATION_MIN_SECONDS=2.2,COMBO_FADE_MS=900;
const MOVE_LABEL={slash:'斬り',back:'返し斬り',thrust:'突き',pierce:'刺突',heavy:'強撃',diagonal:'袈裟斬り',sweep:'薙ぎ',counter:'返し',guard:'受け',brace:'構え',parry:'弾き',ready:'見切り',retreat:'退き',slip:'かわし',bash:'柄打ち',pommel:'柄打ち'};
let runtime=null,sound=null,controller=null,sequence=0,disposed=false,prepared=false,started=false,reviewMeta=null,battleMode='duel',history=[],seenActions=new Set(),seenNarration=new Set(),lastNarrationAt=new Map(),lastBattleId='',lastPhaseCueKey='',comboFadeTimer=0,inspirationTimer=0,comboInterrupted=false;
let state='BOOT',lastError=null,lastExchangeKey='',activeLoadout=null,battleSettings=readBattleSettings(),lastRadarAt=-Infinity;
const loadoutUI=createBattle2LoadoutUI({stage,onChange:next=>{activeLoadout=next;reviewMeta=null;lastExchangeKey='';resetHistory();playerHud?.clearPortrait?.();runtime?.configureLoadout?.(next);syncWeaponButtons();}});
activeLoadout=loadoutUI.value;
hud.dataset.anchored='true';
if(versionNode)versionNode.textContent=`v${BATTLE2_VERSION}`;
function report(next,detail=''){
 if(disposed||((next==='BATTLE'||next==='READY')&&!prepared))return;
 state=next;stage.dataset.state=next;
 startButton.hidden=started||next==='ERROR';startButton.disabled=!prepared||next==='ERROR';
 hud.hidden=!started||!prepared||next==='ERROR';bodyHud?.setVisible(started&&prepared&&next!=='ERROR');
 if(next==='ERROR'){lastError=String(detail);stage.dataset.error=lastError;status.hidden=false;status.setAttribute('role','alert');status.textContent='戦闘を読み込めませんでした。'+lastError+' 再読み込みで再試行できます。';}
 else{status.setAttribute('role','status');status.hidden=['BATTLE','RESETTING','READY'].includes(next);status.textContent=next==='ASSET_LOADING'?'戦闘を読み込み中… '+detail:'戦闘を準備中…';}
}
function hideInspiration(){if(inspirationTimer){clearTimeout(inspirationTimer);inspirationTimer=0;}if(inspirationBanner){inspirationBanner.hidden=true;delete inspirationBanner.dataset.grade;}}
function showInspiration(row){
 if(!inspirationBanner)return;hideInspiration();inspirationName.textContent=row.techniqueName||battle2TechniqueLabel(row.techniqueId);
 const profile=row.firstInspirationPresentation||FIRST_INSPIRATION_PRESENTATION;
 const duration=Math.min(2500,Math.max(500,(Number(profile.hudSeconds)||1.8)*1000));
 inspirationBanner.style.setProperty('--inspiration-duration',`${duration}ms`);
 inspirationBanner.dataset.grade=row.grade||'normal';inspirationBanner.hidden=false;
 sound?.inspiration?.();cameraPresentation.beginInspiration(row,runtime?.inspectActors?.()||[]);
 inspirationTimer=setTimeout(hideInspiration,duration);
}
const motionLabel=kind=>MOVE_LABEL[kind]||kind||'動作';
function shortActionName(meta){return String(meta?.techniqueName||meta?.actionName||motionLabel(meta?.actionMotion)||'').trim();}
function actionHistoryKey(meta){return [meta?.battleId,meta?.exchangeSerial,meta?.cycle,meta?.phase,meta?.techniqueId,meta?.techniqueIndex].join(':');}
function semanticActionLabel(row){
 if(row?.type==='clash')return'武器がぶつかった';
 if(row?.type==='parry')return row.targetId==='hero'?'攻撃を弾いた':row.sourceId==='hero'?'攻撃を弾かれた':'武器を弾いた';
 if(row?.type==='guard')return row.targetId==='hero'?'受け止めた':row.sourceId==='hero'?'受け止められた':'攻撃を受けた';
 if(row?.type==='slip')return row.targetId==='hero'?'かわした':row.sourceId==='hero'?'かわされた':'攻撃をかわした';
 if(row?.type==='player-hit')return'攻撃が命中';
 if(row?.type==='enemy-hit')return'攻撃を受けた';
 if(row?.type==='enemy-downed')return'敵を崩した';
 if(row?.type==='finisher-start')return'止めに入る';
 if(row?.type==='finisher-complete')return'敵を仕留めた';
 if(row?.type==='enemy-spawn')return'新たな敵が現れた';
 return'';
}
function semanticActionPerspective(row){
 if(['player-hit','enemy-downed','finisher-start','finisher-complete'].includes(row?.type))return'self';
 if(row?.type==='enemy-hit')return'opponent';
 if(['parry','guard','slip'].includes(row?.type)){
  if(row.targetId==='hero')return'self';
  if(row.sourceId==='hero')return'opponent';
 }
 return'neutral';
}
function clearVisualHistory(){historyNode.replaceChildren();}
function clearComboFade(){
 if(comboFadeTimer){clearTimeout(comboFadeTimer);comboFadeTimer=0;}
 delete phasePanel.dataset.comboInterrupted;
}
function resetHistory(battleId=''){
 lastBattleId=battleId;lastPhaseCueKey='';seenActions.clear();seenNarration.clear();lastNarrationAt.clear();history=[];comboInterrupted=false;finisherNode.hidden=true;finisherNode.textContent='';clearVisualHistory();for(const lane of techniqueLanes.values())lane.replaceChildren();clearComboFade();
}
function historyDisplayLabel(row){
 const label=String(row?.label||'').trim();return label?label+'…':'';
}
function syncLogRows(){
 const nodes=[...historyNode.querySelectorAll('.battle-sequence-history__flow')];
 nodes.slice(LOG_VISIBLE_LIMIT).forEach(node=>node.remove());
 [...historyNode.querySelectorAll('.battle-sequence-history__flow')].forEach((node,index)=>node.style.setProperty('--log-row',String(index)));
}
function spawnActionText(row){
 const label=historyDisplayLabel(row);if(!label)return;
 const line=document.createElement('span');line.className='battle-sequence-history__flow';line.dataset.phase=row.phase||'idle';line.dataset.kind=row.kind||'semantic';line.dataset.perspective=row.perspective||'neutral';line.textContent=label;
 historyNode.prepend(line);syncLogRows();
 const remove=()=>{line.remove();syncLogRows();};line.addEventListener('animationend',remove,{once:true});setTimeout(remove,LOG_DISPLAY_MS+180);
}
function recordHistory(row){history.push(row);if(history.length>8)history.shift();spawnActionText(row);}
function selectedTechniqueDisplay(meta){
 if(meta?.stageIndex!==0||meta?.techniqueIndex!==0||meta?.actionKind==='finisher'||meta?.actionKind==='reaction')return null;
 const label=meta.techniqueSelection?battle2SelectionLabel(meta.techniqueSelection):shortActionName(meta);
 return label?{label,key:[meta.battleId,meta.cycle,meta.phase,meta.techniqueSelection||meta.techniqueId].join(':')}:null;
}
function pushAction(meta){
 const display=selectedTechniqueDisplay(meta);if(!meta?.actionId||!meta?.techniqueId||!display||seenActions.has(display.key))return;
 seenActions.add(display.key);if(seenActions.size>256)seenActions.delete(seenActions.values().next().value);
 const lane=techniqueLanes.get(meta.phase);if(!lane)return;
 const line=document.createElement('span');line.className='battle-sequence-technique-name';line.dataset.phase=meta.phase;line.textContent=display.label;lane.append(line);
 const remove=()=>line.remove();line.addEventListener('animationend',remove,{once:true});setTimeout(remove,TECHNIQUE_DISPLAY_MS);
}
function pushNarration(row,meta){
 const label=semanticActionLabel(row);if(!label)return false;
 const now=Number(row?.time)||0,semanticKey=[row?.sourceId||row?.actorId||'pair',row?.targetId||'',row?.type,label].join(':'),rapid=['player-hit','enemy-hit','parry','guard','slip','clash','enemy-downed','finisher-start','finisher-complete','enemy-spawn'].includes(row?.type),minimum=rapid?.18:NARRATION_MIN_SECONDS;
 const previous=lastNarrationAt.get(semanticKey)??-Infinity;if(now-previous<minimum)return false;
 const key=[meta?.battleId,row?.type,row?.reason,row?.actorId,row?.id,Math.floor(now*2),label].join(':');if(seenNarration.has(key))return false;
 lastNarrationAt.set(semanticKey,now);seenNarration.add(key);if(seenNarration.size>256)seenNarration.delete(seenNarration.values().next().value);
 recordHistory({phase:'idle',label,kind:'semantic',perspective:semanticActionPerspective(row)});return true;
}
function setPhaseLamps(index){
 for(const node of phaseNodes){const i=PHASE_INDEX[node.dataset.combatPhase];node.dataset.active=String(i===index);node.dataset.completed=String(index>=0&&i<index);node.dataset.lit=String(index>=0&&i<=index);}
 for(const link of phaseLinks){const i=LINK_INDEX[link.dataset.combatLink];link.dataset.lit=String(index>i);link.dataset.current=String(index===i);}
}
function beginComboFade(){
 if(phasePanel.dataset.comboInterrupted==='true')return;
 phasePanel.dataset.comboInterrupted='true';
 comboFadeTimer=setTimeout(()=>{comboFadeTimer=0;delete phasePanel.dataset.comboInterrupted;},COMBO_FADE_MS);
}
function updateSequence(meta){
 reviewMeta=meta;if(meta.battleId!==lastBattleId)resetHistory(meta.battleId);lastExchangeKey=meta.exchangeHistoryKey;
 const finisherName=meta.actionKind==='finisher'?String(meta.finisherName||'葬焉'):'';
 if(finisherNode.textContent!==finisherName)finisherNode.textContent=finisherName;
 finisherNode.hidden=!finisherName;
 finisherNode.setAttribute('aria-label',finisherName?`葬焉モーション ${finisherName}`:'葬焉モーション');
 const cueKey=String(meta.phaseCueKey||'');if(started&&cueKey&&cueKey!==lastPhaseCueKey){lastPhaseCueKey=cueKey;sound?.phaseCue?.({phase:meta.phaseCuePhase||meta.phase});}
 const actors=runtime?.inspectActors?.()||[],hero=actors.find(actor=>actor.self);
 if(hero){
   bodyHud?.update(hero);
   const now=performance.now();
   if(now-lastRadarAt>=90){
     lastRadarAt=now;
     const opponents=actors.filter(actor=>!actor.self&&!actor.dead&&Number.isFinite(actor.position?.x)&&Number.isFinite(actor.position?.z));
     const nearest=opponents.reduce((best,actor)=>!best||Math.hypot(actor.position.x-hero.position.x,actor.position.z-hero.position.z)<Math.hypot(best.position.x-hero.position.x,best.position.z-hero.position.z)?actor:best,null);
     updateRinneFieldRadar(battleRadar,{position:hero.position,yaw:hero.yaw,places:opponents.map((actor,index)=>({x:actor.position.x,z:actor.position.z,category:'enemy',label:`敵${index+1}`})),target:nearest?{x:nearest.position.x,z:nearest.position.z,label:'敵',distance:Math.round(Math.hypot(nearest.position.x-hero.position.x,nearest.position.z-hero.position.z))}:null,range:NOCTURNE_FIELD_RADAR_RANGE,label:'戦闘位置',interactive:false});
   }
 }if(playerHud?.root?.dataset.portrait!=='model'&&runtime?.renderPlayerPortrait?.(playerHud.canvas))playerHud.markPortrait?.('model');
 const activity=Array.isArray(meta.activity)?meta.activity:[];
 for(const row of activity){
  if((row.type==='chain-break'||row.type==='interrupted')&&(row.actorId||row.sourceId)==='hero')comboInterrupted=true;
  if(row.type==='stage-start'&&(row.actorId||row.sourceId)==='hero'&&['jo','ha','kyu'].includes(row.phase))comboInterrupted=false;
  if(row.type==='actor-downed'&&row.targetId==='hero')deathCinematic.down({caption:'意識が遠のく'});
  if(row.type==='finisher-complete'&&row.targetId==='hero')void deathCinematic.playDeath({kicker:'葬焉',title:'DEAD',caption:'因果は、次の刻へ',watchCaption:'時は血を継ぐ'});
  if(row.type==='hero-recovered')deathCinematic.recover();
 }
 for(const row of activity){
  if(row?.type==='inspiration'&&row.techniqueId){
   loadoutUI.learnTechnique(row.techniqueId,row.phase);activeLoadout=loadoutUI.value;runtime?.learnTechnique?.(row.techniqueId,row.phase);syncInspirationResetButton();showInspiration(row);
   // The first cast already has its own reveal; keep history for combat reactions.
   continue;
  }
  pushNarration(row,meta);
 }
 hud.dataset.exchangeIntent=meta.exchangeIntent||'read';
 const hudState=comboInterrupted?'maai':(meta.hudState||'maai'),phase=meta.phase,index=PHASE_INDEX[hudState]??-1;
 if(comboInterrupted)for(const lane of techniqueLanes.values())lane.replaceChildren();
 phasePanel.dataset.phase=hudState;phasePanel.dataset.combatSequencePhase=hudState;phasePanel.dataset.comboActive=String(index>=0&&!comboInterrupted);
 if(comboInterrupted)beginComboFade();else if(index>=0)clearComboFade();
 setPhaseLamps(comboInterrupted?-1:index);
 if(!comboInterrupted&&meta.actionId&&Object.hasOwn(PHASE_INDEX,phase))pushAction(meta);
 currentNode.dataset.kind='idle';currentNode.textContent='';
}
function syncInspirationResetButton(){if(resetInspirationButton)resetInspirationButton.disabled=!loadoutUI.learnedTechniqueIds.length;}
function syncWeaponButtons(){const weapon=loadoutUI.value.equipment.weapon;for(const button of weaponButtons)button.setAttribute('aria-pressed',String(button.dataset.battleWeapon===weapon));}
function syncModeButtons(){for(const button of modeButtons)button.setAttribute('aria-pressed',String(button.dataset.battleMode===battleMode));for(const button of techniqueModeButtons)button.setAttribute('aria-pressed',String(button.dataset.battleTechniqueMode===battleSettings.techniqueMode));for(const button of inspirationRateButtons)button.setAttribute('aria-pressed',String(button.dataset.battleInspirationRate===battleSettings.inspirationRate));syncWeaponButtons();}
function setBattleSetting(key,value){
 const next=normalizeBattleSettings({...battleSettings,[key]:value});if(next[key]===battleSettings[key])return;
 battleSettings=next;writeBattleSettings(battleSettings);syncModeButtons();reviewMeta=null;lastExchangeKey='';resetHistory();runtime?.configureSettings?.(battleSettings);
}
function failed(error){runtime?.fail?.(error);report('ERROR',error?.message||String(error));sound?.pause();}
window.__BATTLE2__=Object.freeze({get state(){return state;},get started(){return started;},get mode(){return battleMode;},get settings(){return {...battleSettings};},get loadout(){return loadoutUI.value;},get learnedTechniqueIds(){return loadoutUI.learnedTechniqueIds;},get lastError(){return lastError;},get audio(){return sound?.metrics?.()??null;},get version(){return BATTLE2_VERSION;},get sourceSha(){return __BUILD_INFO__.commit;},get metrics(){return runtime?.metrics()||{ready:false};},get camera(){return cameraPresentation.snapshot();},get actors(){return runtime?.inspectActors()||[];},get renderedActors(){return runtime?.inspectRenderedActors?.()||[];},get trace(){return runtime?.trace.slice()||[];},get observation(){return prepared?runtime?.inspectBattle(sequence)??null:null;},get review(){return reviewMeta;},get history(){return history.slice();},get exchangeTrace(){return runtime?.exchangeTrace??[];},advance(seconds){if(!new URL(location.href).searchParams.has('evidence'))throw Error('Evidence mode required');return runtime.advance(seconds);}});
async function boot(){
 const own=++sequence;deathCinematic.reset();hideInspiration();prepared=false;movementInput.reset();cameraPresentation.cancelInspiration();controller?.abort();runtime?.destroy();runtime=null;lastError=null;reviewMeta=null;lastExchangeKey='';resetHistory();delete stage.dataset.error;controller=new AbortController();report('BOOT');
 try{
  const [{createNocturneSound},{createJohakyuP7Controller}]=await Promise.all([import('./nocturne/audio.js'),import('./nocturne/johakyu-p7-controller.js')]);
  if(disposed||own!==sequence)return;
  // Install gesture listeners before enabling Start, and keep the unlocked
  // AudioContext across mode switches instead of recreating it after the tap.
  sound??=createNocturneSound();
  runtime=createJohakyuP7Controller({world,effects,stage,sound,notify:report,signal:controller.signal,cameraPresentation,movementInput,onMeta:updateSequence,evidence:new URL(location.href).searchParams.has('evidence'),fixture:new URL(location.href).searchParams.get('exchangeFixture'),mode:battleMode,loadout:loadoutUI.value,settings:battleSettings,learnedTechniqueIds:loadoutUI.learnedTechniqueIds});
  await runtime.prepare();if(disposed||own!==sequence)return;
  prepared=true;if(started){runtime.start();report('BATTLE');}else report('READY');
 }catch(error){if(!disposed&&own===sequence){controller.abort(error);failed(error);}}
}
startButton.addEventListener('click',async event=>{
 if(disposed||!prepared||started||state!=='READY')return;
 startButton.disabled=true;void deathCinematic.unlockAudio();
 // Unlock inside this same trusted activation, and wait for the AudioContext
 // to run before scheduling the first battle frame.
 await sound?.unlock(event);
 if(disposed||!prepared||started||state!=='READY')return;
 if(runtime.start()){started=true;report('BATTLE');}
 else startButton.disabled=false;
});
for(const button of modeButtons)button.addEventListener('click',()=>{const next=button.dataset.battleMode;if(!['duel','oneVsThree'].includes(next)||next===battleMode)return;battleMode=next;syncModeButtons();void boot();});
for(const button of techniqueModeButtons)button.addEventListener('click',()=>{const next=button.dataset.battleTechniqueMode;if(!['random','set'].includes(next))return;setBattleSetting('techniqueMode',next);});
for(const button of weaponButtons)button.addEventListener('click',()=>{const next=button.dataset.battleWeapon;if(!['sword','great'].includes(next))return;loadoutUI.setWeapon(next);syncWeaponButtons();});
for(const button of inspirationRateButtons)button.addEventListener('click',()=>{const next=button.dataset.battleInspirationRate;if(!['normal','high'].includes(next))return;setBattleSetting('inspirationRate',next);});
resetInspirationButton?.addEventListener('click',()=>{if(!loadoutUI.resetLearnedTechniques())return;activeLoadout=loadoutUI.value;reviewMeta=null;lastExchangeKey='';resetHistory();playerHud?.clearPortrait?.();syncInspirationResetButton();void boot();});
const observer=new ResizeObserver(()=>runtime?.resize());observer.observe(stage);
world.addEventListener('webglcontextlost',event=>{event.preventDefault();prepared=false;const error=new Error('描画環境が中断されました。');controller?.abort(error);failed(error);});
world.addEventListener('webglcontextrestored',()=>{if(!disposed)void boot();});
window.addEventListener('error',event=>{if(event.error&&!disposed)failed(event.error);});
window.addEventListener('unhandledrejection',event=>{if(!disposed)failed(event.reason);});
window.addEventListener('pagehide',event=>{sound?.pause();if(event.persisted)return;disposed=true;sequence++;controller?.abort();if(comboFadeTimer)clearTimeout(comboFadeTimer);hideInspiration();observer.disconnect();runtime?.destroy();sound?.destroy();deathCinematic.dispose();bodyHud?.destroy();movementInput.dispose();cameraPresentation.dispose();stageControls?.destroy();playerHud?.destroy();loadoutUI.destroy();});
syncInspirationResetButton();syncModeButtons();report('BOOT');void boot();
