import {connectPeerHostedWorld} from '@soul/network/peer-world-client';
import {createPredictionReconciler} from '@soul/network/interpolation';
import {installWorldDarknessOverlay} from '@soul/shared-ui/world-darkness';
const PLAYER_KEY='soul.demon.player.v1';

export function installOnlineRaid(snapshot) {
 let session=null,connecting=false,disposed=false,lastAuthority=null,battle=null;const reconciler=createPredictionReconciler(),remoteIds=new Set();
 const playerId=localStorage.getItem(PLAYER_KEY)||crypto.randomUUID();localStorage.setItem(PLAYER_KEY,playerId);
 const root=document.createElement('dialog');root.id='online-box';root.setAttribute('aria-label','共通村へ接続');
 root.innerHTML=`<form method="dialog"><button id="online-close">閉じる</button></form><h2>共通村へ侵入</h2><p>村のHostから受け取った参加コードを入力してください。Hostが交代すると闇に包まれ、復旧後は自動で新Hostへ繋ぎ直します。</p><label>参加コード<textarea id="online-offer" placeholder="村の参加コード"></textarea></label><button id="online-join" type="button">応答コードを作る</button><label>応答コード<textarea id="online-answer" readonly></textarea></label><p id="online-state" role="status"></p>`;document.body.append(root);
 const $=q=>root.querySelector(q),status=t=>$('#online-state').textContent=t;
 const overlay=installWorldDarknessOverlay({onPauseChange:paused=>{window.__DEMON_SHARED_WORLD_PAUSED__=paused;}});
 const clearRemote=()=>{for(const id of remoteIds)window.__DEMON_WORLD_SCALE__?.removePresence?.(id);remoteIds.clear();};
 function consumePlayers(players,serverTime){const current=snapshot().player;for(const[id,p]of Object.entries(players||{})){if(id===playerId){lastAuthority=reconciler.reconcile(current,p);continue;}remoteIds.add(id);window.__DEMON_WORLD_SCALE__?.upsertPresence?.({id,...p,receivedAt:serverTime||performance.now()});}}
 $('#online-join').onclick=async()=>{
  if(connecting||disposed)return;connecting=true;$('#online-join').disabled=true;session?.dispose?.();session=null;clearRemote();status('応答コードを準備しています');
  try{
   const offer=$('#online-offer').value.trim();if(!offer)throw Error('参加コードを入力してください。');
   session=await connectPeerHostedWorld({offer,selfId:playerId,role:'demon',name:'尽喰廻遊',app:'demon',hostEligible:false,RTCPeerConnection,getLocalState:()=>{const p=snapshot().player;return{x:p.x,z:p.z,yaw:p.yaw||0,state:'hunt',action:snapshot().combat?'combat':null};},onState:(s,detail)=>{if(disposed)return;if(s==='rejected')status(detail?.reason||'参加できません');else status('接続: '+s);},onAccepted:m=>{if(m.type==='world-welcome')status('共有村へ侵入しました。一度きりです。');},onPhase:info=>{if(disposed)return;overlay.setPhase(info.phase,{candidateId:info.candidateId});status(info.phase==='open'?`共有村へ侵入中 · Host ${info.hostId}`:info.phase==='migrating'?'闇の中で村のHostが移り変わっています':'村は闇に閉ざされています');},onPresence:consumePlayers,onBattle:value=>{battle=value;if(value)status(value.finished?'決着: '+value.winner:'実プレイヤーと自動戦闘中');}});
   if(disposed){session.dispose();return;}$('#online-answer').value=session.answerCode;
  }catch(e){if(!disposed)status(e.message);}finally{connecting=false;$('#online-join').disabled=false;}
 };
 const dispose=()=>{if(disposed)return;disposed=true;session?.dispose?.();session=null;clearRemote();overlay.dispose();root.remove();};
 window.__DEMON_NETWORK_SCALE__={snapshot:()=>({session:session?.snapshot?.()||null,reconciliation:reconciler.snapshot(),lastAuthority,battle})};window.addEventListener('pagehide',dispose,{once:true});return{open(){if(!disposed&&!root.open)root.showModal();},close(){root.close();},dispose};
}
