/* Raw-bone adaptation of the rest-space approach in norio/vrm-game-starter.
 * MIT notice: ../licenses/norio-MIT.txt (also retained in built asset-review/licenses).
 * Authored motion is Quaternius CC0.
 * No generated poses, normalized-VRM rig, gameplay clock or movement controller.
 */
import { AnimationClip, AnimationMixer, LoopOnce, Quaternion, QuaternionKeyframeTrack, Vector3, VectorKeyframeTrack } from 'three';
export const SOURCE_HUMANOID = {
  'DEF-hips':'hips','DEF-spine001':'spine','DEF-spine002':'chest','DEF-spine003':'upperChest','DEF-neck':'neck','DEF-head':'head',
};
for (const [suffix, side] of [['L','left'],['R','right']]) {
  for (const [source, target] of Object.entries({shoulder:'Shoulder',upper_arm:'UpperArm',forearm:'LowerArm',hand:'Hand',thigh:'UpperLeg',shin:'LowerLeg',foot:'Foot',toe:'Toes'})) SOURCE_HUMANOID[`DEF-${source}${suffix}`] = side + target;
  for (const [source, target] of [['thumb','Thumb'],['f_index','Index'],['f_middle','Middle'],['f_ring','Ring'],['f_pinky','Little']]) {
    const names = source === 'thumb' ? ['Metacarpal','Proximal','Distal'] : ['Proximal','Intermediate','Distal'];
    names.forEach((name, i) => { SOURCE_HUMANOID[`DEF-${source}0${i + 1}${suffix}`] = side + target + name; });
  }
}
Object.freeze(SOURCE_HUMANOID);
const required = ['hips','spine','head', ...['left','right'].flatMap(side => ['UpperArm','LowerArm','Hand','UpperLeg','LowerLeg','Foot'].map(part => side + part))];
const snapshot = root => { const rows = []; root.traverse(node => rows.push({node,p:node.position.clone(),q:node.quaternion.clone(),s:node.scale.clone()})); return rows; };
const restore = rows => rows.forEach(({node,p,q,s}) => { node.position.copy(p); node.quaternion.copy(q); node.scale.copy(s); });
/** Output clips target raw UUIDs, including non-humanoid intermediate parents. */
export async function createQuaterniusRetargeter(library, target) {
  const defs = target.parser?.json?.extensions?.VRMC_vrm?.humanoid?.humanBones;
  if (!defs || !target.scene) throw new Error('VRM 1.0 raw humanoid metadata is required');
  const bones = Object.fromEntries(await Promise.all(Object.entries(defs).map(async ([name, entry]) => [name, await target.parser.getDependency('node', entry.node)])));
  const source = Object.fromEntries(Object.entries(SOURCE_HUMANOID).map(([name,human]) => [human, library.scene.getObjectByName(name)]));
  for (const name of required) if (!bones[name] || !source[name]) throw new Error(`Retarget bone missing: ${name}`);
  const restClip = library.animations.find(clip => clip.name === 'A_TPose');
  if (!restClip) throw new Error('Authored A_TPose clip is missing; bind-pose guessing is disabled');
  const original = snapshot(library.scene), targetRest = snapshot(target.scene);
  const sourceMixer = new AnimationMixer(library.scene);
  const restAction = sourceMixer.clipAction(restClip).setLoop(LoopOnce, 1); restAction.clampWhenFinished = true;
  restAction.play(); sourceMixer.setTime(0); library.scene.updateMatrixWorld(true);
  const authoredRest = snapshot(library.scene);
  target.scene.updateMatrixWorld(true);
  const byNode = new Map();
  const mapped = Object.keys(bones).filter(name => source[name]).map(name => {
    const row = {name,from:source[name],to:bones[name],
      sourceInverse:source[name].getWorldQuaternion(new Quaternion()).invert(),
      targetWorld:bones[name].getWorldQuaternion(new Quaternion())};
    byNode.set(row.to,row); return row;
  });
  // Traverse the real target hierarchy, not an assumed humanoid parent table.
  const ordered = []; target.scene.traverse(node => { if (byNode.has(node)) ordered.push(byNode.get(node)); });
  const hipsSource = source.hips.getWorldPosition(new Vector3());
  const hipsTarget = bones.hips.getWorldPosition(new Vector3());
  const height = (map, hips) => hips.y - (map.leftFoot.getWorldPosition(new Vector3()).y + map.rightFoot.getWorldPosition(new Vector3()).y) / 2;
  const ratio = height(bones, hipsTarget) / height(source, hipsSource);
  if (!Number.isFinite(ratio) || ratio < .02 || ratio > 50) throw new Error('Invalid retarget scale');
  sourceMixer.stopAllAction(); sourceMixer.uncacheAction(restClip);
  restore(original); library.scene.updateMatrixWorld(true);
  const cache = new Map();
  return {
    bones,
    clipNames: library.animations.filter(clip => clip.name !== 'A_TPose').map(clip => clip.name),
    getClip(name, {inPlace = true} = {}) {
      const key = `${name}:${inPlace}`;
      if (cache.has(key)) return cache.get(key);
      const input = library.animations.find(clip => clip.name === name);
      if (!input || !Number.isFinite(input.duration) || input.duration <= 0 || input.duration > 120) throw new Error(`Invalid source clip: ${name}`);
      const times = [...new Set([0, input.duration, ...input.tracks.flatMap(track => Array.from(track.times))])].filter(t => t >= 0 && t <= input.duration).sort((a,b) => a-b);
      if (times.length > 5000) throw new Error(`Too many keyframes: ${name}`);
      const rotations = new Map(mapped.map(row => [row.to, []])), positions = [];
      sourceMixer.stopAllAction(); restore(authoredRest);
      const action = sourceMixer.clipAction(input).reset().setLoop(LoopOnce, 1); action.clampWhenFinished = true; action.play();
      const q = new Quaternion(), world = new Quaternion(), inverseParent = new Quaternion(), p = new Vector3();
      try {
        for (const time of times) {
          restore(authoredRest); action.paused = false; sourceMixer.setTime(time); library.scene.updateMatrixWorld(true);
          restore(targetRest); target.scene.updateMatrixWorld(true);
          for (const row of ordered) {
            world.copy(row.from.getWorldQuaternion(q)).multiply(row.sourceInverse).multiply(row.targetWorld).normalize();
            row.to.parent?.updateWorldMatrix(true, false);
            if (row.to.parent) row.to.quaternion.copy(inverseParent.copy(row.to.parent.getWorldQuaternion(q)).invert()).multiply(world).normalize();
            else row.to.quaternion.copy(world);
            row.to.updateWorldMatrix(false, false);
            const values = rotations.get(row.to);
            if (values.length && row.to.quaternion.dot(new Quaternion().fromArray(values, values.length - 4)) < 0) { row.to.quaternion.x *= -1; row.to.quaternion.y *= -1; row.to.quaternion.z *= -1; row.to.quaternion.w *= -1; }
            row.to.quaternion.toArray(values, values.length);
          }
          p.copy(source.hips.getWorldPosition(new Vector3())).sub(hipsSource).multiplyScalar(ratio);
          if (inPlace) { p.x = 0; p.z = 0; }
          p.add(hipsTarget); bones.hips.parent?.worldToLocal(p); p.toArray(positions, positions.length);
        }
        const tracks = ordered.map(row => new QuaternionKeyframeTrack(`${row.to.uuid}.quaternion`, times, rotations.get(row.to)));
        tracks.push(new VectorKeyframeTrack(`${bones.hips.uuid}.position`, times, positions));
        for (const track of tracks) if (!Array.from(track.values).every(Number.isFinite)) throw new Error(`Non-finite retarget track: ${track.name}`);
        const result = new AnimationClip(name, input.duration, tracks); cache.set(key, result); return result;
      } finally { sourceMixer.stopAllAction(); sourceMixer.uncacheAction(input); restore(original); restore(targetRest); library.scene.updateMatrixWorld(true); target.scene.updateMatrixWorld(true); }
    },
    dispose() { sourceMixer.stopAllAction(); sourceMixer.uncacheRoot(library.scene); cache.clear(); },
  };
}
