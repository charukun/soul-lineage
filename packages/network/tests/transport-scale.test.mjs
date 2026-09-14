import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createPresenceTransport} from '../src/transport-lod.js';
import {createSnapshotInterpolator,createPredictionReconciler} from '../src/interpolation.js';

test('presence transport sends position on lossy channel and battle on reliable channel',()=>{
 const presence=[],reliable=[];const connection={sendPresence:value=>presence.push(value),send:value=>reliable.push(value),presenceBufferedAmount:()=>0};const transport=createPresenceTransport({now:()=>0});const snap={villageId:'v',players:{self:{x:0,z:0,_presence:{tier:'near',hz:20}},far:{x:80,z:0,_presence:{tier:'far',hz:2}}},battle:{winner:null}};transport.sendObserverSnapshot('self',connection,snap,0);assert.equal(presence.length,1);assert.equal(presence[0].type,'snapshot-delta');assert.equal(reliable.length,1);assert.equal(reliable[0].type,'battle');transport.sendObserverSnapshot('self',connection,snap,10);assert.equal(presence.length,1);assert.equal(reliable.length,1);
});

test('presence transport drops lossy state under buffered backpressure without dropping reliable events',()=>{
 const presence=[],reliable=[];const connection={sendPresence:value=>presence.push(value),send:value=>reliable.push(value),presenceBufferedAmount:()=>999999};const transport=createPresenceTransport({highWaterMark:1024});transport.sendObserverSnapshot('self',connection,{villageId:'v',players:{self:{x:0,z:0,_presence:{tier:'near',hz:20}}},battle:{winner:'human'}},0);assert.equal(presence.length,0);assert.equal(reliable.length,1);assert.equal(transport.snapshot().dropped,1);
});

test('snapshot interpolation smooths remote state and bounds extrapolation',()=>{
 const buffer=createSnapshotInterpolator({delayMs:0,maxExtrapolationMs:100});buffer.push('p',{x:0,z:0,yaw:0,state:'walk'},0);buffer.push('p',{x:10,z:0,yaw:0,state:'walk'},100);const mid=buffer.sample('p',50);assert.equal(mid.mode,'interpolate');assert.equal(mid.x,5);const far=buffer.sample('p',500);assert.equal(far.mode,'extrapolate');assert.equal(far.x,20);
});

test('prediction reconciler smooths small errors and snaps only teleport-class drift',()=>{
 const r=createPredictionReconciler({snapDistance:5,halfLifeMs:100});const small=r.reconcile({x:0,z:0},{x:1,z:0});assert.equal(small.snap,false);const corrected=r.apply({x:0,z:0},100);assert.ok(corrected.x>.4&&corrected.x<.6);const large=r.reconcile({x:0,z:0},{x:10,z:0});assert.equal(large.snap,true);assert.equal(large.x,10);
});

test('peer transport declares an unordered unreliable presence data channel while retaining reliable control',()=>{
 const source=fs.readFileSync(new URL('../src/peer.js',import.meta.url),'utf8');assert.match(source,/ordered:false/);assert.match(source,/maxRetransmits:0/);assert.match(source,/sendPresence/);assert.match(source,/createDataChannel\('soul-lineage',\{ordered:true\}\)/);
});
