import {personalSpaceSteering,rankPoseCandidates,resolveInteractionSchema,weaponContactConstraint} from './motion-orchestration.js';

const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const freeze=value=>Object.freeze(value);
const finite=(...values)=>values.every(Number.isFinite);

export const MOTION_OPERATIONALIZATION_VERSION=1;
export const SEMANTIC_PRESENTATION_ROUTES=freeze({
  'foot-plant':freeze(['footstep','surface-vfx']),
  'weight-transfer':freeze(['cloth','body-fx']),
  'anticipation-end':freeze(['camera','weapon-vfx']),
  'weapon-release':freeze(['weapon-vfx','audio']),
  contact:freeze(['camera','weapon-vfx','audio']),
  'follow-through':freeze(['cloth','weapon-vfx']),
  handoff:freeze(['transition'])
});

function trajectoryAt(clip,phase){
  if(Array.isArray(clip.trajectory)&&clip.trajectory.length)return clip.trajectory;
  const distance=Math.max(0,Number(clip.speed)||0)*Math.max(0,Number(clip.duration)||0)*phase;
  const yaw=Number(clip.yaw)||0;
  return freeze([{x:Math.sin(yaw)*distance,z:Math.cos(yaw)*distance}]);
}

export function buildPoseCandidateBank({clips=[],fps=60,samplesPerClip=5}={}){
  if(!Array.isArray(clips)||!clips.length||!Number.isSafeInteger(fps)||fps<=0||!Number.isSafeInteger(samplesPerClip)||samplesPerClip<2||samplesPerClip>16)throw Error('Invalid pose candidate bank');
  const candidates=[];
  for(const clip of clips){
    if(!clip||clip.id==null||typeof clip.state!=='string'||!clip.state||!finite(Number(clip.duration),Number(clip.speed??0),Number(clip.yaw??0))||clip.duration<=0)throw Error('Invalid pose clip');
    const phases=Array.isArray(clip.entryPhases)&&clip.entryPhases.length?clip.entryPhases:Array.from({length:samplesPerClip},(_,i)=>i/(samplesPerClip-1));
    for(const raw of phases){
      const phase=clamp(Number(raw));
      if(!Number.isFinite(phase))throw Error('Invalid pose entry phase');
      const frame=Math.round(phase*clip.duration*fps),supportSide=clip.supportAt?clip.supportAt(phase):(clip.supportSide??(frame%2?'right':'left'));
      candidates.push(freeze({id:`${clip.id}@${frame}`,clipId:String(clip.id),frame,phase,state:clip.state,speed:Number(clip.speed)||0,yaw:Number(clip.yaw)||0,supportSide:supportSide==='right'?'right':'left',continuity:clamp(Number.isFinite(clip.continuity)?clip.continuity:1-Math.abs(.5-phase)*.35),trajectory:trajectoryAt(clip,phase)}));
    }
  }
  return freeze({version:1,fps,candidates:freeze(candidates),advisory:true,gameplayAuthority:false});
}

export function selectPoseStart({state,speed=0,yaw=0,supportSide='left',trajectory=[],bank,continuityById={}}={}){
  if(!bank||bank.version!==1||!Array.isArray(bank.candidates)||!bank.candidates.length)throw Error('Invalid pose candidate bank');
  const candidates=bank.candidates.map(row=>({...row,continuity:Number.isFinite(continuityById[row.id])?clamp(continuityById[row.id]):row.continuity}));
  const ranked=rankPoseCandidates({query:{state,speed,yaw,supportSide,trajectory},candidates});
  const winner=ranked[0];
  return freeze({version:1,id:winner.id,clipId:winner.candidate.clipId,frame:winner.candidate.frame,phase:winner.candidate.phase,score:winner.score,terms:winner.terms,ranked:freeze(ranked.slice(0,5).map(r=>freeze({id:r.id,score:r.score,terms:r.terms}))),advisory:true,gameplayAuthority:false});
}

export function routeSemanticPresentationEvent(event,consumers={}){
  if(!event||typeof event.name!=='string'||!SEMANTIC_PRESENTATION_ROUTES[event.name])throw Error('Unknown semantic presentation event');
  const payload=freeze({...event,presentationOnly:true,contactAuthority:'gameplay-external'}),delivered=[];
  for(const route of SEMANTIC_PRESENTATION_ROUTES[event.name]){
    const consumer=consumers[route];
    if(typeof consumer!=='function')continue;
    consumer(payload);delivered.push(route);
  }
  return freeze({version:1,event:payload,delivered:freeze(delivered),gameplayAuthority:false});
}

export function explicitInteractionAdapter(schemaId,{partner,anchors,metadata={}}={}){
  const resolved=resolveInteractionSchema(schemaId,{partner,anchors});
  return freeze({version:1,...resolved,metadata:freeze({...metadata}),explicit:true,mayInferPartner:false,worldAuthority:false});
}

export function sweptWeaponContactEvidence({point,normal,relativeSpeed=0,penetration=0,weaponMass=1,hitSerial=0,source='swept-contact'}={}){
  if(!point||!normal||!finite(point.x,point.y??0,point.z,normal.x,normal.z,relativeSpeed,penetration,weaponMass,hitSerial)||penetration<0||weaponMass<=0||hitSerial<0)throw Error('Invalid swept weapon contact evidence');
  const constraint=weaponContactConstraint({normal,relativeSpeed,penetration,weaponMass});
  return freeze({version:1,source:String(source),hitSerial,point:freeze({x:point.x,y:Number(point.y)||0,z:point.z}),normal:constraint.normal,relativeSpeed,penetration,constraint,presentationOnly:true,damageAuthority:false,collisionAuthority:false});
}

export function personalSpaceNavigationBias(input={}){
  const steering=personalSpaceSteering(input);
  return freeze({version:1,suggestion:steering.suggestion,preferred:steering.preferred,accepted:false,advisory:true,worldAuthority:false,consumerMustOptIn:true});
}

export function createMotionDeviceCalibration({deviceClass,physicalDevice=false,userAgent='',refreshHz=null,cohort=1,layers=[],sampleCount=0,totalMeanMs=null,notes=''}={}){
  if(typeof deviceClass!=='string'||!deviceClass||typeof physicalDevice!=='boolean'||!Number.isSafeInteger(cohort)||cohort<1||!Number.isSafeInteger(sampleCount)||sampleCount<0||!Array.isArray(layers))throw Error('Invalid motion device calibration');
  if(refreshHz!==null&&(!Number.isFinite(refreshHz)||refreshHz<=0))throw Error('Invalid refresh rate');
  if(totalMeanMs!==null&&(!Number.isFinite(totalMeanMs)||totalMeanMs<0))throw Error('Invalid motion timing');
  const rows=layers.map(row=>{if(!row||typeof row.layer!=='string'||!row.layer||!finite(row.meanMs,row.maxMs)||row.meanMs<0||row.maxMs<0)throw Error('Invalid motion layer calibration');return freeze({layer:row.layer,meanMs:row.meanMs,maxMs:row.maxMs});});
  const measured=physicalDevice&&sampleCount>0&&totalMeanMs!==null&&userAgent.trim().length>0;
  return freeze({schema:'motion-device-calibration',version:1,deviceClass,physicalDevice,measuredHardware:measured,userAgent:String(userAgent).slice(0,400),refreshHz,cohort,sampleCount,totalMeanMs,layers:freeze(rows),notes:String(notes).slice(0,1000),designBudgetIsMeasurement:false});
}
