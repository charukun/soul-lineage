import{createHostOffer}from'@soul/network/peer';
import{createFriendVillageInvite,friendVillageInviteUrl,assertFriendVillageInviteActive}from'@soul/network/friend-invite';
import{createWebPlatform}from'@soul/platform-web';
import{createSaveStore}from'./game/save-store.js';
const id='online-panel';let pending=null;
function visualSnapshot(state){
 const objects=(state?.objects||[]).filter(o=>o&&typeof o.id==='string'&&typeof o.kind==='string'&&[o.x,o.z,o.rot].every(Number.isFinite)&&o.phase!=='planned').slice(0,800).map(o=>({id:o.id,kind:o.kind,x:o.x,z:o.z,rot:o.rot,material:typeof o.material==='string'?o.material.slice(0,60):'base',level:Number.isFinite(o.level)?Math.max(1,Math.min(3,o.level)):1,phase:'built',room:[]}));
 return{version:1,name:String(state?.name||'友人の村').slice(0,80),villageId:String(state?.villageId||'friend-village').slice(0,180),clock:Number.isFinite(state?.clock)?state.clock:0,objects};
}
export function installOnlineHost(){const mount=document.getElementById('onlineHost')||document.querySelector('main');if(!mount)return;const root=document.createElement('section');root.id=id;root.innerHTML=`<h2>友人を村へ招待</h2><p id="net-state">招待した時だけ、友人がこの村を見学できます。</p><button id="make-offer">友人招待をつくる</button><textarea id="invite" readonly placeholder="招待リンク"></textarea><div class="invite-actions"><button id="share-invite" disabled>招待を共有</button><button id="copy-invite" disabled>リンクをコピー</button></div><p class="muted">招待は15分で失効します。公開村一覧や魔王軍の襲撃候補には表示されません。</p><textarea id="answer" placeholder="友人から返された参加返事"></textarea><button id="accept-answer" disabled>参加返事を受け取る</button>`;mount.append(root);style(root);const $=q=>root.querySelector(q),status=t=>$('#net-state').textContent=t;
 const platform=createWebPlatform({gameId:'village',environment:__BUILD_INFO__.environment,playerId:'local'}),store=createSaveStore(platform);
 let activeInvite=null,creating=false,disposed=false;
 $('#make-offer').onclick=async()=>{
  if(creating||disposed)return;creating=true;$('#make-offer').disabled=true;pending?.close?.();pending=null;activeInvite=null;
  $('#share-invite').disabled=true;$('#copy-invite').disabled=true;$('#accept-answer').disabled=true;$('#invite').value='';$('#answer').value='';
  try{
   const saved=await store.load();if(!saved)throw Error('村を一度保存してから招待してください。');if(disposed)return;
   const snapshot=visualSnapshot(saved);let connection,invite;
   connection=await createHostOffer({RTCPeerConnection,onState:s=>{if(disposed)return;if(s==='open')status('友人が接続しました。参加を確認しています。');else if(['failed','closed','disconnected'].includes(s))status('接続が終了しました。');},onMessage:m=>{
    if(disposed||pending!==connection||m?.type!=='join'||m.role!=='visitor')return;
    try{assertFriendVillageInviteActive(invite);connection.send({type:'friend-village',snapshot});status('友人が接続しました。村の外観だけを共有しています。');}catch(e){connection.close();status(e.message);}
   }});
   if(disposed){connection.close();return;}
   pending=connection;invite=createFriendVillageInvite({offer:connection.code,villageId:snapshot.villageId,villageName:snapshot.name});activeInvite=invite;
   $('#invite').value=friendVillageInviteUrl(new URL('./friend.html',location.href),invite);$('#share-invite').disabled=false;$('#copy-invite').disabled=false;$('#accept-answer').disabled=false;status('このリンクを友人へ送ってください。');
  }catch(e){status(e.message);}finally{creating=false;$('#make-offer').disabled=disposed;}
 };
 $('#copy-invite').onclick=async()=>{try{assertFriendVillageInviteActive(activeInvite);try{await navigator.clipboard.writeText($('#invite').value);status('招待リンクをコピーしました。');}catch{status('招待リンクを長押ししてコピーしてください。');}}catch(e){status(e.message);}};
 $('#share-invite').onclick=async()=>{const url=$('#invite').value;if(!url)return;try{assertFriendVillageInviteActive(activeInvite);if(navigator.share)await navigator.share({title:'村へ遊びに来て',text:'友人限定の村見学招待です。',url});else{await navigator.clipboard.writeText(url);status('招待リンクをコピーしました。');}}catch(e){if(e?.name!=='AbortError')status(e.message);}};
 $('#accept-answer').onclick=async()=>{try{if(!pending)throw Error('先に友人招待をつくってください。');try{assertFriendVillageInviteActive(activeInvite);}catch(e){pending.close();throw e;}const answer=$('#answer').value.trim();if(!answer)throw Error('友人から届いた参加返事を貼り付けてください。');await pending.accept(answer);status('参加返事を受け取りました。友人の接続を待っています。');}catch(e){status(e.message);}};
 window.addEventListener('pagehide',()=>{disposed=true;pending?.close?.();pending=null;activeInvite=null;},{once:true});
}
function style(el){el.style.cssText='margin:20px auto;max-width:720px;padding:18px;border:1px solid #8b7750;background:#15130fcc;color:#eee';el.querySelectorAll('textarea').forEach(x=>x.style.cssText='display:block;width:100%;height:82px;margin:8px 0;background:#080808;color:#bfe;padding:8px;box-sizing:border-box');el.querySelectorAll('button').forEach(x=>x.style.cssText='padding:10px;margin:4px;background:#6b5530;color:white;border:0');el.querySelectorAll('.muted').forEach(x=>x.style.cssText='opacity:.72;font-size:.86rem;line-height:1.55');}
