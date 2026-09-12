import {acceptHostOffer} from '@soul/network/peer';
const PLAYER_KEY='soul.demon.player.v1';
export function installOnlineRaid(snapshot) {
 let peer,timer,connecting=false,disposed=false;
 const playerId=localStorage.getItem(PLAYER_KEY)||crypto.randomUUID();
 localStorage.setItem(PLAYER_KEY,playerId);
 const root=document.createElement('dialog');root.id='online-box';root.setAttribute('aria-label','村長端末へ接続');
 root.innerHTML=`<form method="dialog"><button id="online-close">閉じる</button></form><h2>村長端末へ接続</h2><p>村長から受け取った参加コードを入力してください。</p><label>参加コード<textarea id="online-offer" placeholder="村長の参加コード"></textarea></label><button id="online-join" type="button">応答コードを作る</button><label>応答コード<textarea id="online-answer" readonly></textarea></label><p id="online-state" role="status"></p>`;
 document.body.append(root);
 const $=q=>root.querySelector(q),status=t=>$('#online-state').textContent=t;
 const disconnect=()=>{clearInterval(timer);timer=null;peer?.close();peer=null;};
 $('#online-join').onclick=async()=>{
  if(connecting||disposed)return;connecting=true;$('#online-join').disabled=true;disconnect();
  status('応答コードを準備しています');
  try {
   const connection=await acceptHostOffer($('#online-offer').value,{
    RTCPeerConnection,
    onState:s=>{if(disposed)return;status('接続: '+s);if(s==='open'&&peer){
     clearInterval(timer);peer.send({type:'join',role:'demon',playerId,name:'尽喰廻遊'});
     timer=setInterval(()=>{try{const p=snapshot().player;peer?.send({type:'state',x:p.x,z:p.z});}catch{}},100);
    }else if(['closed','failed','disconnected','error'].includes(s)){clearInterval(timer);}},
    onMessage:m=>{if(disposed)return;if(m.type==='rejected'){status(m.reason);clearInterval(timer);}if(m.type==='accepted')status('共有村へ侵入しました。一度きりです。');if(m.type==='snapshot'&&m.battle)status(m.battle.finished?'決着: '+m.battle.winner:'実プレイヤーと自動戦闘中');}
   });
   if(disposed){connection.close();return;}peer=connection;$('#online-answer').value=peer.code;
  }catch(e){if(!disposed)status(e.message);}finally{connecting=false;$('#online-join').disabled=false;}
 };
 const dispose=()=>{disposed=true;disconnect();root.remove();};
 window.addEventListener('pagehide',dispose,{once:true});
 return {open(){if(!disposed&&!root.open)root.showModal();},close(){root.close();},dispose};
}
