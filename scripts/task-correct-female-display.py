from pathlib import Path

catalog = Path('packages/characters/src/reference-model-catalog.js')
text = catalog.read_text()
if 'excludeMeshNodes' not in text:
    old = "  sourceModelId: 'kaykit.rogue.v1',"
    assert text.count(old) == 1
    text = text.replace(old, old + "\n  sourceDisplay: { excludeMeshNodes: ['Knife_Offhand', '1H_Crossbow', '2H_Crossbow', 'Knife', 'Throwable'] },")
    catalog.write_text(text)

runtime = Path('apps/character-studio/src/review/character/runtime.js')
text = runtime.read_text()
old = "return load(() => modelBytes(assetUrl.href, { cache: 'no-store' }), auditReferenceDocument, kaykitReviewRig);"
new = """return load(() => modelBytes(assetUrl.href, { cache: 'no-store' }), auditReferenceDocument, async gltf => {
        // Bundled weapon samples are not the protagonist's owned equipment.
        // Exclude only display meshes before framing/cloning; the verified original
        // GLB, body, clothing, skeleton and attachment bones remain unchanged.
        for (const name of model.sourceDisplay?.excludeMeshNodes || []) {
          const mesh = gltf.scene.getObjectByName(name);
          if (!mesh?.isMesh) throw new Error(`除外対象の素材メッシュが見つかりません: ${name}`);
          mesh.removeFromParent();
        }
        return kaykitReviewRig(gltf);
      });"""
if old in text:
    assert text.count(old) == 1
    runtime.write_text(text.replace(old, new))
else:
    assert 'excludeMeshNodes' in text

probe = Path('scripts/task-observe-female-rogue.mjs')
text = probe.read_text()
for old, new in [
    ("['upperarm.r', 'z', .5]", "['rightUpperArm', 'z', .5]"),
    ("['lowerarm.r', 'x', .6]", "['rightLowerArm', 'x', .6]"),
    ("['lowerleg.l', 'x', -.6]", "['leftLowerLeg', 'x', -.6]"),
    ('const bone = root.getObjectByName(name);', 'const bone = r.actors[0].bones[name];')
]:
    text = text.replace(old, new)
marker = "  assert.ok(receipt.runtime.names.includes('Rogue_Body'));"
addition = "\n  for (const name of ['Knife_Offhand','1H_Crossbow','2H_Crossbow','Knife','Throwable']) assert.ok(!receipt.runtime.names.includes(name), name);"
if addition not in text:
    assert marker in text
    text = text.replace(marker, marker + addition)
probe.write_text(text)

test_path = Path('packages/characters/tests/female-protagonist-source.test.mjs')
text = test_path.read_text()
if 'bundled weapon sample meshes are excluded' not in text:
    text += """

test('bundled weapon sample meshes are excluded from display without altering the source or skeleton', () => {
  assert.deepEqual(model.sourceDisplay.excludeMeshNodes, ['Knife_Offhand', '1H_Crossbow', '2H_Crossbow', 'Knife', 'Throwable']);
  const joints = new Set(doc.skins.flatMap(skin => skin.joints));
  for (const name of model.sourceDisplay.excludeMeshNodes) {
    const index = doc.nodes.findIndex(node => node.name === name);
    assert.ok(index >= 0 && Number.isInteger(doc.nodes[index].mesh), name);
    assert.equal(joints.has(index), false, name);
  }
});
"""
    test_path.write_text(text)

note = Path('docs/characters/PROTAGONIST_FEMALE_REPLACEMENT.md')
text = note.read_text()
if '武器見本' not in text:
    note.write_text(text + '\n公式原本に同梱された武器見本5メッシュは、主人公女の表示時だけ外す。\nGLB原本は無改変。身体・髪・衣装・Rig・手持ちソケットは残し、\nモデル鑑賞とゲーム上の装備所有を混同しない。\n')
