const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const finite=(...v)=>v.every(Number.isFinite);
const freeze=o=>Object.freeze(o);

export const MOTION_FRAME_QA_VERSION=1;

export function compareRgbaFrames(before,after,{channelThreshold=18,maxChangedRatio=.025,maxMeanDelta=.03,ignoreAlpha=true}={}){
 if(!(before instanceof Uint8Array||before instanceof Uint8ClampedArray)||!(after instanceof Uint8Array||after instanceof Uint8ClampedArray)||before.length!==after.length||before.length===0||before.length%4!==0||!finite(channelThreshold,maxChangedRatio,maxMeanDelta)||channelThreshold<0||maxChangedRatio<0||maxMeanDelta<0)throw Error('Invalid RGBA frame comparison');
 const pixels=before.length/4,channels=ignoreAlpha?3:4;let changed=0,sum=0,max=0;
 for(let p=0;p<pixels;p++){let pixelChanged=false;for(let c=0;c<channels;c++){const i=p*4+c,d=Math.abs(after[i]-before[i]);sum+=d;max=Math.max(max,d);if(d>channelThreshold)pixelChanged=true;}if(pixelChanged)changed++;}
 const changedRatio=changed/pixels,meanDelta=sum/(pixels*channels*255),maxDelta=max/255;
 return freeze({version:1,pixels,changedPixels:changed,changedRatio,meanDelta,maxDelta,pass:changedRatio<=maxChangedRatio&&meanDelta<=maxMeanDelta,thresholds:freeze({channelThreshold,maxChangedRatio,maxMeanDelta,ignoreAlpha:Boolean(ignoreAlpha)})});
}

export function compareLandmarkFrames(before,after,{maxRoot=.08,maxJoint=.12,maxWeapon=.16}={}){
 if(!before||!after||!Array.isArray(before.joints)||!Array.isArray(after.joints)||before.joints.length!==after.joints.length||!finite(maxRoot,maxJoint,maxWeapon))throw Error('Invalid landmark frame comparison');
 const point=p=>Array.isArray(p)?p:p?[p.x,p.y,p.z]:null,dist=(a,b)=>{a=point(a);b=point(b);if(!a||!b||a.length<3||b.length<3||![...a,...b].every(Number.isFinite))throw Error('Invalid landmark point');return Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);};
 const root=dist(before.root,after.root),joints=before.joints.map((p,i)=>dist(p,after.joints[i])),maxJointDelta=Math.max(0,...joints),weapon=before.weaponTip&&after.weaponTip?dist(before.weaponTip,after.weaponTip):0;
 return freeze({version:1,root,maxJointDelta,weapon,jointDeltas:freeze(joints),pass:root<=maxRoot&&maxJointDelta<=maxJoint&&weapon<=maxWeapon,thresholds:freeze({maxRoot,maxJoint,maxWeapon})});
}

export function createFrameComparisonEvidence({camera,frame,beforeRevision,afterRevision,rgba=null,landmarks=null}={}){
 if(typeof camera!=='string'||!camera||!Number.isInteger(frame)||frame<0||typeof beforeRevision!=='string'||!beforeRevision||typeof afterRevision!=='string'||!afterRevision||(!rgba&&!landmarks))throw Error('Invalid frame comparison evidence');
 const evidence={schema:'motion-frame-qa',version:1,camera,frame,beforeRevision,afterRevision,visualApprovalRequired:true};if(rgba)evidence.rgba=rgba;if(landmarks)evidence.landmarks=landmarks;return freeze(evidence);
}

export function summarizeFrameComparisons(items=[]){
 if(!Array.isArray(items)||!items.length)throw Error('Invalid frame comparison list');let failed=0,worstChanged=0,worstJoint=0;for(const item of items){if(!item||item.schema!=='motion-frame-qa'||item.version!==1||item.visualApprovalRequired!==true)throw Error('Invalid frame comparison evidence');const pass=(item.rgba?.pass??true)&&(item.landmarks?.pass??true);if(!pass)failed++;worstChanged=Math.max(worstChanged,item.rgba?.changedRatio??0);worstJoint=Math.max(worstJoint,item.landmarks?.maxJointDelta??0);}return freeze({version:1,count:items.length,failed,worstChangedRatio:worstChanged,worstJointDelta:worstJoint,diagnosticPass:failed===0,visualApprovalRequired:true});
}
