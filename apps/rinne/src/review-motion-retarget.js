import { Quaternion, Vector3 } from 'three';
import { normalizeHumanoidPose, retargetHumanoidPose } from '@soul/animations';
import { hierarchyQuaternion } from '@soul/rendering/motion-quality';

const normalize = value => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const PARENTS = Object.freeze({ hips: null, spine: 'hips', chest: 'spine', head: 'chest',
  leftUpperArm: 'chest', leftLowerArm: 'leftUpperArm', leftHand: 'leftLowerArm',
  rightUpperArm: 'chest', rightLowerArm: 'rightUpperArm', rightHand: 'rightLowerArm',
  leftUpperLeg: 'hips', leftLowerLeg: 'leftUpperLeg', leftFoot: 'leftLowerLeg', leftToes: 'leftFoot',
  rightUpperLeg: 'hips', rightLowerLeg: 'rightUpperLeg', rightFoot: 'rightLowerLeg', rightToes: 'rightFoot' });
const KAYKIT = Object.freeze({ hips: 'hips', spine: 'spine', chest: 'chest', head: 'head',
  leftUpperArm: 'upperarm.l', leftLowerArm: 'lowerarm.l', leftHand: 'hand.l',
  rightUpperArm: 'upperarm.r', rightLowerArm: 'lowerarm.r', rightHand: 'hand.r',
  leftUpperLeg: 'upperleg.l', leftLowerLeg: 'lowerleg.l', leftFoot: 'foot.l', leftToes: 'toes.l',
  rightUpperLeg: 'upperleg.r', rightLowerLeg: 'lowerleg.r', rightFoot: 'foot.r', rightToes: 'toes.r' });
const UNIVERSAL = Object.freeze({ hips: 'pelvis', spine: 'spine_01', chest: 'spine_03', head: 'head',
  leftUpperArm: 'upperarm_l', leftLowerArm: 'lowerarm_l', leftHand: 'hand_l',
  rightUpperArm: 'upperarm_r', rightLowerArm: 'lowerarm_r', rightHand: 'hand_r',
  leftUpperLeg: 'thigh_l', leftLowerLeg: 'calf_l', leftFoot: 'foot_l', leftToes: 'ball_l',
  rightUpperLeg: 'thigh_r', rightLowerLeg: 'calf_r', rightFoot: 'foot_r', rightToes: 'ball_r' });
const point = (rig, node) => rig.scene.worldToLocal(node.getWorldPosition(new Vector3()));
const orientation = (rig, node) => hierarchyQuaternion(rig.scene).invert().multiply(hierarchyQuaternion(node)).normalize();

// Capture immutable rest before ANY action. Targets own bone lengths and scales.
export function captureReviewRig(scene, family = 'kaykit') {
  scene.updateWorldMatrix(true, true);
  const nodes = new Map(), restNodes = [];
  scene.traverse(node => {
    nodes.set(normalize(node.name), node);
    restNodes.push({ node, position: node.position.clone(), quaternion: node.quaternion.clone(), scale: node.scale.clone() });
  });
  const names = family === 'kaykit' ? KAYKIT : UNIVERSAL, bones = {};
  for (const [key, name] of Object.entries(names)) {
    const bone = nodes.get(normalize(name));
    if (!bone) throw new Error(`Motion rig ${family} missing ${name}`);
    bones[key] = bone;
  }
  const rig = { scene, family, nodes, bones, restNodes };
  const positions = Object.fromEntries(Object.entries(bones).map(([key, node]) => [key, point(rig, node).toArray()]));
  const floor = Math.min(...['leftFoot', 'rightFoot', 'leftToes', 'rightToes'].map(key => positions[key][1]));
  const height = positions.hips[1] - floor;
  if (!(height > .1 && height < 10)) throw new Error('Invalid motion rig hip height');
  // Virtual parent chains fold source-only clavicles, spine links and neck into
  // the next mapped joint. This is an adapter to the existing normalization
  // contract, not a second retarget math implementation.
  const virtual = {};
  for (const [key, node] of Object.entries(bones)) {
    const parent = PARENTS[key] ? orientation(rig, bones[PARENTS[key]]) : new Quaternion();
    virtual[key] = { parentWorld: parent.toArray(), local: parent.clone().invert().multiply(orientation(rig, node)).normalize().toArray() };
  }
  rig.rest = { height, hips: positions.hips, bones: virtual };
  rig.floor = floor;
  rig.positions = positions;
  rig.reset = () => {
    for (const row of restNodes) { row.node.position.copy(row.position); row.node.quaternion.copy(row.quaternion); row.node.scale.copy(row.scale); }
    scene.updateWorldMatrix(true, true);
  };
  return rig;
}
function virtualPose(rig) {
  rig.scene.updateWorldMatrix(true, true);
  const rotations = {};
  for (const [key, node] of Object.entries(rig.bones)) {
    const parent = PARENTS[key] ? orientation(rig, rig.bones[PARENTS[key]]) : new Quaternion();
    rotations[key] = parent.invert().multiply(orientation(rig, node)).normalize().toArray();
  }
  return { rotations, hips: point(rig, rig.bones.hips).toArray() };
}
export function inspectReviewRig(rig) {
  rig.scene.updateWorldMatrix(true, true);
  const points = Object.fromEntries(Object.entries(rig.bones).map(([key, node]) => [key, point(rig, node).toArray()]));
  const values = Object.values(points).flat();
  const radii = Object.values(points).map(p => Math.hypot(p[0], p[2]));
  return { finite: values.every(Number.isFinite), minY: Math.min(...Object.values(points).map(p => p[1])),
    maxRadius: Math.max(...radii), height: Math.max(...Object.values(points).map(p => p[1])), points };
}
export function createReviewMotionBridge(source, target) {
  if (source === target) return { apply() {}, lastLift: 0, mode: 'native' };
  const scale = target.rest.height / source.rest.height;
  const native = source.family === 'kaykit';
  const sourceRest = new Map(source.restNodes.map(row => [normalize(row.node.name), row]));
  const targetRest = new Map(target.restNodes.map(row => [normalize(row.node.name), row]));
  const bridge = { mode: native ? 'rig-medium' : 'normalized-humanoid', lastLift: 0,
    apply() {
      target.reset();
      source.scene.updateWorldMatrix(true, true);
      if (native) {
        // Same Rig_Medium: keep every matching wrist/toe rotation, never import
        // mesh/IK-control transforms or source-dependent bone translations.
        for (const [name, node] of target.nodes) {
          const origin = source.nodes.get(name), rest = sourceRest.get(name), own = targetRest.get(name);
          if (!origin || !rest || !own || (!node.isBone && !Object.values(target.bones).includes(node))) continue;
          node.quaternion.copy(origin.quaternion).multiply(rest.quaternion.clone().invert()).multiply(own.quaternion).normalize();
          if (name === 'hips') node.position.copy(own.position).add(origin.position.clone().sub(rest.position).multiplyScalar(scale));
        }
      } else {
        const canonical = normalizeHumanoidPose(virtualPose(source), source.rest);
        // Source pelvis displacement is measured in scene space, not in the
        // source's Z-up root local frame. Horizontal travel stays in place.
        canonical.hips[0] = 0; canonical.hips[2] = 0;
        const raw = retargetHumanoidPose(canonical, target.rest);
        for (const [key, node] of Object.entries(target.bones)) {
          const parent = PARENTS[key] ? hierarchyQuaternion(target.bones[PARENTS[key]]) : hierarchyQuaternion(target.scene);
          const world = parent.multiply(new Quaternion().fromArray(raw.rotations[key]));
          node.quaternion.copy(hierarchyQuaternion(node.parent).invert().multiply(world)).normalize();
          if (key === 'hips') node.position.copy(node.parent.worldToLocal(target.scene.localToWorld(new Vector3().fromArray(raw.hips))));
          node.updateWorldMatrix(false, true);
        }
      }
      target.scene.updateWorldMatrix(true, true);
      // A target proportion change may put a supporting joint slightly below
      // its rest floor. One common vertical offset preserves all limb lengths.
      const minY = inspectReviewRig(target).minY;
      bridge.lastLift = native ? 0 : Math.max(0, target.floor - minY);
      if (bridge.lastLift > 0) {
        const hips = target.bones.hips, world = hips.getWorldPosition(new Vector3());
        const up = new Vector3(0, bridge.lastLift, 0).applyQuaternion(hierarchyQuaternion(target.scene));
        hips.position.copy(hips.parent.worldToLocal(world.add(up)));
        target.scene.updateWorldMatrix(true, true);
      }
    }
  };
  return bridge;
}
