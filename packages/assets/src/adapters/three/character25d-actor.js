import {assertSprite25dManifest} from '../../sprite25d-manifest.js';
import {loadSpriteImage,spriteAssetBlob} from '../browser/sprite25d-assets.js';
import {createRinneWeapon,disposeRinneEquipment,resolveRinneEquipment,RINNE_EQUIPMENT_PROFILES} from './runtime-equipment.js';

export const CHARACTER25D_ACTIONS=Object.freeze(['idle','walk','run','turn','attack','hit','rest']);
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const smooth=x=>{x=clamp(x,0,1);return x*x*(3-2*x);};
const wrap=x=>Math.atan2(Math.sin(x),Math.cos(x));
export function character25dView(relative){
  const a=Math.abs(wrap(relative));return a>Math.PI*.75?'back':a>Math.PI*.375?'side':a>Math.PI*.125?'quarter':'front';
}

// One body proxy owns both the deforming appearance and equipment. Neither weapons
// nor hit/trail anchors are independently positioned by the renderer.
export function createCharacter25dRig(THREE,{height=1.72,width=.92}={}){
  const root=new THREE.Group();root.name='Character25D.GameplayProxy';
  root.userData.collider={kind:'capsule',radius:width*.22,height};
  const rig=new THREE.Group();rig.name='Invisible3DSkeleton';root.add(rig);
  const bones={},rest={},list=[];
  function bone(name,parent,position){const b=new THREE.Bone();b.name=name;b.position.fromArray(position);parent.add(b);bones[name]=b;rest[name]=b.position.clone();list.push(b);return b;}
  const torso=bone('torso',rig,[0,0,0]);
  bone('head',torso,[0,height*.76,0]);
  for(const [side,sign] of [['right',-1],['left',1]]){
    const shoulder=bone(side+'UpperArm',torso,[sign*width*.28,height*.63,0]);
    const elbow=bone(side+'LowerArm',shoulder,[sign*width*.025,-height*.12,0]);
    bone(side+'Hand',elbow,[sign*width*.025,-height*.12,0]);
    const hip=bone(side+'UpperLeg',torso,[sign*width*.14,height*.32,0]);
    bone(side+'LowerLeg',hip,[0,-height*.15,0]);
  }
  const sockets={rightHand:bones.rightHand,leftHand:bones.leftHand};sockets.offhand=sockets.leftHand;
  function socket(name,parent){const node=new THREE.Group();node.name=name;parent.add(node);sockets[name]=node;return node;}
  const weapon=socket('weapon',sockets.rightHand),gripFrame=socket('gripFrame',weapon);
  socket('secondaryGripTarget',gripFrame);socket('weaponHitboxAnchor',gripFrame);socket('trailOrigin',gripFrame);socket('heldItemAnchor',sockets.leftHand);
  root.updateMatrixWorld(true);
  const skeleton=new THREE.Skeleton(list);
  const v=()=>new THREE.Vector3(),q=()=>new THREE.Quaternion();
  // Fixed-length, two-bone solve; targets beyond reach are clamped rather than
  // stretching wrists away from their skinned arm. Targets use rig-local space.
  function solveHand(side,target,rotation){
    const upper=bones[side+'UpperArm'],lower=bones[side+'LowerArm'],hand=bones[side+'Hand'];
    const start=upper.position.clone(),axis=target.clone().sub(start),l1=rest[side+'LowerArm'].length(),l2=rest[side+'Hand'].length();
    const d=clamp(axis.length(),.0001,l1+l2-.00001);axis.normalize();
    const along=(l1*l1-l2*l2+d*d)/(2*d),bend=Math.sqrt(Math.max(0,l1*l1-along*along));
    const pole=v().set(side==='right'?-1:1,-.2,.12);pole.addScaledVector(axis,-pole.dot(axis)).normalize();
    const elbow=start.clone().addScaledVector(axis,along).addScaledVector(pole,bend);
    const end=start.clone().addScaledVector(axis,d);
    upper.quaternion.setFromUnitVectors(lower.position.clone().normalize(),elbow.clone().sub(start).normalize());
    const fore=end.sub(elbow).applyQuaternion(upper.quaternion.clone().invert()).normalize();
    lower.quaternion.setFromUnitVectors(hand.position.clone().normalize(),fore);
    hand.quaternion.copy(upper.quaternion).multiply(lower.quaternion).invert().multiply(rotation||q());
  }
  function reset(){for(const b of list){b.position.copy(rest[b.name]);b.quaternion.identity();}}
  return {root,rig,bones,sockets,skeleton,rest,solveHand,reset,height,width};
}

function skinGeometry(THREE,rig,flip=false,sideView=null){
  const {width:w,height:h,bones,skeleton}=rig,g=new THREE.PlaneGeometry(w,h,36,56);
  g.translate(0,h*.5,0);
  const indices=[],weights=[],index=name=>skeleton.bones.indexOf(bones[name]);
  const add=(a,b,t)=>{indices.push(index(a),index(b),0,0);weights.push(1-t,t,0,0);};
  const pos=g.attributes.position;
  for(let i=0;i<pos.count;i++){
    const x=pos.getX(i)/w,y=pos.getY(i)/h,side=(x<0)!==flip?'right':'left';
    if(y>.71){add('torso','head',smooth((y-.71)/.10));}
    else if(sideView&&y>.34&&y<.66&&Math.abs(x)<.26){
      const part=y>.51?sideView+'UpperArm':y>.405?sideView+'LowerArm':sideView+'Hand';
      add('torso',part,smooth((.30-Math.abs(x))/.10));
    }else if(!sideView&&y>.33&&y<.65&&Math.abs(x)>.21){
      const arm=smooth((Math.abs(x)-.21)/.055);
      const part=y>.51?side+'UpperArm':y>.405?side+'LowerArm':side+'Hand';
      add('torso',part,arm);
    }else if(y<.33){add(side+'UpperLeg',side+'LowerLeg',1-smooth((y-.13)/.10));}
    else add('torso','torso',0);
  }
  g.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(indices,4));g.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));return g;
}

export async function createCharacter25dActor(THREE,bundle,{shadow=false,equipment={weapon:'sword',shield:true}}={}){
  assertSprite25dManifest(bundle);
  const views=bundle.appearance?.views||{front:bundle.pose};
  if(!views.front)throw new Error('先にキャラクター画像を入れてください');
  const textures=new Map();
  try{for(const hash of new Set(Object.values(views).filter(Boolean))){const image=await loadSpriteImage(spriteAssetBlob(bundle.assets[hash]));const t=new THREE.Texture(image);t.colorSpace=THREE.SRGBColorSpace;t.generateMipmaps=false;t.minFilter=t.magFilter=THREE.LinearFilter;t.needsUpdate=true;textures.set(hash,t);}}
  catch(error){for(const texture of textures.values())texture.dispose();throw error;}
  const h=bundle.render.height,front=bundle.assets[views.front],width=h*front.width/front.height;
  const rig=createCharacter25dRig(THREE,{height:h,width}),{root:object,bones,sockets}=rig;
  const material=new THREE.MeshBasicMaterial({map:textures.get(views.front),alphaTest:.12,side:THREE.DoubleSide,depthTest:true,depthWrite:true,toneMapped:false});
  // Cutout depth writes make the actual skinned arm/palm occlude a 3D grip. The
  // rig supplies signed local depth per view; no fixed front/back render order.
  const mesh=new THREE.SkinnedMesh(skinGeometry(THREE,rig),material);mesh.name='Character25D.Appearance';mesh.frustumCulled=false;rig.rig.add(mesh);object.updateMatrixWorld(true);mesh.bind(rig.skeleton);
  let contact=null;
  if(shadow){contact=new THREE.Mesh(new THREE.CircleGeometry(width*.32,24),new THREE.MeshBasicMaterial({color:0x050706,transparent:true,opacity:.28,depthWrite:false}));contact.rotation.x=-Math.PI/2;contact.scale.y=.6;contact.position.y=.012;object.add(contact);}
  let weapon=null,shield=null,loadout={},profile=null,time=0,actionTime=0,action='idle',previewAction=null,previewDirection=null,disposed=false,relative=0,view='front',sourceView='front',secondary=0,lastYaw=0,geometryKey='';
  const point=new THREE.Vector3(),target=new THREE.Vector3(),rotation=new THREE.Quaternion(),yAxis=new THREE.Vector3(0,1,0);
  function setEquipment(next){
    const resolved=resolveRinneEquipment(next);
    if(resolved.weapon!==loadout.weapon){
      disposeRinneEquipment(weapon);weapon=null;profile=RINNE_EQUIPMENT_PROFILES[resolved.weapon]||null;
      if(profile){weapon=createRinneWeapon(THREE,resolved.weapon);sockets.gripFrame.add(weapon);weapon.position.set(0,0,0);
        sockets.weapon.quaternion.fromArray(profile.rotation);sockets.gripFrame.scale.setScalar(profile.scale);sockets.gripFrame.position.fromArray(profile.grip).multiplyScalar(-profile.scale);
        sockets.secondaryGripTarget.position.fromArray(profile.supportGrip);sockets.weaponHitboxAnchor.position.fromArray(profile.bladeBase);sockets.trailOrigin.position.fromArray(profile.bladeTip);
      }
    }
    if(resolved.shield!==loadout.shield){disposeRinneEquipment(shield);shield=null;if(resolved.shield){shield=createRinneWeapon(THREE,'shield');shield.scale.setScalar(.8);sockets.leftHand.add(shield);shield.position.set(0,0,.044);}}
    loadout=resolved;object.userData.equipment={...resolved};
  }
  setEquipment(equipment);
  function update({camera,delta=0,yaw=0,moving=false,speed=0,action:requested,attacking=false,hit=false,resting=false}={}){
    if(disposed||!camera)return;
    const dt=clamp(Number(delta)||0,0,.05);time+=dt;
    object.getWorldPosition(point);camera.getWorldPosition(target);
    const angle=Math.atan2(target.x-point.x,target.z-point.z);relative=wrap(angle-yaw);
    if(previewDirection){const directions=['s','sw','w','nw','n','ne','e','se'];relative=directions.indexOf(previewDirection)*Math.PI/4;}
    object.rotation.y=angle;
    const next=previewAction||requested||(hit?'hit':attacking?'attack':resting?'rest':moving?(speed>3?'run':'walk'):Math.abs(wrap(yaw-lastYaw))>.015?'turn':'idle');
    lastYaw=yaw;
    if(action!==next){action=CHARACTER25D_ACTIONS.includes(next)?next:'idle';actionTime=0;}else actionTime+=dt;
    view=character25dView(relative);sourceView=views[view]?view:view==='quarter'?'front':views.side?'side':'front';
    material.map=textures.get(views[sourceView]);
    // Opposite profile is an explicit mirrored approximation; missing rear art
    // remains reported as missing. It is never counted as authored coverage.
    const mirror=sourceView==='side'&&relative<0;
    material.map.repeat.x=mirror?-1:1;material.map.offset.x=mirror?1:0;
    const source=bundle.assets[views[sourceView]],viewWidth=h*source.width/source.height;
    const back=view==='back',flip=back?-1:1,sideView=sourceView==='side'?(relative>=0?'right':'left'):null;
    const nextGeometryKey=`${back}:${sideView}`;
    if(geometryKey!==nextGeometryKey){mesh.geometry.dispose();mesh.geometry=skinGeometry(THREE,rig,back,sideView);geometryKey=nextGeometryKey;}
    const positions=mesh.geometry.attributes.position;
    for(let i=0;i<positions.count;i++)positions.setX(i,((i%37)/36-.5)*viewWidth);
    positions.needsUpdate=true;
    rig.reset();
    for(const [name,sign]of [['right',-1],['left',1]]){
      bones[name+'UpperArm'].position.x=sideView?viewWidth*.02*(mirror?-1:1):sign*viewWidth*.28*flip;
      bones[name+'LowerArm'].position.x=sideView?-viewWidth*.05*(mirror?-1:1):sign*viewWidth*.025*flip;
      bones[name+'Hand'].position.x=sideView?-viewWidth*.05*(mirror?-1:1):sign*viewWidth*.025*flip;
      bones[name+'UpperLeg'].position.x=sign*viewWidth*.14*flip;
    }
    object.updateMatrixWorld(true);rig.skeleton.calculateInverses();
    mesh.bindMatrix.copy(object.matrixWorld);mesh.bindMatrixInverse.copy(object.matrixWorld).invert();
    const locomotion=action==='walk'||action==='run',stride=locomotion?Math.sin(time*(action==='run'?10:6))*(action==='run'?.55:.3):0;
    const attack=action==='attack'?Math.sin(clamp(actionTime/.65,0,1)*Math.PI):0;
    const recoil=action==='hit'?Math.sin(clamp(actionTime/.4,0,1)*Math.PI):0;
    const rest=action==='rest'?1:0;
    bones.torso.position.y=locomotion?Math.abs(stride)*.035:-rest*h*.044;
    bones.torso.rotation.z=recoil*.09;
    bones.head.rotation.z=Math.sin(time*1.8)*.008-recoil*.035;
    secondary+=(stride*.075+attack*.04-secondary)*(1-Math.exp(-8*dt));bones.head.rotation.y=secondary;
    bones.rightUpperLeg.rotation.x=stride-rest*.55;bones.leftUpperLeg.rotation.x=-stride-rest*.55;
    bones.rightUpperLeg.rotation.z=stride*.14;bones.leftUpperLeg.rotation.z=-stride*.14;
    bones.rightLowerLeg.rotation.x=Math.max(0,-stride)*.65+rest*1.1;bones.leftLowerLeg.rotation.x=Math.max(0,stride)*.65+rest*1.1;
    // Natural front/back hand order, changing through turn and the attack arc.
    const facing=Math.cos(relative),side=Math.sin(relative),two=Boolean(profile?.twoHanded);
    for(const [name,sign]of [['right',-1],['left',1]]){
      const upper=bones[name+'UpperArm'];upper.position.z=-sign*width*.18*side;
      const carry=two?viewWidth*.12:viewWidth*.32;
      const x=sideView?-viewWidth*.08*(mirror?-1:1):(sign*carry+(name==='right'?attack*viewWidth*.10:0))*flip;
      const z=-sign*carry*side+(.045+attack*.15)*(Math.cos(relative));
      target.set(x,h*((two?.61:.39)+attack*.04+rest*.035)+stride*sign*.018,z);
      rotation.setFromAxisAngle(yAxis,-relative);
      rotation.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),name==='right'?(-.18+attack*1.65):.12));
      if(two&&name==='right'){
        // Keep the primary wrist in the intersection of both arms' reach
        // spheres, with the asset's rotated support offset included.
        const support=new THREE.Vector3(...profile.supportGrip).sub(new THREE.Vector3(...profile.grip)).multiplyScalar(profile.scale).applyQuaternion(new THREE.Quaternion().fromArray(profile.rotation)).applyQuaternion(rotation);
        const other=bones.leftUpperArm.position.clone();other.z=width*.18*-side;
        const centers=[upper.position,other.sub(support)],reach=h*.24-.002;
        for(let pass=0;pass<12;pass++)for(const center of centers){const offset=target.clone().sub(center);if(offset.length()>reach)target.copy(center).add(offset.setLength(reach));}
      }
      rig.solveHand(name,target,rotation);
    }
    if(two){
      object.updateMatrixWorld(true);sockets.secondaryGripTarget.getWorldPosition(target);bones.torso.worldToLocal(target);
      rig.solveHand('left',target,bones.rightHand.quaternion);
    }
    material.color.setHex(action==='hit'?0xffdddd:0xffffff);
    object.updateMatrixWorld(true);rig.skeleton.update();
    object.userData.character25d={action,view,sourceView,missingView:!views[view]&&view!=='quarter',secondary,hybrid:true};
  }
  return {object,rig,sockets,update,setEquipment,
    setPreview(next=null,direction=null){previewAction=next;previewDirection=direction;},
    setOpacity(value){material.opacity=clamp(value,0,1);material.transparent=value<1;},
    getStatus:()=>`${action} · ${view}${sourceView!==view?'（推定表示）':''} · ${loadout.weapon||'素手'}`,
    snapshot(){object.updateMatrixWorld(true);const world=node=>node.getWorldPosition(new THREE.Vector3()).toArray();const actualGrip=weapon?weapon.localToWorld(new THREE.Vector3(...profile.grip)).toArray():null;return {action,view,sourceView,equipment:{...loadout},position:object.position.toArray(),hand:world(sockets.rightHand),actualGrip,offhand:world(sockets.leftHand),secondaryGrip:world(sockets.secondaryGripTarget),trail:world(sockets.trailOrigin),hitbox:world(sockets.weaponHitboxAnchor),twoHanded:!!profile?.twoHanded};},
    dispose(){if(disposed)return;disposed=true;object.removeFromParent();disposeRinneEquipment(weapon);disposeRinneEquipment(shield);mesh.geometry.dispose();material.dispose();rig.skeleton.dispose();contact?.geometry.dispose();contact?.material.dispose();for(const t of textures.values())t.dispose();textures.clear();},
  };
}
