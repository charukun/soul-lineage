import * as T from '../vendor/three.js';
import {GLTFLoader} from '../vendor/GLTFLoader.js';

const REVISION='672074b73ba276876a19e8816ecdc5241817ab47';
const ROOT=`https://raw.githubusercontent.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0/${REVISION}/addons/kaykit_character_pack_adventures/Characters/gltf/`;
export const COMPACT_PERFORMANCE_MODEL=Object.freeze({
  id:'motion-library.knight',label:'Knight / デフォルメ',file:'Knight.glb',repository:'KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0',revision:REVISION,license:'CC0-1.0'
});
export const COMPACT_PERFORMANCE_REVISION='compact-performance-1';

const clamp=x=>Math.min(1,Math.max(0,x));
const key=name=>String(name||'').toLowerCase().replace(/[^a-z0-9]/g,'');
const attackOrder=['slash','back','thrust','uppercut','heavy','sweep','round','leap','dash'];
function findNode(root,aliases){
  const wanted=aliases.map(key),nodes=[];root.traverse(node=>nodes.push(node));
  return nodes.find(node=>wanted.includes(key(node.name)))||nodes.find(node=>wanted.some(alias=>key(node.name).endsWith(alias)))||null;
}
function one(rows){return rows?.[0]||null;}
function choose(groups,performance){
  const e=performance.event,step=performance.directionalStep?.kind||e.step||'',speed=Math.hypot(performance.vx||0,performance.vz||0);
  if(e.kind==='draw')return one(groups.draw)||one(groups.idle);
  if(e.kind==='sheathe')return one(groups.sheathe)||one(groups.idle);
  if(e.kind==='move'){
    if(step.startsWith('back'))return one(groups.back)||one(groups.walk)||one(groups.run)||one(groups.idle);
    if(step.includes('left'))return one(groups.left)||one(groups.walk)||one(groups.run)||one(groups.idle);
    if(step.includes('right'))return one(groups.right)||one(groups.walk)||one(groups.run)||one(groups.idle);
    return speed>2?one(groups.run)||one(groups.walk)||one(groups.idle):one(groups.walk)||one(groups.run)||one(groups.idle);
  }
  if(e.phrase||attackOrder.includes(e.kind)){
    const rows=groups.attack.length?groups.attack:groups.action;
    if(rows.length){const i=Math.max(0,attackOrder.indexOf(e.kind));return rows[i%rows.length];}
  }
  return one(groups.idle)||performance.event&&one(groups.action);
}
function makeFrame(position,direction,scale){
  const y=direction.clone();if(y.lengthSq()<1e-8)y.set(0,1,0);y.normalize();
  const helper=Math.abs(y.y)>.92?new T.Vector3(0,0,1):new T.Vector3(0,1,0),x=helper.clone().cross(y).normalize(),z=x.clone().cross(y).normalize();
  const m=new T.Matrix4().makeBasis(x,y,z);m.setPosition(position);m.scale(new T.Vector3(scale,scale,scale));return m;
}
function blendFrame(a,b,t){
  const pa=new T.Vector3(),qa=new T.Quaternion(),sa=new T.Vector3(),pb=new T.Vector3(),qb=new T.Quaternion(),sb=new T.Vector3();
  a.decompose(pa,qa,sa);b.decompose(pb,qb,sb);return new T.Matrix4().compose(pa.lerp(pb,t),qa.slerp(qb,t),sa.lerp(sb,t));
}

/**
 * Review-only adapter for the already-audited compact KayKit character.
 * It consumes the same PERFORMANCE_EVENTS/sample state as the humanoid viewer,
 * while using the character's own embedded rig/animation bank. Combat ownership,
 * hit clocks, learning and saved technique recipes are intentionally untouched.
 */
export class CompactPerformanceRuntime{
  constructor(scene){this.scene=scene;this.ready=false;this.root=null;this.model=null;this.mixer=null;this.actions=new Map();this.groups=null;this.bones={};this.restRoots=[];this.sourceHeight=1;}
  async load(){
    if(this.ready)return this;
    const gltf=await new GLTFLoader().loadAsync(ROOT+COMPACT_PERFORMANCE_MODEL.file),model=gltf.scene;
    model.updateMatrixWorld(true);const box=new T.Box3().setFromObject(model),height=Math.max(.001,box.max.y-box.min.y),root=new T.Group();
    model.position.y=-box.min.y;root.add(model);root.scale.setScalar(2.02/height);this.scene.add(root);root.visible=false;root.updateMatrixWorld(true);
    this.root=root;this.model=model;this.sourceHeight=height;this.mixer=new T.AnimationMixer(model);
    const clips=gltf.animations||[],named=re=>clips.filter(clip=>re.test(String(clip.name||'')));
    this.groups={
      idle:named(/idle|stand|breath/i),walk:named(/walk|move/i),run:named(/run|sprint|jog/i),
      back:named(/back|backward|retreat/i),left:named(/(?:strafe|step|dodge|walk|run).*left|left.*(?:strafe|step|dodge)/i),right:named(/(?:strafe|step|dodge|walk|run).*right|right.*(?:strafe|step|dodge)/i),
      draw:named(/draw|unsheath|equip/i),sheathe:named(/sheath|holster|unequip/i),
      attack:named(/attack|slash|sword|melee|chop|strike|swing/i),action:clips.filter(clip=>!/idle|walk|run|sprint|jog|death|die/i.test(String(clip.name||'')))
    };
    this.bones={
      hips:findNode(model,['hips','pelvis','mixamorighips','root']),head:findNode(model,['head','mixamorighead']),
      rightHand:findNode(model,['righthand','handr','rhand','mixamorigrighthand']),rightLowerArm:findNode(model,['rightforearm','lowerarmr','forearmr','mixamorigrightforearm'])
    };
    const candidates=[];model.traverse(node=>{const n=key(node.name);if(node.isBone&&(n==='root'||n.includes('hips')||n.includes('pelvis')))candidates.push({node,p:node.position.clone()});});this.restRoots=candidates;
    this.ready=true;return this;
  }
  setVisible(visible){if(this.root)this.root.visible=visible;}
  focus(handDetail=false){const node=handDetail?this.bones.rightHand:this.bones.head||this.bones.hips;if(node)return node.getWorldPosition(new T.Vector3());return this.root?.getWorldPosition(new T.Vector3()).add(new T.Vector3(0,1.15,.2))||new T.Vector3(0,1.15,.2);}
  sample(performance,weaponSpec={base:.21,tip:1.62}){
    if(!this.ready)throw Error('Compact performance model is not ready');
    const clip=choose(this.groups,performance);
    for(const action of this.actions.values()){action.enabled=false;action.setEffectiveWeight(0);}
    if(clip){
      let action=this.actions.get(clip.uuid);if(!action){action=this.mixer.clipAction(clip);this.actions.set(clip.uuid,action);action.play();}
      action.enabled=true;action.paused=false;action.setEffectiveWeight(1);action.setEffectiveTimeScale(0);
      const local=performance.time-performance.event.start,attack=performance.event.phrase||attackOrder.includes(performance.event.kind);
      action.time=attack||performance.event.kind==='draw'||performance.event.kind==='sheathe'?clamp(performance.phase)*Math.max(.001,clip.duration):((local%Math.max(.001,clip.duration))+clip.duration)%clip.duration;
      this.mixer.update(0);
    }
    for(const row of this.restRoots){row.node.position.x=row.p.x;row.node.position.z=row.p.z;}
    const step=performance.directionalStep,side=step?.kind?.includes('left')?.06:step?.kind?.includes('right')?-.06:0;
    this.root.position.set(performance.x,(step?.pelvisY||0)*.45,performance.z);this.root.rotation.set((step?.lean||0)*.55,performance.yaw,side*Math.sin(Math.PI*(performance.phase||0)),'YXZ');this.root.updateMatrixWorld(true);
    const hips=(this.bones.hips||this.model).getWorldPosition(new T.Vector3()),hand=(this.bones.rightHand||this.bones.head||this.model).getWorldPosition(new T.Vector3()),fore=(this.bones.rightLowerArm||this.bones.hips||this.model).getWorldPosition(new T.Vector3());
    const drawn=makeFrame(hand,hand.clone().sub(fore),.56),carry=makeFrame(hips.clone().add(new T.Vector3(-.22,.08,-.08).applyAxisAngle(new T.Vector3(0,1,0),performance.yaw)),new T.Vector3(.08,-.88,.46).applyAxisAngle(new T.Vector3(0,1,0),performance.yaw),.56),sm=blendFrame(carry,drawn,clamp(performance.weaponDraw??1));
    const base=new T.Vector3(0,weaponSpec.base,0).applyMatrix4(sm),tip=new T.Vector3(0,weaponSpec.tip,0).applyMatrix4(sm),active=!!performance.attack&&performance.phase>=.35&&performance.phase<=.66;
    return {sm:sm.toArray(),weaponBase:base.toArray(),weaponTip:tip.toArray(),active,attachment:(performance.weaponDraw??1)>.5?'rightHand':'hips',clip:clip?.name||'embedded fallback',label:`${performance.event.label} · ${clip?.name||'静止'}`};
  }
  dispose(){if(this.mixer){this.mixer.stopAllAction();this.mixer.uncacheRoot(this.model);}this.root?.removeFromParent();this.model?.traverse(node=>{node.geometry?.dispose();for(const material of Array.isArray(node.material)?node.material:node.material?[node.material]:[])material?.dispose?.();});this.ready=false;}
}
