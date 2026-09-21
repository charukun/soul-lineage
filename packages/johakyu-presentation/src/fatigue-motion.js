/** RINNE-authored Rig_Medium fatigue motion. No stamina authority lives here. */
const pose=(time,label,values)=>Object.freeze({time,label,...values});
const zero=Object.freeze({rootLean:0,rootDrop:0,rootSway:0,chestPitch:0,shoulderRoll:0,headPitch:0,armDrop:0,breath:0});

const clips=Object.freeze({
  steady:Object.freeze({
    id:'rinne.fatigue.steady.rig-medium.v1',duration:4,
    keyframes:Object.freeze([
      pose(0,'settled',{rootLean:.012,rootDrop:.003,rootSway:0,chestPitch:.003,shoulderRoll:.004,headPitch:-.002,armDrop:.002,breath:.18}),
      pose(1,'inhale',{rootLean:.016,rootDrop:.002,rootSway:.002,chestPitch:.014,shoulderRoll:.012,headPitch:-.001,armDrop:.003,breath:.68}),
      pose(2,'exhale',{rootLean:.021,rootDrop:.006,rootSway:-.002,chestPitch:.004,shoulderRoll:.005,headPitch:-.004,armDrop:.004,breath:.12}),
      pose(3,'inhale',{rootLean:.015,rootDrop:.003,rootSway:.002,chestPitch:.012,shoulderRoll:.01,headPitch:-.002,armDrop:.003,breath:.6}),
      pose(4,'settled',{rootLean:.012,rootDrop:.003,rootSway:0,chestPitch:.003,shoulderRoll:.004,headPitch:-.002,armDrop:.002,breath:.18})
    ])
  }),
  low:Object.freeze({
    id:'rinne.fatigue.low.rig-medium.v1',duration:3.2,
    keyframes:Object.freeze([
      pose(0,'brace',{rootLean:.055,rootDrop:.016,rootSway:0,chestPitch:.014,shoulderRoll:.018,headPitch:-.012,armDrop:.014,breath:.18}),
      pose(.72,'inhale',{rootLean:.068,rootDrop:.014,rootSway:.006,chestPitch:.042,shoulderRoll:.042,headPitch:-.009,armDrop:.018,breath:.96}),
      pose(1.52,'sink',{rootLean:.086,rootDrop:.026,rootSway:-.007,chestPitch:.012,shoulderRoll:.022,headPitch:-.022,armDrop:.025,breath:.08}),
      pose(2.28,'recover',{rootLean:.058,rootDrop:.016,rootSway:.004,chestPitch:.036,shoulderRoll:.036,headPitch:-.01,armDrop:.017,breath:.82}),
      pose(3.2,'brace',{rootLean:.055,rootDrop:.016,rootSway:0,chestPitch:.014,shoulderRoll:.018,headPitch:-.012,armDrop:.014,breath:.18})
    ])
  }),
  critical:Object.freeze({
    id:'rinne.fatigue.critical.rig-medium.v1',duration:2.8,
    keyframes:Object.freeze([
      pose(0,'catch-breath',{rootLean:.17,rootDrop:.045,rootSway:0,chestPitch:.028,shoulderRoll:.036,headPitch:-.038,armDrop:.038,breath:.24}),
      pose(.55,'fold',{rootLean:.27,rootDrop:.085,rootSway:.012,chestPitch:.034,shoulderRoll:.048,headPitch:-.06,armDrop:.052,breath:.18}),
      pose(1.05,'inhale',{rootLean:.245,rootDrop:.07,rootSway:.004,chestPitch:.082,shoulderRoll:.086,headPitch:-.043,armDrop:.046,breath:1}),
      pose(1.55,'sink',{rootLean:.29,rootDrop:.094,rootSway:-.014,chestPitch:.018,shoulderRoll:.042,headPitch:-.07,armDrop:.056,breath:.06}),
      pose(2.15,'recover',{rootLean:.19,rootDrop:.05,rootSway:.007,chestPitch:.06,shoulderRoll:.066,headPitch:-.03,armDrop:.036,breath:.84}),
      pose(2.8,'catch-breath',{rootLean:.17,rootDrop:.045,rootSway:0,chestPitch:.028,shoulderRoll:.036,headPitch:-.038,armDrop:.038,breath:.24})
    ])
  })
});

export const FATIGUE_MOTION_ASSET=Object.freeze({
  id:'rinne.fatigue.rig-medium.v1',
  author:'RINNE',
  license:'RINNE-owned',
  rigFamily:'Rig_Medium',
  format:'authored-key-pose-runtime',
  purpose:'stamina-fatigue-presentation',
  clips
});

const fields=Object.freeze(Object.keys(zero));
const smooth=t=>t*t*(3-2*t);
const lerp=(a,b,t)=>a+(b-a)*t;

export function sampleFatigueMotion(band,seconds=0){
  const clip=clips[band];
  if(!clip)return Object.freeze({motionId:null,poseLabel:'rest',duration:0,...zero});
  const duration=clip.duration,time=((Number(seconds)||0)%duration+duration)%duration,frames=clip.keyframes;
  let a=frames[0],b=frames[frames.length-1];
  for(let i=0;i<frames.length-1;i++)if(time>=frames[i].time&&time<=frames[i+1].time){a=frames[i];b=frames[i+1];break;}
  const span=Math.max(1e-6,b.time-a.time),mix=smooth(Math.min(1,Math.max(0,(time-a.time)/span))),out={};
  for(const field of fields)out[field]=lerp(Number(a[field])||0,Number(b[field])||0,mix);
  return Object.freeze({motionId:clip.id,poseLabel:mix<.5?a.label:b.label,duration,...out});
}
