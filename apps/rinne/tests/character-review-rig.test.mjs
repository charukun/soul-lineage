import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Bone, Group } from 'three';
import { shinoProductionRigFromGLTF } from '@soul/rendering/master-character-production';
test('actual Shino JSON resolves expression and spring references inside one graph', async () => {
  // Exact asset metadata contract, not a substitute for a real GLTF/GPU browser test.
  const bytes = readFileSync(new URL('../public/simulator/assets/SHINO_review.vrm', import.meta.url));
  const json = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString('utf8'));
  const nodes = json.nodes.map(row => {
    const result = new Bone(); result.name = row.name ?? '';
    if (row.translation) result.position.fromArray(row.translation); if (row.rotation) result.quaternion.fromArray(row.rotation); if (row.scale) result.scale.fromArray(row.scale);
    if (row.mesh !== undefined) {
      result.isMesh = true; const mesh = json.meshes[row.mesh]; const count = mesh.primitives[0].targets?.length ?? 0;
      if (count) result.morphTargetInfluences = new Array(count).fill(0);
    }
    return result;
  });
  json.nodes.forEach((row, i) => (row.children ?? []).forEach(child => nodes[i].add(nodes[child])));
  const scene = new Group(); json.scenes[json.scene ?? 0].nodes.forEach(i => scene.add(nodes[i])); scene.updateMatrixWorld(true);
  const gltf = { scene, parser: { json, getDependency: async (type, i) => { assert.equal(type, 'node'); return nodes[i]; } } };
  const rig = await shinoProductionRigFromGLTF(gltf); assert.ok(rig.expressions.length > 0); assert.ok(rig.springs.length > 0); assert.equal(rig.warnings.length, 0, rig.warnings.join(', '));
  assert.ok(rig.springs.some(s => s.joints.length > 1));
  console.log(`Shino actual metadata: ${rig.expressions.length} expressions / ${rig.springs.length} spring chains`);
  const bad = structuredClone(json); bad.extensions.VRMC_springBone.springs[0].joints[0].node = json.nodes.length + 1;
  await assert.rejects(() => shinoProductionRigFromGLTF({ ...gltf, parser: { ...gltf.parser, json: bad } }), /rig node/);
});
