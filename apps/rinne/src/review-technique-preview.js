const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
const PHASES=new Set(['jo','ha','kyu']);
const COLORS=Object.freeze({jo:0x73bce5,ha:0xc7a15d,kyu:0xe27658});
const BURST_COLORS=Object.freeze({jo:0x9bd7f1,ha:0xe3c77f,kyu:0xffb08e});

function makeMaterial(THREE,color){
  return new THREE.MeshBasicMaterial({color,transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending});
}
function createEffect(THREE,parent){
  const root=new THREE.Group();root.name='ReviewTechniquePreview';root.visible=false;parent.add(root);
  const materials={ring:makeMaterial(THREE,0xc7a15d),arc:makeMaterial(THREE,0xe3c77f),burst:makeMaterial(THREE,0x73bce5)};
  const ring=new THREE.Mesh(new THREE.RingGeometry(.48,.64,48),materials.ring);ring.rotation.x=-Math.PI/2;ring.position.y=.035;
  const arc=new THREE.Mesh(new THREE.TorusGeometry(.86,.052,7,40,Math.PI*1.42),materials.arc);arc.position.y=1.02;arc.rotation.z=-.75;
  const burst=new THREE.Mesh(new THREE.RingGeometry(.12,.34,40),materials.burst);burst.position.y=.98;
  root.add(ring,arc,burst);return{root,ring,arc,burst,materials};
}
function progress(preview,time){
  if(!preview)return null;
  const t=(time-preview.startedAt)/preview.duration;
  return t<0?0:t>=1?null:clamp(t,0,1);
}
function poseWeight(phase){return phase==='kyu'?1.2:phase==='ha'?1.04:.9;}
function applyPoseVariant(bones,preview,strike){
  const weight=poseWeight(preview.phase),variant=preview.variant;
  if(variant===0){if(bones.spine){bones.spine.rotation.y+=.52*strike*weight;bones.spine.rotation.z-=.12*strike;}if(bones.rightUpperArm){bones.rightUpperArm.rotation.x-=.72*strike*weight;bones.rightUpperArm.rotation.z-=.48*strike;}if(bones.leftUpperArm)bones.leftUpperArm.rotation.z+=.2*strike;}
  else if(variant===1){if(bones.spine){bones.spine.rotation.x+=.16*strike;bones.spine.rotation.y-=.28*strike*weight;}if(bones.rightUpperArm){bones.rightUpperArm.rotation.x-=1.02*strike*weight;bones.rightUpperArm.rotation.y+=.18*strike;}if(bones.rightLowerArm)bones.rightLowerArm.rotation.x-=.42*strike;}
  else{if(bones.spine){bones.spine.rotation.x-=.12*strike;bones.spine.rotation.y+=.2*strike;}if(bones.rightUpperArm){bones.rightUpperArm.rotation.x-=1.25*strike*weight;bones.rightUpperArm.rotation.z+=.26*strike;}if(bones.leftUpperArm)bones.leftUpperArm.rotation.x-=.36*strike;}
  if(bones.hips)bones.hips.rotation.y-=.18*strike*weight;if(bones.rightUpperLeg)bones.rightUpperLeg.rotation.x-=.12*strike;if(bones.leftUpperLeg)bones.leftUpperLeg.rotation.x+=.08*strike;
}
function updateEffect(effect,preview,t,actor){
  effect.root.visible=true;effect.root.position.copy(actor.root.position);effect.root.rotation.y=actor.root.rotation.y;
  const pulse=Math.sin(Math.PI*t),fade=Math.pow(1-t,.72);
  effect.ring.scale.setScalar(.72+t*1.35);effect.materials.ring.opacity=.58*fade;
  effect.arc.rotation.z=-.9+t*2.2+preview.variant*.24;effect.arc.scale.setScalar(.78+pulse*.52);effect.materials.arc.opacity=.88*pulse;
  effect.burst.scale.setScalar(.7+t*1.7);effect.materials.burst.opacity=.78*pulse*fade;
}
function disposeEffect(effect){
  effect.root.removeFromParent();
  for(const node of [effect.ring,effect.arc,effect.burst])node.geometry.dispose();
  for(const material of Object.values(effect.materials))material.dispose();
}

export function createReviewTechniquePreview({THREE,parent,canvas,getActor}){
  const effect=createEffect(THREE,parent);let preview=null;
  function clear(){preview=null;effect.root.visible=false;for(const material of Object.values(effect.materials))material.opacity=0;}
  function trigger({id='',name='技',phase='jo'}={}){
    const selected=PHASES.has(phase)?phase:'jo';
    preview={id:String(id||''),name:String(name||'技'),phase:selected,startedAt:performance.now()/1000,duration:1.22,variant:Math.floor(Math.random()*3)};
    effect.materials.ring.color.setHex(COLORS[selected]);effect.materials.arc.color.setHex(COLORS[selected]);effect.materials.burst.color.setHex(BURST_COLORS[selected]);
    effect.root.visible=true;canvas.dataset.reviewTechnique=preview.name;canvas.dataset.reviewTechniquePhase=selected;
    return Object.freeze({durationMs:Math.round(preview.duration*1000),impactDelayMs:selected==='kyu'?390:selected==='ha'?330:285});
  }
  function offsetRoot(root,yaw,time){
    const t=progress(preview,time);if(t==null||!preview)return;
    const lunge=Math.sin(Math.PI*t)*(preview.phase==='kyu'?.34:preview.phase==='ha'?.27:.21);root.position.x+=Math.sin(yaw)*lunge;root.position.z+=Math.cos(yaw)*lunge;
  }
  function applyPose(bones,time){const t=progress(preview,time);if(t==null||!preview)return;applyPoseVariant(bones,preview,Math.sin(Math.PI*t));}
  function update(time){
    const t=progress(preview,time),actor=getActor?.();if(t==null){if(preview)clear();else effect.root.visible=false;return;}if(!actor){effect.root.visible=false;return;}updateEffect(effect,preview,t,actor);
  }
  return Object.freeze({trigger,clear,offsetRoot,applyPose,update,dispose(){clear();disposeEffect(effect);}});
}
