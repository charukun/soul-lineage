import test from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { defaultMuraLayout } from '@soul/world/mura';
import { CoopWorld } from '../src/rebuild/coop-world.js';
import { LIFE_SECONDS } from '../src/rebuild/domain.js';
import { createCoopHost, joinCoopHost } from '../src/coop/session.js';

// Protocol fault fixture, not evidence of ICE/NAT/WebRTC compatibility.
// A remote HELLO may arrive before the offering side observes its channel-open event.
class MemoryRTC {
  static all=new Map();
  constructor(){this.id=String(MemoryRTC.all.size+1);MemoryRTC.all.set(this.id,this);this.channels=[];this.iceGatheringState='complete';}
  createDataChannel(label){const channel={label,readyState:'connecting',bufferedAmount:0,send:body=>queueMicrotask(()=>channel.other.onmessage?.({data:body}))};this.channels.push(channel);return channel;}
  async createOffer(){return{type:'offer',sdp:this.id};}
  async createAnswer(){return{type:'answer',sdp:this.id};}
  async setLocalDescription(value){this.localDescription=value;}
  async setRemoteDescription(value){
    if(value.type!=='answer')return;const other=MemoryRTC.all.get(value.sdp);this.other=other;other.other=this;
    for(const channel of this.channels){const remote=other.createDataChannel(channel.label);remote.other=channel;channel.other=remote;other.ondatachannel({channel:remote});remote.readyState='open';remote.onopen();}
    setTimeout(()=>{if(this.connectionState==='closed')return;for(const channel of this.channels){channel.readyState='open';channel.onopen();}},10);
  }
  close(){if(this.connectionState==='closed')return;this.connectionState='closed';for(const channel of this.channels){channel.readyState='closed';channel.onclose?.();}this.onconnectionstatechange?.();this.other?.close();}
}
async function until(fn){const deadline=Date.now()+1600;while(!fn()){if(Date.now()>deadline)throw Error('protocol deadline');await delay(10);}}
const room=()=>new CoopWorld({worldId:'test-room',ownerId:'owner',name:'Host',layout:defaultMuraLayout()});
const connect=async(host,options={})=>{const invite=await host.invite(),guest=await joinCoopHost({invite,name:'友達',contentVersion:'test',RTCPeerConnection:MemoryRTC,...options});await host.accept(guest.answerCode);return guest;};

test('early HELLO, common time, pause, disconnect and same-owner restoration retain one guest',async()=>{
  const world=room();let stored,ticket,host,guest;
  const options={contentVersion:'test',RTCPeerConnection:MemoryRTC,save:async value=>{stored=structuredClone(value);}};
  try{
    host=await createCoopHost({world,...options});guest=await connect(host,{remember:value=>{ticket=value;}});await until(()=>guest.snapshot().phase==='open');
    const playerId=guest.selfId;assert.equal(guest.snapshot().view.count,2);assert.equal(guest.snapshot().view.connected,2);assert.equal(guest.snapshot().view.me.id,`${playerId}:1`);
    guest.input({x:0,z:1});await until(()=>guest.snapshot().view.tick>4);assert(guest.snapshot().view.worldSeconds>0);
    host.pause(true);await until(()=>guest.snapshot().phase==='closed');const tick=world.data.tick;await delay(110);assert.equal(world.data.tick,tick);
    host.pause(false);await until(()=>guest.snapshot().phase==='open');await host.dispose();await until(()=>guest.snapshot().phase==='closed');guest.dispose();
    const restored=new CoopWorld({worldId:'test-room',ownerId:'owner',layout:stored.layout,saved:stored.world});host=await createCoopHost({world:restored,...options});
    guest=await connect(host,{resume:ticket});await until(()=>guest.snapshot().phase==='open');assert.equal(guest.selfId,playerId);assert.equal(guest.snapshot().view.count,2);assert.equal(guest.snapshot().view.epoch,2);
  }finally{guest?.dispose();await host?.dispose();}
});

test('a different build is rejected before another life is admitted',async()=>{
  const world=room(),host=await createCoopHost({world,contentVersion:'test',RTCPeerConnection:MemoryRTC,save:async()=>{}});let guest;
  try{guest=await connect(host,{contentVersion:'other-build'});await until(()=>guest.snapshot().phase==='closed');assert.match(guest.snapshot().error,/版/);assert.equal(Object.keys(world.data.players).length,1);}
  finally{guest?.dispose();await host.dispose();}
});

test('pending or failed historical save cannot publish death or keep the world ticking',async()=>{
  const world=room();let fail=false,release,pending=false;
  const host=await createCoopHost({world,contentVersion:'test',RTCPeerConnection:MemoryRTC,save:async()=>{if(fail){pending=true;await new Promise(resolve=>{release=resolve;});throw Error('disk full');}}});
  try{
    world.data.players.owner.life.ageSeconds=LIFE_SECONDS-.01;world.data.players.owner.life.ageYears=99.99;fail=true;
    await until(()=>pending);const tick=world.data.tick;assert(world.data.players.owner.life.ended);assert.equal(host.snapshot().view.me.ended,false);
    host.pause(true);host.pause(false);await delay(120);assert.equal(world.data.tick,tick);assert.equal(host.snapshot().view.me.ended,false);
    release();await until(()=>host.snapshot().phase==='closed');assert.equal(host.snapshot().error,'disk full');await delay(100);assert.equal(world.data.tick,tick);
  }finally{fail=false;release?.();await host.dispose();}
});

test('silence closes a guest even when transport reports no disconnect, then fresh state recovers',async()=>{
  const world=room(),host=await createCoopHost({world,contentVersion:'test',RTCPeerConnection:MemoryRTC,save:async()=>{}});let guest,clock=0;
  try{
    guest=await connect(host,{now:()=>clock});await until(()=>guest.snapshot().phase==='open');
    const hostPC=[...MemoryRTC.all.values()].find(pc=>pc.connectionState!=='closed'&&pc.channels[0]?.other&&pc.channels[0].other===MemoryRTC.all.get(pc.other.id)?.channels[0]);
    assert(hostPC);const channel=hostPC.channels[0],send=channel.send;channel.send=()=>{};clock=3000;
    await until(()=>guest.snapshot().phase==='closed');assert.match(guest.snapshot().error,/つながり/);
    channel.send=send;await until(()=>guest.snapshot().phase==='open');assert.equal(guest.snapshot().error,'');
  }finally{guest?.dispose();await host.dispose();}
});
