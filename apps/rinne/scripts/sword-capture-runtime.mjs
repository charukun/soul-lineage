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
