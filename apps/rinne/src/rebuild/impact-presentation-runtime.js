const norm=value=>String(value||'').toLowerCase().replace(/[^a-z0-9]/g,'');
const boneCache=new WeakMap();
function findBone(root,names){let found=null;root?.traverse?.(node=>{if(found||!node.isBone)return;const key=norm(node.name);if(names.some(name=>key===name||key.endsWith(name)))found=node;});return found;}
function bonesFor(root){if(boneCache.has(root))return boneCache.get(root);const bones={
  hips:findBone(root,['hips','pelvis']),spine:findBone(root,['spine','chest']),head:findBone(root,['head']),
  leftUpperArm:findBone(root,['leftupperarm','upperarml']),rightUpperArm:findBone(root,['rightupperarm','upperarmr']),
  leftLowerArm:findBone(root,['leftlowerarm','lowerarml','leftforearm']),rightLowerArm:findBone(root,['rightlowerarm','lowerarmr','rightforearm']),
  leftUpperLeg:findBone(root,['leftupperleg','upperlegl']),rightUpperLeg:findBone(root,['rightupperleg','upperlegr']),
  leftLowerLeg:findBone(root,['leftlowerleg','lowerlegl']),rightLowerLeg:findBone(root,['rightlowerleg','lowerlegr'])};boneCache.set(root,bones);return bones;}
function actorRoot(scene,key){if(key==='hero')return scene.getObjectByName('Player');if(key.startsWith('enemy:'))return scene.getObjectByName(`Enemy:${key.slice(6)}`);return null;}
function saveRotation(list,bone){if(!bone||list.some(row=>row[0]===bone))return;list.push([bone,bone.rotation.x,bone.rotation.y,bone.rotation.z]);}
function add(list,bone,x=0,y=0,z=0){if(!bone)return;saveRotation(list,bone);bone.rotation.x+=x;bone.rotation.y+=y;bone.rotation.z+=z;}

function applyReaction(scene,row,restore){const root=actorRoot(scene,row.actorKey);if(!root)return;const bones=bonesFor(root),life=Math.max(0,Math.min(1,row.remaining/Math.max(.001,row.duration))),weight=(1-(1-life)*(1-life))*row.energy,worldYaw=Math.atan2(row.vector.x,row.vector.z),localYaw=worldYaw-(Number(root.rotation.y)||0),side=Math.sin(localYaw),forward=Math.cos(localYaw),kick=.22*weight;
  const rotations=[];restore.push(()=>{for(const [bone,x,y,z] of rotations)bone.rotation.set(x,y,z);});
  add(rotations,bones.spine,-forward*kick*.42,side*kick*.18,-side*kick*.72);add(rotations,bones.hips,forward*kick*.12,-side*kick*.18,side*kick*.12);
  if(row.part==='head'){add(rotations,bones.head,-forward*kick*.85,side*kick*.62,-side*kick*.75);add(rotations,bones.spine,-forward*kick*.28,0,-side*kick*.24);}
  else if(row.part==='leftArm'){add(rotations,bones.leftUpperArm,-kick*.72,side*kick*.32,-kick*.55);add(rotations,bones.leftLowerArm,-kick*.48,0,-side*kick*.2);}
  else if(row.part==='rightArm'){add(rotations,bones.rightUpperArm,-kick*.72,side*kick*.32,kick*.55);add(rotations,bones.rightLowerArm,-kick*.48,0,side*kick*.2);}
  else if(row.part==='leftLeg'){add(rotations,bones.leftUpperLeg,kick*.68,0,-side*kick*.18);add(rotations,bones.leftLowerLeg,-kick*.62,0,0);add(rotations,bones.hips,kick*.16,0,side*kick*.18);}
  else if(row.part==='rightLeg'){add(rotations,bones.rightUpperLeg,kick*.68,0,side*kick*.18);add(rotations,bones.rightLowerLeg,-kick*.62,0,0);add(rotations,bones.hips,kick*.16,0,-side*kick*.18);}
  else{add(rotations,bones.spine,-forward*kick*.48,side*kick*.2,-side*kick*.5);add(rotations,bones.head,forward*kick*.12,-side*kick*.12,side*kick*.18);}
}

export function createImpactPresentationRuntime({view,director}){
  const scene=view.scene,camera=view.camera,T=view.THREE,forward=new T.Vector3(),right=new T.Vector3(),up=new T.Vector3(0,1,0);let restore=[];
  function beforeRender(){
    const snap=director.snapshot();if(snap.hidden)return;const c=snap.camera;if(c.strength>1e-4||c.fov>1e-4){const position=camera.position.clone(),fov=camera.fov;restore.push(()=>{camera.position.copy(position);if(camera.fov!==fov){camera.fov=fov;camera.updateProjectionMatrix();}});camera.getWorldDirection(forward);forward.y=0;forward.normalize();right.crossVectors(forward,up).normalize();const screenX=c.x*right.x+c.z*right.z,screenY=c.x*forward.x+c.z*forward.z;camera.position.addScaledVector(right,-screenX*c.strength*1.35);camera.position.addScaledVector(forward,-screenY*c.strength*.58);camera.position.y+=c.strength*.26;if(c.fov>0){camera.fov=Math.max(34,fov-c.fov);camera.updateProjectionMatrix();}camera.updateMatrixWorld();}
    for(const row of snap.reactions)applyReaction(scene,row,restore);
  }
  function afterRender(){for(let i=restore.length-1;i>=0;i--)restore[i]();restore=[];camera.updateMatrixWorld();}
  function clear(){afterRender();boneCache.clear?.();}
  return{beforeRender,afterRender,clear};
}
