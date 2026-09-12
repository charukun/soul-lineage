import test from 'node:test';
import assert from 'node:assert/strict';
import {World,validate} from '../src/game/core.js';
import {findPlacementSite,commitPlacement} from '../src/game/placement-guidance.js';
const pending=(kind='tent')=>({kind,x:0,z:0,rot:0,roomId:null,moveId:null,material:'base'});
test('first tent uses an authored legal location without mutating the village or preview',()=>{
 const w=new World(),p=pending(),before=JSON.stringify([w.state,p]);
 const site=findPlacementSite(w,p);assert.deepEqual(site,{x:-22,z:12});
 assert.equal(w.canPlace(p.kind,site.x,site.z,p.rot),null);
 assert.equal(JSON.stringify([w.state,p]),before);
});
test('confirm adds exactly one building and reports actual new beds; save round trip preserves it',()=>{
 const w=new World(),p={...pending(),...findPlacementSite(new World(),pending())},n=w.objects.length;
 const r=commitPlacement(w,p);assert.equal(w.objects.length,n+1);assert.equal(r.addedBeds,2);
 assert.match(r.message,/2床/);assert.equal(r.object.phase,'built');
 const restored=new World(validate(JSON.parse(JSON.stringify(w.state))));
 assert.deepEqual(restored.object(r.object.id),r.object);
});
test('invalid placement cannot create or move anything',()=>{
 const w=new World(),p={...pending(),x:-7,z:-5},before=JSON.stringify(w.state);
 assert.ok(commitPlacement(w,p).error);assert.equal(JSON.stringify(w.state),before);
});
test('a changed village is revalidated at confirm instead of trusting stale preview',()=>{
 const w=new World(),p={...pending(),...findPlacementSite(w,pending())};w.add('tent',p.x,p.z);
 const before=JSON.stringify(w.state);assert.ok(commitPlacement(w,p).error);assert.equal(JSON.stringify(w.state),before);
});
test('search returns null if all existing rules reject a site',()=>{
 const w=new World(),before=JSON.stringify(w.state);w.canPlace=()=> 'blocked';
 assert.equal(findPlacementSite(w,pending()),null);assert.equal(JSON.stringify(w.state),before);
});
test('furniture search preserves doorway and wall constraints',()=>{
 const w=new World(),p={...pending('bed'),roomId:'b1'};
 const site=findPlacementSite(w,p);assert.ok(site);assert.equal(w.canPlace('bed',site.x,site.z,0,'b1'),null);
 const r=commitPlacement(w,{...p,...site});assert.equal(r.error,undefined);assert.equal(r.addedBeds,0);
 assert.equal(w.object('b1').room.length,1);
});
test('moving an existing tent does not report new beds',()=>{
 const w=new World(),first=commitPlacement(w,{...pending(),x:-22,z:12});
 const r=commitPlacement(w,{...pending(),x:-35,z:12,moveId:first.object.id});
 assert.equal(r.error,undefined);assert.equal(r.addedBeds,0);assert.equal(r.message,'移動しました');
});
test('missing preview or room is rejected safely',()=>{
 const w=new World();assert.equal(findPlacementSite(w,null),null);assert.equal(findPlacementSite(w,{...pending('bed'),roomId:'gone'}),null);assert.ok(commitPlacement(w,null).error);
});
