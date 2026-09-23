// Original NOCTURNE environment from a923fcc02dfef9a57aad00001bd3daab8786fc07; geometry and lighting language preserved.
export const NOCTURNE_FIELD_BOUNDS=Object.freeze({minX:-16,maxX:16,minZ:-14,maxZ:18});
export const NOCTURNE_FIELD_RADAR_RANGE=32;
const NOCTURNE_CLEARING_RADIUS=27.5;
export function buildNocturneEnvironment(env){
const {THREE,V,TAU,models,scene,environmentMeshes,torches,rand,randRange}=env;
function tintMaterial(material,key){
 const list=Array.isArray(material)?material:[material];
 const next=list.map(m=>{const n=m.clone();n.roughness=.9;n.metalness=0;if(/tree|plant|grass|flower/.test(key))n.color.multiply(new THREE.Color('#89ab9b'));else if(/stone|statue|path/.test(key))n.color.multiply(new THREE.Color('#799493'));else n.color.multiply(new THREE.Color('#8b9a83'));return n;});
 return Array.isArray(material)?next:next[0];
}
// Material-only shading of the original flat ground GLB. Vertex data is untouched.
function shadeFloor(material){
 for(const m of Array.isArray(material)?material:[material]){
  m.onBeforeCompile=shader=>{
   shader.vertexShader='varying vec3 vForestWorld;\n'+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvForestWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
   shader.fragmentShader=`varying vec3 vForestWorld;
float fh(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float fn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(fh(i),fh(i+vec2(1,0)),f.x),mix(fh(i+vec2(0,1)),fh(i+vec2(1,1)),f.x),f.y);}
`+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
vec2 fp=vForestWorld.xz;
float grain=fn(fp*1.7)*0.5+fn(fp*5.1)*0.3+fn(fp*19.0)*0.2;
float worn=1.0-smoothstep(4.8,9.3,length(fp)+fn(fp*0.65)*2.2);
worn=max(worn,(1.0-smoothstep(0.7,2.4,abs(fp.x+sin(fp.y*.5)*.35)))*smoothstep(0.0,3.0,fp.y));
vec3 earth=mix(vec3(.022,.048,.038),vec3(.071,.065,.052),worn);
diffuseColor.rgb=mix(diffuseColor.rgb*.48,earth,.8)*(.72+.5*grain);`);
  };
  m.customProgramCacheKey=()=> 'forest-ground-shading-v2';
 }
}
function prop(key,x,z,size=1,rotation=0,wide=false,y=0){
 key='nature/'+key;const root=models.get(key).scene.clone(true);const box=new THREE.Box3().setFromObject(root),dims=box.getSize(new V()),center=box.getCenter(new V());
 const s=size/(wide?Math.max(dims.x,dims.z):dims.y);const wrapper=new THREE.Group();root.position.set(-center.x,-box.min.y,-center.z);wrapper.add(root);wrapper.scale.setScalar(s);wrapper.rotation.y=rotation;wrapper.position.set(x,y,z);
 root.traverse(o=>{if(o.isMesh){o.material=tintMaterial(o.material,key);o.userData.assetSource=key;environmentMeshes.push(o);}});scene.add(wrapper);return wrapper;
}
function batch(key,placements){
 key='nature/'+key;const root=models.get(key).scene;root.updateMatrixWorld(true);
 const box=new THREE.Box3().setFromObject(root),dims=box.getSize(new V()),center=box.getCenter(new V()),normal=new THREE.Matrix4().makeTranslation(-center.x,-box.min.y,-center.z);
 root.traverse(child=>{
  if(!child.isMesh)return;
  const inst=new THREE.InstancedMesh(child.geometry,tintMaterial(child.material,key),placements.length);inst.userData.assetSource=key;inst.castShadow=true;inst.receiveShadow=true;const object=new THREE.Object3D();
  placements.forEach((p,i)=>{object.position.set(p.x,p.y||0,p.z);object.rotation.set(0,p.r||0,0);object.scale.setScalar(p.h/dims.y);object.updateMatrix();inst.setMatrixAt(i,new THREE.Matrix4().copy(object.matrix).multiply(normal).multiply(child.matrixWorld));});
  inst.instanceMatrix.needsUpdate=true;inst.computeBoundingSphere();scene.add(inst);environmentMeshes.push(inst);
 });
}
function buildForest(){
 const original=models.get('nature/ground_grass').scene.clone(true),b=new THREE.Box3().setFromObject(original),s=b.getSize(new V()),c=b.getCenter(new V());const floor=new THREE.Group();
 original.position.set(-c.x,-b.max.y,-c.z);floor.add(original);floor.scale.set(104/s.x,.12/Math.max(.01,s.y),104/s.z);floor.position.y=-.06;
 original.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=true;o.material=tintMaterial(o.material,'ground_grass');shadeFloor(o.material);o.userData.assetSource='nature/ground_grass';}});scene.add(floor);
 // Cover the playable field itself, not just the old central arena, with ground variation.
 for(let x=-4;x<=4;x++)for(let z=-4;z<=4;z++){if(Math.hypot(x,z)>4.6)continue;const p=prop('ground_pathTile',x*4.35,z*4.35,4.45,Math.floor(rand()*4)*Math.PI/2,true,-.061);p.scale.y*=.12;p.traverse(o=>{if(o.isMesh)shadeFloor(o.material);});}
 const paving=prop('path_stoneCircle',0,-.4,9.4,0,true,-.055);paving.scale.y*=.12;
 const treeKinds=['tree_pineTallA_detailed','tree_pineTallB_detailed','tree_pineRoundC','tree_detailed_dark'];
 for(let k=0;k<treeKinds.length;k++){const placements=[];for(let i=0;i<36;i++){const a=rand()*TAU,r=randRange(NOCTURNE_CLEARING_RADIUS,50);placements.push({x:Math.cos(a)*r,z:Math.sin(a)*r,h:randRange(5.8,9.7),r:rand()*TAU});}batch(treeKinds[k],placements);}
 for(const [key,count,lo,hi,h1,h2] of [['plant_bushDetailed',58,20,45,.9,2.1],['plant_bushSmall',50,18,43,.55,1.1],['grass_large',100,13,43,.25,.55],['grass_leafsLarge',64,16,43,.4,.75],['flower_purpleA',48,11,30,.25,.52],['mushroom_redGroup',28,13,31,.25,.5],['stone_smallC',64,9,42,.2,.6]]){
  const ps=[];for(let i=0;i<count;i++){const a=rand()*TAU,r=randRange(lo,hi);ps.push({x:Math.cos(a)*r,z:Math.sin(a)*r,h:randRange(h1,h2),r:rand()*TAU});}batch(key,ps);
 }
 // The old apparent arena ended around radius 10-13. Keep the boundary language, but move it beyond the full 32x32-ish playable field.
 for(let i=0;i<22;i++){const a=i/22*TAU+.2,r=randRange(24.8,28.4);prop(i%2?'stone_largeB':'stone_largeD',Math.cos(a)*r,Math.sin(a)*r,randRange(1.4,2.7),rand()*TAU);}
 for(let i=0;i<10;i++){const a=i/10*TAU+.3;prop('fence_planks',Math.cos(a)*24.6,Math.sin(a)*24.6,1.8,-a+Math.PI/2);}
 prop('statue_obelisk',-12,-18.5,4.4,.15);prop('statue_columnDamaged',12.5,-17.5,2.8,-.5);prop('stone_tallB',-19,3.5,3.5,.3);prop('log_large',20,7.5,3.8,.5,true);prop('log_large',-19,-10.5,3.3,1.3,true);prop('stump_roundDetailed',-18,14,1.3);
 for(const [x,z] of [[-13,-11.5],[13,-10.5],[-12.5,12.5],[13,13.5]]){prop('campfire_stones',x,z,1.35,rand()*TAU,true);const light=new THREE.PointLight('#ff9c43',33,11,2);light.position.set(x,.8,z);scene.add(light);torches.push({x,z,light,seed:rand()*9});}
 for(let i=0;i<10;i++){const p=prop('path_stone',Math.sin(i)*.55,13+i*2.2,2.05,rand()*.4,true,-.045);p.scale.y*=.25;}
 for(let i=0;i<8;i++){const p=prop('path_stone',Math.sin(i+1.7)*.55,-10-i*2.15,2.05,rand()*.4,true,-.045);p.scale.y*=.25;}
}



buildForest();
}
