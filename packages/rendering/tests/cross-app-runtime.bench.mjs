// Deterministic operation counts, not a hardware FPS benchmark.
// node packages/rendering/tests/cross-app-runtime.bench.mjs <baseline-ref>
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {dirname,resolve} from 'node:path';
import * as T from 'three';
import {naturalTrees} from '@soul/world/mura';
import {partitionStaticInstances} from '../src/spatial-instances.js';
import {createPerformanceRecorder} from '../src/performance-lab.js';
import {createMasterCharacterPool} from '../src/master-character.js';

const baseline=process.argv[2];if(!baseline)throw Error('Pass a baseline git ref');
const root=execFileSync('git',['rev-parse','--show-toplevel'],{encoding:'utf8'}).trim();
async function previous(path){
 const text=execFileSync('git',['show',`${baseline}:${path}`],{cwd:root,encoding:'utf8'});
 const source=text.replace(/from (['"])([^'"]+)\1/g,(_,quote,id)=>`from ${JSON.stringify(id.startsWith('.')?pathToFileURL(resolve(root,dirname(path),id)).href:import.meta.resolve(id))}`);
 return import(`data:text/javascript,${encodeURIComponent(source)}`);
}
function culling(items,camera,cellSize){
 const mesh=new T.InstancedMesh(new T.BoxGeometry(4,12,4),new T.MeshBasicMaterial(),items.length),matrix=new T.Matrix4();
 items.forEach((item,i)=>{matrix.makeTranslation(item.x,0,item.z);mesh.setMatrixAt(i,matrix);});mesh.computeBoundingSphere();mesh.updateMatrixWorld();
 camera.updateMatrixWorld();const frustum=new T.Frustum().setFromProjectionMatrix(new T.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
 const chunks=partitionStaticInstances(mesh,{THREE:T,cellSize});let after=0,draws=0;
 for(const chunk of chunks){chunk.updateMatrixWorld();if(frustum.intersectsObject(chunk)){after+=chunk.count;draws++;}}
 return{before:frustum.intersectsObject(mesh)?mesh.count:0,after,batches:chunks.length,visibleBatches:draws};
}
const rinneCamera=new T.PerspectiveCamera(43,412/915,.08,650);rinneCamera.position.set(10.5,12.65,14.5);rinneCamera.lookAt(0,1.15,0);
const villageCamera=new T.OrthographicCamera(-19,19,19*915/412,-19*915/412,.1,1200);villageCamera.position.set(Math.sin(.63)*165*Math.cos(.72),Math.sin(.72)*165,Math.cos(.63)*165*Math.cos(.72));villageCamera.lookAt(0,0,0);
const demonCamera=new T.PerspectiveCamera(43,412/915,.08,250);demonCamera.position.set(6,20,18);demonCamera.lookAt(0,1,0);
const floor=Array.from({length:1024},(_,i)=>({x:(i%32-16)*4,z:(Math.floor(i/32)-16)*4}));
function telemetry(factory,eager){
 const recorder=factory({snapshotOnSample:eager}),sort=Array.prototype.sort,shift=Array.prototype.shift;let sorts=0,shifts=0;
 Array.prototype.sort=function(...args){sorts++;return sort.apply(this,args);};Array.prototype.shift=function(...args){shifts++;return shift.apply(this,args);};
 try{for(let i=0;i<2400;i++)recorder.sample({frameMs:i%90+1,gpuMs:i%20,drawCalls:90+i%3,triangles:20000,textureBytes:16000,transparentDrawCalls:3,transparentTriangleUpperBound:600});const sampling={sorts,shifts};const {startedAt,...snapshot}=recorder.snapshot();return{sampling,snapshot};}finally{Array.prototype.sort=sort;Array.prototype.shift=shift;}
}
function sockets(factory){
 const template=new T.Group(),humanoid={};for(const name of['hips','spine','head',...['left','right'].flatMap(side=>['UpperArm','LowerArm','Hand','UpperLeg','LowerLeg','Foot'].map(b=>side+b))]){const bone=new T.Bone();humanoid[name]=bone;(name==='hips'?template:humanoid.hips).add(bone);}
 template.add(new T.Mesh(new T.BoxGeometry(1,2,1),new T.MeshBasicMaterial()));for(let i=0;i<200;i++)template.add(new T.Group());
 const pool=factory({template,humanoid}),actor=pool.spawn('bench');actor.attachWeapon('sword',new T.Group());const appearance={scale:1,headScale:1,height:1,width:1,gray:0,stoop:0,skinAge:0,adultHeightMetres:2,canEquipWeapon:true,dead:false,skin:[1,1,1],hair:[1,1,1],eyes:[1,1,1],dye:[1,1,1]};
 const update=T.Object3D.prototype.updateWorldMatrix;let visits=0;T.Object3D.prototype.updateWorldMatrix=function(...args){visits++;return update.apply(this,args);};
 try{for(let i=0;i<120;i++){actor.root.position.x=i;actor.sample(appearance,i/60);actor.updateAttachments();}return visits;}finally{T.Object3D.prototype.updateWorldMatrix=update;pool.dispose();}
}
const oldRecorder=await previous('packages/rendering/src/performance-lab.js'),before=telemetry(oldRecorder.createPerformanceRecorder,true),after=telemetry(createPerformanceRecorder,false);assert.deepEqual(after.snapshot,before.snapshot);
const oldPool=await previous('packages/rendering/src/master-character.js');
console.log(JSON.stringify({baseline,renderCandidates:{rinne:culling(naturalTrees(),rinneCamera,64),village:culling(naturalTrees(),villageCamera,64),demon:culling(floor,demonCamera,24)},telemetry:{frames:2400,before:before.sampling,after:after.sampling,identicalReport:true},socketHierarchyVisits:{frames:120,before:sockets(oldPool.createMasterCharacterPool),after:sockets(createMasterCharacterPool)},limits:'Fixed cameras and synthetic geometry/floor grid; trees use the real placement list. Counts are potential instance submissions and CPU operations, not real-device FPS.'},null,2));
