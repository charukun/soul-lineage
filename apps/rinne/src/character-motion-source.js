import { QA_FPS, qaSequenceAt, blendHumanoidPose, stabilizeMotionBoundaries } from '@soul/animations';
import { captureMotionRest, captureNormalizedMotion } from '@soul/rendering/motion-quality';

/** Bake the existing runtime once, then release its model/controllers. A crowd shares
 * immutable canonical poses, never a mixer, VRM bridge, spring history or model clone.
 * The source resolver is injected so Node rig tests use the exact same bake path.
 */
export async function loadWorkshopMotionSource({resolveModule,readAsset,progress=()=>{}}) {
  const [{HumanoidRuntime},{SLASH_SECONDS,SLASH_TIMING,SLASH_REVISION},{createReviewSword}]=await Promise.all([
    resolveModule('humanoid.js'),resolveModule('authored-slash.js'),resolveModule('review-sword.js')]);
  const runtime=new HumanoidRuntime({readAsset,weapons:{sword:{base:.21,tip:1.62,width:.065}},strikes:{slash:{}},clips:{slash:SLASH_TIMING},windows:{},
    progress:(a,t)=>Math.min(1,Math.max(0,(t??a.attack?.t??0)/SLASH_SECONDS)),window:(_kind,p)=>p>=SLASH_TIMING.active[0]&&p<=SLASH_TIMING.active[1]?0:-1});
  try {await runtime.load('SHINO');return {...await bakeWorkshopMotionSource(runtime,{slashSeconds:SLASH_SECONDS,revision:SLASH_REVISION,progress}),createSword:createReviewSword};}
  finally {if(runtime.current)runtime.dispose(runtime.current);}
}
export async function bakeWorkshopMotionSource(runtime,{slashSeconds,revision,progress=()=>{}}) {
  const c=runtime.current;
  for(const id of ['idle-01','walk','run-slow'])if(!c.shared[id])throw new Error(`Missing QA source motion: ${id}`);
  runtime.resetRoot(c);runtime.resetBones(c);c.vrm.update(0);c.root.updateMatrixWorld(true);
  const rest=captureMotionRest(c.raw,c.sourceHeight),socket={position:c.sockets.right.rawOffset.toArray(),quaternion:c.sockets.right.rawRotation.toArray(),supportPosition:c.sockets.left.rawOffset.toArray(),supportQuaternion:c.sockets.left.rawRotation.toArray()};
  const actor={id:'workshop-motion-source',hero:true,weapon:'sword',weaponDraw:0,lifeAgeYears:22,x:0,z:0,yaw:0,air:0,vx:0,vz:0,_humanoidClock:0};
  c.lastActorId=null;const frames=[],attachments=[];
  for(let frame=0;frame<=30*QA_FPS;frame++) {
    const time=frame/QA_FPS,row=qaSequenceAt(time),phase=row.localTime;
    actor._humanoidClock=time;actor._humanoidPhase=time;actor.vx=0;actor.vz=row.id==='walk'?1:row.id==='run'?3:0;
    actor.attack=null;actor.combatReady=['draw','guard','slash','sheathe'].includes(row.id);actor.weaponTransition=['draw','sheathe'].includes(row.id);
    actor.weaponDraw=['guard','slash'].includes(row.id)?1:row.id==='draw'?row.progress:row.id==='sheathe'?1-row.progress:0;
    if(row.id==='slash'&&phase%2<slashSeconds)actor.attack={id:`qa-slash-${Math.floor(phase/2)}`,kind:'slash',t:phase%2,duration:slashSeconds};
    // Bake primary animation, not elapsed spring simulation. Secondary motion is
    // deliberately reset for reproducible screenshots and remains a separate review.
    c.resetSpring=true;
    const result=runtime.render(actor);frames.push(captureNormalizedMotion(c.raw,rest));
    attachments.push({attachment:result.attachment,draw:actor.weaponDraw});
    if(frame%120===0){progress(frame/(30*QA_FPS));await new Promise(resolve=>setTimeout(resolve,0));}
  }
  // Close only the final idle seam; skill keys and their .66s timing are untouched.
  for(let i=frames.length-31;i<frames.length;i++)frames[i]=blendHumanoidPose(frames[i],frames[0],(i-(frames.length-31))/30);
  const transitionRanges=[[2.9,3.15],[6.9,7.15],[10.98,11.5],[13.9,14.15],[23,23.3],[26.5,27.2]];
  const qualityFrames=stabilizeMotionBoundaries({frames,fps:QA_FPS,duration:30},transitionRanges);
  return {version:1,fps:QA_FPS,duration:30,revision,sourceHeight:c.sourceHeight,frames,qualityFrames,transitionRanges,attachments,socket,sourceRest:rest,sources:['idle-01','walk','run-slow','runtime.weaponDraw','runtime.guard','authored-slash']};
}
