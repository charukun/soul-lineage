import {Quaternion} from 'three';
import {createHumanoidPreview} from '@soul/rendering/humanoid-preview';
import {loadPinnedMotionSource} from '../motion/source-runtime.js';
import {MOTION_LIBRARY_SOURCE_BY_ID} from '../motion/sources.js';
import {createAuthoredEffectPlayer} from '../../rebuild/authored-effect-player.js';
import {REVIEW_AUTHORED_EFFECTS} from '../../rebuild/authored-effect-manifest.js';
import {authoredEffectBase,createEffekseerBackend} from '../../rebuild/effekseer-loader.js';
import {combatEffectBudget} from '../../rebuild/combat-effect-cues.js';

const clamp=(value,lo=0,hi=1)=>Math.max(lo,Math.min(hi,Number(value)||0));
const smooth=value=>{const t=clamp(value);return t*t*(3-2*t);};
const ATTACK_SWEEP=new Set(['slash','back','crosscut','spin','round','sweep','diagonal','katanaKesa','katanaDraw','katanaReturn','spearwheel']);
const ATTACK_THRUST=new Set(['thrust','pierce','dash','bullrush','katanaThrust','sky']);

export const INSPIRATION_MOTION_SELECTIONS=Object.freeze({
  evade:Object.freeze({sourceId:'kaykit-movement-advanced',left:'Dodge_Left',right:'Dodge_Right'}),
  combat:Object.freeze({
    sourceId:'kaykit-combat-melee',hold:'Melee_Blocking',flinch:'Melee_Block_Hit',counter:'Melee_Block_Attack',
    oneHandChop:'Melee_1H_Attack_Chop',oneHandJumpChop:'Melee_1H_Attack_Jump_Chop',oneHandDiagonal:'Melee_1H_Attack_Slice_Diagonal',oneHandHorizontal:'Melee_1H_Attack_Slice_Horizontal',oneHandStab:'Melee_1H_Attack_Stab',
    twoHandChop:'Melee_2H_Attack_Chop',twoHandSlice:'Melee_2H_Attack_Slice',twoHandSpin:'Melee_2H_Attack_Spin',twoHandSpinning:'Melee_2H_Attack_Spinning',twoHandStab:'Melee_2H_Attack_Stab',
    fistKick:'Melee_Unarmed_Attack_Kick',fistPunch:'Melee_Unarmed_Attack_Punch_A'
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
  counter:sourceClip(INSPIRATION_MOTION_SELECTIONS.combat.sourceId,INSPIRATION_MOTION_SELECTIONS.combat.counter),
  oneHandChop:sourceClip(INSPIRATION_MOTION_SELECTIONS.combat.sourceId,INSPIRATION_MOTION_SELECTIONS.combat.oneHandChop),
  oneHandJumpChop:sourceClip(INSPIRATION_MOTION_SELECTIONS.combat.sourceId,INSPIRATION_MOTION_SELECTIONS.combat.oneHandJumpChop),
  oneHandDiagonal:sourceClip(INSPIRATION_MOTION_SELECTIONS.combat.sourceId,INSPIRATION_MOTION_SELECTIONS.combat.oneHandDiagonal),
  oneHandHorizontal:sourceClip(INSPIRATION_MOTION_SELECTIONS.combat.sourceId,INSPIRATION_MOTION_SELECTIONS.combat.oneHandHorizontal),
  oneHandStab:sourceClip(INSPIRATION_MOTION_SELECTIONS.combat.sourceId,INSPIRATION_MOTION_SELECTIONS.combat.oneHandStab),
  twoHandChop:sourceClip(INSPIRATION_MOTION_SELECTIONS.combat.sourceId,INSPIRATION_MOTION_SELECTIONS.combat.twoHandChop),
  twoHandSlice:sourceClip(INSPIRATION_MOTION_SELECTIONS.combat.sourceId,INSPIRATION_MOTION_SELECTIONS.combat.twoHandSlice),
  twoHandSpin:sourceClip(INSPIRATION_MOTION_SELECTIONS.combat.sourceId,INSPIRATION_MOTION_SELECTIONS.combat.twoHandSpin),
  twoHandSpinning:sourceClip(INSPIRATION_MOTION_SELECTIONS.combat.sourceId,INSPIRATION_MOTION_SELECTIONS.combat.twoHandSpinning),
  twoHandStab:sourceClip(INSPIRATION_MOTION_SELECTIONS.combat.sourceId,INSPIRATION_MOTION_SELECTIONS.combat.twoHandStab),
  fistKick:sourceClip(INSPIRATION_MOTION_SELECTIONS.combat.sourceId,INSPIRATION_MOTION_SELECTIONS.combat.fistKick),
  fistPunch:sourceClip(INSPIRATION_MOTION_SELECTIONS.combat.sourceId,INSPIRATION_MOTION_SELECTIONS.combat.fistPunch),
  hitA:sourceClip(INSPIRATION_MOTION_SELECTIONS.reaction.sourceId,INSPIRATION_MOTION_SELECTIONS.reaction.light),
  hitB:sourceClip(INSPIRATION_MOTION_SELECTIONS.reaction.sourceId,INSPIRATION_MOTION_SELECTIONS.reaction.heavy)
});
export const INSPIRATION_MOTION_CLIPS=CLIPS;

const HEAVY_KINDS=new Set(['heavy','leap','meteor','uppercut','risingfist','oneinch']);
const SPIN_KINDS=new Set(['spin','round','sweep','spearwheel','crosscut']);
const validSteps=steps=>(Array.isArray(steps)?steps:[]).filter(step=>step?.kind&&step.kind!=='none');
function stableMotionHash(value=''){let hash=2166136261;for(const ch of String(value)){hash^=ch.charCodeAt(0);hash=Math.imul(hash,16777619);}return hash>>>0;}
function clipCandidates(weapon='sword',kind='slash'){
  if(weapon==='fist')return HEAVY_KINDS.has(kind)?[CLIPS.fistKick,CLIPS.fistPunch]:[CLIPS.fistPunch,CLIPS.fistKick];
  const twoHand=['great','axe','spear','staff'].includes(weapon);
  if(twoHand){
    if(ATTACK_THRUST.has(kind))return[CLIPS.twoHandStab,CLIPS.twoHandSlice];
    if(SPIN_KINDS.has(kind))return[CLIPS.twoHandSpin,CLIPS.twoHandSpinning,CLIPS.twoHandSlice];
    if(HEAVY_KINDS.has(kind))return[CLIPS.twoHandChop,CLIPS.twoHandSpinning,CLIPS.twoHandSlice];
    return[CLIPS.twoHandSlice,CLIPS.twoHandChop,CLIPS.twoHandSpin];
  }
  if(ATTACK_THRUST.has(kind))return[CLIPS.oneHandStab,CLIPS.counter,CLIPS.oneHandJumpChop];
  if(HEAVY_KINDS.has(kind))return[CLIPS.oneHandChop,CLIPS.oneHandJumpChop,CLIPS.oneHandDiagonal];
  if(SPIN_KINDS.has(kind))return[CLIPS.oneHandHorizontal,CLIPS.oneHandDiagonal,CLIPS.oneHandChop];
  if(ATTACK_SWEEP.has(kind))return[CLIPS.oneHandDiagonal,CLIPS.oneHandHorizontal,CLIPS.oneHandChop];
  return[CLIPS.oneHandDiagonal,CLIPS.oneHandChop,CLIPS.oneHandHorizontal];
}
function motionCurve(value,mode=0){const t=clamp(value);if(mode===1)return 1-Math.pow(1-t,2);if(mode===2)return t*t*(2-t);return smooth(t);}
export function inspirationMotionPlan({techniqueId='',techniqueName='',phase='ha',weapon='sword',steps=[]}={}){
  const authored=validSteps(steps),rows=authored.length?authored:[{kind:'slash'}],kinds=rows.map(step=>String(step.kind||'slash'));
  const identity=String(techniqueId||techniqueName||'unnamed'),seed=stableMotionHash(`${identity}|${phase}|${weapon}|${kinds.join('>')}`);
  const segments=rows.map((step,index)=>{
    const localHash=stableMotionHash(`${seed}|${index}|${step.kind}|${step.footwork||''}`),candidates=clipCandidates(weapon,String(step.kind||'slash')),clip=candidates[localHash%candidates.length];
    const sampleStart=.035+((localHash>>>3)%5)*.022,sampleEnd=.84+((localHash>>>7)%5)*.03,curve=(localHash>>>11)%3;
    return Object.freeze({kind:String(step.kind||'slash'),clip,sampleStart,sampleEnd,curve});
  });
  const prelude=seed%4===0?CLIPS.counter:null,impactRatio=.70+((seed>>>5)%4)*.045;
  const signature=[seed.toString(36),prelude?.name||'direct',...segments.map(row=>`${row.kind}:${row.clip.name}:${row.sampleStart.toFixed(3)}-${row.sampleEnd.toFixed(3)}:${row.curve}`)].join('|');
  return Object.freeze({identity,seed,phase,weapon,prelude,segments:Object.freeze(segments),impactRatio,signature});
}
export function inspirationAttackClipName(weapon='sword',steps=[],techniqueId='',phase='ha'){
  return inspirationMotionPlan({techniqueId,phase,weapon,steps}).segments[0].clip.name;
}
function techniquePose(combat,plan,progress,speed=1){
  if(!combat||!plan?.segments?.length)return null;
  const p=clamp(progress*Math.max(.5,Math.min(1.5,Number(speed)||1))),preludeShare=plan.prelude?.15:0;
  if(plan.prelude&&p<preludeShare)return sample(combat,plan.prelude,.22+.58*(p/preludeShare));
  const strikeProgress=clamp((p-preludeShare)/Math.max(.001,1-preludeShare)),scaled=strikeProgress*plan.segments.length,index=Math.min(plan.segments.length-1,Math.floor(scaled)),local=clamp(scaled-index),segment=plan.segments[index];
  const ratio=segment.sampleStart+(segment.sampleEnd-segment.sampleStart)*motionCurve(local,segment.curve);let pose=sample(combat,segment.clip,ratio);
  const blendWindow=.12;
  if(index>0&&local<blendWindow){const prior=plan.segments[index-1],priorPose=sample(combat,prior.clip,prior.sampleEnd);pose=blendInspirationPose(priorPose,pose,local/blendWindow);}
  if(index<plan.segments.length-1&&local>1-blendWindow){const next=plan.segments[index+1],nextPose=sample(combat,next.clip,next.sampleStart);pose=blendInspirationPose(pose,nextPose,(local-(1-blendWindow))/blendWindow);}
  return pose;
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
  function heroPose(sequence,{side=1,weapon='sword',steps=[],techniqueId='',techniqueName='',phase='ha',presentation=null}={}){
    if(!sequence||sequence.stage==='done'||!evade||!combat)return null;
    const dodge=side<0?CLIPS.evadeLeft:CLIPS.evadeRight,plan=inspirationMotionPlan({techniqueId,techniqueName,phase,weapon,steps}),stage=sequence.stage,elapsed=Number(sequence.elapsed)||0;
    const dodgeEnd=sample(evade,dodge,.72),hold=sample(combat,CLIPS.hold,.28+((elapsed*.13)%1)*.22);
    if(stage==='premonition')return sample(evade,dodge,.08+.64*clamp((sequence.nearMiss||0)));
    if(stage==='camera')return blendInspirationPose(dodgeEnd,hold,sequence.progress);
    if(['spacing','stagger','silence','reveal'].includes(stage))return hold;
    const strike=techniquePose(combat,plan,sequence.executeProgress||0,presentation?.motion?.speed)||hold;
    if(stage==='execute'&&(sequence.executeProgress||0)<.16)return blendInspirationPose(hold,strike,(sequence.executeProgress||0)/.16);
    const final=plan.segments.at(-1);
    if(stage==='impact')return sample(combat,final.clip,Math.min(final.sampleEnd,plan.impactRatio));
    if(stage==='settle')return sample(combat,final.clip,Math.min(final.sampleEnd,.94+.05*sequence.progress));
    if(stage==='afterglow')return sample(combat,final.clip,Math.min(final.sampleEnd,.96+.04*sequence.progress));
    return strike;
  }
  function enemyPose(sequence,index=0){
    if(!sequence||sequence.stage==='done'||sequence.stage==='premonition'||!combat)return null;
    const stage=sequence.stage,elapsed=Number(sequence.elapsed)||0,hold=sample(combat,CLIPS.hold,.34+((elapsed*.11)%1)*.18);
    if(stage==='camera')return blendInspirationPose(sample(combat,CLIPS.flinch,.62),hold,sequence.progress);
    if(['spacing','stagger','silence','reveal','execute'].includes(stage))return hold;
    if(!reaction)return hold;
    const hit=sample(reaction,index%2?CLIPS.hitA:CLIPS.hitB,stage==='impact'?.12+.80*sequence.progress:.96);
    if(stage==='settle')return hit;
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
    insight(position,rotation={x:0,y:0,z:0},presentation=null){player.presentCues([cue(presentation?.vfx?.anticipation||INSPIRATION_VFX_SELECTIONS.insight,position,rotation,{scale:.11*(presentation?.vfx?.scale||1),lifetime:.72,priority:2,followKey:'hero'})]);},
    trail(position,rotation={x:0,y:0,z:0},presentation=null){player.presentCues([cue(presentation?.vfx?.trail||INSPIRATION_VFX_SELECTIONS.trail,position,rotation,{scale:.78*(presentation?.vfx?.scale||1),lifetime:.82,priority:2,followKey:'hero'})]);},
    hit(position,rotation={x:0,y:0,z:0},presentation=null){const scale=presentation?.vfx?.scale||1;player.presentCues([
      cue(presentation?.vfx?.impact||INSPIRATION_VFX_SELECTIONS.impact,position,rotation,{scale:1.08*scale,lifetime:1.05,priority:3,color:[255,246,220,255]}),
      cue(presentation?.vfx?.secondary||INSPIRATION_VFX_SELECTIONS.debris,position,rotation,{scale:.24*scale,lifetime:.78,priority:2,color:[255,220,150,255]})
    ]);},
    draw(camera){player.draw(camera);},
    clear(){player.clear();},
    dispose(){abort.abort();player.dispose();}
  });
}
