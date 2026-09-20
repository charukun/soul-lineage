import {Box3, Matrix4, Quaternion, Vector3} from 'three';

export const HUMANOID_BINDING_VERSION = 1;
const SIDES = ['left', 'right'];
const ALIASES = {
  hips: ['hips', 'pelvis'], spine: ['spine', 'spine01', 'tospine'],
  chest: ['chest', 'spine1', 'spine02'], upperChest: ['upperchest', 'spine2', 'spine03'],
  neck: ['neck', 'neck01'], head: ['head'],
};
for (const side of SIDES) {
  const s = side[0];
  ALIASES[`${side}UpperArm`] = [`upperarm${s}`, `${side}upperarm`, `${side}arm`];
  ALIASES[`${side}LowerArm`] = [`lowerarm${s}`, `forearm${s}`, `${side}lowerarm`, `${side}forearm`];
  ALIASES[`${side}Hand`] = [`hand${s}`, `${side}hand`];
  ALIASES[`${side}UpperLeg`] = [`upperleg${s}`, `thigh${s}`, `${side}upperleg`, `${side}upleg`];
  ALIASES[`${side}LowerLeg`] = [`lowerleg${s}`, `calf${s}`, `${side}lowerleg`, `${side}leg`];
  ALIASES[`${side}Foot`] = [`foot${s}`, `${side}foot`];
}
export const HUMANOID_SLOTS = Object.freeze(Object.keys(ALIASES));
export const HUMANOID_CORE = Object.freeze(HUMANOID_SLOTS.filter(n => !['chest', 'upperChest', 'neck'].includes(n)));
const key = name => String(name || '').replace(/^.*[:|]/, '').replace(/^mixamorig/i, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const helper = name => /twist|finger|thumb|index|middle|ring|pinky|leaf|end.?site|ik[._]|^ik_|^ctrl/i.test(name);
const finite = values => values.every(Number.isFinite);
export function rotationOf(node) {
  const chain = []; for (let n = node; n; n = n.parent) chain.push(n);
  const q = new Quaternion(); for (const n of chain.reverse()) q.multiply(n.quaternion);
  return q.normalize();
}

/** Read-only binding inspection. Call on a fresh/rest-pose scene, before any mixer runs.
 * Paths, never UUIDs, form the override/receipt contract. One physical joint gets one slot.
 * Geometry inference is only a low-confidence upright biped preview, not auto-rigging.
 */
export function inspectHumanoid(root, {role = 'target', mapping = {}, basis = [0, 0, 0, 1], assetHash = '', infer = true} = {}) {
  if (!root?.traverse || !['source', 'target'].includes(role)) throw new Error('Humanoid scene and role required');
  if (!Array.isArray(basis) || basis.length !== 4 || !finite(basis) || Math.hypot(...basis) < 1e-8) throw new Error('Invalid canonical basis');
  const orientation = new Quaternion(...basis).normalize(), issues = [], entries = [], skins = [];
  function visit(node, path) {
    entries.push({node, path}); node.children.forEach((child, i) => visit(child, `${path}/${i}`));
  }
  visit(root, '0'); root.updateWorldMatrix(true, true);
  const inverse = new Matrix4().copy(root.matrixWorld).invert();
  const byNode = new Map(entries.map(e => [e.node, e]));
  const bound = new Set();
  for (const {node} of entries) if (node.isSkinnedMesh) {
    skins.push(node); for (const bone of node.skeleton?.bones || []) bound.add(bone);
  }
  const invalidTransforms = entries.some(({node}) => !finite([...node.position.toArray(), ...node.quaternion.toArray(), ...node.scale.toArray()]) || node.quaternion.lengthSq() < 1e-12 || node.scale.toArray().some(v => v <= 0));
  if (invalidTransforms) issues.push('invalid-transform');
  const malformedSkin = skins.some(n => {
    const a = n.geometry?.attributes;
    if (!n.skeleton?.bones?.length || !a?.position || !a.skinIndex || !a.skinWeight || a.skinIndex.itemSize !== 4 || a.skinWeight.itemSize !== 4 || a.skinIndex.count !== a.position.count || a.skinWeight.count !== a.position.count || !n.skeleton.bones.every(b => byNode.has(b))) return true;
    for (let i=0;i<a.position.count;i++) {
      let sum=0;
      for (let j=0;j<4;j++) {
        const weight=a.skinWeight.getComponent(i,j), index=a.skinIndex.getComponent(i,j);
        if (!Number.isFinite(weight) || weight < 0 || !Number.isInteger(index) || index < 0 || index >= n.skeleton.bones.length) return true;
        sum+=weight;
      }
      if (!(sum>1e-8) || Math.abs(sum-1)>.02) return true;
    }
    return false;
  });
  if (malformedSkin) issues.push('invalid-skin');
  let candidates = entries.filter(({node}) => (node.isBone || bound.has(node)) && !helper(node.name));
  // glTF animation-only joints may be ordinary Object3Ds when there is no skin.
  if (!candidates.length && role === 'source') candidates = entries.filter(({node}) => node !== root && !node.isMesh && !node.isCamera && !node.isLight && !helper(node.name));
  const point = node => node.getWorldPosition(new Vector3()).applyMatrix4(inverse).applyQuaternion(orientation);
  for (const e of candidates) e.point = point(e.node);
  const bones = {}, methods = {}, paths = {}, used = new Set();
  function assign(slot, entry, method) {
    if (!entry || bones[slot] || used.has(entry.node)) return false;
    bones[slot] = entry.node; methods[slot] = method; paths[slot] = entry.path; used.add(entry.node); return true;
  }
  for (const [slot, path] of Object.entries(mapping)) {
    if (!HUMANOID_SLOTS.includes(slot)) throw new Error(`Unknown humanoid slot: ${slot}`);
    const e = candidates.find(e => e.path === path);
    if (!e || !assign(slot, e, 'explicit')) throw new Error(`Invalid or duplicate humanoid override: ${slot}`);
  }
  // CMU's ToSpine -> Spine -> Spine1 is intentionally not the Mixamo chain.
  const cmu = candidates.some(e => key(e.node.name) === 'tospine');
  for (const [slot, aliases] of Object.entries(ALIASES)) {
    if (bones[slot]) continue;
    const names = cmu && ['spine', 'chest', 'upperChest'].includes(slot) ? [{spine:'tospine', chest:'spine', upperChest:'spine1'}[slot]] : aliases;
    const matches = candidates.filter(e => !used.has(e.node) && names.includes(key(e.node.name)));
    if (matches.length === 1) assign(slot, matches[0], 'named');
    else if (matches.length > 1) issues.push(`ambiguous:${slot}`);
  }
  const descendant = (child, parent) => { for (let p = child?.parent; p; p = p.parent) if (p === parent) return true; return false; };
  const children = entry => candidates.filter(e => e !== entry && descendant(e.node, entry.node) && !candidates.some(mid => mid !== entry && mid !== e && descendant(e.node, mid.node) && descendant(mid.node, entry.node)));
  const box = new Box3(); candidates.forEach(e => box.expandByPoint(e.point));
  const extent = box.getSize(new Vector3()), h = extent.y, middle = box.getCenter(new Vector3());
  if (infer && candidates.length > 128) issues.push('inference-budget');
  if (infer && candidates.length <= 128 && h > 1e-6 && !invalidTransforms) {
    if (!bones.hips && !issues.some(i => i === 'ambiguous:hips')) {
      const hips = candidates.filter(e => {
        const c = children(e);
        return Math.abs(e.point.x - middle.x) < h * .14 && c.some(n => n.point.y > e.point.y + h * .025) &&
          c.some(n => n.point.y < e.point.y - h * .025 && n.point.x > e.point.x) &&
          c.some(n => n.point.y < e.point.y - h * .025 && n.point.x < e.point.x);
      });
      if (hips.length === 1) assign('hips', hips[0], 'inferred');
    }
    const hip = candidates.find(e => e.node === bones.hips);
    if (hip) {
      const center = []; let cur = hip;
      for (let i = 0; i < 8; i++) {
        const up = children(cur).filter(e => e.point.y > cur.point.y + h * .008 && Math.abs(e.point.x - hip.point.x) < h * .14);
        if (up.length !== 1) break;
        cur = up[0]; center.push(cur);
      }
      if (center.length >= 2) {
        assign('head', center.at(-1), 'inferred'); assign('spine', center[0], 'inferred');
        if (center.length > 2) assign('chest', center[1], 'inferred');
        if (center.length > 3) assign('upperChest', center[2], 'inferred');
      }
      function chain(start) {
        const list = [start]; let cur = start;
        for (let i = 0; i < 4; i++) { const next = children(cur); if (next.length !== 1) break; cur = next[0]; list.push(cur); }
        return list;
      }
      for (const side of SIDES) {
        const sign = side === 'left' ? 1 : -1;
        const leg = children(hip).filter(e => e.point.y < hip.point.y - h * .025 && (e.point.x - hip.point.x) * sign > h * .015);
        if (leg.length === 1) chain(leg[0]).slice(0, 3).forEach((e, i) => assign(`${side}${['UpperLeg', 'LowerLeg', 'Foot'][i]}`, e, 'inferred'));
        const arms = center.slice(0, -1).flatMap(e => children(e)).filter(e => !center.includes(e) && (e.point.x - hip.point.x) * sign > h * .06);
        if (arms.length === 1) {
          const c = chain(arms[0]);
          // An extra proximal joint is a shoulder, not an elbow to be aliased twice.
          const offset = c.length >= 4 ? 1 : 0;
          c.slice(offset, offset + 3).forEach((e, i) => assign(`${side}${['UpperArm', 'LowerArm', 'Hand'][i]}`, e, 'inferred'));
        }
      }
    }
  }
  // Never combine separate armatures or trust a misleading node name over hierarchy.
  for (const slot of HUMANOID_SLOTS) if (slot !== 'hips' && bones[slot] && bones.hips && !descendant(bones[slot], bones.hips)) {
    issues.push(`outside-hips:${slot}`); delete bones[slot]; delete paths[slot]; delete methods[slot];
  }
  for (const side of SIDES) for (const chain of [['UpperArm','LowerArm','Hand'],['UpperLeg','LowerLeg','Foot']]) {
    for (let i=1; i<chain.length; i++) {
      const parent = bones[side+chain[i-1]], child = bones[side+chain[i]];
      if (parent && child && !descendant(child,parent)) {
        issues.push(`invalid-chain:${side+chain[i]}`); delete bones[side+chain[i]]; delete paths[side+chain[i]]; delete methods[side+chain[i]];
      }
    }
  }
  const missing = HUMANOID_CORE.filter(slot => !bones[slot]);
  const inferred = Object.keys(methods).filter(slot => methods[slot] === 'inferred');
  const visibleMeshes = entries.filter(e => e.node.isMesh).length;
  const driven = role === 'source' || skins.some(n => n.skeleton.bones.some(b => Object.values(bones).includes(b)));
  const status = invalidTransforms || malformedSkin ? 'UNSUPPORTED' : !driven || !bones.hips || Object.keys(bones).length < 3 ? 'RIG_REQUIRED' : missing.length || inferred.length || issues.length ? 'DEGRADED' : 'PLAYABLE';
  const distance = (a,b) => bones[a] && bones[b] ? point(bones[a]).distanceTo(point(bones[b])) : null;
  const lengths = SIDES.map(side => ({leg: distance(side+'UpperLeg',side+'LowerLeg') != null && distance(side+'LowerLeg',side+'Foot') != null ? distance(side+'UpperLeg',side+'LowerLeg') + distance(side+'LowerLeg',side+'Foot') : null,
    arm: distance(side+'UpperArm',side+'LowerArm') != null && distance(side+'LowerArm',side+'Hand') != null ? distance(side+'UpperArm',side+'LowerArm') + distance(side+'LowerArm',side+'Hand') : null}));
  const mean = key => {const v=lengths.map(n=>n[key]).filter(n=>n>0);return v.length?v.reduce((a,b)=>a+b,0)/v.length:null;};
  // Skeleton extent avoids helmets/weapons changing displacement scale. It is not physical stature.
  const height = h > 1e-6 && Number.isFinite(h) ? h : 1;
  const legLength=mean('leg'), armLength=mean('arm'), shoulderWidth=distance('leftUpperArm','rightUpperArm');
  const proportions = legLength == null ? 'unclassified' : legLength/height < .4 ? 'short-legged' : legLength/height > .58 ? 'long-legged' : 'standard';
  return {root, bones, entries, basis:orientation, profile:{height,legLength,armLength,shoulderWidth,proportions,measurement:'rest-skeleton-extent'},
    report:{version:HUMANOID_BINDING_VERSION,assetHash,role,status,missing,inferred,issues,mapping:paths,methods,visibleMeshes,skinCount:skins.length,
      basis:orientation.toArray(),productionApproved:false}};
}
