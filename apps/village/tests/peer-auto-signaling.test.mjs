import test from 'node:test';
import assert from 'node:assert/strict';
import {createFriendVillageInvite} from '@soul/network/friend-invite';
import {createFriendAutoSignaling,sendFriendAutoAnswer} from '../src/peer-auto-signaling.js';

const roomId='a'.repeat(14),inviteToken='b'.repeat(64);
const invitation=()=>createFriendVillageInvite({offer:'offer-for-explicit-friend',villageId:'private-village',villageName:'Private village'});

test('automatic owner signaling stays private and accepts only the invited visitor answer',async()=>{
 const calls=[],accepted=[];
 let events=[{seq:1,type:'join',joinId:'visitor',hostEligible:false}];
 const client={
  createRoom:async input=>{calls.push(['create',input]);return{room:{roomId},hostToken:'owner-token',inviteToken};},
  pollHost:async()=>({events,next:events.at(-1)?.seq||0}),
  postOffer:async(...args)=>calls.push(['offer',...args]),
  telemetry:async(...args)=>calls.push(['telemetry',...args]),
  closeRoom:async()=>{},
 };
 const owner=await createFriendAutoSignaling({invite:invitation(),client,acceptAnswer:async answer=>accepted.push(answer),sample:async()=>({batteryLevel:null}),schedule:()=>1,cancel:()=>{}});
 assert.equal(calls[0][1].purpose,'visitor');
 assert.equal(calls[0][1].capability.stable,true);
 assert.equal(owner.invite.offer,invitation().offer);
 assert.deepEqual(owner.invite.signaling,{version:1,roomId,inviteToken});
 await owner.tick();
 assert.deepEqual(calls.find(call=>call[0]==='offer').slice(1),[roomId,'visitor','owner-token',owner.invite.offer]);
 events=[{seq:2,type:'answer',joinId:'outsider',answer:'forged-answer'},{seq:3,type:'answer',joinId:'visitor',answer:'friend-answer'}];
 await owner.tick();
 assert.deepEqual(accepted,['friend-answer']);
 await owner.close();
});

test('automatic guest answer cannot elevate a visitor or accept an unrelated offer',async()=>{
 const invite={...invitation(),signaling:{version:1,roomId,inviteToken}},calls=[];
 let offered=invite.offer;
 const client={
  joinRoom:async(id,input)=>{calls.push(['join',id,input]);return{joinId:'visitor',guestToken:'guest-token'};},
  pollGuest:async()=>({events:[{type:'offer',offer:offered}],next:1}),
  postAnswer:async(...args)=>calls.push(['answer',...args]),
 };
 assert.equal(await sendFriendAutoAnswer(invite,'friend-answer',{client,pause:async()=>{}}),true);
 assert.equal(calls[0][2].hostEligible,false);
 assert.equal(calls[0][2].app,'village');
 assert.equal(calls[0][2].inviteToken,inviteToken);
 assert.deepEqual(calls[1].slice(1),[roomId,'visitor','guest-token','friend-answer']);
 offered='unrelated-offer';
 await assert.rejects(sendFriendAutoAnswer(invite,'friend-answer',{client,pause:async()=>{}}),/異なる接続/);
 assert.equal(calls.filter(call=>call[0]==='answer').length,1);
});

test('expired and malformed auto invitations make no network request',async()=>{
 let calls=0;const client={joinRoom:async()=>{calls++;}};
 const invite={...invitation(),signaling:{version:1,roomId,inviteToken}};
 await assert.rejects(sendFriendAutoAnswer({...invite,issuedAt:1,expiresAt:2},'answer',{client}),/期限切れ/);
 await assert.rejects(sendFriendAutoAnswer({...invite,signaling:{...invite.signaling,inviteToken:'bad'}},'answer',{client}),/不正/);
 assert.equal(calls,0);
});
