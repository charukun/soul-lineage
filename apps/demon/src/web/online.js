import{acceptHostOffer}from'@soul/network/peer';
const PLAYER_KEY='soul.demon.player.v1';
export function installOnlineRaid(snapshot){let peer,timer;const playerId=localStorage.getItem(PLAYER_KEY)||crypto.randomUUID();localStorage.setItem(PLAYER_KEY,playerId);const root=document.createElement('aside');root.innerHTML=`<button id="online-open">実プレイヤーの村</button><div id="online-box" hidden><b>村長端末へ接続</b><textarea id="online-offer" placeholder="村長の参加コード"></textarea><button id="online-join">応答コードを作る</button><textarea id="online-answer" readonly></textarea><p id="online-state"></p><button id="online-close">閉じる</button></div>`;document.body.append(root);root.style.cssText='position:fixed;right:12px;top:12px;z-index:40;max-width:330px;background:#071316ee;padding:8px;color:#ddd';root.querySelectorAll('textarea').forEach(x=>x.style.cssText='width:100%;height:70px;display:block;margin:6px 0;background:#020707;color:#bfe');const $=q=>root.querySelector(q),status=t=>$('#online-state').textContent=t;$('#online-open').onclick=()=>$('#online-box').hidden=false;$('#online-close').onclick=()=>$('#online-box').hidden=true;
 $('#online-join').onclick=async()=>{try{
  peer=await acceptHostOffer($('#online-offer').value,{
   RTCPeerConnection,
   onState:s=>{status('接続: '+s);if(s==='open'){peer.send({type:'join',role:'demon',playerId,name:'暗い喰らいCry'});timer=setInterval(()=>{try{const p=snapshot().player;peer.send({type:'state',x:p.x,z:p.z});}catch{}},100);}},
   onMessage:m=>{if(m.type==='rejected'){status(m.reason);clearInterval(timer);}if(m.type==='accepted')status('共有村へ侵入しました。一度きりです。');if(m.type==='snapshot'&&m.battle)status(m.battle.finished?'決着: '+m.battle.winner:'実プレイヤーと自動戦闘中');}
  });
  $('#online-answer').value=peer.code;
 }catch(e){status(e.message);}};}
