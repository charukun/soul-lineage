import {Matrix4, Quaternion, Vector3} from 'three';
import {HUMANOID_BINDING_VERSION, HUMANOID_CORE, HUMANOID_SLOTS, inspectHumanoid, rotationOf} from './humanoid-binding.js';
export {HUMANOID_BINDING_VERSION, HUMANOID_CORE, HUMANOID_SLOTS, inspectHumanoid};

const SPACE = 'humanoid-preview-v1';
const TORSO = ['hips', 'spine', 'chest', 'upperChest', 'neck', 'head'];
const finiteArray = (v, n) => Array.isArray(v) && v.length === n && v.every(Number.isFinite);
const validQ = v => finiteArray(v, 4) && Number.isFinite(Math.hypot(...v)) && Math.hypot(...v) > 1e-8;
const q = v => {const length=Math.hypot(...v);return new Quaternion(...v.map(n=>n/length));};
const copyTransform = node => ({position:node.position.clone(), quaternion:node.quaternion.clone(), scale:node.scale.clone()});

/** Preview-only adapter. Deformation quality is deliberately independent of integrity,
 * licensing, gameplay ownership and Production approval. It never invents skin weights.
 * One instance owns one scene; descriptors are serializable, scene/bone references are not.
 */
export function createHumanoidPreview(root, options = {}) {
  const binding = inspectHumanoid(root, options), {bones, report, profile} = binding;
  const transforms = new Map(binding.entries.map(({node}) => [node, copyTransform(node)]));
  const restRootInverse = new Matrix4().copy(root.matrixWorld).invert();
  const canonicalFromWorld = binding.basis.clone().multiply(rotationOf(root).invert());
  const worldFromCanonical = canonicalFromWorld.clone().invert();
  const restWorld = new Map(binding.entries.map(({node}) => [node, rotationOf(node)]));
  const directParentRest = new Map(Object.values(bones).map(b => [b, rotationOf(b.parent)]));
  const semantic = new Set(Object.values(bones));
  const parentOf = new Map();
  for (const bone of semantic) {
    let parent = bone.parent; while (parent && !semantic.has(parent)) parent = parent.parent;
    parentOf.set(bone, parent);
  }
  const canonicalPoint = node => node.getWorldPosition(new Vector3()).applyMatrix4(restRootInverse).applyQuaternion(binding.basis);
  const restHips = bones.hips ? canonicalPoint(bones.hips) : new Vector3();
  const descriptor = Object.freeze({...report, profile, cacheIdentity:JSON.stringify({version:HUMANOID_BINDING_VERSION,assetHash:report.assetHash,mapping:report.mapping,basis:report.basis,profile})});
  function reset() {
    for (const [node, t] of transforms) { node.position.copy(t.position); node.quaternion.copy(t.quaternion); node.scale.copy(t.scale); }
    root.updateWorldMatrix(true, true);
  }
  function capture() {
    if (!bones.hips || ['UNSUPPORTED', 'RIG_REQUIRED'].includes(report.status)) throw new Error(`Humanoid source ${report.status}`);
    root.updateWorldMatrix(true, true);
    if (binding.entries.some(({node}) => !validQ(node.quaternion.toArray()) || !finiteArray(node.position.toArray(),3) || !finiteArray(node.scale.toArray(),3) || node.scale.toArray().some(v=>v<=0))) throw new Error('Non-finite humanoid source pose');
    const rotations = {};
    for (const [slot, bone] of Object.entries(bones)) {
      // Include animated intervening helpers, rather than dropping shoulder/root tracks.
      const parent = parentOf.get(bone), parentRest = parent ? restWorld.get(parent) : new Quaternion();
      const parentNow = parent ? rotationOf(parent) : new Quaternion();
      const delta = parentRest.clone().multiply(parentNow.invert()).multiply(rotationOf(bone)).multiply(restWorld.get(bone).clone().invert());
      rotations[slot] = canonicalFromWorld.clone().multiply(delta).multiply(worldFromCanonical).normalize().toArray();
    }
    const hips = canonicalPoint(bones.hips).sub(restHips).divideScalar(profile.height).toArray();
    if (!finiteArray(hips,3) || Object.values(rotations).some(v=>!validQ(v))) throw new Error('Non-finite humanoid source pose');
    return {space:SPACE, rotations, hips, profile, bindingStatus:report.status};
  }
  function assess(pose, {mode = 'preview', rootMotion = 'in-place'} = {}) {
    const reasons = [...report.issues], missingMotion = HUMANOID_CORE.filter(n => bones[n] && !pose?.rotations?.[n]);
    const badPose = !pose || pose.space !== SPACE || !finiteArray(pose.hips,3) || !pose.rotations || Array.isArray(pose.rotations) ||
      Object.keys(pose.rotations).length > HUMANOID_SLOTS.length || Object.entries(pose.rotations).some(([n,v]) => !HUMANOID_SLOTS.includes(n) || !validQ(v));
    if (badPose || !['preview','strict'].includes(mode) || !['in-place','free','locked'].includes(rootMotion)) return {status:'UNSUPPORTED',applied:false,reasons:['invalid-pose-or-options']};
    if (['UNSUPPORTED','RIG_REQUIRED'].includes(report.status)) return {status:report.status,applied:false,reasons:[...reasons,'target-needs-rig-or-skin']};
    if (missingMotion.length) reasons.push(`missing-motion:${missingMotion.join(',')}`);
    if (report.missing.length) reasons.push(`missing-target:${report.missing.join(',')}`);
    if (report.inferred.length) reasons.push(`inferred:${report.inferred.join(',')}`);
    if (pose.bindingStatus !== 'PLAYABLE') reasons.push('approximate-source');
    const folded = TORSO.slice(1,-1).filter(n => !bones[n] && pose.rotations[n]);
    if (folded.length) reasons.push(`folded-torso:${folded.join(',')}`);
    // World displacement scales by measured legs when both bindings have them.
    const sourceRatio = pose.profile?.legLength / pose.profile?.height, targetRatio = profile.legLength / profile.height;
    const ratio = sourceRatio > 0 && Number.isFinite(sourceRatio) && targetRatio > 0 ? targetRatio/sourceRatio : 1;
    const gain = Math.max(.25,Math.min(4,ratio));
    if (gain !== ratio) reasons.push('proportion-gain-clamped');
    const delta = new Vector3(...pose.hips).multiplyScalar(profile.height*gain);
    if (!finiteArray(delta.toArray(),3)) return {status:'UNSUPPORTED',applied:false,reasons:['displacement-overflow']};
    if (rootMotion !== 'free') {delta.x=0;delta.z=0;}
    if (rootMotion === 'locked') delta.set(0,0,0);
    const limit=profile.height*2;
    if (Math.hypot(...delta.toArray())>limit) {const max=Math.max(...delta.toArray().map(Math.abs));delta.divideScalar(max).normalize().multiplyScalar(limit);reasons.push('displacement-clamped');}
    const status = reasons.length || report.status === 'DEGRADED' ? 'DEGRADED' : 'PLAYABLE';
    return {status,applied:mode !== 'strict' || status === 'PLAYABLE',reasons,missingMotion,folded,delta:delta.toArray(),rootMotion};
  }
  function apply(pose, settings) {
    const result = assess(pose,settings);
    if (!result.applied) return result;
    const rotations = Object.fromEntries(Object.entries(pose.rotations).map(([slot,value])=>[slot,q(value)]));
    // Fold serial torso deltas once into an existing ancestor. Never alias two semantic
    // slots to the same physical bone (which would overwrite the first rotation).
    for (const slot of result.folded) {
      const index=TORSO.indexOf(slot), destination=TORSO.slice(0,index).reverse().find(n=>bones[n]);
      if (destination) {
        const previous=rotations[destination] || new Quaternion();
        rotations[destination]=previous.multiply(rotations[slot]);
      }
    }
    reset();
    for (const [slot,bone] of Object.entries(bones)) {
      const delta=rotations[slot] || new Quaternion(), parentRest=directParentRest.get(bone);
      const worldDelta=worldFromCanonical.clone().multiply(delta).multiply(canonicalFromWorld);
      bone.quaternion.copy(parentRest.clone().invert().multiply(worldDelta).multiply(parentRest).multiply(transforms.get(bone).quaternion)).normalize();
    }
    // Convert displacement as a vector through the full parent matrix, preserving units,
    // orientation and non-uniform parent scale. Limb lengths remain target-owned.
    root.updateWorldMatrix(true,true);
    const canonicalDelta=new Vector3(...result.delta).applyQuaternion(binding.basis.clone().invert());
    const reference=new Matrix4().copy(restRootInverse).invert();
    const origin=new Vector3().applyMatrix4(reference), worldDelta=canonicalDelta.applyMatrix4(reference).sub(origin);
    const parent=bones.hips.parent, inv=new Matrix4().copy(parent?.matrixWorld || new Matrix4()).invert();
    const localOrigin=new Vector3().applyMatrix4(inv), localDelta=worldDelta.applyMatrix4(inv).sub(localOrigin);
    bones.hips.position.copy(transforms.get(bones.hips).position).add(localDelta);
    root.updateWorldMatrix(true,true);
    return result;
  }
  return {root,bones,profile,descriptor,reset,capture,assess,apply};
}
