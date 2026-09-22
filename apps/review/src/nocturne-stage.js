import {BATTLE2_VERSION} from './battle2-version.js';
import {createBattle2BodyHud} from './battle2-body-hud.js';
import {createBattle2LoadoutUI} from './nocturne/battle2-loadout.js';
import {createBattle2CameraPresentation} from './battle2-camera.js';
import {mountReviewStageControls} from '@soul/shared-ui/review-shell';
import '@soul/shared-ui/rinne-primary-four.css';
import '@soul/shared-ui/rinne-loadout-menu.css';

const stage=document.querySelector('[data-review-surface="battle2"]');
const status=document.getElementById('battle2-status'),world=document.getElementById('world'),effects=document.getElementById('effects'),versionNode=document.getElementById('battle2-version'),startButton=document.getElementById('battle2-start');
const hud=document.getElementById('battle-sequence-hud'),phasePanel=document.getElementById('battle-phase'),currentNode=document.getElementById('battle-sequence-current'),historyNode=document.getElementById('battle-sequence-history');
const bodyHud=createBattle2BodyHud(document.getElementById('battle2-body-hud'));
const cameraPresentation=createBattle2CameraPresentation({stage,world});
const stageControls=mountReviewStageControls({stage,groups:['[data-battle-mode-control]'],label:'戦闘設定'});
const phaseNodes=[...document.querySelectorAll('[data-combat-phase]')],phaseLinks=[...document.querySelectorAll('[data-combat-link]')],modeButtons=[...document.querySelectorAll('[data-battle-mode]')];
const PHASE_INDEX={jo:0,ha:1,kyu:2},PHASE_LABEL={jo:'序',ha:'破',kyu:'急'},LINK_INDEX={'jo-ha':0,'ha-kyu':1};
const HISTORY_DISPLAY_MS=3200,HISTORY_GAP_MS=260,HISTORY_QUEUE_LIMIT=6,NARRATION_MIN_SECONDS=2.2,COMBO_FADE_MS=900;
const MOVE_LABEL={slash:'斬り',back:'返し斬り',thrust:'突き',pierce:'刺突',heavy:'強撃',diagonal:'袈裟斬り',sweep:'薙ぎ',counter:'返し',guard:'受け',brace:'構え',parry:'弾き',ready:'見切り',retreat:'退き',slip:'かわし',bash:'柄打ち',pommel:'柄打ち'};
let runtime=null,sound=null,controller=null,sequence=0,disposed=false,prepared=false,started=false,reviewMeta=null,battleMode='duel',history=[],historyQueue=[],historyTimer=0,historyShowing=false,seenActions=new Set(),seenNarration=new Set(),lastNarrationAt=new Map(),lastBattleId='',lastPhaseCueKey='',comboFadeTimer=0;
let state='BOOT',lastError=null,lastExchangeKey='';
const loadoutUI=createBattle2LoadoutUI({stage,onChange:next=>{reviewMeta=null;lastExchangeKey='';resetHistory();runtime?.configureLoadout?.(next);}});
const cueNode=document.createElement('span');cueNode.className='battle-exchange-cue';cueNode.setAttribute('role','status');hud.prepend(cueNode);
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
const motionLabel=kind=>MOVE_LABEL[kind]||kind||'動作';
function shortActionName(meta){return String(meta?.techniqueName||meta?.actionName||motionLabel(meta?.actionMotion)||'').trim();}
function techniqueHistoryName(meta){const name=shortActionName(meta);return name?`連「${name}」`:'';}
function actionHistoryKey(meta){return [meta?.battleId,meta?.exchangeSerial,meta?.cycle,meta?.phase,meta?.techniqueId,meta?.techniqueIndex].join(':');}
function semanticActionLabel(row){
 if(row?.type==='chain-break')return'仕切り直す';
 if(row?.type==='parry'||row?.type==='clash')return'武器で弾いた';
 if(row?.type==='guard')return'受け止めた';
 if(row?.type==='slip')return'かわした';
 if(row?.type==='maneuver-start'){
  if(['engage-range','counter-press'].includes(row.reason))return'間合いを詰める';
  if(['read-threat','read-pressure'].includes(row.reason))return'様子を見る';
  if(['miss-reset','combo-break-retreat','hit-withdrawal','parried-recoil','countered-withdrawal','exchange-zanshin','weapon-clash'].includes(row.reason))return'間合いを取る';
 }
 if(row?.type==='normal-offense-ready')return'序から構え直す';
 return'';
}
function clearVisualHistory(){
 if(historyTimer){clearTimeout(historyTimer);historyTimer=0;}
 historyQueue=[];historyShowing=false;historyNode.replaceChildren();
}
function clearComboFade(){
 if(comboFadeTimer){clearTimeout(comboFadeTimer);comboFadeTimer=0;}
 delete phasePanel.dataset.comboInterrupted;
}
function resetHistory(battleId=''){
 lastBattleId=battleId;lastPhaseCueKey='';seenActions.clear();seenNarration.clear();lastNarrationAt.clear();history=[];clearVisualHistory();clearComboFade();
}
function historyDisplayLabel(row){
 const label=String(row?.label||'').trim();if(!label)return'';
 const phase=row?.kind==='technique'?(PHASE_LABEL[row.phase]||''):'';
 return `${phase?`${phase}・`:''}${label}…`;
}
function drainHistoryQueue(){
 if(historyShowing||historyTimer||!historyQueue.length)return;
 const row=historyQueue.shift(),line=document.createElement('span');line.className='battle-sequence-history__flow';line.dataset.phase=row.phase||'idle';line.dataset.kind=row.kind||'semantic';
 line.textContent=historyDisplayLabel(row);historyNode.replaceChildren(line);historyShowing=true;
 const advance=()=>{if(!historyShowing)return;historyShowing=false;if(historyTimer){clearTimeout(historyTimer);historyTimer=0;}line.remove();historyTimer=setTimeout(()=>{historyTimer=0;drainHistoryQueue();},HISTORY_GAP_MS);};
 line.addEventListener('animationend',advance,{once:true});historyTimer=setTimeout(advance,HISTORY_DISPLAY_MS+450);
}
function spawnActionText(row){
 const previous=historyQueue.at(-1),key=`${row.kind||'semantic'}:${row.phase||'idle'}:${row.label}`;
 if(previous&&`${previous.kind||'semantic'}:${previous.phase||'idle'}:${previous.label}`===key)return;
 if(historyQueue.length>=HISTORY_QUEUE_LIMIT){let drop=historyQueue.findIndex(item=>item.kind!=='technique');if(drop<0)drop=0;historyQueue.splice(drop,1);}
 historyQueue.push(row);drainHistoryQueue();
}
function recordHistory(row){history.push(row);if(history.length>8)history.shift();spawnActionText(row);}
function pushAction(meta){
 const key=actionHistoryKey(meta);if(!meta?.actionId||!meta?.techniqueId||seenActions.has(key))return;
 seenActions.add(key);if(seenActions.size>256)seenActions.delete(seenActions.values().next().value);
 recordHistory({phase:meta.phase,label:techniqueHistoryName(meta),kind:'technique'});
}
function pushNarration(row,meta){
 const label=semanticActionLabel(row);if(!label)return false;
 if((row?.type==='maneuver-start'||row?.type==='chain-break'||row?.type==='normal-offense-ready')&&row?.actorId&&row.actorId!=='hero')return false;
 const now=Number(row?.time)||0,semanticKey=[row?.actorId||'pair',row?.type,row?.reason||'',label].join(':');
 const previous=lastNarrationAt.get(semanticKey)??-Infinity;if(now-previous<NARRATION_MIN_SECONDS)return false;
 const key=[meta?.battleId,row?.type,row?.reason,row?.actorId,row?.id,Math.floor(now*2),label].join(':');if(seenNarration.has(key))return false;
 lastNarrationAt.set(semanticKey,now);seenNarration.add(key);if(seenNarration.size>256)seenNarration.delete(seenNarration.values().next().value);
 recordHistory({phase:'idle',label,kind:'semantic'});return true;
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
 reviewMeta=meta;if(meta.battleId!==lastBattleId||meta.exchangeHistoryKey!==lastExchangeKey){resetHistory(meta.battleId);lastExchangeKey=meta.exchangeHistoryKey;}
 const cueKey=String(meta.phaseCueKey||'');if(started&&cueKey&&cueKey!==lastPhaseCueKey){lastPhaseCueKey=cueKey;sound?.phaseCue?.({phase:meta.phaseCuePhase||meta.phase});}
 const hero=runtime?.inspectActors?.().find(actor=>actor.self);if(hero)bodyHud?.update(hero);
 const activity=Array.isArray(meta.activity)?meta.activity:[],interrupted=activity.some(row=>row.type==='chain-break'&&row.actorId==='hero');
 const technique=String(meta.techniqueName||meta.actionName||'').trim();
 cueNode.hidden=!technique;if(cueNode.textContent!==technique)cueNode.textContent=technique;
 hud.dataset.exchangeIntent=meta.exchangeIntent||'read';
 const hudState=interrupted?'maai':(meta.hudState||'maai'),phase=meta.phase,index=PHASE_INDEX[hudState]??-1;
 phasePanel.dataset.phase=hudState;phasePanel.dataset.combatSequencePhase=hudState;phasePanel.dataset.comboActive=String(index>=0&&!interrupted);
 if(interrupted)beginComboFade();else if(index>=0)clearComboFade();
 setPhaseLamps(interrupted?-1:index);
 if(!interrupted&&index>=0&&meta.actionId&&phase===hudState)pushAction(meta);
 currentNode.dataset.kind='idle';currentNode.textContent='';
}
function syncModeButtons(){for(const button of modeButtons)button.setAttribute('aria-pressed',String(button.dataset.battleMode===battleMode));}
function failed(error){runtime?.fail?.(error);report('ERROR',error?.message||String(error));sound?.pause();}
window.__BATTLE2__=Object.freeze({get state(){return state;},get started(){return started;},get mode(){return battleMode;},get loadout(){return loadoutUI.value;},get lastError(){return lastError;},get version(){return BATTLE2_VERSION;},get sourceSha(){return __BUILD_INFO__.commit;},get metrics(){return runtime?.metrics()||{ready:false};},get camera(){return cameraPresentation.snapshot();},get actors(){return runtime?.inspectActors()||[];},get trace(){return runtime?.trace.slice()||[];},get observation(){return prepared?runtime?.inspectBattle(sequence)??null:null;},get review(){return reviewMeta;},get history(){return history.slice();},get exchangeTrace(){return runtime?.exchangeTrace??[];},advance(seconds){if(!new URL(location.href).searchParams.has('evidence'))throw Error('Evidence mode required');return runtime.advance(seconds);}});
async function boot(){
 const own=++sequence;prepared=false;controller?.abort();runtime?.destroy();runtime=null;lastError=null;reviewMeta=null;lastExchangeKey='';resetHistory();delete stage.dataset.error;controller=new AbortController();report('BOOT');
 try{
  const [{createNocturneSound},{createJohakyuP7Controller}]=await Promise.all([import('./nocturne/audio.js'),import('./nocturne/johakyu-p7-controller.js')]);
  if(disposed||own!==sequence)return;
  // Install gesture listeners before enabling Start, and keep the unlocked
  // AudioContext across mode switches instead of recreating it after the tap.
  sound??=createNocturneSound();
  runtime=createJohakyuP7Controller({world,effects,stage,sound,notify:report,signal:controller.signal,cameraPresentation,onMeta:updateSequence,evidence:new URL(location.href).searchParams.has('evidence'),fixture:new URL(location.href).searchParams.get('exchangeFixture'),mode:battleMode,loadout:loadoutUI.value});
  await runtime.prepare();if(disposed||own!==sequence)return;
  prepared=true;if(started){runtime.start();report('BATTLE');}else report('READY');
 }catch(error){if(!disposed&&own===sequence){controller.abort(error);failed(error);}}
}
startButton.addEventListener('click',()=>{
 if(disposed||!prepared||started||state!=='READY')return;
 // The same tap's pointerdown (or keyboard activation's keydown) has already
 // reached the sound service. No simulation or RAF runs before this activation.
 if(runtime.start()){started=true;report('BATTLE');}
});
for(const button of modeButtons)button.addEventListener('click',()=>{const next=button.dataset.battleMode;if(!['duel','oneVsThree'].includes(next)||next===battleMode)return;battleMode=next;syncModeButtons();void boot();});
const observer=new ResizeObserver(()=>runtime?.resize());observer.observe(stage);
world.addEventListener('webglcontextlost',event=>{event.preventDefault();prepared=false;const error=new Error('描画環境が中断されました。');controller?.abort(error);failed(error);});
world.addEventListener('webglcontextrestored',()=>{if(!disposed)void boot();});
window.addEventListener('error',event=>{if(event.error&&!disposed)failed(event.error);});
window.addEventListener('unhandledrejection',event=>{if(!disposed)failed(event.reason);});
window.addEventListener('pagehide',event=>{sound?.pause();if(event.persisted)return;disposed=true;sequence++;controller?.abort();if(historyTimer)clearTimeout(historyTimer);if(comboFadeTimer)clearTimeout(comboFadeTimer);observer.disconnect();runtime?.destroy();sound?.destroy();bodyHud?.destroy();cameraPresentation.dispose();stageControls?.destroy();loadoutUI.destroy();});
syncModeButtons();report('BOOT');void boot();
