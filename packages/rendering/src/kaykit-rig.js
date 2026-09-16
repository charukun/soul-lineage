const REQUIRED = Object.freeze({
  hips: ['hips'],
  spine: ['spine'],
  head: ['head'],
  leftUpperArm: ['upperarm.l', 'leftupperarm'],
  leftLowerArm: ['lowerarm.l', 'leftlowerarm'],
  leftHand: ['hand.l', 'lefthand'],
  leftUpperLeg: ['upperleg.l', 'leftupperleg'],
  leftLowerLeg: ['lowerleg.l', 'leftlowerleg'],
  leftFoot: ['foot.l', 'leftfoot'],
  rightUpperArm: ['upperarm.r', 'rightupperarm'],
  rightLowerArm: ['lowerarm.r', 'rightlowerarm'],
  rightHand: ['hand.r', 'righthand'],
  rightUpperLeg: ['upperleg.r', 'rightupperleg'],
  rightLowerLeg: ['lowerleg.r', 'rightlowerleg'],
  rightFoot: ['foot.r', 'rightfoot']
});
const OPTIONAL = Object.freeze({ chest: ['chest'] });

const normalize = value => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');

function aliases(values) {
  return values.map(normalize).filter(Boolean);
}

function findBone(rows, names) {
  const wanted = aliases(names);
  for (const bone of rows) {
    const name = normalize(bone.name);
    if (wanted.includes(name)) return bone;
  }
  for (const bone of rows) {
    const name = normalize(bone.name);
    if (wanted.some(value => name.endsWith(value))) return bone;
  }
  return null;
}

/**
 * Map KayKit's public Rig_Medium bone names to the renderer's provider-neutral
 * humanoid contract. Rig_Medium is the shared rig-family identifier, not a
 * required glTF scene-node label. Missing required bones still fail closed
 * instead of silently substituting the legacy VRM rig.
 */
export function kaykitHumanoidFromGLTF(gltf) {
  if (!gltf?.scene?.traverse) throw new Error('KayKit Rig_Medium requires a loaded glTF scene');
  const nodes = [];
  gltf.scene.traverse(node => nodes.push(node));
  const bones = nodes.filter(node => node?.isBone);
  const humanoid = {};
  for (const [key, names] of Object.entries(REQUIRED)) humanoid[key] = findBone(bones, names);
  for (const [key, names] of Object.entries(OPTIONAL)) {
    const bone = findBone(bones, names);
    if (bone) humanoid[key] = bone;
  }
  const missing = Object.entries(REQUIRED).filter(([key]) => !humanoid[key]).map(([key]) => key);
  if (missing.length) throw new Error(`KayKit Rig_Medium bones missing: ${missing.join(', ')}`);
  return Object.freeze(humanoid);
}

export const KAYKIT_HUMANOID_BONES = Object.freeze(Object.keys(REQUIRED));
