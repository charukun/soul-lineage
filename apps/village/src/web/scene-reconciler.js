import {THREE as T} from '@soul/rendering';
import {createSpatialIndex} from '@soul/world/spatial-index';
import {defs,ready} from '../game/core.js';

const shapeKey=o=>`${o.kind}:${o.material||'base'}:${o.level||1}:${o.phase||''}`;
const transformKey=o=>`${o.x}:${o.z}:${o.rot||0}`;
function place(node,o,y){node.position.set(o.x,y,o.z);node.rotation.y=o.rot||0;delete node.userData.observationBounds;}
function removeNode(node,delta){
 if(!node)return;
 node.traverse(child=>{if(child.userData.privateMaterial)child.material.dispose();});
 node.removeFromParent();delta.removed++;delta.changed=true;
}
function exterior(view,o){
 const node=view.node(o);node.userData.hostId=o.id;
 if(defs[o.kind].building)node.traverse(mesh=>{
  if(!mesh.isMesh)return;
  mesh.material=mesh.material.clone();mesh.userData.privateMaterial=true;
  if(!ready(o)){mesh.material.transparent=true;mesh.material.opacity=o.phase==='building'?.50:.22;mesh.material.color.lerp(new T.Color(0xb5d9dd),.6);mesh.castShadow=false;}
 });
 return node;
}
function syncRoom(view,o,row,delta){
 const wanted=defs[o.kind].building&&ready(o);
 if(row.room&&(!wanted||row.roomKind!==o.kind)){removeNode(row.room,delta);row.room=null;row.furniture.clear();}
 if(!wanted)return;
 if(!row.room){
  row.room=new T.Group();row.room.userData.roomId=o.id;row.roomKind=o.kind;
  row.room.add(view.getFloor(o).clone());view.inside.add(row.room);delta.addedRoots.push(row.room);delta.changed=true;
 }
 place(row.room,o,.035);
 const ids=new Set();
 for(const item of o.room||[]){
  ids.add(item.id);let cached=row.furniture.get(item.id);const shape=shapeKey(item),transform=transformKey(item);
  if(!cached||cached.shape!==shape){
   if(cached)removeNode(cached.node,delta);
   const node=view.node(item);node.userData.roomId=o.id;row.room.add(node);cached={node,shape,transform};row.furniture.set(item.id,cached);delta.addedRoots.push(node);delta.changed=true;
  }else if(cached.transform!==transform){place(cached.node,item,.025);cached.transform=transform;delta.changed=true;}
 }
 for(const[id,item]of row.furniture)if(!ids.has(id)){removeNode(item.node,delta);row.furniture.delete(id);}
}
function syncVegetation(view,state,delta){
 const buildings=view.world.objects.filter(o=>defs[o.kind].building);
 const key=buildings.map(o=>`${o.id}:${o.x}:${o.z}:${Math.max(defs[o.kind].w,defs[o.kind].d)}`).join('|');
 if(state.footprints===key)return;
 state.footprints=key;delta.vegetationChanged=true;
 const index=createSpatialIndex({cellSize:32}),near=[];
 for(const o of buildings){const half=Math.max(defs[o.kind].w,defs[o.kind].d)/2+4;index.upsert(o.id,o.x,o.z,{radius:half*Math.SQRT2,data:{o,half}});}
 const matrix=new T.Matrix4(),rotation=new T.Quaternion(),position=new T.Vector3(),scale=new T.Vector3(),up=new T.Vector3(0,1,0);
 for(const mesh of [...(view.forestMeshes||[]),...(view.flowerMeshes||[])]){
  mesh.userData.forestItems.forEach((o,i)=>{
   index.queryRadiusInto(near,o.x,o.z,0);
   const covered=near.some(({data:{o:b,half}})=>Math.abs(b.x-o.x)<half&&Math.abs(b.z-o.z)<half);
   rotation.setFromAxisAngle(up,o.yaw);position.set(o.x,0,o.z);scale.setScalar(covered?0:o.s);matrix.compose(position,rotation,scale);mesh.setMatrixAt(i,matrix);
  });
  mesh.instanceMatrix.needsUpdate=true;
 }
}

/** Reconcile presentation by stable object IDs; authoritative state is read-only. */
export function reconcileVillageScene(view){
 const state=view.__villageSceneCache??={rows:new Map(),footprints:null,revision:0};
 const delta={changed:false,addedRoots:[],removed:0,vegetationChanged:false,revision:state.revision};
 const ids=new Set();
 for(const o of view.world.objects){
  ids.add(o.id);let row=state.rows.get(o.id);const shape=shapeKey(o),transform=transformKey(o);
  if(!row){row={furniture:new Map()};state.rows.set(o.id,row);}
  if(row.shape!==shape){
   removeNode(row.node,delta);row.node=exterior(view,o);row.shape=shape;
   view.objects.add(row.node);view.objectNodes.set(o.id,row.node);delta.addedRoots.push(row.node);delta.changed=true;
  }
  if(row.transform!==transform){place(row.node,o,.025);row.transform=transform;delta.changed=true;}
  syncRoom(view,o,row,delta);
 }
 for(const[id,row]of state.rows)if(!ids.has(id)){
  removeNode(row.node,delta);removeNode(row.room,delta);state.rows.delete(id);view.objectNodes.delete(id);
 }
 syncVegetation(view,state,delta);
 if(view.roomId&&!view.world.object(view.roomId)){view.roomId=null;delta.changed=true;}
 if(delta.changed){
  view.clearObservationOccluders();view.picking=[];
  for(const row of state.rows.values()){view.picking.push(row.node);for(const item of row.furniture.values())view.picking.push(item.node);}
  view.applyCutaway();view.updateActors();view.objects.updateMatrixWorld(true);view.inside.updateMatrixWorld(true);view.renderer.shadowMap.needsUpdate=true;
  delta.revision=++state.revision;
 }
 view.__villageSceneDelta=delta;
 return delta;
}
