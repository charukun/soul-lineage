/** Optional CPU pose capture for visual iteration; never a default CI gate. */
import {readFile} from 'node:fs/promises';
import * as T from '../public/simulator/vendor/three.js';
import {GLTFLoader} from '../public/simulator/vendor/GLTFLoader.js';
import {HumanoidRuntime} from '../public/simulator/src/humanoid.js';
const root=new URL('../public/simulator/',import.meta.url);
globalThis.window={assetBuffer:async id=>{const path=id.startsWith('motion:')?'assets/motions/'+id.slice(7)+'.vrma':'assets/'+id+'_review.vrm';const b=await readFile(new URL(path,root));return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);}};
globalThis.self=globalThis;
const parse=GLTFLoader.prototype.parseAsync;
GLTFLoader.prototype.parseAsync=function(data,path){this.register(()=>({name:'CPUReviewTextures',loadTexture:()=>Promise.resolve(new T.Texture())}));return parse.call(this,data,path);};
export async function loadRuntime(){
const {SWORD_TIMINGS}=await import('../public/simulator/src/sword-performance.js');
const api={weapons:{sword:{tip:1.62,base:.21,width:.065}},clips:SWORD_TIMINGS,strikes:{slash:{}},windows:{},progress:(a,at)=>(at??a.attack?.t??0)/(a.attack?.duration||1),window:(k,p)=>p>=.35&&p<=.64?0:-1};
const runtime=new HumanoidRuntime(api);await runtime.load('SHINO');return runtime;
}
import {writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
const outDir=resolve(process.argv[2]||'/tmp/rinne-sword-sequence');await mkdir(outDir,{recursive:true});


import {createReviewSword} from '../public/simulator/src/review-sword.js';
import {SHORT_SWORD_SEQUENCE,applySwordSequence} from '../public/simulator/src/sword-sequence.js';
const runtime=await loadRuntime(),c=runtime.current,meshes=[];
c.vrm.scene.traverse(o=>{if(o.isMesh)meshes.push(o);});
const sword=createReviewSword();sword.matrixAutoUpdate=false;sword.traverse(o=>{if(o.isMesh)meshes.push(o);});
let count=0;const descriptions=[];
for(const mesh of meshes){const geom=mesh.geometry,pos=geom.getAttribute('position'),uv=geom.getAttribute('uv');const mat=Array.isArray(mesh.material)?mesh.material[0]:mesh.material;const assoc=c.gltf.parser.associations.get(mat);descriptions.push({count:pos.count,start:count,indices:geom.index?Array.from(geom.index.array):Array.from({length:pos.count},(_,i)=>i),uv:uv?Array.from(uv.array):null,material:assoc?.materials??null,color:mat.color?.toArray()??[.5,.5,.5]});count+=pos.count;}
const actor={id:'review',hero:true,weapon:'sword',weaponDraw:1,lifeAgeYears:22,x:0,z:0,yaw:0,air:0,vx:0,vz:0,combatReady:true,_humanoidClock:0,attack:null};
const frameCount=121,vertices=new Float32Array(frameCount*count*3),points=[],v=new T.Vector3();
for(let i=0;i<frameCount;i++){
 const p=i/(frameCount-1),t=p*4;actor._humanoidClock=t;applySwordSequence(actor,SHORT_SWORD_SEQUENCE,t,{start:.3});
 const result=runtime.render(actor);sword.matrix.fromArray(result.sm);sword.updateMatrixWorld(true);
 for(const mesh of meshes){if(mesh.isSkinnedMesh)mesh.skeleton.update();}
 let offset=i*count*3;for(const mesh of meshes){for(let j=0;j<mesh.geometry.getAttribute('position').count;j++){mesh.getVertexPosition(j,v);v.applyMatrix4(mesh.matrixWorld);vertices.set(v.toArray(),offset);offset+=3;}}
 points.push({phase:p,tip:result.weaponTip,hips:c.raw.hips.getWorldPosition(v).toArray(),left:c.raw.leftFoot.getWorldPosition(v).toArray(),right:c.raw.rightFoot.getWorldPosition(v).toArray(),socketError:c.socketError,finite:c.finite});
}
await writeFile(resolve(outDir,'vertices.bin'),Buffer.from(vertices.buffer));
await writeFile(resolve(outDir,'capture.json'),JSON.stringify({frameCount,count,meshes:descriptions,points}));
console.log(JSON.stringify({frameCount,vertices:count,triangles:descriptions.reduce((n,m)=>n+m.indices.length/3,0),socketError:Math.max(...points.map(p=>p.socketError)),finite:points.every(p=>p.finite)}));

runtime.dispose(c);
