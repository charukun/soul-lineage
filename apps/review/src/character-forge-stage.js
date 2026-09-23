import * as THREE from 'three';

// Presentation only: source geometry, package materials and Camera Director bounds stay intact.
export function createForgeInspectionStage({scene,renderer}){
  const ambient=new THREE.HemisphereLight('#eef3ff','#454a46',.65);
  const key=new THREE.DirectionalLight('#fff4e8',3.2);
  const fill=new THREE.DirectionalLight('#d5e7ff',.6);
  key.castShadow=true;key.shadow.mapSize.set(1024,1024);key.shadow.bias=-.0001;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshStandardMaterial({color:'#303a35',roughness:1,metalness:0}));
  ground.name='ForgeInspectionGround';ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;ground.visible=false;
  scene.add(ambient,key,key.target,fill,fill.target,ground);
  let meshes=[],materials=new Map(),bound=false,referenceLighting=null,lightFrame=null;
  const originalToneMapping=renderer.toneMapping;

  function release(){
    for(const {mesh,material,castShadow,receiveShadow} of meshes){
      mesh.material=material;mesh.castShadow=castShadow;mesh.receiveShadow=receiveShadow;
    }
    for(const material of materials.values())material.dispose();
    meshes=[];materials.clear();bound=false;ground.visible=false;referenceLighting=null;
  }
  function bind(root,manifest){
    release();
    const {min,max}=manifest.bounds;
    const height=Math.max(.01,max[1]-min[1]),extent=Math.max(height,max[0]-min[0],max[2]-min[2]);
    const center=new THREE.Vector3().fromArray(min.map((v,i)=>(v+max[i])*.5)).add(root.position);
    // Use the authored ground, not the current animated foot height: floating remains visible.
    const groundPoint=new THREE.Vector3().fromArray(manifest.presentation.groundPoint).add(root.position);
    ground.position.copy(groundPoint);ground.position.y-=height*.002;ground.scale.setScalar(extent*12);
    key.target.position.copy(center);fill.target.position.copy(center);
    key.position.copy(center).add(new THREE.Vector3(-2.5,3,4).multiplyScalar(extent));
    fill.position.copy(center).add(new THREE.Vector3(3,1,-3).multiplyScalar(extent));
    lightFrame={key:key.position.clone(),fill:fill.position.clone(),target:center.clone()};
    referenceLighting=manifest.referenceReview?.lighting||null;
    const shadowCamera=key.shadow.camera,span=extent*1.8;
    Object.assign(shadowCamera,{left:-span,right:span,top:span,bottom:-span,near:extent*.01,far:extent*12});
    shadowCamera.updateProjectionMatrix();key.shadow.normalBias=height*.003;
    root.traverse(mesh=>{
      if(!mesh.isMesh)return;
      const sources=Array.isArray(mesh.material)?mesh.material:[mesh.material];
      for(const source of sources)if(!materials.has(source)){
        materials.set(source,new THREE.MeshStandardMaterial({
          color:'#b8bdc2',roughness:.85,metalness:0,side:source.side,flatShading:source.flatShading||false,
        }));
      }
      meshes.push({mesh,material:mesh.material,castShadow:mesh.castShadow,receiveShadow:mesh.receiveShadow});
      mesh.castShadow=true;mesh.receiveShadow=true;
    });
    bound=true;
  }
  function setDisplay({shape=false,wireframe=false,comparison=false}={}){
    for(const material of materials.values())material.wireframe=wireframe;
    for(const {mesh,material} of meshes){
      mesh.material=shape?(Array.isArray(material)?material.map(m=>materials.get(m)):materials.get(material)):material;
    }
    // References keep their established flat comparison lighting and a clean silhouette.
    const reference=comparison&&!shape;
    if(reference&&referenceLighting){
      const light=referenceLighting;
      ambient.color.set(light.hemisphere.sky);ambient.groundColor.set(light.hemisphere.ground);ambient.intensity=light.hemisphere.intensity;
      key.color.set(light.key.color);key.intensity=light.key.intensity;key.position.fromArray(light.key.position);key.target.position.fromArray(light.key.target);
      fill.color.set(light.rim.color);fill.intensity=light.rim.intensity;fill.position.fromArray(light.rim.position);fill.target.position.fromArray(light.rim.target);
      renderer.toneMapping=light.toneMapping==='none'?THREE.NoToneMapping:THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=light.exposure;key.castShadow=false;ground.visible=false;return;
    }
    ambient.color.set('#eef3ff');ambient.groundColor.set('#454a46');key.color.set('#fff4e8');fill.color.set('#d5e7ff');
    if(lightFrame){key.position.copy(lightFrame.key);fill.position.copy(lightFrame.fill);key.target.position.copy(lightFrame.target);fill.target.position.copy(lightFrame.target);}
    renderer.toneMapping=originalToneMapping;
    ambient.intensity=reference?2.4:.65;key.intensity=reference?3:3.2;fill.intensity=reference?2:.6;
    renderer.toneMappingExposure=reference?1.2:1.05;
    key.castShadow=!comparison;ground.visible=bound&&!comparison;
  }
  function dispose(){
    release();ground.geometry.dispose();ground.material.dispose();key.shadow.dispose();
    for(const object of [ambient,key,key.target,fill,fill.target,ground])object.removeFromParent();
  }
  return {bind,release,setDisplay,dispose};
}
