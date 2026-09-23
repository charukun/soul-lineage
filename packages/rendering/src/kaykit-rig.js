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

const HUMANOID_LINKS = Object.freeze([
  ['hips', 'spine'],
  ['spine', 'head'],
  ['spine', 'leftUpperArm'],
  ['leftUpperArm', 'leftLowerArm'],
  ['leftLowerArm', 'leftHand'],
  ['spine', 'rightUpperArm'],
  ['rightUpperArm', 'rightLowerArm'],
  ['rightLowerArm', 'rightHand'],
  ['hips', 'leftUpperLeg'],
  ['leftUpperLeg', 'leftLowerLeg'],
  ['leftLowerLeg', 'leftFoot'],
  ['hips', 'rightUpperLeg'],
  ['rightUpperLeg', 'rightLowerLeg'],
  ['rightLowerLeg', 'rightFoot']
].map(edge => Object.freeze(edge)));

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

function isAncestor(ancestor, node) {
  for (let parent = node?.parent; parent; parent = parent.parent) if (parent === ancestor) return true;
  return false;
}

function validateHierarchy(humanoid) {
  const invalid = HUMANOID_LINKS.filter(([parent, child]) => !isAncestor(humanoid[parent], humanoid[child]));
  if (invalid.length) {
    throw new Error(`KayKit Rig_Medium hierarchy invalid: ${invalid.map(([parent, child]) => `${child} must descend from ${parent}`).join(', ')}`);
  }
}

/**
 * Map KayKit's public Rig_Medium bone names to the renderer's provider-neutral
 * humanoid contract. Rig_Medium is the shared rig-family identifier, not a
 * required glTF scene-node label. Missing bones or broken humanoid ancestry
 * fail closed instead of silently substituting the legacy VRM rig.
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
  validateHierarchy(humanoid);
  return Object.freeze(humanoid);
}

export const KAYKIT_HUMANOID_BONES = Object.freeze(Object.keys(REQUIRED));
export const KAYKIT_HUMANOID_EDGES = HUMANOID_LINKS;
