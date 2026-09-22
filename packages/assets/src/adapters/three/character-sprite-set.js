import {SPRITE_SET_DIRECTIONS,assertCharacterSpriteSet,resolveSpriteSetDirection,spriteSetGrounding,spriteSetUV} from '../../character-sprite-set.js';
import {createSpriteSetPlayback} from '../../character-sprite-playback.js';
import {loadSpriteSetResources,isSpriteSetResources} from '../browser/character-sprite-set.js';
const claimedResources=new WeakSet();

// Owns textures/materials/resources. External attachments remain caller-owned.
// resourceLoader is a trusted host/test dependency, never taken from the asset or transfer.
export async function createCharacterSpriteSetActor(THREE,input,options={}){
  const loader=options.resourceLoader||loadSpriteSetResources;
  const resources=isSpriteSetResources(input)?input:await loader(input,{playable:options.playable===true});
  if(resources.disposed||claimedResources.has(resources))throw new Error('Sprite Set resources are disposed or already owned');
  const m=assertCharacterSpriteSet(resources.manifest,{playable:options.playable===true});claimedResources.add(resources);
  const playback=createSpriteSetPlayback(m),object=new THREE.Group();object.name='CharacterSpriteSet:'+m.id;object.userData.occlusionCategory=m.render.occlusionCategory||'character';
  const geometry=new THREE.PlaneGeometry(1,1),material=new THREE.MeshLambertMaterial({transparent:true,alphaTest:.04,side:THREE.DoubleSide,depthTest:true,depthWrite:true,emissive:0xffffff,emissiveIntensity:.12});
  const body=new THREE.Group(),mesh=new THREE.Mesh(geometry,material);body.name='SpriteSetBody';body.add(mesh);object.add(body);mesh.frustumCulled=false;
  const shadowGeometry=new THREE.CircleGeometry(m.render.shadowRadius||.3,24),shadowMaterial=new THREE.MeshBasicMaterial({color:0x101a15,transparent:true,opacity:.28,depthWrite:false});
  const shadow=new THREE.Mesh(shadowGeometry,shadowMaterial);shadow.rotation.x=-Math.PI/2;shadow.position.set(...(m.render.shadowAnchor||[0,0,0]));shadow.position.y+=.012;object.add(shadow);
  const textures=new Map(),assetTextures=new Map(),sockets={},attachments=new Map();
  let yaw=0,view='front',forcedView=null,opacity=1,disposed=false,lift=0,renderKey='',lastEvents=[];
  const cameraPoint=new THREE.Vector3(),worldPoint=new THREE.Vector3();
  try{
    for(const [id,a] of Object.entries(m.assets)){
      if(!textures.has(a.sha256)){
        const texture=new THREE.Texture(resources.images.get(id));texture.colorSpace=THREE.SRGBColorSpace;texture.minFilter=texture.magFilter=THREE.LinearFilter;texture.generateMipmaps=false;texture.needsUpdate=true;textures.set(a.sha256,texture);
      }
      assetTextures.set(id,textures.get(a.sha256));
    }
    const socketNames=new Set(['body','rightHand','leftHand','weapon','secondaryGrip','weaponHitbox','trailOrigin','heldItem',...Object.keys(m.anchors||{})]);
    for(const clip of Object.values(m.actions))for(const frames of Object.values(clip.anchors||{}))for(const frame of frames)for(const name of Object.keys(frame))socketNames.add(name);
    for(const name of socketNames){const socket=new THREE.Object3D();socket.name='SpriteSetSocket:'+name;body.add(socket);sockets[name]=socket;}
    playback.play(Object.hasOwn(m.actions,'idle')?'idle':Object.keys(m.actions)[0]);
  }catch(error){dispose();throw error;}
  function renderFrame(){
    if(disposed)return;const state=playback.snapshot(),key=state.action+':'+state.frame+':'+view;
    const clip=m.actions[state.action],g=spriteSetGrounding(m,state.action);
    body.position.set(...(clip.rootOffset||[0,0,0]));body.position.y+=lift;
    if(key!==renderKey){
      renderKey=key;const uv=spriteSetUV(m,state.action,view,state.frame),attribute=geometry.attributes.uv;
      attribute.setXY(0,uv.u0,uv.v1);attribute.setXY(1,uv.u1,uv.v1);attribute.setXY(2,uv.u0,uv.v0);attribute.setXY(3,uv.u1,uv.v0);attribute.needsUpdate=true;
      if(material.map!==assetTextures.get(clip.asset)){const firstMap=!material.map;material.map=assetTextures.get(clip.asset);if(firstMap)material.needsUpdate=true;}
      mesh.scale.set(g.width,g.height,1);mesh.position.set(g.x,g.y,0);
      const anchors={...(m.anchors||{}),...(clip.anchors?.[view]?.[state.frame]||{})};
      for(const [name,socket] of Object.entries(sockets)){
        const p=anchors[name];socket.visible=Boolean(p);socket.userData.available=Boolean(p);
        if(p)socket.position.set((p[0]-g.pivot[0])*g.width,(g.pivot[1]-p[1])*g.height,p[2]*g.height);
      }
    }
    material.opacity=opacity;shadowMaterial.opacity=.28*opacity*Math.max(0,1-lift/2);shadow.visible=options.shadow!==false;
  }
  function resolveView(camera){
    if(disposed||!camera)return;
    camera.getWorldPosition(cameraPoint);object.getWorldPosition(worldPoint);
    const dx=cameraPoint.x-worldPoint.x,dz=cameraPoint.z-worldPoint.z;
    if(Math.hypot(dx,dz)>.0001){const angle=Math.atan2(dx,dz);view=forcedView||resolveSpriteSetDirection(yaw,angle,view);body.rotation.y=angle;}
    else if(forcedView)view=forcedView;
    renderFrame();body.updateMatrixWorld(true);
  }
  // Resolve against the final render camera, including later-in-frame camera director updates.
  mesh.onBeforeRender=(_renderer,_scene,camera)=>resolveView(camera);
  function update({delta=0,camera}={}){
    if(disposed)return;playback.step(delta);lastEvents=playback.drainEvents();renderFrame();resolveView(camera);
    for(const event of lastEvents)options.onEvent?.(event);
  }
  function dispose(){
    if(disposed)return;disposed=true;object.removeFromParent();mesh.onBeforeRender=()=>{};
    for(const attachment of attachments.values())attachment.removeFromParent();attachments.clear();
    playback.dispose();geometry.dispose();material.dispose();shadowGeometry.dispose();shadowMaterial.dispose();
    for(const texture of textures.values())texture.dispose();textures.clear();assetTextures.clear();resources.dispose();
  }
  function setTransform(p,angle=yaw){if(!p||![p.x,p.y??0,p.z,angle].every(Number.isFinite))throw new Error('Invalid Sprite Set transform');object.position.set(p.x,p.y??0,p.z);yaw=angle;}
  renderFrame();
  return {object,body,mesh,sockets,manifest:m,bundle:resources.bundle,playback,update,dispose,setTransform,
    play(action,opts){const result=playback.play(action,opts);renderKey='';renderFrame();return result;},
    setFacing(value){if(!Number.isFinite(value))throw new Error('Invalid facing');yaw=value;},
    setDirection(value=null){if(value!==null&&!SPRITE_SET_DIRECTIONS.includes(value))throw new Error('Invalid direction');forcedView=value;if(value)view=value;renderFrame();},
    setLift(value){if(!Number.isFinite(value)||value<0||value>12)throw new Error('Invalid visual lift');lift=value;renderFrame();},
    setOpacity(value){if(!Number.isFinite(value))throw new Error('Invalid opacity');opacity=Math.max(0,Math.min(1,value));renderFrame();},
    setEquipment(slot,attachment){if(!sockets[slot])throw new Error('Unknown socket');attachments.get(slot)?.removeFromParent();attachments.delete(slot);if(attachment){sockets[slot].add(attachment);attachments.set(slot,attachment);}},
    pause(value=true){return playback.pause(value);},reset(){const result=playback.reset();renderFrame();return result;},
    snapshot(){return {...playback.snapshot(),id:m.id,schema:m.schema,view,availableViews:[...SPRITE_SET_DIRECTIONS],yaw,position:{x:object.position.x,y:object.position.y,z:object.position.z},lift,pivot:[...(m.actions[playback.snapshot().action].pivot||m.render.pivot)],worldHeight:m.render.worldHeight,textures:textures.size,decodedImages:resources.decodedCount,events:lastEvents.map(e=>({...e})),disposed};},
  };
}
