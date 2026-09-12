import test from 'node:test';
import assert from 'node:assert/strict';
import {PREY,RAID_SCALES,offerVillages,makeVillage,describeVillage,importHousing} from '../world.js';
import {ProfileStore} from '../profile.js';
import {advanceDevour,cancelDevour,DEVOUR_SECONDS} from '../devour.js';
import {ITEMS} from '@soul/housing-assets/catalog';
const store=()=>{const data=new Map();return new ProfileStore({getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)},()=> 'hunt-test',()=>123);};
const offer=(raidScale='small',target='traveller',seed=1)=>({id:`raid:${seed}`,name:'旧来の固有村名',seed,target,raidScale,source:'generated',weather:'fog'});
for(const [size,scale] of Object.entries(RAID_SCALES))test(`${size}: briefing matches the actual deterministic world over 40 seeds`,()=>{
 for(let seed=1;seed<=40;seed++){
  const v=offer(size,'traveller',seed),world=makeVillage(v),brief=describeVillage(v);
  assert.equal(world.entities.filter(e=>ITEMS[e.type]?.house||e.type==='bakery').length,scale.houses);
  assert.equal(world.npcs.length,scale.residents);assert.equal(brief.homes,scale.houses);assert.equal(brief.residents,scale.residents);
  assert.equal(brief.armed,world.npcs.filter(n=>PREY[n.role].weapon!=='fist').length);
  assert.equal(brief.size,size);assert.equal(world.npcs.filter(n=>n.marked).length,1);
  assert.deepEqual(makeVillage(v),world);
 }
});
test('all three scale choices persist without changing village identities',()=>{
 const s=store(),first=offerVillages(s);assert.deepEqual(first.map(v=>v.raidScale),['small','medium','large']);
 assert.deepEqual(offerVillages(s),first);
 s.change(p=>p.offers.forEach(v=>delete v.raidScale));const old=s.read().offers;
 const upgraded=offerVillages(s);
 assert.deepEqual(upgraded.map(({raidScale,...v})=>v),old);
 assert.deepEqual(upgraded.map(v=>v.raidScale),['small','medium','large']);
 assert.equal(s.read().sequence,3);
});
test('claim, finish, and reload never permit a second visit after scale migration',()=>{
 const s=store(),v=offerVillages(s)[0];s.claim(v);s.finish(v.id,'escaped',0);
 const next=offerVillages(s);assert.ok(next.every(n=>n.id!==v.id));
 assert.throws(()=>s.claim({...v,raidScale:'large'}),/再び入れません/);
 assert.equal(s.read().visits[v.id].name,v.name);
});
test('small villages with a powerful target are not mislabeled low risk',()=>{
 assert.equal(describeVillage(offer('small','traveller')).danger,1);
 assert.equal(describeVillage(offer('medium','traveller')).danger,2);
 assert.equal(describeVillage(offer('large','traveller')).danger,3);
 assert.equal(describeVillage(offer('small','knight')).danger,3);
 assert.equal(describeVillage({...offer('small','traveller'),level:4}).danger,1);
});
test('legacy worlds without scale still use the original medium layout',()=>{
 const v=offer();delete v.raidScale;const w=makeVillage(v);
 assert.equal(describeVillage(v).homes,10);assert.equal(w.npcs.length,12);
});
test('imported layouts stay unchanged and count every supported housing type',()=>{
 const entities=['mushroom','greenhouse','cottage'].map((type,i)=>({id:String(i),type,x:i*8,z:0,r:.3,room:0,floors:2}));
 entities.push({id:'inside',type:'cottage',x:1,z:1,room:1});
 const data={gameId:'village',playerId:'owner',villageId:'one',payload:{entities,name:'保存した村'}};
 const v=importHousing(data),before=structuredClone(v),w=makeVillage({...v,raidScale:'large'}),d=describeVillage(v);
 assert.deepEqual(v,before);assert.equal(d.homes,3);assert.equal(d.residents,12);assert.equal(d.imported,true);
 assert.deepEqual(w.entities.map(e=>[e.id,e.type,e.x,e.z,e.r,e.floors]),v.entities.filter(e=>e.room===0).map(e=>[e.id,e.type,e.x,e.z,e.r,e.floors]));
});
function session(distance=.5){
 const npc={id:'prey',x:0,z:distance,dead:true,eaten:false};
 return{player:{x:0,z:0,yaw:0,walk:0,speed:4,pose:{pitch:1}},profile:{form:'hollow'},devour:{npc,t:0},consumes:0,
 lineBlocked:()=>false,walkActor(p,x,z){p.x+=x;p.z+=z;return Math.hypot(x,z);},
 consume(n){assert.equal(n.eaten,false);n.eaten=true;this.consumes++;}};
}
test('approach cannot advance feeding or retain a combat pose',()=>{
 const s=session(3),n=s.devour.npc;advanceDevour(s,.1);
 assert.equal(s.devour.t,0);assert.equal(s.devour.phase,'approach');assert.equal(s.player.devourProgress,null);
 assert.equal(s.player.pose,null);assert.equal(n.capturedBy,undefined);assert.ok(s.player.speed>0);assert.equal(s.consumes,0);
});
test('walls and closed gates cannot be bypassed by the devour timer',()=>{
 const s=session(.5);s.lineBlocked=()=>true;
 for(let i=0;i<300;i++)advanceDevour(s,1/60);
 assert.equal(s.devour.t,0);assert.equal(s.consumes,0);assert.equal(s.player.devourProgress,null);
});
test('feeding progress, capture pose, and the single reward agree',()=>{
 const s=session(),n=s.devour.npc;advanceDevour(s,.5);
 assert.equal(s.player.devourProgress,.5/DEVOUR_SECONDS);assert.equal(n.capturedBy.progress,s.player.devourProgress);assert.equal(s.player.speed,0);
 advanceDevour(s,.5);assert.equal(s.consumes,0);advanceDevour(s,.5);
 assert.equal(s.consumes,1);assert.equal(n.eaten,true);assert.equal(s.devour,null);assert.equal(n.capturedBy,undefined);assert.equal(s.player.devourProgress,null);
 advanceDevour(s,.5);assert.equal(s.consumes,1);
});
test('movement interrupts capture without reward and restart begins at zero',()=>{
 const s=session(),n=s.devour.npc;advanceDevour(s,.7);advanceDevour(s,.1,.09);
 assert.equal(s.devour,null);assert.equal(n.capturedBy,undefined);assert.equal(s.consumes,0);
 s.devour={npc:n,t:0};advanceDevour(s,.1);assert.equal(s.player.devourProgress,.1/DEVOUR_SECONDS);
});
test('losing contact resets progress and releases the visual target',()=>{
 const s=session(),n=s.devour.npc;advanceDevour(s,.7);n.z=4;advanceDevour(s,.1);
 assert.equal(s.devour.t,0);assert.equal(s.player.devourProgress,null);assert.equal(n.capturedBy,undefined);
});
test('session end, invalid target, and explicit cancellation release all capture state',()=>{
 for(const kind of ['finished','eaten','alive','explicit']){
  const s=session(),n=s.devour.npc;advanceDevour(s,.1);
  if(kind==='finished')s.finished=true;if(kind==='eaten')n.eaten=true;if(kind==='alive')n.dead=false;
  if(kind==='explicit')cancelDevour(s);else advanceDevour(s,.1);
  assert.equal(s.devour,null);assert.equal(s.player.devourProgress,null);assert.equal(n.capturedBy,undefined);assert.equal(s.consumes,0);
 }
});
test('coincident positions retain finite heading and negative dt adds no progress',()=>{
 const s=session(0);advanceDevour(s,-.1);assert.equal(s.devour.t,0);assert.ok(Number.isFinite(s.player.yaw));
});
