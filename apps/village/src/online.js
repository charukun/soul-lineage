import {createHostClock} from './game/host-clock.js';
import {DAY_SECONDS} from './game/core.js';
import {createHostOffer,acceptHostOffer} from '@soul/network/peer';
import {RaidHost} from '@soul/network/raid-host';
import {createPresenceTransport} from '@soul/network/transport-lod';
import {createPeerHostedWorldNode} from '@soul/network/peer-hosted-world';
import {createPeerMeshCoordinator} from '@soul/network/peer-mesh';
import {createVillageCheckpoint} from '@soul/network';
import {installWorldDarknessOverlay} from '@soul/shared-ui/world-darkness';

const PLAYER_KEY='soul.village.peer.v1';
const CLOSED=new Set(['closed','failed','error']);
let activeSession=null;

export function installOnlineHost(container=document.getElementById('onlineHost')){
  activeSession?.dispose?.();
  if(!container)throw new Error('オンライン村の表示先がありません。');
  const village=window.village;
  if(!village)throw new Error('村の起動後にオンライン接続してください。');
  const {world,sim,view}=village;
  const selfId=localStorage.getItem(PLAYER_KEY)||crypto.randomUUID();localStorage.setItem(PLAYER_KEY,selfId);
  const ownWorldId=String(world.state.villageId||'local-hoshitsugi');
  const transport=createPresenceTransport(),direct=new Map();
  const overlay=installWorldDarknessOverlay({onPauseChange:paused=>{window.__VILLAGE_WORLD_PAUSED__=paused;}});
  let node=null,mesh=null,star=null,starHostId=null,pending=null,seq=0,disposed=false,lastCheckpointAt=0,lastAuthorityHost=null,remoteSession=false;
  let raidHost=new RaidHost({villageId:ownWorldId,storage:localStorage});

  container.replaceChildren();
  const root=document.createElement('section');root.className='peer-world-panel';root.innerHTML=`
    <h2>共通村</h2>
    <p id="peer-world-state">ローカル村。ホストすると、この村を仲間へ開きます。</p>
    <div class="peer-world-actions"><button id="peer-world-host">この村を開く</button><button id="peer-world-handoff" disabled>次の端末へ世界を継ぐ</button></div>
    <label>参加コード<textarea id="peer-world-offer" placeholder="別端末の参加コードを貼り付けます"></textarea></label>
    <button id="peer-world-join">この村の待機Hostとして参加</button>
    <label>応答コード<textarea id="peer-world-answer" readonly></textarea></label>
    <hr><button id="peer-world-make-offer" disabled>仲間用の参加コードを発行</button>
    <label>仲間へ渡すコード<textarea id="peer-world-host-offer" readonly></textarea></label>
    <label>仲間から返った応答<textarea id="peer-world-host-answer"></textarea></label>
    <button id="peer-world-accept" disabled>応答を確定</button><pre id="peer-world-debug"></pre>`;
  container.append(root);style(root);
  const $=q=>root.querySelector(q),stateText=t=>{$('#peer-world-state').textContent=t;};

  function connectionFor(peerId){const id=String(peerId);return direct.get(id)||mesh?.connection(id)||(starHostId===id?star:null)||null;}
  function sendDirect(peerId,message,{presence=false}={}){const connection=connectionFor(peerId);if(!connection)return false;try{presence&&connection.sendPresence?connection.sendPresence(message):connection.send(message);return true;}catch{return false;}}
  function broadcast(message){let sent=0;const seen=new Set();for(const[id,connection]of direct){try{connection.send(message);sent++;seen.add(id);}catch{direct.delete(id);}}if(star&&starHostId&&!seen.has(starHostId)){try{star.send(message);sent++;seen.add(starHostId);}catch{}}for(const id of mesh?.snapshot().connected||[])if(!seen.has(id)&&mesh.send(id,message))sent++;return sent;}
  function emitProtocol({to,message}){if(to)return sendDirect(to,message);return broadcast(message);}

  function applyRemoteCheckpoint(checkpoint){
    const result=world.load(JSON.stringify(checkpoint.world));if(result.error)throw new Error(result.error);
    if(checkpoint.session?.raidHost)raidHost.restoreCheckpoint(checkpoint.session.raidHost);
    remoteSession=true;window.__VILLAGE_REMOTE_WORLD_ACTIVE__=true;
    sim.refresh();view.roomId=null;view.followId=null;view.rebuild();
    window.dispatchEvent(new CustomEvent('village:authority-restored',{detail:{worldId:node?.snapshot().worldId,revision:node?.snapshot().revision}}));
  }
  function captureCheckpoint(){
    const online=[...raidHost.peers].map(([id,p])=>({id,position:[p.x,0,p.z]}));
    const npcs=world.people.map(p=>({id:p.id,position:[p.x,0,p.z]}));
    return createVillageCheckpoint({worldTimeMs:Math.max(0,Math.round(world.state.clock*DAY_SECONDS*1000)),world:JSON.parse(world.export()),characters:online,npcs,randomState:world.state.rng,session:{raidHost:raidHost.checkpoint()}});
  }

  function phaseChanged(info){
    const wasHost=lastAuthorityHost===selfId;lastAuthorityHost=info.hostId;
    overlay.setPhase(info.phase,{candidateId:info.candidateId});
    window.__VILLAGE_SIMULATION_PAUSED__=info.phase!=='open'||!info.isHost;
    const eligible=Object.entries(node?.authority?.members||{}).filter(([id,m])=>id!==selfId&&m.connected&&m.eligible).length;
    $('#peer-world-handoff').disabled=!info.isHost||eligible===0;$('#peer-world-make-offer').disabled=!info.isHost;$('#peer-world-accept').disabled=!info.isHost;
    if(info.isHost&&!wasHost&&remoteSession)stateText('闇が晴れました。この端末が村の時間を引き継いでいます。');
    else if(info.phase==='migrating')stateText('闇の中で、次のHostへ村を継いでいます。');
    else if(info.phase==='closed')stateText('安全に継げるHostがいないため、村は停止しています。');
    else if(info.isHost)stateText('この端末が現在のHostです。');
    else stateText(`共通村へ接続中 · Host ${info.hostId||'-'}`);
    syncMesh();
  }

  function makeNode({worldId,mayorId,authority=null,checkpoint=null}){
    if(node)return node;
    if(raidHost.villageId!==worldId)raidHost=new RaidHost({villageId:worldId,storage:localStorage});
    node=createPeerHostedWorldNode({selfId,worldId,mayorId,hostEligible:true,emit:emitProtocol,applyCheckpoint:applyRemoteCheckpoint,onPhase:phaseChanged});
    mesh=createPeerMeshCoordinator({selfId,RTCPeerConnection,relay:event=>{const hostId=node?.snapshot().hostId;if(hostId&&hostId!==selfId)sendDirect(hostId,{type:'mesh-relay',from:selfId,...event});},onMessage:(peerId,message,kind)=>handleMessage(peerId,message,kind),onState:(peerId,state)=>{if(CLOSED.has(state)&&node?.isHost){node.hostDisconnect(peerId);raidHost.leave(peerId);}}});
    if(authority)node.adoptAuthority(authority.hostId||mayorId,authority);
    if(checkpoint)node.receive(authority?.hostId||mayorId,{type:'world-checkpoint',worldId,hostId:authority?.hostId||mayorId,epoch:checkpoint.epoch,revision:checkpoint.revision,checkpoint:checkpoint.checkpoint});
    syncMesh();return node;
  }
  function syncMesh(){if(!node||!mesh)return;const authority=node.authority;if(authority?.hostId!==selfId)mesh.syncMembers(Object.keys(authority?.members||{}),{hostId:authority?.hostId});}
  function relaySignal(from,message){if(!node?.isHost||!message.to)return false;const target=connectionFor(message.to);if(!target)return false;try{target.send({type:'mesh-signal',from,signal:message.signal});return true;}catch{return false;}}
  function handleProtocol(senderId,message){if(!node)return false;const handled=node.receive(senderId,message);if(handled&&message.type==='world-authority')syncMesh();return handled;}
  function handleMessage(senderId,message,kind='reliable'){
    if(disposed||!message)return;
    if(message.type==='mesh-relay'){relaySignal(senderId,message);return;}
    if(message.type==='mesh-signal'){mesh?.handleSignal(message.from||senderId,message.signal);return;}
    if(message.type?.startsWith('world-')&&message.type!=='world-welcome'){handleProtocol(senderId,message);return;}
    if(node?.isHost&&message.type==='state'){raidHost.input(senderId,message);const p=raidHost.peers.get(senderId);if(p)window.__VILLAGE_WORLD_SCALE__?.upsertPresence?.({id:senderId,x:p.x,z:p.z,yaw:p.yaw||0,state:p.role,important:!!raidHost.battle});return;}
    if(message.type==='snapshot-delta'||message.type==='snapshot')for(const[id,p]of Object.entries(message.players||{}))window.__VILLAGE_WORLD_SCALE__?.upsertPresence?.({id,...p,receivedAt:message.serverTime||performance.now()});
  }

  async function startHost(){
    if(node)throw new Error('すでに共通村へ接続しています。');
    makeNode({worldId:ownWorldId,mayorId:selfId});node.seedHost();remoteSession=false;window.__VILLAGE_REMOTE_WORLD_ACTIVE__=false;window.__VILLAGE_SIMULATION_PAUSED__=false;
    node.publishCheckpoint(captureCheckpoint());lastCheckpointAt=performance.now();stateText('この端末が現在のHostです。仲間用コードを発行できます。');
  }
  async function makeOffer(){
    if(!node?.isHost)throw new Error('現在のHostだけが参加コードを発行できます。');
    let peerId=`pending-${++seq}`,connection;
    connection=await createHostOffer({RTCPeerConnection,dualChannel:true,onState:s=>{if(CLOSED.has(s)){for(const[id,c]of direct)if(c===connection){direct.delete(id);node?.hostDisconnect(id);raidHost.leave(id);}}},onMessage:(message,kind)=>{
      if(message.type==='join'){
        peerId=String(message.playerId||'');if(!peerId)throw new Error('参加者IDがありません。');
        const result=raidHost.join(peerId,message);if(result.type==='rejected'){connection.send(result);connection.close();return;}
        direct.set(peerId,connection);node.hostAdmit(peerId,{eligible:message.hostEligible===true,meta:{app:message.app||message.role,role:message.role,name:message.name||message.role}});
        connection.send(result);const snap=node.snapshot(),cp={epoch:snap.epoch,revision:snap.checkpointRevision,checkpoint:captureCheckpoint()};connection.send({type:'world-welcome',worldId:snap.worldId,mayorId:node.authority.mayorId,authority:node.authority,checkpoint:cp});node.publishCheckpoint(cp.checkpoint);syncMesh();return;
      }
      handleMessage(peerId,message,kind);
    }});
    pending=connection;$('#peer-world-host-offer').value=connection.code;$('#peer-world-host-answer').value='';$('#peer-world-accept').disabled=false;
  }
  async function joinRemote(){
    if(node)throw new Error('すでに共通村へ接続しています。');
    const offer=$('#peer-world-offer').value.trim();if(!offer)throw new Error('参加コードを貼り付けてください。');
    let connection;
    connection=await acceptHostOffer(offer,{RTCPeerConnection,dualChannel:true,onState:s=>{if(CLOSED.has(s)&&node){star=null;node.tick();}},onMessage:(message,kind)=>{
      if(message.type==='world-welcome'){
        starHostId=String(message.authority?.hostId||message.mayorId);star=connection;remoteSession=true;window.__VILLAGE_REMOTE_WORLD_ACTIVE__=true;makeNode(message);window.__VILLAGE_SIMULATION_PAUSED__=true;syncMesh();stateText('共通村の待機Hostとして接続しました。Host移譲時だけ村を復元します。');return;
      }
      if(message.type==='mesh-signal'){mesh?.handleSignal(message.from||starHostId,message.signal);return;}
      if(message.type?.startsWith('world-')){handleProtocol(starHostId,message);return;}
      handleMessage(starHostId,message,kind);
    }});
    star=connection;$('#peer-world-answer').value=connection.code;connection.send({type:'join',role:'human',playerId:selfId,name:'MURAAAAAAA Host候補',app:'village',hostEligible:true,transport:'dual-v1'});
  }

  $('#peer-world-host').onclick=()=>startHost().catch(e=>stateText(e.message));$('#peer-world-make-offer').onclick=()=>makeOffer().catch(e=>stateText(e.message));
  $('#peer-world-accept').onclick=async()=>{try{if(!pending)throw new Error('先に参加コードを発行してください。');await pending.accept($('#peer-world-host-answer').value);stateText('仲間の接続を待っています。');}catch(e){stateText(e.message);}};
  $('#peer-world-join').onclick=()=>joinRemote().catch(e=>stateText(e.message));$('#peer-world-handoff').onclick=()=>{if(node?.gracefulHandoff())stateText('次のHostへ世界を継いでいます。');};

  const advance=createHostClock(dt=>{if(node?.isHost){raidHost.tick(dt);return true;}return false;},performance.now());
  const timer=setInterval(()=>{
    if(disposed)return;node?.tick();const now=performance.now();
    if(node?.isHost){const advanced=advance(now);if(advanced)for(const peerId of Object.keys(node.authority?.members||{})){if(peerId===selfId||!node.authority.members[peerId].connected)continue;const connection=connectionFor(peerId);if(connection)transport.sendObserverSnapshot(peerId,connection,raidHost.snapshotFor(peerId),now);}if(now-lastCheckpointAt>2000){lastCheckpointAt=now;try{node.publishCheckpoint(captureCheckpoint());}catch(error){stateText('Checkpointを更新できません: '+error.message);}}}
    const snap=node?.snapshot();if(snap)$('#peer-world-debug').textContent=`World ${snap.worldId}\nPhase ${snap.phase} / Epoch ${snap.epoch}\nHost ${snap.hostId||'-'} / Candidate ${snap.candidateId||'-'}\nCheckpoint ${snap.checkpointRevision}\nMesh ${mesh?.snapshot().connected.length||0}\nPresence ${transport.snapshot().presenceSent} / drop ${transport.snapshot().dropped}`;
  },100);

  const dispose=()=>{if(disposed)return;disposed=true;clearInterval(timer);if(node?.isHost)node.gracefulHandoff();mesh?.close();for(const connection of direct.values())connection.close?.();star?.close?.();node?.close();overlay.dispose();window.__VILLAGE_SIMULATION_PAUSED__=false;window.__VILLAGE_REMOTE_WORLD_ACTIVE__=false;if(activeSession?.dispose===dispose)activeSession=null;};
  window.addEventListener('pagehide',dispose,{once:true});activeSession={dispose,snapshot:()=>({selfId,node:node?.snapshot()||null,mesh:mesh?.snapshot()||null,transport:transport.snapshot(),remoteSession})};window.__VILLAGE_PEER_HOSTED_WORLD__=activeSession;return activeSession;
}
function style(el){el.style.cssText='margin:0 auto;max-width:720px;padding:12px;color:#eee';el.querySelectorAll('textarea').forEach(x=>x.style.cssText='display:block;width:100%;height:68px;margin:6px 0;background:#080808;color:#bfe;padding:8px;box-sizing:border-box');el.querySelectorAll('button').forEach(x=>x.style.cssText='padding:9px;margin:3px;background:#6b5530;color:white;border:0;border-radius:8px');}
