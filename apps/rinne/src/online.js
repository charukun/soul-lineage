import {connectPeerHostedWorld} from '@soul/network/peer-world-client';
import {installWorldDarknessOverlay} from '@soul/shared-ui/world-darkness';
const PLAYER_KEY='soul.rinne.player.v1';

export function installOnlinePlayer(container=document.querySelector('main')){
 let session=null,x=0,z=0,battle=null,authority=null;
 const playerId=localStorage.getItem(PLAYER_KEY)||crypto.randomUUID();localStorage.setItem(PLAYER_KEY,playerId);
 const root=document.createElement('section');root.innerHTML=`<h2>村へ参加</h2><p id="peer-state">村長の参加コードを貼り付けます</p><label for="host-offer">村長から届いた参加コード</label><textarea id="host-offer" spellcheck="false" autocomplete="off"></textarea><button id="join-peer">応答コードを作る</button><label for="peer-answer">村長に返す応答コード</label><textarea id="peer-answer" readonly aria-label="村長に返す応答コード"></textarea><div class="peer-movement" aria-label="参加先の村で移動"><button data-move="0,-1">↑</button><button data-move="-1,0">←</button><button data-move="1,0">→</button><button data-move="0,1">↓</button></div><pre id="raid-state" role="status"></pre><p class="peer-note">村のHostが交代すると一度闇に包まれ、checkpoint復元後に自動で繋ぎ直します。この端末は投票には参加しますが村のHostにはなりません。</p>`;container.append(root);style(root);
 const $=q=>root.querySelector(q),status=t=>$('#peer-state').textContent=t;
 const overlay=installWorldDarknessOverlay({onPauseChange:paused=>{window.__RINNE_SHARED_WORLD_PAUSED__=paused;}});
 function render(){const host=authority?.hostId||'-',phase=authority?.phase||'未接続';$('#raid-state').textContent=`Host ${host} · ${phase}\n位置 ${x.toFixed(1)}, ${z.toFixed(1)}\n${battle?battle.finished?'決着: '+battle.winner:'魔物と自動戦闘中':'村を探索中'}`;}
 $('#join-peer').onclick=async()=>{try{
   session?.dispose?.();const offer=$('#host-offer').value.trim();if(!offer)throw Error('参加コードを貼り付けてください。');status('応答コードを準備しています');
   session=await connectPeerHostedWorld({offer,selfId:playerId,role:'human',name:'輪廻転焦の旅人',app:'rinne',hostEligible:false,RTCPeerConnection,getLocalState:()=>({x,z,yaw:0,state:'rinne'}),onState:(s,detail)=>{if(s==='rejected')status(detail?.reason||'参加できません');else status('接続: '+s);},onAccepted:m=>{if(m.type==='world-welcome'){authority=m.authority;status('共通村へ参加しました');render();}else if(m.type==='accepted')status('村へ参加しました');},onPhase:info=>{authority=info;overlay.setPhase(info.phase,{candidateId:info.candidateId});status(info.phase==='open'?`共通村へ接続中 · Host ${info.hostId}`:info.phase==='migrating'?'闇の中でHostを継承しています':'村は闇に閉ざされています');render();},onPresence:players=>{const me=players?.[playerId];if(me){if(Number.isFinite(me.x))x=me.x;if(Number.isFinite(me.z))z=me.z;}render();},onBattle:value=>{battle=value;render();}});
   $('#peer-answer').value=session.answerCode;
 }catch(e){status(e.message);}};
 root.querySelectorAll('[data-move]').forEach(button=>button.onclick=()=>{const[dx,dz]=button.dataset.move.split(',').map(Number);x=Math.max(-40,Math.min(40,x+dx*2));z=Math.max(-40,Math.min(40,z+dz*2));render();});
 const dispose=()=>{session?.dispose?.();session=null;overlay.dispose();root.remove();};window.addEventListener('pagehide',dispose,{once:true});window.__RINNE_PEER_HOSTED_WORLD__={snapshot:()=>session?.snapshot?.()||null,dispose};return{dispose};
}
function style(el){el.style.cssText='margin:20px auto;max-width:720px;padding:18px;border:1px solid #8b7750;background:#15130fcc;color:#eee';el.querySelectorAll('textarea').forEach(x=>x.style.cssText='display:block;width:100%;height:78px;margin:8px 0;background:#080808;color:#bfe;padding:8px');el.querySelectorAll('button').forEach(x=>x.style.cssText='padding:10px;margin:4px;background:#6b5530;color:white;border:0');}
