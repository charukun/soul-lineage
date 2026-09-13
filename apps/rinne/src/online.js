import{acceptHostOffer}from'@soul/network/peer';
const PLAYER_KEY='soul.rinne.player.v1';
export function installOnlinePlayer(container=document.querySelector('main')){let peer,x=0,z=0;const playerId=localStorage.getItem(PLAYER_KEY)||crypto.randomUUID();localStorage.setItem(PLAYER_KEY,playerId);const root=document.createElement('section');root.innerHTML=`<h2>村へ参加</h2><p id="peer-state">村長の参加コードを貼り付けます</p><label for="host-offer">村長から届いた参加コード</label><textarea id="host-offer" spellcheck="false" autocomplete="off"></textarea><button id="join-peer">応答コードを作る</button><label for="peer-answer">村長に返す応答コード</label><textarea id="peer-answer" readonly aria-label="村長に返す応答コード"></textarea><div class="peer-movement" aria-label="参加先の村で移動"><button data-move="0,-1">↑</button><button data-move="-1,0">←</button><button data-move="1,0">→</button><button data-move="0,1">↓</button></div><pre id="raid-state" role="status"></pre><p class="peer-note">参加先の村では、メニューを開いても世界は進みます。ここでの接続と本編の人生は、現在は別々に進行します。</p>`;container.append(root);style(root);const $=q=>root.querySelector(q),status=t=>$('#peer-state').textContent=t;
 $('#join-peer').onclick=async()=>{try{
  peer=await acceptHostOffer($('#host-offer').value,{
   RTCPeerConnection,
   onState:s=>{status('接続: '+s);if(s==='open')peer.send({type:'join',role:'human',playerId,name:'輪廻転焦の旅人'});},
   onMessage:m=>{if(m.type==='rejected')status(m.reason);if(m.type==='accepted')status('村へ参加しました');if(m.type==='snapshot'){const me=m.players&&Object.values(m.players).find(p=>p.playerId===playerId);$('#raid-state').textContent=`HP ${me?.hp??'-'} / ${me?.maxhp??'-'}\n${m.battle?m.battle.finished?'決着: '+m.battle.winner:'魔物と自動戦闘中':'村を探索中'}`;}}
  });
  $('#peer-answer').value=peer.code;
 }catch(e){status(e.message);}};
 root.querySelectorAll('[data-move]').forEach(b=>b.onclick=()=>{if(!peer)return;const[a,c]=b.dataset.move.split(',').map(Number);x+=a*2;z+=c*2;try{peer.send({type:'state',x,z});}catch(e){status(e.message);}});}
function style(el){el.style.cssText='margin:20px auto;max-width:720px;padding:18px;border:1px solid #8b7750;background:#15130fcc;color:#eee';el.querySelectorAll('textarea').forEach(x=>x.style.cssText='display:block;width:100%;height:78px;margin:8px 0;background:#080808;color:#bfe;padding:8px');el.querySelectorAll('button').forEach(x=>x.style.cssText='padding:10px;margin:4px;background:#6b5530;color:white;border:0');}
