import test from 'node:test';
import assert from 'node:assert/strict';
import {createPeerMeshCoordinator} from '../src/peer-mesh.js';

function fakeFactory(id){
  const created=[];
  return{
    created,
    async createOffer({onState}){
      const connection={code:`offer:${id}:${created.length}`,sent:[],closed:false,async accept(code){this.answer=code;onState?.('open');},send(value){this.sent.push(value);},sendPresence(value){this.sent.push(value);},close(){this.closed=true;}};
      created.push(connection);return connection;
    },
    async acceptOffer(code){return{code:`answer:${code}`,sent:[],closed:false,send(value){this.sent.push(value);},sendPresence(value){this.sent.push(value);},close(){this.closed=true;}};},
  };
}

test('deterministic lower id initiates a direct mesh edge',async()=>{
  const relay=[],factory=fakeFactory('a');
  const mesh=createPeerMeshCoordinator({selfId:'a',relay:value=>relay.push(value),createOffer:factory.createOffer,acceptOffer:factory.acceptOffer});
  mesh.syncMembers(['a','b','host'],{hostId:'host'});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(relay.length,1);
  assert.equal(relay[0].to,'b');
  assert.equal(relay[0].signal.kind,'offer');
  await mesh.handleSignal('b',{kind:'answer',code:'answer-code'});
  assert.equal(mesh.has('b'),true);
});

test('higher id waits for the lower id offer and answers through relay',async()=>{
  const relay=[],factory=fakeFactory('b');
  const mesh=createPeerMeshCoordinator({selfId:'b',relay:value=>relay.push(value),createOffer:factory.createOffer,acceptOffer:factory.acceptOffer});
  mesh.syncMembers(['a','b','host'],{hostId:'host'});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(relay.length,0);
  await mesh.handleSignal('a',{kind:'offer',code:'offer-code'});
  assert.equal(mesh.has('a'),true);
  assert.equal(relay[0].to,'a');
  assert.equal(relay[0].signal.kind,'answer');
});

test('an established peer edge survives when that peer becomes the new host',async()=>{
  const relay=[],factory=fakeFactory('c');
  const mesh=createPeerMeshCoordinator({selfId:'c',relay:value=>relay.push(value),createOffer:factory.createOffer,acceptOffer:factory.acceptOffer});
  await mesh.handleSignal('b',{kind:'offer',code:'offer-b'});assert.equal(mesh.has('b'),true);const connection=mesh.connection('b');
  mesh.syncMembers(['a','b','c'],{hostId:'b'});
  assert.equal(mesh.has('b'),true);assert.equal(mesh.connection('b'),connection);assert.equal(connection.closed,false);
});
