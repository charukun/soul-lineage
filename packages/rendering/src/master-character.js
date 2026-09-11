import { AnimationMixer, Box3, Color, Group, Matrix4, Quaternion, Vector3 } from 'three';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
const required = ['hips', 'spine', 'head', ...['left', 'right'].flatMap(s => ['UpperArm', 'LowerArm', 'Hand', 'UpperLeg', 'LowerLeg', 'Foot'].map(n => s + n))];
const check = (ok, message) => { if (!ok) throw new Error(message); };
const bounded = (x, lo, hi) => typeof x === 'number' && Number.isFinite(x) && x >= lo && x <= hi;
const xAxis = new Vector3(1, 0, 0);
function nodes(root) { const result = []; root.traverse(n => result.push(n)); return result; }
function mats(mesh) { return Array.isArray(mesh.material) ? mesh.material : [mesh.material]; }
function color3(c) { return Array.isArray(c) && c.length === 3 && c.every(n => bounded(n, 0, 1)); }
function validAppearance(p) {
  check(p && bounded(p.scale, .4, 1) && bounded(p.headScale, 1, 1.22) && bounded(p.height, .9, 1.1) &&
    bounded(p.width, .88, 1.12) && bounded(p.gray, 0, 1) && bounded(p.stoop, 0, .25) &&
    bounded(p.skinAge, 0, 1) && bounded(p.adultHeightMetres, .5, 3) &&
    typeof p.canEquipWeapon === 'boolean' && typeof p.dead === 'boolean' && ['skin', 'hair', 'eyes', 'dye'].every(k => color3(p[k])), 'Invalid appearance descriptor');
}
/**
 * Parsed glTF is loader-owned. Each actor owns bones/morph weights/material uniforms;
 * immutable geometry/images/textures are shared. Raw-bone clips are required: a VRM
 * normalized rig needs its own humanoid bridge and must not be shallow-cloned.
 */
export function createMasterCharacterPool({ template, humanoid, capacity = 30 }) {
  check(template?.isObject3D && Number.isInteger(capacity) && capacity >= 1 && capacity <= 30, 'Invalid character pool');
  const sourceNodes = nodes(template), indices = new Map(sourceNodes.map((n, i) => [n, i]));
  check(required.every(n => humanoid[n]?.isBone && indices.has(humanoid[n])), 'Humanoid bones must be inside the cloned root');
  template.updateMatrixWorld(true);
  const box = new Box3().setFromObject(template), sourceHeight = box.max.y - box.min.y;
  check(Number.isFinite(sourceHeight) && sourceHeight > .1 && sourceHeight < 100, 'Invalid model bounds');
  const active = new Map(), spare = [], all = new Set(); let destroyed = false;
  function allocate() {
    const visual = cloneSkeleton(template), clonedNodes = nodes(visual);
    check(clonedNodes.length === sourceNodes.length, 'Cloned hierarchy mismatch');
    const mapping = new Map(sourceNodes.map((node, i) => [node.uuid, clonedNodes[i].uuid]));
    const bones = Object.fromEntries(Object.entries(humanoid).map(([name, n]) => [name, clonedNodes[indices.get(n)]]));
    const rest = new Map(Object.values(bones).filter(Boolean).map(b => [b, { p: b.position.clone(), q: b.quaternion.clone(), s: b.scale.clone() }]));
    const root = new Group(); root.add(visual); visual.position.y -= box.min.y;
    const visualRest = { p: visual.position.clone(), q: visual.quaternion.clone(), s: visual.scale.clone() };
    const attachments = new Group(), ownedMaterials = new Map(), skeletons = new Set();
    visual.traverse(mesh => {
      if (!mesh.isMesh) return;
      // Conservative culling at actor level; a rest-pose mesh bound is unsafe for animation.
      mesh.frustumCulled = false; mesh.castShadow = false; mesh.receiveShadow = false;
      if (mesh.morphTargetInfluences) mesh.morphTargetInfluences = mesh.morphTargetInfluences.slice();
      if (mesh.skeleton) skeletons.add(mesh.skeleton);
      const copy = material => {
        if (!ownedMaterials.has(material)) {
          const m = material.clone();
          const role = /HAIR/i.test(m.name) ? 'hair' : /EyeIris/i.test(m.name) ? 'eyes' : /SKIN/i.test(m.name) ? 'skin' : /CLOTH/i.test(m.name) ? 'dye' : 'other';
          const tint = { value: new Color(1, 1, 1) }, gray = { value: 0 };
          const originalColor = m.color?.clone();
          if (role === 'hair') {
            // Standard glTF PBR materials. Keep the same shader cache key for every actor.
            const previous = material.onBeforeCompile;
            m.onBeforeCompile = (shader, renderer) => {
              previous.call(m, shader, renderer);
              check(shader.fragmentShader.includes('#include <map_fragment>'), 'Hair shader needs a material-specific tint adapter');
              shader.uniforms.masterHair = tint; shader.uniforms.masterGray = gray;
              shader.fragmentShader = 'uniform vec3 masterHair;\nuniform float masterGray;\n' + shader.fragmentShader.replace('#include <map_fragment>',
                '#include <map_fragment>\nfloat mcL = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));\ndiffuseColor.rgb = mix(masterHair * (0.45 + 0.55 * mcL), vec3(0.55 + 0.3 * mcL), masterGray);');
            };
            const previousKey = material.customProgramCacheKey();
            m.customProgramCacheKey = () => `${previousKey}:master-hair-v1`;
          }
          ownedMaterials.set(material, { m, role, tint, gray, originalColor });
        }
        return ownedMaterials.get(material).m;
      };
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map(copy) : copy(mesh.material);
    });
    const mixer = new AnimationMixer(visual), sockets = new Map(); let clip = null, appearance = null;
    const instance = {
      id: null, root, visual, bones, attachments,
      setClip(sourceClip) {
        mixer.stopAllAction(); if (clip) mixer.uncacheClip(clip); clip = null;
        if (!sourceClip) return;
        clip = sourceClip.clone();
        for (const track of clip.tracks) {
          for (const [from, to] of mapping) if (track.name.startsWith(`${from}.`)) { track.name = to + track.name.slice(from.length); break; }
        }
        mixer.clipAction(clip).play();
      },
      /** Sample only when the pose scheduler is due; sample time must be absolute. */
      sample(p, timeSeconds = 0, pose = null) {
        validAppearance(p); check(bounded(timeSeconds, 0, 1e12) && (pose === null || typeof pose === 'function'), 'Invalid pose sample');
        appearance = p;
        visual.position.copy(visualRest.p); visual.quaternion.copy(visualRest.q); visual.scale.copy(visualRest.s);
        for (const [b, r] of rest) { b.position.copy(r.p); b.quaternion.copy(r.q); b.scale.copy(r.s); }
        if (clip) mixer.setTime(timeSeconds);
        if (pose) pose(bones, timeSeconds);
        if (!p.dead) {
          bones.spine.quaternion.multiply(new Quaternion().setFromAxisAngle(xAxis, p.stoop * .62));
          if (bones.chest) bones.chest.quaternion.multiply(new Quaternion().setFromAxisAngle(xAxis, p.stoop * .38));
          bones.head.quaternion.multiply(new Quaternion().setFromAxisAngle(xAxis, -p.stoop * .38));
        }
        bones.head.scale.copy(rest.get(bones.head).s).multiplyScalar(p.headScale);
        const unit = p.adultHeightMetres / sourceHeight;
        root.scale.set(unit * p.scale * p.width, unit * p.scale * p.height, unit * p.scale * p.width);
        for (const { m, role, tint, gray, originalColor } of ownedMaterials.values()) {
          if (role === 'hair') { tint.value.setRGB(...p.hair); gray.value = p.gray; }
          else if (role !== 'other' && originalColor) m.color.copy(originalColor).multiply(new Color(...p[role]));
        }
        instance.updateAttachments();
      },
      /** Weapons stay uniform scale, outside the nonuniform character hierarchy. Caller owns object. */
      attachWeapon(key, object, { bone = 'rightHand', position = [0, 0, 0], quaternion = [0, 0, 0, 1], scale = 1 } = {}) {
        check(typeof key === 'string' && !sockets.has(key) && object?.isObject3D && !object.parent && bones[bone], 'Invalid or already attached weapon');
        check(Array.isArray(position) && position.length === 3 && position.every(x => bounded(x, -2, 2)) &&
          Array.isArray(quaternion) && quaternion.length === 4 && quaternion.every(x => bounded(x, -1, 1)) &&
          Math.abs(Math.hypot(...quaternion) - 1) < .001 && bounded(scale, .01, 10), 'Invalid socket transform');
        const socket = new Group(); socket.position.fromArray(position); socket.quaternion.fromArray(quaternion); bones[bone].add(socket);
        const holder = new Group(); holder.matrixAutoUpdate = false; holder.add(object); attachments.add(holder);
        sockets.set(key, { socket, holder, object, scale }); instance.updateAttachments();
      },
      detachWeapon(key) {
        const entry = sockets.get(key); if (!entry) return null;
        entry.socket.removeFromParent(); entry.holder.removeFromParent(); entry.object.removeFromParent(); sockets.delete(key); return entry.object;
      },
      updateAttachments() {
        root.updateWorldMatrix(true, true); attachments.updateWorldMatrix(true, false);
        const inverse = new Matrix4().copy(attachments.matrixWorld).invert();
        for (const { socket, holder, scale } of sockets.values()) {
          holder.visible = Boolean(appearance?.canEquipWeapon && !appearance?.dead && root.visible);
          const position = socket.getWorldPosition(new Vector3()), quaternion = socket.getWorldQuaternion(new Quaternion()).normalize();
          holder.matrix.copy(inverse).multiply(new Matrix4().compose(position, quaternion, new Vector3().setScalar(scale * (appearance?.scale ?? 1))));
          holder.matrixWorldNeedsUpdate = true;
        }
      },
      setVisible(visible) { check(typeof visible === 'boolean', 'Invalid visibility'); root.visible = visible; attachments.visible = visible; },
      reset() {
        instance.setClip(null); [...sockets.keys()].forEach(key => instance.detachWeapon(key));
        root.removeFromParent(); attachments.removeFromParent(); root.position.set(0, 0, 0); root.quaternion.identity(); root.scale.setScalar(1);
        root.visible = true; attachments.visible = true; appearance = null;
        visual.position.copy(visualRest.p); visual.quaternion.copy(visualRest.q); visual.scale.copy(visualRest.s);
        for (const [b, r] of rest) { b.position.copy(r.p); b.quaternion.copy(r.q); b.scale.copy(r.s); }
        visual.traverse(mesh => { if (mesh.morphTargetInfluences) mesh.morphTargetInfluences.fill(0); });
      },
      destroy() { instance.reset(); mixer.uncacheRoot(visual); ownedMaterials.forEach(({ m }) => m.dispose()); skeletons.forEach(s => s.dispose()); }
    };
    all.add(instance); return instance;
  }
  return {
    spawn(id) {
      check(!destroyed && typeof id === 'string' && /^[a-zA-Z0-9._:-]{1,96}$/.test(id) && !active.has(id), 'Invalid spawn');
      check(active.size < capacity, 'Character pool exhausted');
      const instance = spare.pop() || allocate(); instance.id = id; active.set(id, instance); return instance;
    },
    despawn(id) {
      check(!destroyed, 'Pool is disposed'); const instance = active.get(id); if (!instance) return false;
      instance.reset(); instance.id = null; active.delete(id); spare.push(instance); return true;
    },
    stats() {
      const geometries = new Set(), textures = new Set(), materials = new Set(); let meshes = 0;
      for (const instance of all) instance.visual.traverse(n => { if (!n.isMesh) return; meshes++; geometries.add(n.geometry); mats(n).forEach(m => {
        materials.add(m); for (const value of Object.values(m)) if (value?.isTexture) textures.add(value);
      }); });
      return { active: active.size, allocated: all.size, meshes, geometries: geometries.size, textures: textures.size, materials: materials.size };
    },
    dispose() { if (destroyed) return; destroyed = true; all.forEach(i => i.destroy()); all.clear(); active.clear(); spare.length = 0; }
  };
}
/** glTF parser supplies raw skin bones; do not reuse gltf.userData.vrm controllers on clones. */
export async function shinoHumanoidFromGLTF(gltf) {
  const rows = gltf?.parser?.json?.extensions?.VRMC_vrm?.humanoid?.humanBones;
  check(rows && gltf.scene, 'VRM 1.0 humanoid metadata is required');
  return Object.fromEntries(await Promise.all(Object.entries(rows).map(async ([name, entry]) => [name, await gltf.parser.getDependency('node', entry.node)])));
}
