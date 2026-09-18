const norm=value=>String(value||'').toLowerCase().replace(/[^a-z0-9]/g,'');
const aliases=Object.freeze({hips:['hips'],spine:['spine'],lu:['upperlegl','leftupperleg'],ru:['upperlegr','rightupperleg'],la:['upperarml','leftupperarm'],ra:['upperarmr','rightupperarm'],ll:['lowerarml','leftlowerarm'],rl:['lowerarmr','rightlowerarm']});
function findBones(root){const found={};root?.traverse?.(node=>{if(!node.isBone)return;const key=norm(node.name);for(const [name,names] of Object.entries(aliases))if(!found[name]&&names.some(alias=>key===alias||key.endsWith(alias)))found[name]=node;});return found;}
function snapshot(root,bones){return{root,rootX:root.rotation.x,rootZ:root.rotation.z,bones:Object.values(bones).filter(Boolean).map(bone=>[bone,bone.rotation.x,bone.rotation.y,bone.rotation.z])};}
function applyStance(bones,id){
  if(id==='chinshin'){if(bones.hips)bones.hips.rotation.x+=.1;if(bones.spine)bones.spine.rotation.x+=.08;if(bones.lu)bones.lu.rotation.x+=.18;if(bones.ru)bones.ru.rotation.x+=.18;if(bones.la)bones.la.rotation.z-=.08;if(bones.ra)bones.ra.rotation.z+=.08;}
  else if(id==='ryu'){if(bones.spine)bones.spine.rotation.z+=.08;if(bones.hips)bones.hips.rotation.y-=.08;if(bones.la)bones.la.rotation.x-=.12;if(bones.ra)bones.ra.rotation.x+=.18;}
  else if(id==='kosei'){if(bones.spine)bones.spine.rotation.x-=.14;if(bones.hips)bones.hips.rotation.x-=.05;if(bones.la)bones.la.rotation.x-=.24;if(bones.ra)bones.ra.rotation.x-=.31;if(bones.ll)bones.ll.rotation.x-=.18;if(bones.rl)bones.rl.rotation.x-=.24;}
  else{if(bones.spine)bones.spine.rotation.x-=.06;if(bones.la)bones.la.rotation.x-=.12;if(bones.ra)bones.ra.rotation.x-=.16;}
}
function applyZanshin(bones,id,intensity){
  if(intensity<=0)return;
  if(id==='breath'){if(bones.spine)bones.spine.rotation.x+=.08*intensity;if(bones.la)bones.la.rotation.z-=.12*intensity;if(bones.ra)bones.ra.rotation.z+=.12*intensity;}
  else if(id==='pursuit'){if(bones.spine)bones.spine.rotation.x-=.12*intensity;if(bones.lu)bones.lu.rotation.x-=.12*intensity;if(bones.ru)bones.ru.rotation.x+=.08*intensity;}
  else if(id==='guard'){if(bones.la)bones.la.rotation.x-=.3*intensity;if(bones.ra)bones.ra.rotation.x-=.3*intensity;if(bones.ll)bones.ll.rotation.x-=.22*intensity;if(bones.rl)bones.rl.rotation.x-=.22*intensity;}
  else if(bones.spine)bones.spine.rotation.x-=.04*intensity;
}
export function createCombatPoseRuntime(view){
  let cachedRoot=null,cachedBones=null,pose=null;
  function resolve(){const root=view.scene.getObjectByName('Player');if(root!==cachedRoot){cachedRoot=root;cachedBones=findBones(root);}return root;}
  function apply(state){
    if(!state?.combat||state.down||state.ended)return;const root=resolve();if(!root)return;const bones=cachedBones||{},body=state.combatLoadout?.body||{};pose=snapshot(root,bones);applyStance(bones,body.stance||'seigan');const intensity=Math.min(1,(Number(state.combat.zanshinSeconds)||0)/.58);applyZanshin(bones,body.zanshin||'still',intensity);
  }
  function restore(){if(!pose)return;pose.root.rotation.x=pose.rootX;pose.root.rotation.z=pose.rootZ;for(const [bone,x,y,z] of pose.bones)bone.rotation.set(x,y,z);pose=null;}
  return{apply,restore};
}
