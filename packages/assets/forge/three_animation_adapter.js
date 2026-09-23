/** Retarget existing RINNE Golden Base motion onto the reference-fitted rig.
 * Geometry comes only from pinned img2threejs. The donor GLB supplies motion
 * rotations, not skin buffers, bone lengths, surface shape or likeness verdicts.
 */
export const REQUIRED_GOLDEN_CLIPS=['Idle','Walk','Talk','Attack','Hit','Rest'];

export function retargetGoldenClips(THREE,sourceClips,bones){
  const mapped=[];const provenance=[];
  for(const name of REQUIRED_GOLDEN_CLIPS){
    const source=sourceClips.find(c=>c.name===name);
    if(!source||!source.tracks.length)throw Error('Missing real Golden Base animation: '+name);
    const tracks=[];
    for(const original of source.tracks){
      const separator=original.name.lastIndexOf('.');
      if(separator<0)throw Error('Malformed Golden Base motion track: '+original.name);
      const legacy=original.name.slice(0,separator),property=original.name.slice(separator+1);
      // Legacy GLB uses upperArm_L; the common RINNE rig uses upperArm.L.
      const target=legacy.replace(/_([LR])$/,'.$1');
      const bone=bones[target];
      if(!bone||!bone.isBone||property!=='quaternion')
        throw Error('Missing mapped rig bone/unsupported track: '+original.name);
      const track=original.clone();track.name=bone.uuid+'.quaternion';tracks.push(track);
      provenance.push({clip:name,legacyBone:legacy,targetBone:target,property,keys:track.times.length});
    }
    mapped.push(new THREE.AnimationClip(name,source.duration,tracks,source.blendMode));
  }
  return {clips:mapped,provenance,authority:'RINNE existing Golden Base motion tracks; explicit bone-name remap'};
}

/** The actual Three AnimationMixer must reproduce the track interpolant. */
export function measureGoldenMixer(THREE,root,retargeted,bones){
  const rows=[];let maxSampledBindingDelta=0;
  for(const clip of retargeted.clips){
    const mixer=new THREE.AnimationMixer(root);
    const action=mixer.clipAction(clip);action.play();let maxMotion=0;
    for(const ratio of [.05,.25,.5,.75,.95]){
      const t=clip.duration*ratio;mixer.setTime(t);root.updateMatrixWorld(true);
      for(const track of clip.tracks){
        const uuid=track.name.slice(0,track.name.lastIndexOf('.'));
        const bone=Object.values(bones).find(b=>b.uuid===uuid);
        if(!bone)throw Error('Mixer target lost its common rig bone');
        const expected=track.createInterpolant().evaluate(t);
        const actual=bone.quaternion.toArray();
        // q and -q represent the same orientation; choose the closest sign.
        const sign=actual.reduce((sum,v,i)=>sum+v*expected[i],0)>=0?1:-1;
        const delta=Math.max(...actual.map((v,i)=>Math.abs(v-sign*expected[i])));
        maxSampledBindingDelta=Math.max(maxSampledBindingDelta,delta);
        maxMotion=Math.max(maxMotion,bone.quaternion.angleTo(new THREE.Quaternion()));
      }
    }
    rows.push({clip:clip.name,sampledTimes:5,maxMotionRadians:maxMotion});
    mixer.stopAllAction();mixer.uncacheClip(clip);
    for(const bone of Object.values(bones))bone.quaternion.identity();
    root.updateMatrixWorld(true);
    if(maxMotion<1e-5)throw Error('Clip exists but did not move the actual bound rig: '+clip.name);
  }
  if(maxSampledBindingDelta>2**-23)
    throw Error('Pinned plugin Gate R1 sampled mixer binding threshold failed: '+maxSampledBindingDelta);
  return {passed:true,maxSampledBindingDelta,limit:2**-23,clips:rows,
          scope:'G1 sampled mixer/interpolant + nonzero joint motion only; other eleven plugin gates remain mandatory'};
}
