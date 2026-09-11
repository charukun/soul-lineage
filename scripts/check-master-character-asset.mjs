import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {Texture,Box3,REVISION} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {inspectMaster} from './prepare-master-character.mjs';
import {createMasterCharacterPool,shinoHumanoidFromGLTF} from '../packages/rendering/src/master-character.js';
import {createCharacter,appearanceForCharacter} from '../packages/characters/src/index.js';
if (!process.argv[2]) throw Error('Usage: node scripts/check-master-character-asset.mjs <audited-model.vrm>');
const bytes=await readFile(process.argv[2]);
const audit=inspectMaster(bytes);
const loader=new GLTFLoader();
loader.register(()=>({name:'CPU_TEST_TEXTURE_STUB',loadTexture:()=>Promise.resolve(new Texture())}));
const gltf=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
const humanoid=await shinoHumanoidFromGLTF(gltf);
const pool=createMasterCharacterPool({template:gltf.scene,humanoid});
const actors=Array.from({length:30},(_,i)=>pool.spawn('actual-'+i));
const geometry=new Set(),materials=new Set();actors.forEach(a=>a.visual.traverse(n=>{if(n.isMesh){geometry.add(n.geometry);for(const m of Array.isArray(n.material)?n.material:[n.material])materials.add(m)}}));
const results=[];
for (const age of [0,7,22,55,85,90]) {
  for(let i=0;i<30;i++)actors[i].sample(appearanceForCharacter(createCharacter({id:'actual-'+i,seed:100+i,ageMs:age*60000})));
  const box=new Box3().setFromObject(actors[0].root);results.push({age,min:box.min.toArray(),max:box.max.toArray()});
  for(const n of [...box.min.toArray(),...box.max.toArray()])assert.ok(Number.isFinite(n));
}
actors[0].bones.head.rotation.x=1;assert.notEqual(actors[0].bones.head.quaternion.x,actors[1].bones.head.quaternion.x);
let sourceDisposed=0;gltf.scene.traverse(n=>{if(n.isMesh)n.geometry.addEventListener('dispose',()=>sourceDisposed++)});
const stats=pool.stats();pool.dispose();assert.equal(sourceDisposed,0);
const report={sourceSHA256:audit.sha256,three:REVISION,mode:'CPU actual glTF geometry and skeleton; textures stubbed; no GPU/visual/FPS certification',passed:true,stats,humanoid:Object.keys(humanoid).length,geometry:geometry.size,materials:materials.size,bounds:results};
console.log(JSON.stringify(report,null,2));
