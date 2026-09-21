import {Quaternion} from 'three';
import {createHumanoidPreview} from '@soul/rendering/humanoid-preview';
import {loadPinnedMotionSource} from './review-motion-source-runtime.js';
import {MOTION_LIBRARY_SOURCE_BY_ID} from './review-motion-sources.js';
import {createAuthoredEffectPlayer} from './rebuild/authored-effect-player.js';
import {REVIEW_AUTHORED_EFFECTS} from './rebuild/authored-effect-manifest.js';
import {authoredEffectBase,createEffekseerBackend} from './rebuild/effekseer-loader.js';
import {combatEffectBudget} from './rebuild/combat-effect-cues.js';

const clamp=(value,lo=0,hi=1)=>Math.max(lo,Math.min(hi,Number(value)||0));
const smooth=value=>{const t=clamp(value);return t*t*(3-2*t);};
const ATTACK_SWEEP=new Set(['slash','back','crosscut','spin','round','sweep','diagonal','katanaKesa','katanaDraw','katanaReturn','spearwheel']);
const ATTACK_THRUST=new Set(['thrust','pierce','dash','bullrush','katanaThrust','sky']);

export const INSPIRATION_MOTION_SELECTIONS=Object.freeze({
  evade:Object.freeze({sourceId:'kaykit-movement-advanced',left:'Dodge_Left',right:'Dodge_Right'}),
  combat:Object.freeze({
    sourceId:'kaykit-combat-melee',hold:'Melee_Blocking',flinch:'Melee_Block_Hit',
    oneHandSlice:'Melee_1H_Attack_Slice_Diagonal',oneHandSweep:'Melee_1H_Attack_Slice_Horizontal',oneHandThrust:'Melee_1H_Attack_Stab',
    twoHandSlice:'Melee_2H_Attack_Slice',twoHandSweep:'Melee_2H_Attack_Spin',twoHandThrust:'Melee_2H_Attack_Stab',fist:'Melee_Unarmed_Attack_Punch_A'
  }),
  reaction:Object.freeze({sourceId:'kaykit-general',light:'Hit_A',heavy:'Hit_B'})
});
export const INSPIRATION_VFX_SELECTIONS=Object.freeze({
  insight:'lib-tktk01-light1',
  trail:'slash',
  impact:'impact',
  debris:'lib-effectmaterials-parts-hit01'
});

function sourceClip(sourceId,name){
  const source=MOTION_LIBRARY_SOURCE_BY_ID[sourceId],row=source?.clips?.find(clip=>clip.name===name);
  if(!source||!row)throw new Error(`Missing Visual Review motion source clip: ${sourceId}/${name}`);
  return Object.freeze({sourceId,index:row.index,name});
}
const CLIPS=Object.freeze({
  evadeLeft:sourceClip(INSPIRATION_MOTION_SELECTIONS.evade.sourceId,INSPIRATION_MOTION_SELECTIONS.evade.left),
  evadeRight:sourceClip(INSPIRATION_MOTION_SELECTIONS.evade.sourceId,INSPIRATION_MOTION_SELECTIONS.evade.right),
  hold:sourceClip(INSPIRATION_MOTION_SELECTIONS.combat.sourceId,INSPIRATION_MOTION_SELECTIONS.combat.hold),
  flinch:sourceClip(INSPIRATION_MOTION_SELECTIONS.combat.sourceId,INSPIRATION_MOTION_SELECTIONS.combat.flinch),
  oneHandSlice:sourceClip(INSPIRATION_MOTION_SELECTIONS.combat.sourceId,INSPIRATION_MOTION_SELECTIONS.combat.oneHandSlice),
  oneHandSweep:sourceClip(INSPIRATION_MOTION_SELECTIONS.combat.sourceId,INSPIRATION_MOTION_SELECTIONS.combat.oneHandSweep),
  oneHandThrust:sourceClip(INSPIRATION_MOTION_SELECTIONS.combat.sourceId,INSPIRATION_MOTION_SELECTIONS.combat.oneHandThrust),
  twoHandSlice:sourceClip(INSPIRATION_MOTION_SELECTIONS.combat.sourceId,INSPIRATION_MOTION_SELECTIONS.combat.twoHandSlice),
  twoHandSweep:sourceClip(INSPIRATION_MOTION_SELECTIONS.combat.sourceId,INSPIRATION_MOTION_SELECTIONS.combat.twoHandSweep),
  twoHandThrust:sourceClip(INSPIRATION_MOTION_SELECTIONS.combat.sourceId,INSPIRATION_MOTION_SELECTIONS.combat.twoHandThrust),
  fist:sourceClip(INSPIRATION_MOTION_SELECTIONS.combat.sourceId,INSPIRATION_MOTION_SELECTIONS.combat.fist),
  hitA:sourceClip(INSPIRATION_MOTION_SELECTIONS.reaction.sourceId,INSPIRATION_MOTION_SELECTIONS.reaction.light),
  hitB:sourceClip(INSPIRATION_MOTION_SELECTIONS.reaction.sourceId,INSPIRATION_MOTION_SELECTIONS.reaction.heavy)
});
export const INSPIRATION_MOTION_CLIPS=CLIPS;

export function inspirationAttackClipName(weapon='sword',steps=[]){
  const kind=String(steps?.find(step=>step?.kind)?.kind||'slash'),twoHand=['great','axe','spear','staff'].includes(weapon);
  if(weapon==='fist')return INSPIRATION_MOTION_SELECTIONS.combat.fist;
  if(ATTACK_THRUST.has(kind))return twoHand?INSPIRATION_MOTION_SELECTIONS.combat.twoHandThrust:INSPIRATION_MOTION_SELECTIONS.combat.oneHandThrust;
  if(ATTACK_SWEEP.has(kind))return twoHand?INSPIRATION_MOTION_SELECTIONS.combat.twoHandSweep:INSPIRATION_MOTION_SELECTIONS.combat.oneHandSweep;
  return twoHand?INSPIRATION_MOTION_SELECTIONS.combat.twoHandSlice:INSPIRATION_MOTION_SELECTIONS.combat.oneHandSlice;
}
function attackClip(weapon,steps){
  const name=inspirationAttackClipName(weapon,steps);
  return Object.values(CLIPS).find(row=>row.name===name)||CLIPS.oneHandSlice;
}
function poseQuat(values){return new Quaternion().fromArray(values).normalize();}
export function blendInspirationPose(a,b,t=.5){
  if(!a)return b;if(!b)return a;const u=smooth(t),slots=new Set([...Object.keys(a.rotations||{}),...Object.keys(b.rotations||{})]),rotations={};
  for(const slot of slots){
    const av=a.rotations?.[slot],bv=b.rotations?.[slot];
    if(av&&bv)rotations[slot]=poseQuat(av).slerp(poseQuat(bv),u).toArray();
    else rotations[slot]=[...(bv||av)];
  }
  const hips=[0,1,2].map(i=>(Number(a.hips?.[i])||0)+((Number(b.hips?.[i])||0)-(Number(a.hips?.[i])||0))*u);
  return{...b,space:b.space||a.space,rotations,hips,profile:b.profile||a.profile,bindingStatus:b.bindingStatus||a.bindingStatus};
}
const sample=(source,clip,ratio)=>source.sample(clip.index,source.duration(clip.index)*clamp(ratio));
function safeTarget(root){try{return createHumanoidPreview(root,{role:'target'});}catch{return null;}}
function applyPreservingRoot(adapter,pose){
  if(!adapter||!pose)return false;const root=adapter.root,position=root.position.clone(),quaternion=root.quaternion.clone(),scale=root.scale.clone();
  const result=adapter.apply(pose,{rootMotion:'locked',mode:'preview'});root.position.copy(position);root.quaternion.copy(quaternion);root.scale.copy(scale);root.updateMatrixWorld(true);
  return Boolean(result?.applied);
}

export async function createInspirationMotionLab({heroRoot,enemyRoots=[]}={}){
  const adapters={hero:safeTarget(heroRoot),enemies:enemyRoots.map(safeTarget)};
  const ids=[INSPIRATION_MOTION_SELECTIONS.evade.sourceId,INSPIRATION_MOTION_SELECTIONS.combat.sourceId,INSPIRATION_MOTION_SELECTIONS.reaction.sourceId];
  const settled=await Promise.allSettled(ids.map(id=>loadPinnedMotionSource(id,{preview:true}))),sources={};
  settled.forEach((row,index)=>{if(row.status==='fulfilled')sources[ids[index]]=row.value;});
  const evade=sources[INSPIRATION_MOTION_SELECTIONS.evade.sourceId],combat=sources[INSPIRATION_MOTION_SELECTIONS.combat.sourceId],reaction=sources[INSPIRATION_MOTION_SELECTIONS.reaction.sourceId];
  function heroPose(sequence,{side=1,weapon='sword',steps=[]}={}){
    if(!sequence||sequence.stage==='done'||!evade||!combat)return null;
    const dodge=side<0?CLIPS.evadeLeft:CLIPS.evadeRight,attack=attackClip(weapon,steps),stage=sequence.stage,elapsed=Number(sequence.elapsed)||0;
    const dodgeEnd=sample(evade,dodge,.72),hold=sample(combat,CLIPS.hold,.28+((elapsed*.13)%1)*.22);
    if(stage==='premonition')return sample(evade,dodge,.08+.64*clamp((sequence.nearMiss||0)));
    if(stage==='camera')return blendInspirationPose(dodgeEnd,hold,sequence.progress);
    if(['spacing','stagger','silence'].includes(stage))return hold;
    const strike=sample(combat,attack,.04+.92*clamp(sequence.executeProgress||0));
    if(stage==='execute'&&(sequence.executeProgress||0)<.18)return blendInspirationPose(hold,strike,(sequence.executeProgress||0)/.18);
    if(stage==='impact')return sample(combat,attack,.72);
    if(stage==='reveal')return sample(combat,attack,.88+.09*sequence.progress);
    if(stage==='afterglow')return sample(combat,attack,.97+.03*sequence.progress);
    return strike;
  }
  function enemyPose(sequence,index=0){
    if(!sequence||sequence.stage==='done'||sequence.stage==='premonition'||!combat)return null;
    const stage=sequence.stage,elapsed=Number(sequence.elapsed)||0,hold=sample(combat,CLIPS.hold,.34+((elapsed*.11)%1)*.18);
    if(stage==='camera')return blendInspirationPose(sample(combat,CLIPS.flinch,.62),hold,sequence.progress);
    if(['spacing','stagger','silence','execute'].includes(stage))return hold;
    if(!reaction)return hold;
    const hit=sample(reaction,index%2?CLIPS.hitA:CLIPS.hitB,stage==='impact'?.12+.80*sequence.progress:.96);
    if(stage==='afterglow')return blendInspirationPose(hit,hold,sequence.progress);
    return hit;
  }
  return Object.freeze({
    ready:Boolean(adapters.hero&&evade&&combat),
    sources:Object.freeze({evade:Boolean(evade),combat:Boolean(combat),reaction:Boolean(reaction)}),
    applyHero(sequence,options){return applyPreservingRoot(adapters.hero,heroPose(sequence,options));},
    applyEnemy(sequence,index=0){return applyPreservingRoot(adapters.enemies[index],enemyPose(sequence,index));},
    reset(){adapters.hero?.reset?.();for(const adapter of adapters.enemies)adapter?.reset?.();}
  });
}

const VFX_SCOPE_STATE=Object.freeze({id:'rinne-inspiration-review',zone:'review-battle',phase:'alive',interior:null,position:{x:0,y:0,z:0}});
const VFX_SCOPE_FRONT=Object.freeze({stage:1,enemies:[]});
function cue(effect,position,rotation,{scale=1,lifetime=1,priority=2,followKey=null,color=[255,239,198,255]}={}){
  return{effect,position:{x:position.x,y:position.y,z:position.z},rotation:{x:rotation.x||0,y:rotation.y||0,z:rotation.z||0},scale,lifetime,priority,followKey,color,kind:'inspiration-choreography'};
}
export async function createInspirationVfxLab({renderer,document,onError=()=>{}}={}){
  const abort=new AbortController(),mobile=Boolean(globalThis.matchMedia?.('(pointer: coarse)').matches),player=createAuthoredEffectPlayer({mobile,onError});
  const ids=Object.values(INSPIRATION_VFX_SELECTIONS);player.prefetch(ids.map((effect,index)=>({effect,priority:200-index})));
  try{
    const backend=await createEffekseerBackend({renderer,document,baseUrl:authoredEffectBase(document),signal:abort.signal,budget:combatEffectBudget(0,mobile,false),effectDefinitions:REVIEW_AUTHORED_EFFECTS,streaming:true,fallbackEffects:['slash','impact'],maxResident:8,retentionMs:20_000});
    player.attach(backend);
  }catch(error){player.fail(error);}
  let anchors=null;
  return Object.freeze({
    snapshot:player.snapshot,
    frame(dt,nextAnchors){anchors=nextAnchors||anchors;player.frame(VFX_SCOPE_STATE,VFX_SCOPE_FRONT,Math.max(1/240,Math.min(.05,Number(dt)||1/60)),{level:0,reduced:false,hidden:false,anchors});},
    insight(position,rotation={x:0,y:0,z:0}){player.presentCues([cue(INSPIRATION_VFX_SELECTIONS.insight,position,rotation,{scale:.11,lifetime:.72,priority:2,followKey:'hero'})]);},
    trail(position,rotation={x:0,y:0,z:0}){player.presentCues([cue(INSPIRATION_VFX_SELECTIONS.trail,position,rotation,{scale:.78,lifetime:.82,priority:2,followKey:'hero'})]);},
    hit(position,rotation={x:0,y:0,z:0}){player.presentCues([
      cue(INSPIRATION_VFX_SELECTIONS.impact,position,rotation,{scale:1.08,lifetime:1.05,priority:3,color:[255,246,220,255]}),
      cue(INSPIRATION_VFX_SELECTIONS.debris,position,rotation,{scale:.24,lifetime:.78,priority:2,color:[255,220,150,255]})
    ]);},
    draw(camera){player.draw(camera);},
    clear(){player.clear();},
    dispose(){abort.abort();player.dispose();}
  });
}
