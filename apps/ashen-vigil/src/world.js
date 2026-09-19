import * as THREE from 'three';
// The environment consists exclusively of instances of authored glTF meshes.
export function buildWorld(scene,assets,lowPower=false){
  const world=new THREE.Group();world.name='Externally authored graveyard';scene.add(world);
  const flames=[],grounds=[];let seed=301;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  function place(key,x,z,scale=1,rotation=0,y=0,tint){
    const root=assets.instance(key),b=new THREE.Box3().setFromObject(root),c=b.getCenter(new THREE.Vector3());
    const holder=new THREE.Group();root.position.set(-c.x,-b.min.y,-c.z);holder.add(root);holder.scale.setScalar(scale);holder.position.set(x,y,z);holder.rotation.y=rotation;
    if(tint)root.traverse(o=>{if(o.isMesh){o.material=o.material.clone();o.material.color.multiply(new THREE.Color(tint));}});
    world.add(holder);return holder;
  }
  // Reuse the original road model's vertices, normals, UVs and indices unchanged.
  const road=assets.models.get('graveyard/road').scene;road.updateMatrixWorld(true);
  const cells=[];for(let x=-9;x<=9;x++)for(let z=-9;z<=9;z++)cells.push([x,z]);
  const transform=new THREE.Matrix4(),obj=new THREE.Object3D();
  road.traverse(mesh=>{if(!mesh.isMesh)return;const mat=mesh.material.clone();mat.color.set('#617879');mat.roughness=.94;
    const inst=new THREE.InstancedMesh(mesh.geometry,mat,cells.length);inst.receiveShadow=true;inst.castShadow=false;inst.name='Original road tiles';
    cells.forEach(([x,z],i)=>{obj.position.set(x*1.8,-.175+(random()-.5)*.013,z*1.8);obj.rotation.set(0,Math.floor(random()*4)*Math.PI/2,0);obj.scale.set(2.3,.95,2.3);obj.updateMatrix();transform.copy(obj.matrix).multiply(mesh.matrixWorld);inst.setMatrixAt(i,transform);inst.setColorAt(i,new THREE.Color().setScalar(.78+random()*.25));});inst.instanceMatrix.needsUpdate=true;world.add(inst);grounds.push(inst);
  });
  place('graveyard/crypt-large',-1,-12.1,3.4,0,0,'#8baba6');
  place('graveyard/crypt-large-roof',-1,-12.1,3.4,0,3.4,'#697d80');
  place('graveyard/crypt-large-door',-1,-8.04,3.2,0,.05,'#80948b');
  for(const x of [-5.6,3.6]){place('graveyard/column-large',x,-10,3.7,0,0,'#899f92');place('graveyard/candle-multiple',x,-10,1.5,0,4.18);flames.push({x,y:4.5,z:-10,scale:.65});}
  place('graveyard/altar-stone',0,0,2.6,0,0,'#9fac98');
  place('graveyard/fire-basket',0,0,2.4,0,.8,'#8b9380');flames.push({x:0,z:0,y:1.4,scale:1.2});
  for(const [x,z] of [[-6,-6],[6,-6],[-6,6],[6,6]]){
    place('graveyard/pillar-obelisk',x,z,2.3,0,0,'#92a9a2');place('graveyard/fire-basket',x,z,1.6,0,2.3,'#818f7b');flames.push({x,z,y:2.65,scale:.78});
  }
  for(let i=0;i<20;i++){
    const side=i%2?1:-1,z=-8+(i>>1)*2.1;
    place('graveyard/'+(i%4===0?'iron-fence-damaged':'iron-fence'),side*10.1,z,2.2,side*Math.PI/2,0,'#677b77');
    if(i%3===0)place('graveyard/iron-fence-border-column',side*10.1,z,2.5,0,0,'#829a92');
  }
  const graves=['gravestone-bevel','gravestone-cross-large','gravestone-decorative','gravestone-broken'];
  for(let i=0;i<34;i++){const side=i%2?1:-1,x=side*(10.9+random()*3),z=-11+random()*23;place('graveyard/'+graves[i%4],x,z,1.8+random(),(random()-.5)*.5,0,'#82998e');}
  for(let i=0;i<32;i++){
    const a=i/32*Math.PI*2,r=15.5+random()*4.5;
    place('graveyard/'+(i%3===0?'pine-crooked':i%5===0?'pine-fall':'pine'),Math.cos(a)*r,Math.sin(a)*r,2.2+random()*1.5,random()*Math.PI,0,i%5===0?'#698483':'#477d75');
  }
  for(let i=0;i<17;i++){const a=random()*Math.PI*2,r=12+random()*6;place('pirate/Environment_Cliff1',Math.cos(a)*r,Math.sin(a)*r,.55+random()*.7,random()*6,-.6,'#738e90');}
  for(let i=0;i<32;i++){const a=random()*Math.PI*2,r=8.2+random()*2;place('graveyard/'+(i%2?'rocks':'debris'),Math.cos(a)*r,Math.sin(a)*r,.45+random()*.7,random()*6,.02,'#718682');}
  place('pirate/Environment_LargeBones',8.2,3.5,.7,1.6,.03,'#a4b49e');place('graveyard/trunk-long',-8,4,1.8,1.1,0,'#74918c');place('pirate/Prop_Chest_Closed',5,-9.7,.95,-.4,0,'#9c9e83');
  const fire=new THREE.PointLight('#f4b367',23,13,1.5);fire.position.set(0,3,0);scene.add(fire);
  const moon=new THREE.DirectionalLight('#a3dbe1',2.6);moon.position.set(-10,19,-12);scene.add(moon);
  const sun=new THREE.DirectionalLight('#ffe0ad',3.2);sun.position.set(9,17,8);sun.castShadow=true;sun.shadow.mapSize.set(lowPower?512:1536,lowPower?512:1536);sun.shadow.camera.left=-18;sun.shadow.camera.right=18;sun.shadow.camera.top=18;sun.shadow.camera.bottom=-18;sun.shadow.camera.far=55;sun.shadow.bias=-.0003;sun.shadow.normalBias=.03;scene.add(sun);
  scene.add(new THREE.HemisphereLight('#a5cfcc','#23313b',1.95));
  batchOriginalMeshes(world);
  return {world,grounds,flames,fire,update(t){fire.intensity=23+Math.sin(t*5.7)*2+Math.sin(t*11)*1.2;}};
}
// Hardware instancing preserves every authored vertex, UV and index unchanged.
function batchOriginalMeshes(world){
  world.updateMatrixWorld(true);const groups=new Map();
  world.traverse(mesh=>{
    if(!mesh.isMesh||mesh.isSkinnedMesh||mesh.isInstancedMesh||Array.isArray(mesh.material))return;
    const m=mesh.material,key=[mesh.geometry.uuid,m.map?.uuid||'',m.color.getHexString(),m.roughness,m.metalness].join('|');
    if(!groups.has(key))groups.set(key,[]);groups.get(key).push(mesh);
  });
  for(const meshes of groups.values()){
    if(meshes.length<2)continue;const source=meshes[0],batch=new THREE.InstancedMesh(source.geometry,source.material,meshes.length);
    batch.name='Authored mesh instances: '+source.name;batch.castShadow=source.castShadow;batch.receiveShadow=source.receiveShadow;
    meshes.forEach((mesh,i)=>{batch.setMatrixAt(i,mesh.matrixWorld);mesh.removeFromParent();if(mesh.material!==source.material)mesh.material.dispose();});
    batch.instanceMatrix.needsUpdate=true;batch.computeBoundingSphere();world.add(batch);
  }
}
