import { THREE as T, GLTFLoader } from '@soul/rendering';
import { solveTwoBone } from './pose-transfer.js';
const ROOT='https://raw.githubusercontent.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0/672074b73ba276876a19e8816ecdc5241817ab47/addons/kaykit_character_pack_adventures/Assets/gltf/';
export const WEAPON_PROFILES=Object.freeze({
 greatsword:{file:'sword_2handed.gltf',scale:.50,grip:[0,-.025,0],support:[0,-.28,0],axis:'y'},
 sword:{file:'sword_1handed.gltf',scale:.50,grip:[0,-.035,0],axis:'y'},
 katana:{scale:.72,grip:[0,-.04,0],support:[0,-.215,0],axis:'y'},
 axe:{file:'axe_1handed.gltf',scale:.50,grip:[0,-.02,0],axis:'y'},
 greataxe:{file:'axe_2handed.gltf',scale:.55,grip:[0,.03,0],support:[0,-.30,0],axis:'y'},
 dagger:{file:'dagger.gltf',scale:.42,grip:[0,-.03,0],axis:'y'},
 crossbow:{file:'crossbow_2handed.gltf',scale:.52,grip:[0,-.09,.10],support:[0,-.035,.59],axis:'z'},
 staff:{file:'staff.gltf',scale:.62,grip:[0,-.12,0],support:[0,.38,0],axis:'y'},
 wand:{file:'wand.gltf',scale:.48,grip:[0,-.035,0],axis:'y'}
});
export const reviewWeaponIds=Object.freeze(Object.keys(WEAPON_PROFILES));
const vec=(...a)=>new T.Vector3(...a),rad=n=>n*Math.PI/180;
const smooth=x=>{x=T.MathUtils.clamp(x,0,1);return x*x*(3-2*x);};
function disposeObject(root){const gs=new Set(),ms=new Set(),ts=new Set();root.traverse(n=>{if(n.geometry)gs.add(n.geometry);for(const m of Array.isArray(n.material)?n.material:n.material?[n.material]:[]){ms.add(m);for(const v of Object.values(m))if(v?.isTexture)ts.add(v);}});gs.forEach(g=>g.dispose());ms.forEach(m=>m.dispose());ts.forEach(t=>t.dispose());root.removeFromParent();}
export function createKatana(){
 const root=new T.Group();root.name='ReviewKatana';const material=(color,metalness,roughness)=>new T.MeshStandardMaterial({color,metalness,roughness});
 const steel=material(0xdce5e7,.78,.22),dark=material(0x17191b,.15,.78),brass=material(0x6d5331,.65,.38),wrap=material(0x40352e,.05,.9);
 const handle=new T.Mesh(new T.CylinderGeometry(.026,.028,.28,12),dark);handle.position.y=-.102;root.add(handle);
 for(let i=0;i<7;i++){const band=new T.Mesh(new T.TorusGeometry(.028,.0035,5,12),wrap);band.rotation.x=Math.PI/2;band.position.y=-.223+i*.038;root.add(band);}
 const guard=new T.Mesh(new T.CylinderGeometry(.07,.07,.012,24),brass);guard.position.y=.044;root.add(guard);
 const shape=new T.Shape();shape.moveTo(-.020,.055);shape.quadraticCurveTo(-.008,.61,.026,1.06);shape.quadraticCurveTo(.038,1.16,.065,1.20);shape.lineTo(.076,1.055);shape.quadraticCurveTo(.033,.53,.024,.055);shape.closePath();
 const blade=new T.Mesh(new T.ExtrudeGeometry(shape,{depth:.01,bevelEnabled:true,bevelSize:.002,bevelThickness:.002,bevelSegments:1}),steel);blade.position.z=-.005;root.add(blade);
 root.traverse(n=>{if(n.isMesh){n.castShadow=true;n.receiveShadow=true;}});return root;
}
function setWorldQ(b,q){b.quaternion.copy(b.parent.getWorldQuaternion(new T.Quaternion()).invert()).multiply(q).normalize();b.updateWorldMatrix(false,true);}
function calibratedPalm(bones,side){
 const hand=bones[side+'Hand'],hp=hand.getWorldPosition(vec()),hq=hand.getWorldQuaternion(new T.Quaternion());
 const point=n=>bones[side+n]?.getWorldPosition(vec());
 const middle=point('MiddleProximal')||point('IndexProximal');if(!middle)throw new Error('Palm landmarks missing');
 const long=middle.sub(hp),across=point('IndexProximal').sub(point('LittleProximal'));
 const y=across.clone().normalize(),x=long.clone().normalize().addScaledVector(y,-long.clone().normalize().dot(y)).normalize(),z=x.clone().cross(y).normalize();
 const frame=new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(x,y,z));
 const center=hp.clone().addScaledVector(long,.66).addScaledVector(z,side==='right'?-.012:.012);
 const offset=hand.worldToLocal(center),rotation=hq.invert().multiply(frame);
 const fingerRest=new Map();
 for(const finger of ['Index','Middle','Ring','Little','Thumb'])for(const seg of ['Metacarpal','Proximal','Intermediate','Distal']){
  const b=bones[side+finger+seg];if(b)fingerRest.set(side+finger+seg,{b,q:b.quaternion.clone(),axis:y.clone().applyQuaternion(b.getWorldQuaternion(new T.Quaternion()).invert())});
 }
 return{hand,offset,rotation,fingerRest};
}

/** Measured anatomical sockets + explicit per-weapon grip/support definitions.
 * Late async completions cannot turn a hidden weapon back on or leak old models.
 */
export function installWeaponReviewPolish(body){
 const select=document.querySelector('#weapon-select');if(select&&![...select.options].some(o=>o.value==='katana'))select.add(new Option('刀','katana'),2);
 if(!body?.bones?.rightHand)return body;
 body.root.updateMatrixWorld(true);body.bones.rightHand.getObjectByName('ReviewWeaponSocket')?.removeFromParent();
 const palms={right:calibratedPalm(body.bones,'right'),left:calibratedPalm(body.bones,'left')};
 const socket=new T.Group();socket.name='ReviewWeaponPolishedSocket';socket.position.copy(palms.right.offset);socket.quaternion.copy(palms.right.rotation);palms.right.hand.add(socket);socket.visible=false;
 const roots=new Map(),pending=new Map(),loader=new GLTFLoader();let active=null,disposed=false,sequence=0;
 let config={enabled:false,id:'katana',scale:.5,x:0,y:0,z:0},signature='';
 const height=new T.Box3().setFromObject(body.root).getSize(vec()).y,unit=T.MathUtils.clamp(height/1.62,.7,1.35),flip=body.sourceVRM?.meta.metaVersion==='1'?-1:1;
 const toWorld=p=>body.root.localToWorld(vec(p.x*flip,p.y,p.z*flip));
 const toDir=p=>vec(p.x*flip,p.y,p.z*flip).applyQuaternion(body.root.getWorldQuaternion(new T.Quaternion())).normalize();
 const local=b=>{const p=body.root.worldToLocal(b.getWorldPosition(vec()));return vec(p.x*flip,p.y,p.z*flip);};
 async function get(id){
  if(roots.has(id))return roots.get(id);
  if(!pending.has(id))pending.set(id,(async()=>{let root;try{root=id==='katana'?createKatana():(await loader.loadAsync(ROOT+WEAPON_PROFILES[id].file)).scene;if(disposed){disposeObject(root);return null;}root.name='ReviewWeapon:'+id;root.visible=false;socket.add(root);roots.set(id,root);return root;}finally{pending.delete(id);}})());
  return pending.get(id);
 }
 body.setWeapon=async next=>{
  config={...config,...next};if(!WEAPON_PROFILES[config.id])config.id='katana';
  const key=JSON.stringify(config);if(key===signature)return;signature=key;const token=++sequence;
  socket.visible=false;if(disposed||!config.enabled){active=null;body.weaponDiagnostics=null;return;}
  const id=config.id;
  try{
    const root=await get(id);if(!root||disposed||token!==sequence||!config.enabled)return;
    const spec=WEAPON_PROFILES[id],scale=spec.scale*unit*T.MathUtils.clamp(config.scale/.5,.2,2);
    root.scale.setScalar(scale);root.position.fromArray(spec.grip).multiplyScalar(-scale);
    socket.quaternion.copy(palms.right.rotation).multiply(new T.Quaternion().setFromEuler(new T.Euler(rad(config.x),rad(config.y),rad(config.z))));
    for(const[k,n]of roots)n.visible=k===id;active=id;socket.visible=true;
  }catch(error){if(token===sequence){body.weaponError=String(error.message);throw error;}}
 };
 function curl(side){for(const[name,{b,q,axis}]of palms[side].fingerRest){const factor=name.includes('Thumb')?.45:name.endsWith('Intermediate')?1.15:name.endsWith('Distal')?.78:.55;b.quaternion.copy(q).multiply(new T.Quaternion().setFromAxisAngle(axis,factor));}}
 function handAt(side,palmPoint,palmQ){
  const p=palms[side],q=palmQ.clone().multiply(p.rotation.clone().invert());
  const scale=p.hand.getWorldScale(vec()),wrist=palmPoint.clone().sub(p.offset.clone().multiply(scale).applyQuaternion(q));
  const pole=toDir(vec(side==='left'?-.5:.5,-1,.12));
  solveTwoBone(body.bones[side+'UpperArm'],body.bones[side+'LowerArm'],p.hand,wrist,pole);setWorldQ(p.hand,q);curl(side);
 }
 function bladeQ(direction,axis){
  const y=axis==='z'?toDir(vec(0,1,0)):toDir(direction);
  const z=axis==='z'?toDir(direction):toDir(vec(0,0,1));
  const x=y.clone().cross(z).normalize();if(x.lengthSq()<.1)x.copy(toDir(vec(1,0,0)));
  if(axis==='z')y.copy(z.clone().cross(x).normalize());else z.copy(x.clone().cross(y).normalize());
  return new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(x,y,z));
 }
 const oldAfter=body.afterSample?.bind(body);
 body.afterSample=(time=0,clip='',state={})=>{
  oldAfter?.();if(!active||!socket.visible)return;
  const spec=WEAPON_PROFILES[active],meta=body.motionMeta?.get(clip),root=roots.get(active);let target,q;
  const shoulder=local(body.bones.rightUpperArm),hip=local(body.bones.hips),normal=state.mode==='normal';
  // Reference idle grips and the reviewed slash get dedicated pose constraints.
  // An explicitly mismatched motion remains visible and labelled, not silently replaced.
  if(clip==='通常 / 自然体'||clip==='Tidebreak / Idle'||meta?.kind==='ready'||meta?.kind==='slash'){
    if(normal){target=vec(.19*unit,hip.y+.04*unit,-.12*unit);q=bladeQ(vec(.12,-.48,-.87),spec.axis);}
    else {target=vec(.08*unit,shoulder.y-(active==='crossbow'?.13:.25)*unit,-(active==='crossbow'?.17:active==='staff'?.19:.28)*unit);q=bladeQ(active==='crossbow'?vec(0,0,-1):vec(.02,.68,-.73),spec.axis);}
    if(meta?.kind==='slash'&&!normal){
      const f=T.MathUtils.clamp(time/1.28,0,1),keys=[{t:0,p:[.08,-.25,-.28],d:[.02,.68,-.73]},{t:.25,p:[.25,.04,-.05],d:[.20,.95,.24]},{t:.49,p:[-.04,-.12,-.38],d:[-.72,-.12,-.68]},{t:.73,p:[-.27,-.31,-.17],d:[-.80,-.58,.12]},{t:1,p:[.08,-.25,-.28],d:[.02,.68,-.73]}];
      let i=keys.findIndex(k=>k.t>=f);if(i<1)i=1;const a=keys[i-1],b=keys[i],u=smooth((f-a.t)/(b.t-a.t));
      const p=vec(...a.p).lerp(vec(...b.p),u);target=vec(p.x*unit,shoulder.y+p.y*unit,p.z*unit);
      q=bladeQ(vec(...a.d),spec.axis).slerp(bladeQ(vec(...b.d),spec.axis),u);
    }
    handAt('right',toWorld(target),q);
  }
  body.root.updateMatrixWorld(true);curl('right');
  let supportError=null;
  if(spec.support&&!normal){
    const target=vec(...spec.support).applyMatrix4(root.matrixWorld),frame=socket.getWorldQuaternion(new T.Quaternion());
    if(spec.axis!=='z')frame.multiply(new T.Quaternion().setFromAxisAngle(vec(0,1,0),Math.PI));
    handAt('left',target,frame);body.root.updateMatrixWorld(true);
    supportError=palms.left.hand.localToWorld(palms.left.offset.clone()).distanceTo(target);
  }
  body.weaponDiagnostics={id:active,grip:spec.grip,support:spec.support||null,supportError,sourceScale:root.scale.x,pose:state.mode||'normal'};
 };
 body.weaponDiagnostics=null;
 const oldDispose=body.dispose?.bind(body);body.dispose=()=>{disposed=true;sequence++;for(const root of roots.values())disposeObject(root);roots.clear();socket.removeFromParent();oldDispose?.();};
 return body;
}
