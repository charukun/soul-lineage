import test from 'node:test';
import assert from 'node:assert/strict';
import {THREE as T} from '@soul/rendering';
import {defs} from '../src/game/core.js';
import {reconcileVillageScene} from '../src/web/scene-reconciler.js';

function fixture(){
 const template=new T.Group(),material=new T.MeshBasicMaterial();template.add(new T.Mesh(new T.BoxGeometry(),material));
 const objects=[{id:1,kind:'storage',x:0,z:0,rot:0,phase:'built',room:[{id:10,kind:'dirtbed',x:1,z:2,rot:0}]},{id:2,kind:'tent',x:32,z:32,rot:0,phase:'built',room:[]}];
 const calls={node:0,cutaway:0,actors:0};
 const forest=new T.InstancedMesh(new T.BoxGeometry(),material,3);
 forest.userData.forestItems=[{x:0,z:0,yaw:0,s:1},{x:24,z:0,yaw:.5,s:2},{x:96,z:96,yaw:1,s:3}];
 const view={world:{objects,object(id){return this.objects.find(o=>o.id===id);}},objects:new T.Group(),inside:new T.Group(),objectNodes:new Map(),forestMeshes:[forest],flowerMeshes:[],renderer:{shadowMap:{}},roomId:null,
  node(o){calls.node++;const n=template.clone();n.position.set(o.x,.025,o.z);n.rotation.y=o.rot||0;n.userData.objectId=o.id;return n;},getFloor(){return template;},clearObservationOccluders(){},applyCutaway(){calls.cutaway++;},updateActors(){calls.actors++;}};
 return {view,calls,objects,material,forest};
}
const furniture=view=>view.inside.children.find(r=>r.userData.roomId===1).children.find(n=>n.userData.objectId===10);
const scaleAt=(mesh,i)=>{const m=new T.Matrix4();mesh.getMatrixAt(i,m);return new T.Vector3().setFromMatrixScale(m).length();};

test('unchanged, population-only and loaded equivalent worlds retain buildings, rooms and furniture',()=>{
 const {view,calls}=fixture();const initial=reconcileVillageScene(view),building=view.objectNodes.get(1),room=view.inside.children[0],item=furniture(view);assert.ok(initial.changed);
 const initialCalls={...calls};let disposed=0;building.children[0].material.addEventListener('dispose',()=>disposed++);
 view.world.people=[{id:'new-resident'}];view.world.objects=structuredClone(view.world.objects);
 const delta=reconcileVillageScene(view);assert.equal(delta.changed,false);assert.equal(delta.vegetationChanged,false);assert.deepEqual(calls,initialCalls);
 assert.equal(view.objectNodes.get(1),building);assert.equal(view.inside.children[0],room);assert.equal(furniture(view),item);assert.equal(disposed,0);
});

test('furniture changes affect only the changed item and building transforms preserve identity',()=>{
 const {view,objects,forest}=fixture();reconcileVillageScene(view);const building=view.objectNodes.get(1),room=view.inside.children[0],item=furniture(view),version=forest.instanceMatrix.version;
 objects[0].room[0].x=4;let delta=reconcileVillageScene(view);assert.equal(delta.changed,true);assert.equal(delta.vegetationChanged,false);assert.equal(furniture(view),item);assert.equal(item.position.x,4);assert.equal(forest.instanceMatrix.version,version);
 objects[0].room.push({id:11,kind:'dirtbed',x:-1,z:0,rot:0});delta=reconcileVillageScene(view);assert.equal(delta.addedRoots.length,1);assert.equal(furniture(view),item);assert.equal(view.picking.length,4);
 objects[0].room.splice(0,1);delta=reconcileVillageScene(view);assert.equal(delta.removed,1);assert.equal(item.parent,null);assert.equal(view.picking.length,3);
 building.userData.observationBounds={stale:true};objects[0].x=24;objects[0].rot=.7;delta=reconcileVillageScene(view);
 assert.equal(view.objectNodes.get(1),building);assert.equal(view.inside.children[0],room);assert.equal(building.position.x,24);assert.equal(room.position.x,24);assert.equal(room.rotation.y,.7);assert.equal(building.userData.observationBounds,undefined);assert.ok(delta.vegetationChanged);
 assert.ok(scaleAt(forest,0)>0);assert.equal(scaleAt(forest,1),0);assert.ok(scaleAt(forest,2)>0);
});

test('phase and shape changes replace only the exterior, with private materials disposed once',()=>{
 const {view,objects,material}=fixture();objects[0].phase='planned';reconcileVillageScene(view);
 let node=view.objectNodes.get(1),disposed=0;node.children[0].material.addEventListener('dispose',()=>disposed++);
 assert.equal(node.children[0].material.opacity,.22);assert.equal(view.inside.children.length,1);
 objects[0].phase='building';reconcileVillageScene(view);assert.equal(disposed,1);assert.equal(view.objectNodes.get(1).children[0].material.opacity,.5);
 objects[0].phase='built';reconcileVillageScene(view);const room=view.inside.children.find(r=>r.userData.roomId===1),item=furniture(view),neighbor=view.objectNodes.get(2);
 objects[0].level=2;const delta=reconcileVillageScene(view);assert.ok(delta.changed);assert.equal(view.inside.children.find(r=>r.userData.roomId===1),room);assert.equal(furniture(view),item);assert.equal(view.objectNodes.get(2),neighbor);assert.notEqual(view.objectNodes.get(1).children[0].material,material);
 view.roomId=1;objects.shift();reconcileVillageScene(view);assert.equal(view.roomId,null);assert.equal(room.parent,null);assert.equal(view.objectNodes.has(1),false);assert.equal(view.picking.length,1);assert.equal(disposed,1);
});

test('vegetation masking matches the footprint rectangle, including corners and boundaries',()=>{
 const {view,objects,forest}=fixture();objects.splice(1);const half=Math.max(defs.storage.w,defs.storage.d)/2+4;
 forest.userData.forestItems=[{x:half-.01,z:half-.01,yaw:0,s:1},{x:half,z:0,yaw:0,s:1},{x:half+1,z:0,yaw:0,s:1}];reconcileVillageScene(view);
 assert.equal(scaleAt(forest,0),0);assert.ok(scaleAt(forest,1)>0);assert.ok(scaleAt(forest,2)>0);
});
