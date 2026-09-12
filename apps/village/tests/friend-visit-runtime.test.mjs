import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as invites from '@soul/network/friend-invite';
const hostSource=readFileSync(new URL('../src/online.js',import.meta.url),'utf8');
const guestSource=readFileSync(new URL('../src/friend-visit.js',import.meta.url),'utf8');
const saved=()=>({name:'友人の村',villageId:'village-7',clock:420,news:['private-news'],ledger:{secret:true},progress:{gold:77},objects:[{id:'house-1',kind:'house',x:1,z:2,rot:0,material:'wood',level:2,phase:'built',room:[{secret:'private-room'}],owner:'private-owner'},{id:'plan',kind:'house',x:0,z:0,rot:0,phase:'planned'}]});
function harness(){
 const clock={now:1_700_000_000_000},elements=new Map(),connections=[],listeners=new Map(),reads=[];
 const root={style:{},querySelector:q=>elements.get(q.slice(1)),querySelectorAll:()=>[]};
 Object.defineProperty(root,'innerHTML',{set:html=>{for(const [,id]of html.matchAll(/id="([^"]+)"/g))elements.set(id,{id,value:'',disabled:false,textContent:'',style:{}});}});
 const context={URL,console,RTCPeerConnection:class{},__BUILD_INFO__:{environment:'dev'},location:{href:'https://example.test/dev/village/'},navigator:{clipboard:{writeText:async()=>{}}},window:{addEventListener:(name,fn)=>listeners.set(name,fn)},document:{getElementById:()=>({append(){}}),createElement:()=>root},
  createWebPlatform:()=>({}),createSaveStore:()=>({load:async()=>{const value=saved();reads.push(value);return value;}}),
  createHostOffer:async callbacks=>{const connection={...callbacks,code:'offer-'+connections.length,sent:[],answers:[],closed:false,send(m){this.sent.push(structuredClone(m));},close(){this.closed=true;},async accept(a){this.answers.push(a);}};connections.push(connection);return connection;},
  createFriendVillageInvite:options=>invites.createFriendVillageInvite({...options,issuedAt:clock.now}),friendVillageInviteUrl:invites.friendVillageInviteUrl,
  assertFriendVillageInviteActive:invite=>invites.assertFriendVillageInviteActive(invite,{now:clock.now})};
 vm.runInNewContext(hostSource.replace(/^import.*;\n/gm,'').replace('export function installOnlineHost','function installOnlineHost')+'\ninstallOnlineHost();',context);
 return{clock,elements,connections,listeners,reads,create:()=>elements.get('make-offer').onclick()};
}
test('host sends only exterior data to an invited visitor and does not mutate its save',async()=>{
 const h=harness();await h.create();const p=h.connections[0],before=JSON.stringify(h.reads[0]);
 for(const role of ['demon','hero','owner'])p.onMessage({type:'join',role});p.onMessage({type:'attack',role:'visitor'});assert.equal(p.sent.length,0);
 p.onMessage({type:'join',role:'visitor'});assert.equal(p.sent.length,1);const message=p.sent[0];
 assert.equal(message.type,'friend-village');assert.deepEqual(Object.keys(message.snapshot).sort(),['clock','name','objects','version','villageId']);
 assert.equal(message.snapshot.objects.length,1);assert.deepEqual(message.snapshot.objects[0].room,[]);
 assert.deepEqual(Object.keys(message.snapshot.objects[0]).sort(),['id','kind','level','material','phase','room','rot','x','z']);
 assert.doesNotMatch(JSON.stringify(message),/private-|progress|gold|ledger|news|owner/);assert.equal(JSON.stringify(h.reads[0]),before);
});
test('host rejects an answer at expiry before touching WebRTC',async()=>{
 const h=harness();await h.create();h.elements.get('answer').value='answer';h.clock.now+=invites.FRIEND_VILLAGE_INVITE_TTL;
 await h.elements.get('accept-answer').onclick();assert.equal(h.connections[0].answers.length,0);assert.equal(h.connections[0].closed,true);assert.match(h.elements.get('net-state').textContent,/期限切れ/);
});
test('host rechecks expiry on visitor join even after an answer was accepted in time',async()=>{
 const h=harness();await h.create();h.elements.get('answer').value='answer';await h.elements.get('accept-answer').onclick();assert.equal(h.connections[0].answers.length,1);
 h.clock.now+=invites.FRIEND_VILLAGE_INVITE_TTL;h.connections[0].onMessage({type:'join',role:'visitor'});assert.equal(h.connections[0].sent.length,0);assert.equal(h.connections[0].closed,true);
});
test('blank answer preserves a valid invite for retry and replacement retires stale callbacks',async()=>{
 const h=harness();await h.create();await h.elements.get('accept-answer').onclick();assert.equal(h.connections[0].closed,false);
 const old=h.connections[0];await h.create();assert.equal(old.closed,true);old.onMessage({type:'join',role:'visitor'});assert.equal(old.sent.length,0);
 h.connections[1].onMessage({type:'join',role:'visitor'});assert.equal(h.connections[1].sent.length,1);
});
test('duplicate creation and page exit cannot leave a stale sharing connection',async()=>{
 const h=harness();await Promise.all([h.create(),h.create()]);assert.equal(h.connections.length,1);
 h.listeners.get('pagehide')();assert.equal(h.connections[0].closed,true);h.connections[0].onMessage({type:'join',role:'visitor'});assert.equal(h.connections[0].sent.length,0);
});
test('guest rechecks an already-open invitation before creating a peer',async()=>{
 const now=1_700_000_000_000,invite=invites.createFriendVillageInvite({offer:'offer',villageId:'v',villageName:'村',issuedAt:now});
 const elements=new Map(['friend-title','friend-state','friend-connect','copy-answer','share-answer'].map(id=>[id,{disabled:true,textContent:''}]));
 let current=now,peers=0;
 const context={document:{getElementById:id=>elements.get(id)},location:{hash:new URL(invites.friendVillageInviteUrl('https://example.test/friend.html',invite)).hash},window:{addEventListener(){}},
  friendVillageInviteFromLocation:location=>invites.friendVillageInviteFromLocation(location,{now:current}),assertFriendVillageInviteActive:value=>invites.assertFriendVillageInviteActive(value,{now:current}),acceptHostOffer:async()=>{peers++;},console};
 vm.runInNewContext(guestSource.replace(/^import.*;\n/gm,''),context);assert.equal(elements.get('friend-connect').disabled,false);
 current=invite.expiresAt;await elements.get('friend-connect').onclick();assert.equal(peers,0);assert.match(elements.get('friend-state').textContent,/期限切れ/);
});
