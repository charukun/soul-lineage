import { Matrix4, Quaternion, Vector3 } from 'three';
import { createMasterCharacterPool, shinoHumanoidFromGLTF } from './master-character.js';

const check = (ok, message) => { if (!ok) throw new Error(message); };
const finite = (x, lo, hi) => typeof x === 'number' && Number.isFinite(x) && x >= lo && x <= hi;
const flat = root => { const result = []; root.traverse(node => result.push(node)); return result; };
const vec = (v, name) => { check(Array.isArray(v) && v.length === 3 && v.every(x => finite(x, -1e4, 1e4)), `Invalid ${name}`); return [...v]; };
const scalar = (v, fallback, lo, hi, name) => { const n = v ?? fallback; check(finite(n, lo, hi), `Invalid ${name}`); return n; };
const largestScale = v => Math.max(Math.abs(v.x), Math.abs(v.y), Math.abs(v.z));
const isAncestor = (head, tail) => { for (let p = tail.parent; p; p = p.parent) if (p === head) return true; return false; };
const categories = {
  overrideBlink: new Set(['blink', 'blinkLeft', 'blinkRight']),
  overrideMouth: new Set(['aa', 'ih', 'ou', 'ee', 'oh']),
  overrideLookAt: new Set(['lookUp', 'lookDown', 'lookLeft', 'lookRight'])
};

/** Read audited VRM1 metadata into descriptors referencing the loader-owned graph.
 * No VRM controller is copied; actors resolve every reference into their own cloned graph.
 * This is the raw-bone/PBR adapter, not a replacement MToon/VRM implementation.
 */
export async function shinoProductionRigFromGLTF(gltf) {
  const humanoid = await shinoHumanoidFromGLTF(gltf);
  const json = gltf.parser.json, rootNodes = new Set(flat(gltf.scene)), cache = new Map();
  async function node(index) {
    check(Number.isInteger(index) && index >= 0 && json.nodes?.[index], 'Invalid rig node index');
    if (!cache.has(index)) cache.set(index, gltf.parser.getDependency('node', index));
    const result = await cache.get(index);
    check(rootNodes.has(result), 'Rig node is outside the template'); return result;
  }
  const expressions = [], warnings = [], definition = json.extensions?.VRMC_vrm?.expressions ?? {};
  const rows = [...Object.entries(definition.preset ?? {}), ...Object.entries(definition.custom ?? {})];
  check(rows.length <= 128 && new Set(rows.map(([name]) => name)).size === rows.length, 'Invalid expression count or duplicate name');
  for (const [name, entry] of rows) {
    check(typeof name === 'string' && name.length <= 96 && entry && typeof entry === 'object', 'Invalid expression');
    if (entry.materialColorBinds?.length || entry.textureTransformBinds?.length) {
      warnings.push(`Expression ${name}: material/UV bindings require a material-specific adapter`); continue;
    }
    const binds = [];
    check(Array.isArray(entry.morphTargetBinds ?? []) && (entry.morphTargetBinds?.length ?? 0) <= 512, 'Invalid morph bindings');
    for (const bind of entry.morphTargetBinds ?? []) {
      check(Number.isInteger(bind.index) && bind.index >= 0, 'Invalid morph target index');
      const target = await node(bind.node), meshes = flat(target).filter(n => n.isMesh && n.morphTargetInfluences);
      check(meshes.length > 0 && meshes.every(m => bind.index < m.morphTargetInfluences.length), `Missing morph target for ${name}`);
      binds.push({ node: target, index: bind.index, weight: scalar(bind.weight, 1, 0, 1, 'morph weight') });
    }
    if (!binds.length) continue;
    const overrides = Object.fromEntries(Object.keys(categories).map(key => {
      const mode = entry[key] ?? 'none'; check(['none', 'block', 'blend'].includes(mode), 'Invalid expression override'); return [key, mode];
    }));
    check(entry.isBinary === undefined || typeof entry.isBinary === 'boolean', 'Invalid binary expression flag');
    expressions.push({ name, isBinary: entry.isBinary === true, ...overrides, binds });
  }
  const extension = json.extensions?.VRMC_springBone;
  if (extension) check(extension.specVersion === '1.0', 'Unsupported spring-bone version');
  const colliders = [];
  check((extension?.colliders?.length ?? 0) <= 512 && (extension?.springs?.length ?? 0) <= 256, 'Rig exceeds safety limits');
  for (const row of extension?.colliders ?? []) {
    const sphere = row.shape?.sphere, capsule = row.shape?.capsule;
    check(Boolean(sphere) !== Boolean(capsule), 'Unsupported or ambiguous spring collider');
    check(!row.extensions || Object.keys(row.extensions).length === 0, 'Extended spring colliders need a dedicated adapter');
    const shape = sphere || capsule;
    colliders.push({ node: await node(row.node), offset: vec(shape.offset ?? [0, 0, 0], 'collider offset'),
      radius: scalar(shape.radius, 0, 0, 100, 'collider radius'), tail: capsule ? vec(capsule.tail, 'capsule tail') : null });
  }
  const springs = [], used = new Set(); let jointCount = 0;
  for (const row of extension?.springs ?? []) {
    check(Array.isArray(row.joints) && row.joints.length >= 1 && row.joints.length <= 128, 'Invalid spring chain');
    const joints = [];
    for (const j of row.joints) {
      const target = await node(j.node);
      check(!used.has(target), 'Spring joints cannot belong to multiple chains'); used.add(target);
      joints.push({ node: target, stiffness: scalar(j.stiffness, 1, 0, 1e4, 'stiffness'),
        gravityPower: scalar(j.gravityPower, 0, 0, 1e4, 'gravity'), gravityDir: vec(j.gravityDir ?? [0, -1, 0], 'gravity direction'),
        dragForce: scalar(j.dragForce, .4, 0, 1, 'drag'), hitRadius: scalar(j.hitRadius, 0, 0, 100, 'hit radius') });
    }
    for (let i = 1; i < joints.length; i++) check(isAncestor(joints[i - 1].node, joints[i].node), 'Disconnected spring chain');
    jointCount += joints.length; check(jointCount <= 2048, 'Too many spring joints');
    const center = row.center === undefined ? null : await node(row.center);
    check(!center || center === joints[0].node || isAncestor(center, joints[0].node), 'Invalid spring center');
    const groups = row.colliderGroups ?? []; check(Array.isArray(groups), 'Invalid collider groups');
    const selected = new Set();
    for (const index of groups) {
      check(Number.isInteger(index) && Array.isArray(extension.colliderGroups?.[index]?.colliders), 'Missing collider group');
      for (const id of extension.colliderGroups[index].colliders) { check(Number.isInteger(id) && colliders[id], 'Missing collider'); selected.add(colliders[id]); }
    }
    springs.push({ center, joints, colliders: [...selected] });
  }
  // A chain's center may not be driven by another chain.
  for (const chain of springs) for (const other of springs) if (chain !== other && chain.center) {
    check(!other.joints.some(j => j.node === chain.center || isAncestor(j.node, chain.center)), 'Spring center depends on another chain');
  }
  return { humanoid, expressions, springs, warnings };
}

function expressionController(definitions, resolve) {
  const weights = new Map(), targets = new Map();
  const rows = definitions.map(row => ({ ...row, binds: row.binds.flatMap(bind =>
    flat(resolve(bind.node)).filter(n => n.isMesh && n.morphTargetInfluences).map(mesh => {
      check(bind.index < mesh.morphTargetInfluences.length, 'Cloned morph target mismatch');
      if (!targets.has(mesh)) targets.set(mesh, new Set()); targets.get(mesh).add(bind.index);
      return { mesh, index: bind.index, weight: bind.weight };
    })) }));
  const names = Object.freeze(rows.map(row => row.name));
  function apply() {
    for (const [mesh, indices] of targets) for (const index of indices) mesh.morphTargetInfluences[index] = 0;
    const effective = row => row.isBinary ? Number((weights.get(row.name) ?? 0) > .5) : (weights.get(row.name) ?? 0);
    const attenuation = {};
    for (const [key, members] of Object.entries(categories)) {
      let sum = 0;
      for (const row of rows) if (!members.has(row.name)) {
        const weight = effective(row);
        if (weight > 0 && row[key] === 'block') { sum = 1; break; }
        if (row[key] === 'blend') sum += weight;
      }
      attenuation[key] = 1 - Math.min(1, sum);
    }
    for (const row of rows) {
      let weight = effective(row);
      for (const [key, members] of Object.entries(categories)) if (members.has(row.name)) {
        weight *= row.isBinary && attenuation[key] < 1 ? 0 : attenuation[key];
      }
      for (const bind of row.binds) bind.mesh.morphTargetInfluences[bind.index] += weight * bind.weight;
    }
    for (const [mesh, indices] of targets) for (const index of indices) mesh.morphTargetInfluences[index] = Math.min(1, mesh.morphTargetInfluences[index]);
  }
  return { names, apply,
    setWeights(values) {
      check(values && typeof values === 'object' && !Array.isArray(values), 'Invalid expression values');
      const entries = Object.entries(values);
      check(entries.length <= names.length && entries.every(([name, value]) => names.includes(name) && finite(value, 0, 1)), 'Unknown expression or invalid weight');
      weights.clear(); entries.forEach(([name, value]) => weights.set(name, value)); apply();
    },
    set(name, value) { check(names.includes(name) && finite(value, 0, 1), 'Unknown expression or invalid weight'); weights.set(name, value); apply(); },
    reset() { weights.clear(); apply(); }
  };
}

/** Per-actor fixed-step VRM1 spring state. World forces, optional center space and
 * sphere/capsule collision are evaluated against this actor's cloned transforms.
 * No fabricated terminal joints; nonuniform collision radii use conservative max scale.
 * Spec references: vrm-c/vrm-specification, VRMC_springBone-1.0 and VRMC_vrm-1.0/expressions.
 */
function springController(actor, definitions, resolve) {
  const STEP = 1 / 60, origin = new Vector3(), restTail = new Vector3(), desired = new Vector3(), next = new Vector3();
  const direction = new Vector3(), center = new Vector3(), end = new Vector3(), segment = new Vector3(), scale = new Vector3();
  const local = new Vector3(), initial = new Vector3(), inverse = new Matrix4(), transport = new Matrix4(), rotation = new Quaternion();
  actor.root.updateWorldMatrix(true, true);
  const chains = definitions.map(row => ({ center: row.center ? resolve(row.center) : null, previousCenter: new Matrix4(),
    colliders: row.colliders.map(c => ({ ...c, node: resolve(c.node), offset: new Vector3(...c.offset), tail: c.tail ? new Vector3(...c.tail) : null })),
    joints: row.joints.slice(0, -1).map((j, i) => {
      const head = resolve(j.node), tail = resolve(row.joints[i + 1].node);
      head.updateWorldMatrix(true, true);
      const axis = head.worldToLocal(tail.getWorldPosition(new Vector3()));
      check(axis.lengthSq() > 1e-12, 'Zero-length spring joint');
      return { ...j, head, tail, axis, rest: head.quaternion.clone(), gravity: new Vector3(...j.gravityDir).normalize(),
        current: new Vector3(), previous: new Vector3() };
    }) }));
  let accumulated = 0, started = false, enabledLast = false;
  function reset() {
    for (const chain of chains) for (const j of chain.joints) j.head.quaternion.copy(j.rest);
    actor.root.updateWorldMatrix(true, true);
    for (const chain of chains) {
      if (chain.center) chain.previousCenter.copy(chain.center.matrixWorld);
      for (const j of chain.joints) { j.tail.getWorldPosition(j.current); j.previous.copy(j.current); }
    }
    accumulated = 0; started = true;
  }
  function constrain(point, length) {
    direction.copy(point).sub(origin);
    if (direction.lengthSq() < 1e-16) direction.copy(desired);
    point.copy(origin).add(direction.normalize().multiplyScalar(length));
  }
  function step() {
    for (const chain of chains) for (const j of chain.joints) {
      j.head.quaternion.copy(j.rest); j.head.updateWorldMatrix(true, false);
      origin.setFromMatrixPosition(j.head.matrixWorld);
      restTail.copy(j.axis).applyMatrix4(j.head.matrixWorld); desired.copy(restTail).sub(origin);
      const length = desired.length(); check(length > 1e-8 && Number.isFinite(length), 'Invalid transformed spring length');
      desired.normalize();
      next.copy(j.current).addScaledVector(direction.copy(j.current).sub(j.previous), 1 - j.dragForce)
        .addScaledVector(desired, j.stiffness * STEP).addScaledVector(j.gravity, j.gravityPower * STEP);
      constrain(next, length);
      const radius = j.hitRadius * largestScale(j.head.getWorldScale(scale));
      for (const c of chain.colliders) {
        c.node.updateWorldMatrix(true, false); center.copy(c.offset).applyMatrix4(c.node.matrixWorld);
        if (c.tail) {
          end.copy(c.tail).applyMatrix4(c.node.matrixWorld); segment.copy(end).sub(center);
          const t = segment.lengthSq() > 1e-16 ? Math.max(0, Math.min(1, direction.copy(next).sub(center).dot(segment) / segment.lengthSq())) : 0;
          center.addScaledVector(segment, t);
        }
        direction.copy(next).sub(center);
        const distance = direction.length(), combined = radius + c.radius * largestScale(c.node.getWorldScale(scale));
        if (distance < combined) {
          if (distance < 1e-12) direction.copy(desired); else direction.multiplyScalar(1 / distance);
          next.copy(center).addScaledVector(direction, combined); constrain(next, length);
        }
      }
      j.previous.copy(j.current); j.current.copy(next);
      inverse.copy(j.head.parent?.matrixWorld ?? new Matrix4()).invert();
      local.copy(next).applyMatrix4(inverse).sub(j.head.position).normalize();
      initial.copy(j.axis).multiply(j.head.scale).applyQuaternion(j.rest).normalize();
      rotation.setFromUnitVectors(initial, local); j.head.quaternion.copy(rotation).multiply(j.rest).normalize();
      j.head.updateWorldMatrix(false, true);
    }
  }
  return { jointCount: chains.reduce((n, c) => n + c.joints.length, 0), reset,
    update(deltaSeconds, enabled = true) {
      check(finite(deltaSeconds, 0, 60) && typeof enabled === 'boolean', 'Invalid secondary motion timing');
      if (!enabled) { if (enabledLast || !started) reset(); enabledLast = false; return; }
      if (!started || !enabledLast || deltaSeconds > .25) reset();
      enabledLast = true;
      actor.root.updateWorldMatrix(true, true);
      for (const chain of chains) if (chain.center) {
        transport.copy(chain.center.matrixWorld).multiply(inverse.copy(chain.previousCenter).invert());
        for (const j of chain.joints) { j.current.applyMatrix4(transport); j.previous.applyMatrix4(transport); }
      }
      accumulated = Math.min(accumulated + Math.min(deltaSeconds, .1), STEP * 4);
      for (; accumulated + 1e-10 >= STEP; accumulated -= STEP) step();
      for (const chain of chains) if (chain.center) chain.previousCenter.copy(chain.center.matrixWorld);
    }
  };
}

/** Opt-in extension of the existing pool. Existing game consumers keep their API.
 * Geometry, images and textures remain shared; expressions and spring history do not.
 */
export function createShinoProductionPool({ template, humanoid, rig, capacity = 30 }) {
  check(rig && Array.isArray(rig.expressions) && Array.isArray(rig.springs), 'Production rig is required');
  const pool = createMasterCharacterPool({ template, humanoid: humanoid ?? rig.humanoid, capacity });
  const source = flat(template), sourceIndex = new Map(source.map((node, i) => [node, i])), decorated = new WeakSet();
  return { ...pool,
    spawn(id) {
      const actor = pool.spawn(id);
      if (decorated.has(actor)) return actor;
      try {
        const clone = flat(actor.visual); check(clone.length === source.length, 'Production clone hierarchy mismatch');
        const resolve = node => { const i = sourceIndex.get(node); check(i !== undefined && clone[i], 'Production rig reference is outside the clone'); return clone[i]; };
        const expressions = expressionController(rig.expressions, resolve), springs = springController(actor, rig.springs, resolve);
        const sample = actor.sample.bind(actor), reset = actor.reset.bind(actor); let lastScale = '';
        actor.expressionNames = expressions.names;
        actor.secondaryJointCount = springs.jointCount;
        actor.setExpression = expressions.set;
        actor.setExpressions = expressions.setWeights;
        actor.clearExpressions = expressions.reset;
        actor.updateSecondary = springs.update;
        actor.resetSecondary = springs.reset;
        actor.sample = (appearance, time = 0, pose = null) => {
          sample(appearance, time, pose); expressions.apply();
          const signature = actor.root.scale.toArray().join(',');
          if (signature !== lastScale) { springs.reset(); lastScale = signature; }
        };
        actor.reset = () => { reset(); expressions.reset(); springs.reset(); lastScale = ''; };
        decorated.add(actor); return actor;
      } catch (error) { pool.despawn(id); throw error; }
    },
    diagnostics() { return { expressionNames: rig.expressions.map(e => e.name), springChains: rig.springs.length,
      springJoints: rig.springs.reduce((n, c) => n + Math.max(0, c.joints.length - 1), 0), warnings: [...(rig.warnings ?? [])] }; }
  };
}
