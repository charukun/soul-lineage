import {REQUIRED_POLISH_EXPRESSIONS} from './production-pipeline.js';

/** Shared expression semantics, independent of the authoring tool and rig provider.
 * Neutral is the unchanged mesh at zero weights. The other polish expressions
 * use named glTF morph targets; a texture swap is not a geometric morph.
 */
export const CHARACTER_EXPRESSION_CONTRACT = Object.freeze({
  schema: 'rinne.character-expressions/v1',
  names: REQUIRED_POLISH_EXPRESSIONS,
  range: Object.freeze([0, 1]),
  neutral: 'all-target-weights-zero',
  blink: 'close-both-eyelids',
  smile: 'raise-mouth-corners',
  'mouth-open': 'separate-lips-and-lower-jaw'
});

export function createCharacterExpressions(root, contract) {
  if (contract?.schema !== CHARACTER_EXPRESSION_CONTRACT.schema) throw new Error('Unsupported character expression contract');
  const targets = new Map(REQUIRED_POLISH_EXPRESSIONS.filter(name => name !== 'neutral').map(name => [name, []]));
  const morphMeshes = new Set();
  root.traverse(mesh => {
    if (!mesh.isMesh) return;
    if (mesh.morphTargetInfluences) morphMeshes.add(mesh);
    for (const [name, rows] of targets) {
      const index = mesh.morphTargetDictionary?.[name];
      if (index === undefined) continue;
      const attribute = mesh.geometry?.morphAttributes?.position?.[index];
      if (!attribute || attribute.count !== mesh.geometry.attributes.position.count || !mesh.morphTargetInfluences) {
        throw new Error(`Invalid geometric expression ${name} on ${mesh.name}`);
      }
      const base=mesh.geometry.attributes.position;
      const component=(a,i,axis)=>a.getComponent?a.getComponent(i,axis):a.array?.[i*3+axis];
      let maxDelta=0;
      for(let i=0;i<attribute.count;i++)for(let axis=0;axis<3;axis++){
        const value=component(attribute,i,axis),origin=mesh.geometry.morphTargetsRelative?0:component(base,i,axis);
        if(!Number.isFinite(value)||!Number.isFinite(origin))throw new Error(`Non-finite geometric expression ${name} on ${mesh.name}`);
        maxDelta=Math.max(maxDelta,Math.abs(value-origin));
      }
      rows.push({mesh, index, maxDelta});
    }
  });
  for (const [name, rows] of targets) {
    if (!rows.length) throw new Error(`Missing geometric expression ${name}`);
    if (!rows.some(row=>row.maxDelta>1e-8)) throw new Error(`Empty geometric expression ${name}`);
  }
  const reset = () => { for (const mesh of morphMeshes) mesh.morphTargetInfluences.fill(0); };
  reset();
  return Object.freeze({
    contract: CHARACTER_EXPRESSION_CONTRACT,
    reset,
    set(name, weight = 1) {
      if (!REQUIRED_POLISH_EXPRESSIONS.includes(name)) throw new Error(`Unknown expression ${name}`);
      if (!Number.isFinite(weight) || weight < 0 || weight > 1) throw new Error('Expression weight must be in [0, 1]');
      reset();
      for (const {mesh, index} of targets.get(name) || []) mesh.morphTargetInfluences[index] = weight;
    },
    snapshot() { return Object.fromEntries([...targets].map(([name, rows]) => [name, rows.map(({mesh, index, maxDelta}) => ({mesh: mesh.name, weight: mesh.morphTargetInfluences[index],maxDelta}))])); }
  });
}
