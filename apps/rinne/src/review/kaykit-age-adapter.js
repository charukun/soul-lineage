import { THREE } from '@soul/rendering';

const REQUIRED_BONES = Object.freeze(['hips', 'spine', 'chest', 'head']);
const HAIR_SURFACE = /hair|beard|moustache|mustache|brow|eyebrow/i;
const SKIN_SURFACE = /face|head|skin|body/i;
const GRAY = new THREE.Color('#b9bab6');
const SKIN_AGE = new THREE.Color('#d1b8a6');

function normalizedName(value = '') {
  return String(value).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function findBone(root, wanted) {
  const key = normalizedName(wanted);
  let exact = null;
  let suffix = null;
  root.traverse(node => {
    if (!node?.isBone) return;
    const name = normalizedName(node.name);
    if (!exact && name === key) exact = node;
    else if (!suffix && name.endsWith(key)) suffix = node;
  });
  return exact || suffix;
}

function classifySurface(node, material) {
  const nodeName = String(node?.name || '');
  const materialName = String(material?.name || '');
  const text = `${nodeName} ${materialName}`;
  if (HAIR_SURFACE.test(text)) return 'hair';
  if (SKIN_SURFACE.test(text)) return 'skin';
  return null;
}

function isolateAgeMaterials(root) {
  const rows = [];
  root.traverse(node => {
    if (!node?.isMesh || !node.material) return;
    const source = Array.isArray(node.material) ? node.material : [node.material];
    let changed = false;
    const next = source.map(material => {
      const kind = classifySurface(node, material);
      if (!kind || !material?.clone || !material.color) return material;
      const clone = material.clone();
      clone.name = `${material.name || node.name || 'KayKit'}:age-${kind}`;
      rows.push({ node, material: clone, baseColor: clone.color.clone(), kind });
      changed = true;
      return clone;
    });
    if (!changed) return;
    node.material = Array.isArray(node.material) ? next : next[0];
  });
  return rows;
}

export function resolveKayKitAgeBones(root) {
  if (!root?.traverse) throw new Error('KayKit aging requires a loaded scene root');
  const bones = Object.fromEntries(REQUIRED_BONES.map(name => [name, findBone(root, name)]));
  const missing = REQUIRED_BONES.filter(name => !bones[name]);
  if (missing.length) throw new Error(`KayKit Rig_Medium aging bones missing: ${missing.join(', ')}`);
  return bones;
}

/**
 * Review/runtime age presentation for KayKit Adventurers Rig_Medium.
 *
 * This does not manufacture age-specific DCC meshes. It applies the canonical
 * Rinne age curve to the real low-poly rig and safely isolated age surfaces.
 */
export function createKayKitAgeAdapter(root) {
  const bones = resolveKayKitAgeBones(root);
  const surfaces = isolateAgeMaterials(root);
  const base = {
    rootScale: root.scale.clone(),
    rootPosition: root.position.clone(),
    headScale: bones.head.scale.clone(),
    spineQ: bones.spine.quaternion.clone(),
    chestQ: bones.chest.quaternion.clone(),
    headQ: bones.head.quaternion.clone(),
  };
  const scaleVector = new THREE.Vector3(1, 1, 1);
  const xAxis = new THREE.Vector3(1, 0, 0);
  const rotation = new THREE.Quaternion();

  function reset() {
    root.scale.copy(base.rootScale);
    root.position.copy(base.rootPosition);
    bones.head.scale.copy(base.headScale);
    bones.spine.quaternion.copy(base.spineQ);
    bones.chest.quaternion.copy(base.chestQ);
    bones.head.quaternion.copy(base.headQ);
    for (const row of surfaces) row.material.color.copy(row.baseColor);
  }

  function apply(appearance, appearanceScale = [1, 1, 1]) {
    if (!appearance || !Number.isFinite(appearance.scale) || !Number.isFinite(appearance.headScale)) {
      throw new Error('KayKit aging received an invalid age appearance');
    }
    reset();
    scaleVector.fromArray(appearanceScale);
    root.scale.multiply(scaleVector).multiplyScalar(appearance.scale);
    bones.head.scale.multiplyScalar(appearance.headScale);

    // KayKit Rig_Medium faces +Z. Positive local X bends hips/spine/chest
    // forward; the head counter-rotates so the face remains readable.
    if (appearance.stoop > 0) {
      bones.spine.quaternion.multiply(rotation.setFromAxisAngle(xAxis, appearance.stoop * .62));
      bones.chest.quaternion.multiply(rotation.setFromAxisAngle(xAxis, appearance.stoop * .38));
      bones.head.quaternion.multiply(rotation.setFromAxisAngle(xAxis, -appearance.stoop * .38));
    }

    for (const row of surfaces) {
      row.material.color.copy(row.baseColor);
      if (row.kind === 'hair' && appearance.gray > 0) {
        row.material.color.lerp(GRAY, Math.min(1, appearance.gray * .88));
      } else if (row.kind === 'skin' && appearance.skinAge > 0) {
        row.material.color.lerp(SKIN_AGE, Math.min(.12, appearance.skinAge * .10));
        row.material.color.multiplyScalar(1 - .045 * appearance.skinAge);
      }
    }
    root.updateMatrixWorld(true);
    return report();
  }

  function report() {
    return {
      mode: 'kaykit-rig-medium-aging',
      boneNames: Object.fromEntries(Object.entries(bones).map(([name, bone]) => [name, bone.name])),
      hairSurfaces: surfaces.filter(row => row.kind === 'hair').length,
      skinSurfaces: surfaces.filter(row => row.kind === 'skin').length,
    };
  }

  return Object.freeze({ bones, reset, apply, report });
}
