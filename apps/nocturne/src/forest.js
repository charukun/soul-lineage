// Only clone or instance geometry from downloaded models. No procedural solids.
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
 original.position.set(-c.x,-b.max.y,-c.z);floor.add(original);floor.scale.set(75/s.x,.12/Math.max(.01,s.y),75/s.z);floor.position.y=-.06;
 original.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=true;o.material=tintMaterial(o.material,'ground_grass');shadeFloor(o.material);o.userData.assetSource='nature/ground_grass';}});scene.add(floor);
 for(let x=-2;x<=2;x++)for(let z=-2;z<=2;z++){if(Math.hypot(x,z)>2.6)continue;const p=prop('ground_pathTile',x*3.45,z*3.45,3.5,Math.floor(rand()*4)*Math.PI/2,true,-.061);p.scale.y*=.12;p.traverse(o=>{if(o.isMesh)shadeFloor(o.material);});}
 const paving=prop('path_stoneCircle',0,-.4,6.7,0,true,-.055);paving.scale.y*=.12;
 const treeKinds=['tree_pineTallA_detailed','tree_pineTallB_detailed','tree_pineRoundC','tree_detailed_dark'];
 for(let k=0;k<treeKinds.length;k++){const placements=[];for(let i=0;i<29;i++){const a=rand()*TAU,r=randRange(13.6,30);placements.push({x:Math.cos(a)*r,z:Math.sin(a)*r,h:randRange(5.8,9.7),r:rand()*TAU});}batch(treeKinds[k],placements);}
 for(const [key,count,lo,hi,h1,h2] of [['plant_bushDetailed',45,9.2,27,.9,2.1],['plant_bushSmall',34,8.5,24,.55,1.1],['grass_large',70,7,26,.25,.55],['grass_leafsLarge',40,9,26,.4,.75],['flower_purpleA',32,7.5,17,.25,.52],['mushroom_redGroup',18,8,18,.25,.5],['stone_smallC',40,5.2,23,.2,.6]]){
  const ps=[];for(let i=0;i<count;i++){const a=rand()*TAU,r=randRange(lo,hi);ps.push({x:Math.cos(a)*r,z:Math.sin(a)*r,h:randRange(h1,h2),r:rand()*TAU});}batch(key,ps);
 }
 for(let i=0;i<15;i++){const a=i/15*TAU+.2,r=randRange(10.2,13.3);prop(i%2?'stone_largeB':'stone_largeD',Math.cos(a)*r,Math.sin(a)*r,randRange(1.4,2.7),rand()*TAU);}
 for(let i=0;i<7;i++){const a=i/7*TAU+.3;prop('fence_planks',Math.cos(a)*10.2,Math.sin(a)*10.2,1.6,-a+Math.PI/2);}
 prop('statue_obelisk',-5,-8.4,4.4,.15);prop('statue_columnDamaged',5.5,-8,2.8,-.5);prop('stone_tallB',-8.4,2.3,3.5,.3);prop('log_large',9,4.2,3.8,.5,true);prop('log_large',-8,-5,3.3,1.3,true);prop('stump_roundDetailed',-7.9,6.2,1.3);
 for(const [x,z] of [[-7,-6],[7,-5],[-6.5,6.5],[6.8,7]]){prop('campfire_stones',x,z,1.35,rand()*TAU,true);const light=new THREE.PointLight('#ff9c43',33,11,2);light.position.set(x,.8,z);scene.add(light);torches.push({x,z,light,seed:rand()*9});}
 for(let i=0;i<7;i++){const p=prop('path_stone',Math.sin(i)*.4,8+i*1.8,1.9,rand()*.4,true,-.045);p.scale.y*=.25;}
}
