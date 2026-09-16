import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { setTimeout as delay } from 'node:timers/promises';
import { createCoopHost, joinCoopHost } from '../src/coop/session.js';
import { CoopWorld } from '../src/rebuild/coop-world.js';
import { defaultMuraLayout } from '@soul/world/mura';
const { RTCPeerConnection: RTC }=createRequire(import.meta.url)(process.env.RINNE_RTC_MODULE||'werift');
const pcs=[];
// Node-only real SCTP/DTLS/ICE loopback probe. This cannot certify a browser, NAT or TURN path.
class LocalRTC extends RTC { constructor(){super({iceServers:[],iceUseIpv4:false,iceUseIpv6:false,iceAdditionalHostAddresses:['127.0.0.1'],iceInterfaceAddresses:{udp4:'127.0.0.1'}});pcs.push(this);} }
async function until(fn,label){const deadline=Date.now()+5000;while(!fn()){if(Date.now()>deadline)throw Error(label);await delay(20);}}
let saved,ticket,host,guest;
try{
 const world=new CoopWorld({worldId:'rtc-room',ownerId:'owner',layout:defaultMuraLayout(),name:'Host'});
 host=await createCoopHost({world,contentVersion:'rtc-test',save:async value=>{saved=structuredClone(value);},RTCPeerConnection:LocalRTC});
 const invite=await host.invite();
 guest=await joinCoopHost({invite,name:'Guest',contentVersion:'rtc-test',RTCPeerConnection:LocalRTC,remember:value=>ticket=value});
 await host.accept(guest.answerCode);await until(()=>guest.snapshot().phase==='open','welcome timeout');
 assert.equal(guest.snapshot().view.connected,2);const start=guest.snapshot().view.me.position;
 for(let i=0;i<10;i++){guest.input({x:0,z:1});await delay(50);}
 await until(()=>guest.snapshot().view.me.position.z>start.z+.1,'shared movement timeout');
 host.pause(true);await until(()=>guest.snapshot().phase==='closed','darkness timeout');const tick=world.data.tick;await delay(200);assert.equal(world.data.tick,tick);
 host.pause(false);await until(()=>guest.snapshot().phase==='open','resume timeout');
 for(const row of Object.values(world.data.players)){Object.assign(row.life,{ageSeconds:1200,ageYears:20,phase:'living',zone:'frontier',position:{x:0,z:0}});row.life.equipment.weapon='sword';}
 await until(()=>guest.snapshot().view.front?.enemies.some(enemy=>enemy.hp<enemy.maxHp),'shared battle timeout');
 host.pause(true);await until(()=>guest.snapshot().phase==='closed','battle pause timeout');assert.deepEqual(guest.snapshot().view.front,world.view(guest.selfId).front);
 host.pause(false);
 const playerId=guest.selfId;await host.dispose();await until(()=>guest.snapshot().phase==='closed','host loss timeout');guest.dispose();
 const restored=new CoopWorld({worldId:'rtc-room',ownerId:'owner',layout:saved.layout,saved:saved.world});
 host=await createCoopHost({world:restored,contentVersion:'rtc-test',save:async value=>{saved=structuredClone(value);},RTCPeerConnection:LocalRTC});
 const freshInvite=await host.invite();guest=await joinCoopHost({invite:freshInvite,name:'Guest',contentVersion:'rtc-test',RTCPeerConnection:LocalRTC,resume:ticket});await host.accept(guest.answerCode);await until(()=>guest.snapshot().phase==='open','reconnect timeout');
 assert.equal(guest.selfId,playerId);assert.equal(guest.snapshot().view.epoch,2);assert.equal(guest.snapshot().view.count,2);
 console.log(JSON.stringify({pass:true,transport:'werift SCTP/DTLS/ICE loopback',checks:['welcome','shared input','shared enemy HP','pause','host loss','same-host reconnect','epoch','stable identity']},null,2));
}finally{guest?.dispose();await host?.dispose();await Promise.all(pcs.map(pc=>pc.close()));}
