import test from 'node:test';
import assert from 'node:assert/strict';
import {createPeerSignalingClient} from '../src/peer-signaling.js';

test('peer signaling client keeps requests on configured HTTPS endpoint',async()=>{
  const calls=[];const fetchImpl=async(url,options={})=>{calls.push({url:String(url),options});return new Response(JSON.stringify({rooms:[]}),{status:200,headers:{'content-type':'application/json'}});};
  const client=createPeerSignalingClient({endpoint:'https://signal.example.test/base/',fetchImpl});
  await client.listRooms();
  assert.equal(calls[0].url,'https://signal.example.test/base/api/peer-world/rooms');
  assert.equal(calls[0].options.method,'GET');
});

test('peer signaling mutations carry bearer token without query exposure',async()=>{
  const calls=[];const fetchImpl=async(url,options={})=>{calls.push({url:String(url),options});return new Response(JSON.stringify({accepted:true}),{status:200,headers:{'content-type':'application/json'}});};
  const client=createPeerSignalingClient({endpoint:'https://signal.example.test/',fetchImpl});
  await client.postOffer('room A','join/1','secret-token','offer-code-123456');
  assert.equal(calls[0].options.headers.authorization,'Bearer secret-token');
  assert.equal(calls[0].url.includes('secret-token'),false);
  assert.match(calls[0].url,/room%20A\/joins\/join%2F1\/offer$/);
});

test('peer signaling rejects insecure endpoint',()=>{
  assert.throws(()=>createPeerSignalingClient({endpoint:'http://signal.example.test/'}),/HTTPS/);
});
