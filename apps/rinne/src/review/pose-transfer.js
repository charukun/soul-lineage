import { THREE as T } from '@soul/rendering';

/** Bake through the VRM's own normalized -> raw update, never copy quaternion
 * components between those two spaces. The displayed PBR mesh stays unchanged.
 */
export function rawClipFromNormalized(clip, bones, vrm, targets, name = clip?.name) {
  if (!clip || !vrm?.humanoid) throw new Error('A normalized clip and its source VRM are required');
  const byUUID = new Map(Object.entries(bones).map(([human, node]) => [node.uuid, human]));
  const channels = clip.tracks.map(track => {
    const dot = track.name.lastIndexOf('.'), human = byUUID.get(track.name.slice(0, dot));
    return {track, human, prop: track.name.slice(dot + 1), sample: track.createInterpolant()};
  }).filter(row => row.human && targets[row.human] && ['quaternion', 'position'].includes(row.prop));
  const times = [...new Set([0, clip.duration, ...channels.flatMap(row => [...row.track.times])])].sort((a,b) => a-b);
  if (times.length > 6000 || !Number.isFinite(clip.duration) || clip.duration <= 0) throw new Error('Invalid motion timeline');
  const saved = Object.values(bones).map(node => ({node,p:node.position.clone(),q:node.quaternion.clone()}));
  const humans = [...new Set(channels.map(row => row.human))];
  const rotations = new Map(humans.map(h => [h, []])), hips = [];
  try {
    for (const time of times) {
      for (const row of channels) bones[row.human][row.prop].fromArray(row.sample.evaluate(time));
      // This is the official conversion, including source-specific rest axes.
      vrm.humanoid.update();
      for (const human of humans) {
        const raw = vrm.humanoid.getRawBoneNode(human);
        if (!raw) throw new Error(`Raw source bone missing: ${human}`);
        const q = raw.quaternion.toArray(), values = rotations.get(human);
        if (!q.every(Number.isFinite)) throw new Error(`Non-finite raw pose: ${human}`);
        if (values.length && q.reduce((sum,x,i) => sum + x*values[values.length-4+i],0) < 0) q.forEach((x,i) => q[i]=-x);
        values.push(...q);
      }
      if (humans.includes('hips')) hips.push(...vrm.humanoid.getRawBoneNode('hips').position.toArray());
    }
    const tracks = humans.map(h => new T.QuaternionKeyframeTrack(`${targets[h].uuid}.quaternion`, times, rotations.get(h)));
    if (hips.length) tracks.push(new T.VectorKeyframeTrack(`${targets.hips.uuid}.position`, times, hips));
    const result = new T.AnimationClip(name, clip.duration, tracks);
    result.userData = {...clip.userData, poseTransfer:'VRMHumanoid.update: normalized-to-raw'};
    return result;
  } finally {
    for (const {node,p,q} of saved) { node.position.copy(p); node.quaternion.copy(q); }
    vrm.humanoid.update(); vrm.scene.updateMatrixWorld(true);
  }
}

/** Delta IK preserves the bone's rest-space axial twist, including raw VRM rigs. */
export function aimBone(bone, child, target) {
  const origin=bone.getWorldPosition(new T.Vector3());
  const from=child.getWorldPosition(new T.Vector3()).sub(origin), to=target.clone().sub(origin);
  if (from.lengthSq()<1e-12 || to.lengthSq()<1e-12) return;
  const world=new T.Quaternion().setFromUnitVectors(from.normalize(),to.normalize()).multiply(bone.getWorldQuaternion(new T.Quaternion()));
  bone.quaternion.copy(bone.parent.getWorldQuaternion(new T.Quaternion()).invert()).multiply(world).normalize();
  bone.updateWorldMatrix(false,true);
}
export function solveTwoBone(a,b,c,target,pole) {
  const origin=a.getWorldPosition(new T.Vector3()), l1=origin.distanceTo(b.getWorldPosition(new T.Vector3())), l2=b.getWorldPosition(new T.Vector3()).distanceTo(c.getWorldPosition(new T.Vector3()));
  const direction=target.clone().sub(origin);
  if (direction.lengthSq()<1e-12 || l1+l2<1e-5) return Infinity;
  const reach=T.MathUtils.clamp(direction.length(),Math.abs(l1-l2)+1e-5,(l1+l2)*.997);
  direction.normalize(); const destination=origin.clone().addScaledVector(direction,reach);
  const bend=pole.clone().addScaledVector(direction,-pole.dot(direction));
  if(bend.lengthSq()<1e-10) bend.set(0,0,1).addScaledVector(direction,-direction.z);
  bend.normalize();
  const along=(l1*l1-l2*l2+reach*reach)/(2*reach),height=Math.sqrt(Math.max(0,l1*l1-along*along));
  const elbow=origin.clone().addScaledVector(direction,along).addScaledVector(bend,height);
  aimBone(a,b,elbow);aimBone(b,c,destination);
  return c.getWorldPosition(new T.Vector3()).distanceTo(target);
}

/** Explicit writes are required after resetPose: AnimationMixer intentionally
 * caches unchanged values, so update(0) alone can leave a paused model in rest.
 */
const samplers=new WeakMap();
export function sampleRawClip(clip,root,time,weight=1){
 let roots=samplers.get(clip);if(!roots){roots=new WeakMap();samplers.set(clip,roots);}
 let bindings=roots.get(root);
 if(!bindings){bindings=clip.tracks.map(track=>{
  const dot=track.name.lastIndexOf('.'),id=track.name.slice(0,dot),property=track.name.slice(dot+1);
  const node=root.getObjectByProperty('uuid',id)||root.getObjectByName(id);
  if(!node||!['quaternion','position','scale'].includes(property))throw new Error(`Unresolved review pose channel: ${track.name}`);
  return{node,property,interpolant:track.createInterpolant()};
 });roots.set(root,bindings);}
 for(const{node,property,interpolant}of bindings){const value=interpolant.evaluate(Math.max(0,Math.min(clip.duration,time)));if(weight===1)node[property].fromArray(value);else if(property==='quaternion')node.quaternion.slerp(new T.Quaternion().fromArray(value),weight);else node[property].lerp(new T.Vector3().fromArray(value),weight);if(property==='quaternion')node.quaternion.normalize();}
 root.updateMatrixWorld(true);
}
