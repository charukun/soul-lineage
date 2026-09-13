import * as T from '../public/simulator/vendor/three.js';
import {loadRuntime} from './sword-capture-runtime.mjs';
import {writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
const outDir=resolve(process.argv[2]||'/tmp/rinne-sword-sequence');await mkdir(outDir,{recursive:true});


import {createReviewSword} from '../public/simulator/src/review-sword.js';
import {SHORT_SWORD_SEQUENCE,applySwordSequence,swordSequenceTravel} from '../public/simulator/src/sword-sequence.js';
const runtime=await loadRuntime(),c=runtime.current,meshes=[];
c.vrm.scene.traverse(o=>{if(o.isMesh)meshes.push(o);});
const sword=createReviewSword();sword.matrixAutoUpdate=false;sword.traverse(o=>{if(o.isMesh)meshes.push(o);});
let count=0;const descriptions=[];
for(const mesh of meshes){const geom=mesh.geometry,pos=geom.getAttribute('position'),uv=geom.getAttribute('uv');const mat=Array.isArray(mesh.material)?mesh.material[0]:mesh.material;const assoc=c.gltf.parser.associations.get(mat);descriptions.push({count:pos.count,start:count,indices:geom.index?Array.from(geom.index.array):Array.from({length:pos.count},(_,i)=>i),uv:uv?Array.from(uv.array):null,material:assoc?.materials??null,color:mat.color?.toArray()??[.5,.5,.5]});count+=pos.count;}
const actor={id:'review',hero:true,weapon:'sword',weaponDraw:1,lifeAgeYears:22,x:0,z:0,yaw:0,air:0,vx:0,vz:0,combatReady:true,_humanoidClock:0,attack:null};
const kind=process.argv[3]||'combination';
const {SWORD_MOVES}=await import('../public/simulator/src/authored-sword.js');
const {applyPerformance}=await import('../public/simulator/src/sword-performance.js');
const seconds=SWORD_MOVES[kind]?.seconds??(kind==='performance'?30:4);
const frameCount=Math.round(seconds*30)+1,vertices=new Float32Array(frameCount*count*3),points=[],v=new T.Vector3();
for(let i=0;i<frameCount;i++){
 const p=i/(frameCount-1),t=p*seconds;actor._humanoidClock=t;
 if(SWORD_MOVES[kind])actor.attack={id:kind,kind,t,duration:seconds};
 else if(kind==='performance')applyPerformance(actor,t,c.locomotion,c.unit*c.legLength/.82);
 else {applySwordSequence(actor,SHORT_SWORD_SEQUENCE,t,{start:.3});Object.assign(actor,swordSequenceTravel(SHORT_SWORD_SEQUENCE,t-.3,c.unit*c.legLength/.82));}
 const result=runtime.render(actor);sword.matrix.fromArray(result.sm);sword.updateMatrixWorld(true);
 for(const mesh of meshes){if(mesh.isSkinnedMesh)mesh.skeleton.update();}
 let offset=i*count*3;for(const mesh of meshes){for(let j=0;j<mesh.geometry.getAttribute('position').count;j++){mesh.getVertexPosition(j,v);v.applyMatrix4(mesh.matrixWorld);vertices.set(v.toArray(),offset);offset+=3;}}
 points.push({phase:p,tip:result.weaponTip,hips:c.raw.hips.getWorldPosition(v).toArray(),left:c.raw.leftFoot.getWorldPosition(v).toArray(),right:c.raw.rightFoot.getWorldPosition(v).toArray(),socketError:c.socketError,finite:c.finite});
}
await writeFile(resolve(outDir,'vertices.bin'),Buffer.from(vertices.buffer));
await writeFile(resolve(outDir,'capture.json'),JSON.stringify({frameCount,count,seconds,kind,meshes:descriptions,points}));
console.log(JSON.stringify({frameCount,vertices:count,triangles:descriptions.reduce((n,m)=>n+m.indices.length/3,0),socketError:Math.max(...points.map(p=>p.socketError)),finite:points.every(p=>p.finite)}));

runtime.dispose(c);
