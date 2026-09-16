import * as T from 'three';

export function miniatureShadowCell(x,z){return{x:Math.round(x/24)*24,z:Math.round(z/24)*24};}

/** Static scenery casts a cached local sun shadow; actors use cheap contact marks. */
export function createMiniatureLighting({renderer,scene,staticRoots=[]}){
  const ambient=new T.HemisphereLight(0xb9d4ef,0x454938,.85),sun=new T.DirectionalLight(0xffe4bc,3.1);
  scene.add(ambient,sun,sun.target);renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFShadowMap;
  sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=sun.shadow.camera.bottom=-48;sun.shadow.camera.right=sun.shadow.camera.top=48;
  sun.shadow.camera.near=1;sun.shadow.camera.far=160;sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias=-.0004;sun.shadow.normalBias=.09;sun.shadow.autoUpdate=false;
  const casters=new WeakSet();
  for(const root of staticRoots)root.traverse(node=>{
    const materials=Array.isArray(node.material)?node.material:[node.material];
    if(node.isMesh&&!node.isSkinnedMesh&&!materials.some(m=>m?.transparent))casters.add(node);
  });
  let previous='',updates=0,enabled=false;
  function update({x=0,z=0,inside=false,frontier=false,level=0}={}){
    ambient.intensity=inside?1.1:.85;sun.intensity=inside?1.4:3.1;
    const nextEnabled=!inside&&!frontier&&level<2,cell=miniatureShadowCell(x,z),key=`${cell.x}:${cell.z}`;
    if(nextEnabled&&(!enabled||key!==previous)){
      sun.position.set(cell.x-36,54,cell.z+30);sun.target.position.set(cell.x,0,cell.z);
      sun.shadow.needsUpdate=true;previous=key;updates++;
    }
    if(!nextEnabled){sun.position.set(x-36,54,z+30);sun.target.position.set(x,0,z);}
    enabled=nextEnabled;sun.castShadow=enabled;
    // Three's shadow pass uses the main camera's layers. Filter only on cache
    // refresh so newly loaded actors/weapons never leave frozen sun shadows.
    if(enabled&&sun.shadow.needsUpdate)scene.traverse(node=>{if(node.isMesh)node.castShadow=casters.has(node);});
  }
  update();
  return{update,snapshot:()=>({cachedSunShadow:enabled,shadowMapSize:1024,shadowUpdates:updates,ambientIntensity:ambient.intensity,keyIntensity:sun.intensity}),dispose(){ambient.removeFromParent();sun.removeFromParent();sun.target.removeFromParent();sun.dispose();}};
}

export function createActorContactShadows(scene,groups,{capacity=128}={}){
  const bytes=new Uint8Array(32*32*4);
  for(let y=0;y<32;y++)for(let x=0;x<32;x++){
    const i=(y*32+x)*4,r=Math.hypot((x-15.5)/15.5,(y-15.5)/15.5),a=Math.max(0,1-r*r);
    bytes[i]=bytes[i+1]=bytes[i+2]=255;bytes[i+3]=Math.round(a*a*150);
  }
  const texture=new T.DataTexture(bytes,32,32,T.RGBAFormat);texture.magFilter=texture.minFilter=T.LinearFilter;texture.needsUpdate=true;
  const geometry=new T.PlaneGeometry(1,1);geometry.rotateX(-Math.PI/2);
  const material=new T.MeshBasicMaterial({map:texture,color:0x343c48,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1});
  const mesh=new T.InstancedMesh(geometry,material,capacity),matrix=new T.Matrix4();mesh.name='ActorContactShadows';mesh.frustumCulled=false;mesh.count=0;scene.add(mesh);
  function update(){
    let count=0;
    for(const group of groups){if(!group.visible)continue;for(const actor of group.children){
      if(count>=capacity||!actor.visible||actor.position.y>.4||!(actor.userData.characterModel||actor.name.startsWith('VillageThreat:')))continue;
      const radius=Math.max(.3,Math.min(1.2,actor.scale.x*.9));matrix.makeScale(radius,1,radius*.7);matrix.setPosition(actor.position.x,.045,actor.position.z);mesh.setMatrixAt(count++,matrix);
    }}
    mesh.count=count;if(count)mesh.instanceMatrix.needsUpdate=true;
  }
  return{update,snapshot:()=>({instances:mesh.count,drawCalls:mesh.count?1:0}),dispose(){mesh.removeFromParent();mesh.dispose();geometry.dispose();material.dispose();texture.dispose();}};
}
