import {createPeerSignalingClient,sampleBrowserHostCapability} from '@soul/platform-web/peer-signaling';
import {normalizeHostCapability} from '@soul/network';

const wait=async(test,{timeoutMs=20_000,intervalMs=80}={})=>{const until=performance.now()+timeoutMs;while(performance.now()<until){const value=await test();if(value)return value;await new Promise(r=>setTimeout(r,intervalMs));}throw new Error('接続処理が時間切れになりました。');};
const short=value=>String(value||'').slice(0,8);
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function installPeerAutoSignaling({root,client=createPeerSignalingClient()}={}){
  if(!root||root.querySelector('.peer-auto-signaling'))return null;
  const box=document.createElement('section');box.className='peer-auto-signaling';box.innerHTML=`
    <h3>かんたん接続</h3>
    <p class="peer-auto-note">通常はこちらを使います。接続コード欄は通信障害時の手動fallbackです。</p>
    <div class="peer-auto-actions"><button type="button" data-auto-host>この村を自動公開</button><button type="button" data-auto-refresh>公開中の村を探す</button></div>
    <p data-auto-state>接続先を確認できます。</p><div data-auto-rooms></div>`;
  root.prepend(box);
  const stateNode=box.querySelector('[data-auto-state]'),roomsNode=box.querySelector('[data-auto-rooms]');
  let stopped=false,room=null,hostCursor=0,hostLoop=null,telemetryLoop=null,serial=Promise.resolve(),lastPhase='open',migrationStart=null,lastMigrationMs=null,splitBrainPrevented=0;
  const state=text=>{stateNode.textContent=text;};
  const session=()=>window.__VILLAGE_PEER_HOSTED_WORLD__;
  const snapshot=()=>session()?.snapshot?.()||null;
  async function capability(){return normalizeHostCapability(await sampleBrowserHostCapability());}
  async function renderRooms(){
    state('公開中の村を確認しています。');
    try{const data=await client.listRooms(),rooms=data.rooms||[];roomsNode.replaceChildren();if(!rooms.length){roomsNode.textContent='いま参加できる共通村はありません。';state('この端末の村を公開できます。');return;}
      for(const item of rooms){const row=document.createElement('article');row.className='peer-auto-room';row.innerHTML=`<strong>${escape(item.label||'共通村')}</strong><small>${item.peers||1}端末 · Host ${escape(item.hostRef||'-')} · score ${item.hostScore??'--'}</small><button type="button">この村へ参加</button>`;row.querySelector('button').onclick=()=>joinRoom(item.roomId).catch(error=>state(error.message));roomsNode.append(row);}state(`${rooms.length}件の共通村を確認しました。`);
    }catch(error){state(`自動検索を利用できません。手動コード接続は利用できます: ${error.message}`);}
  }
  async function startHosting(){
    if(room){state('この村はすでに公開中です。');return;}
    const hostButton=root.querySelector('#peer-world-host');if(!hostButton)throw new Error('Host操作を準備できません。');
    if(!snapshot()?.node?.hostId){hostButton.click();await wait(()=>snapshot()?.node?.hostId===snapshot()?.selfId);}
    const snap=snapshot(),hostCapability=await capability();const created=await client.createRoom({worldId:snap.node.worldId,label:'星継ぎの庭',hostId:snap.selfId,capability:hostCapability});room={...created.room,hostToken:created.hostToken};state('共通村を公開しました。参加者を自動で迎えます。');startHostLoop();startTelemetry();
  }
  function startHostLoop(){if(hostLoop)return;hostLoop=setInterval(()=>{if(stopped||!room)return;serial=serial.then(processHostEvents).catch(error=>state(`自動接続を継続できません: ${error.message}`));},350);}
  async function processHostEvents(){
    const data=await client.pollHost(room.roomId,room.hostToken,hostCursor);hostCursor=data.next??hostCursor;
    for(const event of data.events||[]){if(event.type==='join')await makeOffer(event);else if(event.type==='answer')await acceptAnswer(event);}
  }
  async function makeOffer(event){
    const make=root.querySelector('#peer-world-make-offer'),field=root.querySelector('#peer-world-host-offer');if(!make||!field)throw new Error('Host接続UIがありません。');
    field.value='';make.click();const offer=await wait(()=>field.value.length>20&&field.value);await client.postOffer(room.roomId,event.joinId,room.hostToken,offer);state(`${short(event.peerId)} の接続を準備しています。`);
  }
  async function acceptAnswer(event){
    const answer=root.querySelector('#peer-world-host-answer'),accept=root.querySelector('#peer-world-accept');if(!answer||!accept)throw new Error('Host応答UIがありません。');answer.value=event.answer;accept.click();await new Promise(r=>setTimeout(r,50));state(`${short(event.peerId)} を共通村へ迎えています。`);
  }
  async function joinRoom(roomId){
    if(snapshot()?.node?.hostId)throw new Error('すでに共通村へ接続しています。');
    state('共通村との接続を自動で準備しています。');const selfId=localStorage.getItem('soul.village.peer.v1')||crypto.randomUUID();localStorage.setItem('soul.village.peer.v1',selfId);const joined=await client.joinRoom(roomId,{peerId:selfId,app:'village',capability:await capability()});let cursor=0;
    const offerEvent=await wait(async()=>{const data=await client.pollGuest(roomId,joined.joinId,joined.guestToken,cursor);cursor=data.next??cursor;return(data.events||[]).find(e=>e.type==='offer')||null;},{timeoutMs:25_000,intervalMs:250});
    const offer=root.querySelector('#peer-world-offer'),join=root.querySelector('#peer-world-join'),answer=root.querySelector('#peer-world-answer');offer.value=offerEvent.offer;join.click();const answerCode=await wait(()=>answer.value.length>20&&answer.value,{timeoutMs:20_000});await client.postAnswer(roomId,joined.joinId,joined.guestToken,answerCode);await wait(()=>snapshot()?.node?.phase==='open',{timeoutMs:25_000});state('共通村へ接続しました。Host交代も自動で追従します。');
  }
  function startTelemetry(){if(telemetryLoop)return;telemetryLoop=setInterval(()=>sendTelemetry().catch(()=>{}),2000);sendTelemetry().catch(()=>{});}
  async function sendTelemetry(){
    if(!room)return;const snap=snapshot(),node=snap?.node;if(!node||node.hostId!==snap.selfId)return;const now=performance.now();
    if(node.phase!==lastPhase){if(node.phase==='migrating')migrationStart=now;if(lastPhase==='migrating'&&node.phase==='open'&&migrationStart!==null){lastMigrationMs=now-migrationStart;migrationStart=null;}if(node.phase==='closed'&&lastPhase==='migrating')splitBrainPrevented++;lastPhase=node.phase;}
    const members=Object.values(node.authority?.members||{}).filter(m=>m.connected),total=members.length,required=Math.floor(total/2)+1,hostMember=node.authority?.members?.[node.hostId],score=hostMember?.meta?.hostCapability?.score??(await capability()).score;
    await client.telemetry(room.roomId,room.hostToken,{phase:node.phase,hostRef:short(node.hostId),hostScore:score,peers:Math.max(1,total),checkpointRevision:node.checkpointRevision,epoch:node.epoch,quorum:{acked:node.phase==='open'?required:0,total},migrationMs:lastMigrationMs,sloPass:lastMigrationMs===null||lastMigrationMs<=6000,splitBrainPrevented});
  }
  async function closeRoom(){if(!room)return;const current=room;room=null;try{await client.closeRoom(current.roomId,current.hostToken);}catch{}}
  box.querySelector('[data-auto-host]').onclick=()=>startHosting().catch(error=>state(`自動公開できません。手動接続は利用できます: ${error.message}`));
  box.querySelector('[data-auto-refresh]').onclick=()=>renderRooms();
  const onHide=()=>closeRoom();window.addEventListener('pagehide',onHide,{once:true});renderRooms();
  const api={refresh:renderRooms,host:startHosting,close:async()=>{stopped=true;clearInterval(hostLoop);clearInterval(telemetryLoop);await closeRoom();window.removeEventListener('pagehide',onHide);box.remove();},snapshot:()=>({room:room?.roomId||null,lastMigrationMs,splitBrainPrevented})};window.__VILLAGE_AUTO_SIGNALING__=api;return api;
}
