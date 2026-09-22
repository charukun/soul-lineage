import {BATTLE2_VERSION} from './battle2-version.js';

const stage=document.querySelector('[data-review-surface="battle2"]');
const status=document.getElementById('battle2-status'),world=document.getElementById('world'),effects=document.getElementById('effects'),versionNode=document.getElementById('battle2-version'),startButton=document.getElementById('battle2-start');
const hud=document.getElementById('battle-sequence-hud'),phasePanel=document.getElementById('battle-phase'),currentNode=document.getElementById('battle-sequence-current'),historyNode=document.getElementById('battle-sequence-history');
const phaseNodes=[...document.querySelectorAll('[data-combat-phase]')],modeButtons=[...document.querySelectorAll('[data-battle-mode]')];
const PHASE_INDEX={jo:0,ha:1,kyu:2},PHASE_LABEL={jo:'序',ha:'破',kyu:'急'};
const MOVE_LABEL={slash:'斬り',back:'返し斬り',thrust:'突き',pierce:'刺突',heavy:'強撃',diagonal:'袈裟斬り',sweep:'薙ぎ',counter:'返し',guard:'受け',brace:'構え',parry:'弾き',ready:'見切り',retreat:'退き',slip:'かわし',bash:'柄打ち',pommel:'柄打ち'};
let runtime=null,sound=null,controller=null,sequence=0,disposed=false,prepared=false,started=false,reviewMeta=null,battleMode='duel',history=[],seenActions=new Set(),seenNarration=new Set(),lastBattleId='';
let state='BOOT',lastError=null;
hud.dataset.anchored='true';
if(versionNode)versionNode.textContent=`v${BATTLE2_VERSION}`;
function report(next,detail=''){
 if(disposed||((next==='BATTLE'||next==='READY')&&!prepared))return;
 state=next;stage.dataset.state=next;
 startButton.hidden=started||next==='ERROR';startButton.disabled=!prepared||next==='ERROR';
 hud.hidden=!started||!prepared||next==='ERROR';
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
  if(['miss-reset','hit-withdrawal','parried-recoil','countered-withdrawal','exchange-zanshin','weapon-clash'].includes(row.reason))return'間合いを取る';
 }
 if(row?.type==='normal-offense-ready')return'序から構え直す';
 return'';
}
function clearVisualHistory(){historyNode.replaceChildren();}
function resetHistory(battleId=''){lastBattleId=battleId;seenActions.clear();seenNarration.clear();history=[];clearVisualHistory();}
function spawnActionText(row){
 const line=document.createElement('span');line.className='battle-sequence-history__float';line.dataset.phase=row.phase;
 line.textContent=row.label;line.style.setProperty('--float-x',row.phase==='jo'?'-5px':row.phase==='kyu'?'5px':'0px');historyNode.append(line);
 const remove=()=>line.remove();line.addEventListener('animationend',remove,{once:true});setTimeout(remove,4200);
}
function pushAction(meta){
 const key=actionHistoryKey(meta);if(!meta?.actionId||!meta?.techniqueId||seenActions.has(key))return;
 seenActions.add(key);if(seenActions.size>256)seenActions.delete(seenActions.values().next().value);
 const row={phase:meta.phase,label:techniqueHistoryName(meta)};history.unshift(row);if(history.length>8)history.length=8;spawnActionText(row);
}
function pushNarration(row,meta){
 const label=semanticActionLabel(row);if(!label)return;
 const key=[meta?.battleId,row?.time,row?.type,row?.reason,row?.actorId,row?.id,label].join(':');if(seenNarration.has(key))return;
 seenNarration.add(key);if(seenNarration.size>256)seenNarration.delete(seenNarration.values().next().value);
 const item={phase:Object.hasOwn(PHASE_INDEX,row?.phase)?row.phase:'idle',label};history.unshift(item);if(history.length>8)history.length=8;spawnActionText(item);
}
function updateSequence(meta){
 reviewMeta=meta;if(meta.battleId!==lastBattleId)resetHistory(meta.battleId);
 const activity=Array.isArray(meta.activity)?meta.activity:[],interrupted=activity.some(row=>row.type==='chain-break'&&row.actorId==='hero');
 for(const row of activity)pushNarration(row,meta);
 const hudState=interrupted?'maai':(meta.hudState||'maai'),phase=meta.phase,index=PHASE_INDEX[hudState]??-1;phasePanel.dataset.phase=hudState;phasePanel.dataset.combatSequencePhase=hudState;phasePanel.dataset.comboActive=String(index>=0);
 for(const node of phaseNodes){const i=PHASE_INDEX[node.dataset.combatPhase];node.dataset.active=String(i===index);node.dataset.completed=String(index>=0&&i<index);}
 if(!interrupted&&index>=0&&meta.actionId){currentNode.dataset.kind=phase;currentNode.textContent=techniqueHistoryName(meta);pushAction(meta);}
 else{currentNode.dataset.kind='idle';currentNode.textContent='';}
}
function syncModeButtons(){for(const button of modeButtons)button.setAttribute('aria-pressed',String(button.dataset.battleMode===battleMode));}
function failed(error){runtime?.fail?.(error);report('ERROR',error?.message||String(error));sound?.pause();}
window.__BATTLE2__=Object.freeze({get state(){return state;},get started(){return started;},get mode(){return battleMode;},get lastError(){return lastError;},get version(){return BATTLE2_VERSION;},get sourceSha(){return __BUILD_INFO__.commit;},get metrics(){return runtime?.metrics()||{ready:false};},get actors(){return runtime?.inspectActors()||[];},get trace(){return runtime?.trace.slice()||[];},get observation(){return prepared?runtime?.inspectBattle(sequence)??null:null;},get review(){return reviewMeta;},get history(){return history.slice();},advance(seconds){if(!new URL(location.href).searchParams.has('evidence'))throw Error('Evidence mode required');return runtime.advance(seconds);}});
async function boot(){
 const own=++sequence;prepared=false;controller?.abort();runtime?.destroy();runtime=null;lastError=null;reviewMeta=null;resetHistory();delete stage.dataset.error;controller=new AbortController();report('BOOT');
 try{
  const [{createNocturneSound},{createJohakyuP7Controller}]=await Promise.all([import('./nocturne/audio.js'),import('./nocturne/johakyu-p7-controller.js')]);
  if(disposed||own!==sequence)return;
  // Install gesture listeners before enabling Start, and keep the unlocked
  // AudioContext across mode switches instead of recreating it after the tap.
  sound??=createNocturneSound();
  runtime=createJohakyuP7Controller({world,effects,stage,sound,notify:report,signal:controller.signal,onMeta:updateSequence,evidence:new URL(location.href).searchParams.has('evidence'),mode:battleMode});
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
window.addEventListener('pagehide',event=>{sound?.pause();if(event.persisted)return;disposed=true;sequence++;controller?.abort();observer.disconnect();runtime?.destroy();sound?.destroy();});
syncModeButtons();report('BOOT');void boot();
