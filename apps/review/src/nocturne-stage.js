const stage=document.querySelector('[data-review-surface="battle2"]');
const status=document.getElementById('battle2-status'),world=document.getElementById('world'),effects=document.getElementById('effects'),versionNode=document.getElementById('battle2-version');
const hud=document.getElementById('battle-sequence-hud'),phasePanel=document.getElementById('battle-phase'),currentNode=document.getElementById('battle-sequence-current'),historyNode=document.getElementById('battle-sequence-history');
const phaseNodes=[...document.querySelectorAll('[data-combat-phase]')],modeButtons=[...document.querySelectorAll('[data-battle-mode]')];
const PHASE_INDEX={jo:0,ha:1,kyu:2},PHASE_LABEL={jo:'序',ha:'破',kyu:'急'};
const MOVE_LABEL={slash:'斬り',back:'返し斬り',thrust:'突き',pierce:'刺突',heavy:'強撃',diagonal:'袈裟斬り',sweep:'薙ぎ',counter:'返し',guard:'受け',brace:'構え',parry:'弾き',ready:'見切り',retreat:'退き',slip:'かわし',bash:'柄打ち',pommel:'柄打ち'};
let runtime=null,sound=null,controller=null,sequence=0,disposed=false,prepared=false,reviewMeta=null,battleMode='duel',history=[],seenActions=new Set(),lastBattleId='';
let state='BOOT',lastError=null;
const buildCommit=String(__BUILD_INFO__?.commit||'dev');if(versionNode)versionNode.textContent=`DEV · ${buildCommit.slice(0,7)}`;
function report(next,detail=''){if(disposed)return;if(next==='BATTLE'&&!prepared)return;state=next;stage.dataset.state=next;if(next==='ERROR'){lastError=String(detail);stage.dataset.error=lastError;status.hidden=false;status.setAttribute('role','alert');status.textContent='戦闘を読み込めませんでした。'+lastError+' 再読み込みで再試行できます。';}else{status.setAttribute('role','status');status.hidden=next==='BATTLE'||next==='RESETTING';status.textContent=next==='ASSET_LOADING'?'戦闘を読み込み中… '+detail:'戦闘を準備中…';}}
const motionLabel=kind=>MOVE_LABEL[kind]||kind||'動作';
function shortActionName(meta){return String(meta?.techniqueName||meta?.actionName||motionLabel(meta?.actionMotion)||'').trim();}
function techniqueStageName(meta){const name=shortActionName(meta),stage=Number.isInteger(meta?.stageIndex)?`${meta.stageIndex+1}段`:'';return [name,stage].filter(Boolean).join(' · ');}
function positionHud(){
 const anchor=runtime?.footAnchor?.();if(!anchor){hud.dataset.anchored='false';return;}
 hud.dataset.anchored='true';hud.style.left=`${anchor.x}px`;hud.style.top=`${anchor.y}px`;
}
function clearVisualHistory(){historyNode.replaceChildren();}
function resetHistory(battleId=''){lastBattleId=battleId;seenActions.clear();history=[];clearVisualHistory();}
function spawnActionText(row){
 const line=document.createElement('span');line.className='battle-sequence-history__float';line.dataset.phase=row.phase;
 line.textContent=row.label;line.style.setProperty('--float-x',row.phase==='jo'?'-5px':row.phase==='kyu'?'5px':'0px');historyNode.append(line);
 const remove=()=>line.remove();line.addEventListener('animationend',remove,{once:true});setTimeout(remove,4200);
}
function pushAction(meta){
 if(!meta?.actionId||seenActions.has(meta.actionId))return;
 seenActions.add(meta.actionId);const row={phase:meta.phase,label:techniqueStageName(meta)};history.unshift(row);if(history.length>8)history.length=8;spawnActionText(row);
}
function updateSequence(meta){
 reviewMeta=meta;if(meta.battleId!==lastBattleId)resetHistory(meta.battleId);positionHud();
 const phase=meta.phase,index=PHASE_INDEX[phase]??-1;phasePanel.dataset.phase=phase||'idle';phasePanel.dataset.combatSequencePhase=phase||'idle';phasePanel.dataset.comboActive=String(index>=0);
 for(const node of phaseNodes){const i=PHASE_INDEX[node.dataset.combatPhase];node.dataset.active=String(i===index);node.dataset.completed=String(index>=0&&i<index);}
 if(meta.actionId){currentNode.dataset.kind=phase;currentNode.textContent=techniqueStageName(meta);pushAction(meta);}
 else{currentNode.dataset.kind='idle';currentNode.textContent='';}
}
function syncModeButtons(){for(const button of modeButtons)button.setAttribute('aria-pressed',String(button.dataset.battleMode===battleMode));}
function failed(error){report('ERROR',error?.message||String(error));sound?.pause();}
window.__BATTLE2__=Object.freeze({get state(){return state;},get mode(){return battleMode;},get lastError(){return lastError;},get sourceSha(){return __BUILD_INFO__.commit;},get metrics(){return runtime?.metrics()||{ready:false};},get actors(){return runtime?.inspectActors()||[];},get trace(){return runtime?.trace.slice()||[];},get observation(){return prepared?runtime?.inspectBattle(sequence)??null:null;},get review(){return reviewMeta;},get history(){return history.slice();},advance(seconds){if(!new URL(location.href).searchParams.has('evidence'))throw Error('Evidence mode required');return runtime.advance(seconds);}});
async function boot(){const own=++sequence;prepared=false;controller?.abort();runtime?.destroy();sound?.destroy();runtime=null;sound=null;lastError=null;reviewMeta=null;resetHistory();hud.dataset.anchored='false';delete stage.dataset.error;controller=new AbortController();report('BOOT');try{const [{createNocturneSound},{createJohakyuP7Controller}]=await Promise.all([import('./nocturne/audio.js'),import('./nocturne/johakyu-p7-controller.js')]);if(disposed||own!==sequence)return;sound=createNocturneSound();runtime=createJohakyuP7Controller({world,effects,stage,sound,notify:report,signal:controller.signal,onMeta:updateSequence,evidence:new URL(location.href).searchParams.has('evidence'),mode:battleMode});await runtime.prepare();if(disposed||own!==sequence)return;prepared=true;positionHud();report('BATTLE');}catch(error){if(!disposed&&own===sequence){controller.abort(error);runtime?.fail?.(error);failed(error);}}}
for(const button of modeButtons)button.addEventListener('click',()=>{const next=button.dataset.battleMode;if(!['duel','oneVsThree'].includes(next)||next===battleMode)return;battleMode=next;syncModeButtons();boot();});
const observer=new ResizeObserver(()=>{runtime?.resize();positionHud();});observer.observe(stage);world.addEventListener('webglcontextlost',event=>{event.preventDefault();prepared=false;controller?.abort();runtime?.fail?.(new Error('描画環境が中断されました。'));});world.addEventListener('webglcontextrestored',()=>{if(!disposed)boot();});window.addEventListener('error',event=>{if(event.error&&!disposed)failed(event.error);});window.addEventListener('unhandledrejection',event=>{if(!disposed)failed(event.reason);});window.addEventListener('pagehide',event=>{sound?.pause();if(event.persisted)return;disposed=true;sequence++;controller?.abort();observer.disconnect();runtime?.destroy();sound?.destroy();});syncModeButtons();report('BOOT');boot();
