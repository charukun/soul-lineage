import {assertCharacter25D,CHARACTER25D_SCHEMA} from '../../character25d-schema.js';
import {buildInfluenceMeshes,clamp,angleDelta} from '../../character25d-rig.js';
import {createMotionState,sampleMotion,stepSpring} from '../../character25d-motion.js';
import {createCharacter25DProxy,selectAppearance,VIEW_ANGLES} from '../../character25d-proxy.js';
import {loadSpriteImage,spriteAssetBlob} from '../browser/sprite25d-assets.js';
import {createSprite25dActor} from './sprite25d-actor.js';
import {createCharacter25DEquipment} from './character25d-equipment.js';

export async function createCharacter25DActor(THREE,bundle,options={}) {
  assertCharacter25D(bundle);
  if(bundle.schema!==CHARACTER25D_SCHEMA)return createSprite25dActor(THREE,bundle,options);
  if(!bundle.appearance.front)throw new Error('Character25D needs a front appearance');
  const object=new THREE.Group();object.name='Character25D:'+bundle.id;
  const body=new THREE.Group();body.name='Invisible3DBody';object.add(body);
  const proxy=createCharacter25DProxy(bundle.gameplayProxy,options),motion=createMotionState();
  const textures=new Map(),views=[],owned=[],attachments=new Map();
  const rotations=new Float32Array(bundle.rig.bones.length*3),translations=new Float32Array(rotations.length);
  const springs={hair:{value:0,velocity:0},clothing:{value:0,velocity:0},accessories:{value:0,velocity:0}};
  const uniforms=Object.fromEntries(Object.keys(springs).map(k=>[k,{value:0}]));
  const scale=bundle.render.height,point=new THREE.Vector3(),cameraPoint=new THREE.Vector3(),footPoint=new THREE.Vector3(),up=new THREE.Vector3(0,1,0),normal=new THREE.Vector3();
  const springKeys=Object.keys(springs),footPairs=[['L','left'],['R','right']];
  let disposed=false,current=null,previous=null,transition=1,opacity=1,lastSpeed=0,lastYaw=0,actualSpeed=0,forcedView=null;
  function makeSkeleton(parent,compression=1) {
    const bones=[],byName=new Map();
    const projectedRest=def=>{if(!def)return [0,0,0];const x=def.rest[0]*compression;if(compression===.48&&/^(upperArm|lowerArm|hand)\./.test(def.name))return [(def.name.endsWith('.L')?1:-1)*(def.name.startsWith('upper')?.01:def.name.startsWith('lower')?.005:0),def.rest[1],0];return [x,def.rest[1],0];};
    for(const def of bundle.rig.bones) {
      const bone=new THREE.Bone();bone.name=def.name;const p=bundle.rig.bones.find(b=>b.name===def.parent);
      const a=projectedRest(def),b=projectedRest(p);bone.position.set(a[0]-b[0],a[1]-b[1],0);
      (byName.get(def.parent)||parent).add(bone);byName.set(def.name,bone);bones.push(bone);
    }
    parent.updateMatrixWorld(true);
    return {bones,byName,skeleton:new THREE.Skeleton(bones),rest:bones.map(b=>b.position.clone())};
  }
  const bodyRig=makeSkeleton(body);body.scale.setScalar(scale);
  const sockets={};
  for(const [key,boneName] of Object.entries(bundle.gameplayProxy.sockets)) {
    const socket=new THREE.Object3D();socket.name='Character25D:'+key;bodyRig.byName.get(boneName).add(socket);sockets[key]=socket;
  }
  const equipment=createCharacter25DEquipment(THREE,{body,rig:bodyRig,sockets,height:scale});
  equipment.setEquipment(options.equipment||{},options.equipmentProfiles);
  const debugGeometry=new THREE.CapsuleGeometry(proxy.collider.radius,Math.max(.01,proxy.collider.height-2*proxy.collider.radius),4,8);
  const debugMaterial=new THREE.MeshBasicMaterial({color:0xe5c991,wireframe:true});owned.push(debugGeometry,debugMaterial);
  const collider=new THREE.Mesh(debugGeometry,debugMaterial);collider.position.y=proxy.collider.height/2;collider.visible=false;object.add(collider);
  const shadowGeometry=new THREE.CircleGeometry(proxy.collider.radius*1.35,20),shadowMaterial=new THREE.MeshBasicMaterial({color:0x131d18,transparent:true,opacity:.24,depthWrite:false});owned.push(shadowGeometry,shadowMaterial);
  const contact=new THREE.Mesh(shadowGeometry,shadowMaterial);contact.rotation.x=-Math.PI/2;contact.position.y=.009;object.add(contact);
  const dispose=()=>{if(disposed)return;disposed=true;object.removeFromParent();equipment.dispose();for(const attachment of attachments.values())attachment.removeFromParent();attachments.clear();for(const v of views)v.rig.skeleton.dispose();bodyRig.skeleton.dispose();for(const asset of owned)asset.dispose();for(const texture of textures.values())texture.dispose();textures.clear();};
  try {
    for(const [name,appearance] of Object.entries(bundle.appearance)) {
      if(!appearance)continue;
      const asset=bundle.assets[appearance.asset];
      if(!textures.has(appearance.asset)) {const image=await loadSpriteImage(spriteAssetBlob(asset)),texture=new THREE.Texture(image);texture.colorSpace=THREE.SRGBColorSpace;texture.minFilter=texture.magFilter=THREE.LinearFilter;texture.generateMipmaps=false;texture.needsUpdate=true;textures.set(appearance.asset,texture);}
      const group=new THREE.Group();group.name='Appearance:'+name;group.scale.setScalar(scale);object.add(group);
      const rig=makeSkeleton(group,name==='side'?.48:name.startsWith('back')?-1:1),meshes=[],footSamples=[],handDepth=equipment.handDepth.clone();
      const data=buildInfluenceMeshes(bundle.rig,{bounds:appearance.bounds,width:asset.width,height:asset.height,side:name==='side',back:name.startsWith('back')});
      for(const layer of data) {
        const geometry=new THREE.BufferGeometry();
        geometry.setAttribute('position',new THREE.Float32BufferAttribute(layer.positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(layer.uvs,2));
        geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(layer.skinIndices,4));geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(layer.skinWeights,4));geometry.setAttribute('secondaryWeight',new THREE.Float32BufferAttribute(layer.secondary,1));geometry.setIndex(layer.indices);geometry.computeVertexNormals();
        const handIds=['hand.R','hand.L'].map(name=>bundle.rig.bones.findIndex(b=>b.name===name)),priority=[];
        for(let i=0;i<layer.skinIndices.length;i+=4)for(const id of handIds){let weight=0;for(let j=0;j<4;j++)if(layer.skinIndices[i+j]===id)weight+=layer.skinWeights[i+j];priority.push(weight);}
        geometry.setAttribute('handPriority',new THREE.Float32BufferAttribute(priority,2));
        const material=new THREE.MeshLambertMaterial({map:textures.get(appearance.asset),transparent:true,alphaTest:.055,side:THREE.DoubleSide,depthTest:true,depthWrite:true,emissive:0xffffff,emissiveIntensity:.12,toneMapped:false});
        const secondary=layer.name.startsWith('hair')?'hair':layer.name==='clothing'?'clothing':layer.name==='accessories'?'accessories':null;
        material.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>','outgoingLight = clamp(outgoingLight, diffuseColor.rgb * 0.72, diffuseColor.rgb * 1.12);\n#include <opaque_fragment>');shader.uniforms.characterLag=secondary?uniforms[secondary]:{value:0};shader.uniforms.characterHandDepth={value:handDepth};shader.vertexShader='attribute float secondaryWeight;\nattribute vec2 handPriority;\nuniform vec2 characterHandDepth;\nuniform float characterLag;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <skinning_vertex>','#include <skinning_vertex>\ntransformed.x += characterLag * secondaryWeight * (1.0 - min(1.0, handPriority.x + handPriority.y));\ntransformed.z += dot(handPriority, characterHandDepth);');};
        material.customProgramCacheKey=()=> 'character25d-layer-v2-art-light-equipment-depth';
        const mesh=new THREE.SkinnedMesh(geometry,material);mesh.name=layer.name;mesh.frustumCulled=false;mesh.receiveShadow=true;mesh.castShadow=false;group.add(mesh);mesh.bind(rig.skeleton);meshes.push(mesh);owned.push(geometry,material);
        for(let i=0;i<layer.positions.length/3;i++)if(layer.positions[i*3+1]<.001)footSamples.push({mesh,index:i});
      }
      group.visible=false;views.push({name,group,rig,meshes,footSamples,appearance,handDepth});
    }
  } catch(error){dispose();throw error;}
  function applyPose(rig,projection=null) {
    for(let i=0;i<rig.bones.length;i++) {
      const bone=rig.bones[i],k=i*3;bone.position.copy(rig.rest[i]);
      if(projection===null){bone.rotation.set(rotations[k],rotations[k+1],rotations[k+2]);bone.position.y+=translations[k+1];}
      else{
        // Project sagittal movement into each view; front keeps a small lateral
        // silhouette cue. Never scale limbs, flip UVs, or repaint the face.
        const sagittal=Math.sin(projection),frontal=Math.cos(projection);
        bone.rotation.set(0,0,clamp(rotations[k+2]*frontal-rotations[k]*(Math.abs(sagittal)>.15?sagittal:.28),-.32,.32));
        bone.position.y+=translations[k+1];
      }
    }
  }
  function update(input={}) {
    if(disposed)return;const delta=clamp(Number(typeof input==='number'?input:input.delta)||0,0,.05),camera=typeof input==='object'?input.camera:null;
    actualSpeed=proxy.step(delta);motion.step(delta,actualSpeed);sampleMotion(motion,bundle.rig,rotations,translations);
    object.position.set(proxy.position.x,proxy.position.y,proxy.position.z);body.rotation.y=proxy.yaw;applyPose(bodyRig);equipment.pose(motion);
    const acceleration=delta?(actualSpeed-lastSpeed)/delta:0,turn=delta?angleDelta(lastYaw,proxy.yaw)/delta:0;
    for(const key of springKeys){const cfg=bundle.secondaryMotion[key],target=clamp(-acceleration*.005-turn*.009+Math.sin(motion.phase-.6)*(actualSpeed>.08?.013:0),-cfg.limit,cfg.limit);uniforms[key].value=stepSpring(springs[key],target,delta,cfg);}
    lastSpeed=actualSpeed;lastYaw=proxy.yaw;
    if(camera){camera.getWorldPosition(cameraPoint);object.getWorldPosition(point);const cameraYaw=Math.atan2(cameraPoint.x-point.x,cameraPoint.z-point.z),relative=angleDelta(proxy.yaw,cameraYaw);
      const selected=forcedView||selectAppearance(bundle.appearance,relative,current);
      if(selected!==current){previous=current;current=selected;transition=0;}transition=Math.min(1,transition+delta/.14);
      for(const view of views){const active=view.name===current,old=view.name===previous&&transition<1;view.group.visible=active||old;if(!view.group.visible)continue;
        view.group.rotation.y=cameraYaw;const viewAngle=VIEW_ANGLES[view.name]*(relative<0?-1:1);applyPose(view.rig,viewAngle);view.group.position.y=0;view.group.updateMatrixWorld(true);view.rig.skeleton.update();
        let min=Infinity;for(const sample of view.footSamples){footPoint.fromBufferAttribute(sample.mesh.geometry.attributes.position,sample.index);sample.mesh.applyBoneTransform(sample.index,footPoint);min=Math.min(min,footPoint.y);}
        view.group.position.y=Number.isFinite(min)?-min*scale:0;
        view.group.updateWorldMatrix(true,true);equipment.project(view,relative);
        const alpha=(active?transition:1-transition)*opacity;
        for(const mesh of view.meshes){mesh.material.opacity=alpha;mesh.material.depthWrite=alpha>.5;}
      }
    }
    normal.set(proxy.groundNormal.x,proxy.groundNormal.y,proxy.groundNormal.z);contact.quaternion.setFromUnitVectors(up,normal);contact.rotateX(-Math.PI/2);
    contact.material.opacity=proxy.grounded?.24*opacity:0;
    object.updateMatrixWorld(true);
    for(const [side,key] of footPairs){bodyRig.byName.get('foot.'+side).getWorldPosition(footPoint);proxy.feet[key].x=footPoint.x;proxy.feet[key].y=footPoint.y;proxy.feet[key].z=footPoint.z;}
  }
  function snapshot(){const view=views.find(v=>v.name===current);return {schema:bundle.schema,id:bundle.id,position:{...proxy.position},yaw:proxy.yaw,velocity:{...proxy.velocity},speed:actualSpeed,grounded:proxy.grounded,blocked:proxy.blocked,groundNormal:{...proxy.groundNormal},action:motion.action,time:motion.time,view:current,transition,availableViews:views.map(v=>v.name),mirror:false,bodyBones:bodyRig.bones.length,layerMeshes:view?.meshes.length||0,rotations:[...rotations],secondary:Object.fromEntries(Object.entries(springs).map(([k,v])=>[k,v.value])),textures:textures.size,feet:{left:{...proxy.feet.left},right:{...proxy.feet.right}},...equipment.snapshot(),appearanceGrips:view?Object.fromEntries(['R','L'].map(side=>[side,view.rig.byName.get('hand.'+(view.sideFlip?(side==='R'?'L':'R'):side)).getWorldPosition(new THREE.Vector3()).toArray()])):null,disposed};}
  return {object,proxy,sockets,update,dispose,snapshot,
    play(name,opts){motion.play(name,opts);},setAction(name,opts){motion.play(name,{restart:false,...opts});},releaseAction({locomotionOnly=false}={}){if(!locomotionOnly||['idle','walk','run','rest'].includes(motion.action))motion.release();},
    setTransform(p,yaw){proxy.setTransform(p,yaw);},setVelocity(v){proxy.setVelocity(v);},setFacing(yaw){proxy.setFacing(yaw);},setGroundNormal(n){proxy.setGroundNormal(n);},
    setEquipment(slot,attachment){if(typeof slot!=='string')return equipment.setEquipment(slot,attachment);if(!sockets[slot])throw new Error('Unknown equipment socket');attachments.get(slot)?.removeFromParent();attachments.delete(slot);if(attachment){sockets[slot].add(attachment);attachments.set(slot,attachment);}},
    setHeldItem:equipment.setHeldItem,
    setOpacity(value){opacity=clamp(value,0,1);},setDebug(value){collider.visible=Boolean(value);},
    setPreview(action=null,direction=null){if(action)motion.play(action);else motion.release();forcedView=({s:'front',sw:'frontQuarter',w:'side',nw:'backQuarter',n:'back',ne:'backQuarter',e:'side',se:'frontQuarter'})[direction]||null;if(forcedView&&!bundle.appearance[forcedView])forcedView=null;},
    getStatus(){return `${motion.action} · ${current||'front'} · ${views.length===1?'正面のみ（他方向は未収録）':views.length+'方向候補・反転なし'}`;}};
}
