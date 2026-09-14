from pathlib import Path
import subprocess

CONFLICTS = [
    'apps/rinne/src/character-workspace.js',
    'packages/characters/src/reference-models.js',
    'packages/characters/tests/reference-models.test.mjs',
    'scripts/validate.mjs',
]


def run(*args):
    subprocess.run(args, check=True)


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected one match, found {count}')
    return text.replace(old, new, 1)


# Start from the latest develop side for every true conflict, then reapply only the
# Shino DCC-specific behavior. This preserves all newer reference-model/runtime work.
run('git', 'checkout', '--theirs', '--', *CONFLICTS)

# Character Workspace: retain develop's runtime Reference Controller, but when Shino
# DCC is selected load the audited VRM directly and do not layer procedural parts on it.
path = Path('apps/rinne/src/character-workspace.js')
text = path.read_text(encoding='utf-8')
text = replace_once(
    text,
    "  const emit = () => window.dispatchEvent(new Event('character-workspace-change'));\n",
    "  const emit = () => window.dispatchEvent(new Event('character-workspace-change'));\n"
    "  function clearModelSelection() {\n"
    "    const previous = model(); modelId = null;\n"
    "    if (previous?.kind === 'dcc-character-model') void review.loadDefaultModel?.();\n"
    "  }\n",
    'workspace clearModelSelection',
)
text = replace_once(
    text,
    """      for (const actor of review.actors) {
        let controller = controllers.get(actor);
        if (!controller) {
          controller = attachModularAppearanceController(actor);
          controllers.set(actor, controller);
          referenceControllers.set(actor, attachReferenceCharacterController(actor));
          attached = true;
        }
        const referenceController = referenceControllers.get(actor);
        const index = review.records.findIndex(r => r.id === actor.id);
        const selectedReference = referenceModel && actor.id === selectedId ? referenceModel : null;
        const identity = selectedReference ?? (actor.id === previewId ? null : qualityIdentity(review.records[index], index, quality, profiles.get(actor.id)));
        const next = selectedReference ? selectedReference.profile : actor.id === previewId || quality.mode === 'baseline' ? BASE_APPEARANCE_PARTS : profile(actor.id);
        if (JSON.stringify(controller.identity) !== JSON.stringify(identity)) controller.setIdentity(identity);
        // Check the actual controller after pool recycling, not a stale signature cache.
        if (JSON.stringify(controller.profile) !== JSON.stringify(next)) controller.setProfile(next);
        referenceController.setIdentity(selectedReference);
      }
""",
    """      for (const actor of review.actors) {
        const index = review.records.findIndex(r => r.id === actor.id);
        const selectedReference = referenceModel && actor.id === selectedId ? referenceModel : null;
        // A DCC reference swaps the whole audited template/pool. Do not layer the
        // procedural modular/reference controllers back over that authored mesh.
        if (referenceModel?.kind === 'dcc-character-model') continue;
        let controller = controllers.get(actor);
        if (!controller) {
          controller = attachModularAppearanceController(actor);
          controllers.set(actor, controller);
          referenceControllers.set(actor, attachReferenceCharacterController(actor));
          attached = true;
        }
        const referenceController = referenceControllers.get(actor);
        const identity = selectedReference ?? (actor.id === previewId ? null : qualityIdentity(review.records[index], index, quality, profiles.get(actor.id)));
        const next = selectedReference ? selectedReference.profile : actor.id === previewId || quality.mode === 'baseline' ? BASE_APPEARANCE_PARTS : profile(actor.id);
        if (JSON.stringify(controller.identity) !== JSON.stringify(identity)) controller.setIdentity(identity);
        // Check the actual controller after pool recycling, not a stale signature cache.
        if (JSON.stringify(controller.profile) !== JSON.stringify(next)) controller.setProfile(next);
        referenceController.setIdentity(selectedReference);
      }
""",
    'workspace controller merge',
)
text = replace_once(
    text,
    "      modelId = next; previewId = null; sync(); emit();\n",
    "      const previous = model(); modelId = next; previewId = null; const selectedModel = model();\n"
    "      if (selectedModel?.kind === 'dcc-character-model') void review.loadReferenceModel?.(selectedModel);\n"
    "      else if (previous?.kind === 'dcc-character-model') void review.loadDefaultModel?.();\n"
    "      sync(); emit();\n",
    'workspace selectModel',
)
text = replace_once(text, "perform(() => { modelId = null; const settings = reviewSettings", "perform(() => { clearModelSelection(); const settings = reviewSettings", 'workspace generate')
text = replace_once(text, "perform(() => { const settings = reviewSettings({ ...review.settings, ages:", "perform(() => { clearModelSelection(); const settings = reviewSettings({ ...review.settings, ages:", 'workspace ages')
text = replace_once(text, "change(slot, value) { perform(() => { modelId = null;", "change(slot, value) { perform(() => { clearModelSelection();", 'workspace change')
text = replace_once(text, "edit(changes) { perform(() => review.editSelected(changes)); },", "edit(changes) { perform(() => { clearModelSelection(); review.editSelected(changes); }); },", 'workspace edit')
text = replace_once(text, "randomize() { perform(() => { modelId = null;", "randomize() { perform(() => { clearModelSelection();", 'workspace randomize')
text = replace_once(text, "previewOriginal() { modelId = null;", "previewOriginal() { clearModelSelection();", 'workspace preview')
path.write_text(text, encoding='utf-8')

# Reference catalog: preserve every develop runtime reference identity. Shino alone is
# backed by the exact-hash audited DCC asset while retaining the shared visual identity
# fields used by catalog/UX code.
path = Path('packages/characters/src/reference-models.js')
text = path.read_text(encoding='utf-8')
dcc_helper = """
function dccModel(spec) {
  const profile = parts(...spec.parts);
  const value = {
    version: 1,
    seed: spec.seed,
    role: spec.role,
    ageBand: spec.ageBand,
    parts: profile,
    front: spec.front,
    back: spec.back,
    face: Object.freeze({ ...FACE[spec.face] }),
    proportions: spec.proportions,
    gear: spec.gear,
    cloth: Object.freeze([...spec.referenceStyle.palette.primary]),
    trim: Object.freeze([...spec.referenceStyle.palette.accent]),
    hairValue: 1,
    id: spec.id,
    label: spec.label,
    kind: 'dcc-character-model',
    characterId: spec.characterId,
    masterId: MASTER_ID,
    assetId: spec.assetId,
    productionStage: 'PRIMARY',
    modelingMode: 'dcc-blender',
    productionReady: false,
    assetPath: spec.assetPath,
    integrityPath: spec.integrityPath,
    dccSourcePath: spec.dccSourcePath,
    referencePath: spec.referencePath,
    profile,
    referenceStyle: spec.referenceStyle,
    note: 'キャラクターリファレンスを正本にBlenderで専用造形したDCC PRIMARYモデル。旧Shinoの色替え/primitive blockoutではない。DEFORMATION以降と明示Visual Approvalは未完了。'
  };
  validateVisualIdentity(value);
  Object.freeze(value.face); Object.freeze(value.proportions); Object.freeze(value.parts); Object.freeze(value.profile);
  return Object.freeze(value);
}
"""
text = replace_once(text, "\nconst npcPath = name => `docs/characters/references/npc-role-set/${name}.avif`;\n", dcc_helper + "\nconst npcPath = name => `docs/characters/references/npc-role-set/${name}.avif`;\n", 'reference dcc helper')
text = replace_once(
    text,
    """  'shino.reference.v2': model({
    id: 'shino.reference.v2', label: 'Shino', characterId: 'Sendagaya_Shino', seed: 0x5348494e, role: 'traveller', ageBand: 'child',
    parts: ['round','bob','compact','mantle','none'], front: 'fringe', back: 'layered', face: 'soft', proportions: proportions(.94,.97,.94,1.08), gear: 'satchel',
    referencePath: 'docs/characters/references/shino/shino-character-reference-sheet-v2.png',
    referenceStyle: style('shino', .70, 'shino', { armStyle: 'blouse', legStyle: 'bare', footwear: 'boots', prop: 'satchel' })
  }),
""",
    """  'shino.reference.v2': dccModel({
    id: 'shino.reference.v2', label: 'Shino Reference v2 / DCC', characterId: 'Sendagaya_Shino', seed: 0x5348494e, role: 'traveller', ageBand: 'child',
    parts: ['round','bob','compact','mantle','none'], front: 'fringe', back: 'layered', face: 'soft', proportions: proportions(.94,.97,.94,1.08), gear: 'satchel',
    assetId: 'character.shino-reference-v2.dcc.v1',
    assetPath: './simulator/assets/SHINO_REFERENCE_V2.vrm',
    integrityPath: './simulator/assets/SHINO_REFERENCE_V2.asset.json',
    dccSourcePath: 'assets/characters/shino/reference-v2/source/ShinoReferenceV2.blend',
    referencePath: 'docs/characters/references/shino/shino-character-reference-sheet-v2.png',
    referenceStyle: style('shino', .70, 'shino', { armStyle: 'blouse', legStyle: 'bare', footwear: 'boots', prop: 'satchel' })
  }),
""",
    'reference Shino DCC entry',
)
path.write_text(text, encoding='utf-8')

# Catalog tests: all new develop references stay covered, with a dedicated contract
# assertion for the single DCC-backed Shino entry.
path = Path('packages/characters/tests/reference-models.test.mjs')
text = path.read_text(encoding='utf-8')
text = replace_once(
    text,
    """test('reference catalog exposes every Character References page model as runtime 3D identity', () => {
  assert.deepEqual(Object.keys(CHARACTER_REFERENCE_MODELS), EXPECTED);
  const assets = new Set();
  for (const id of EXPECTED) {
    const model = characterReferenceModel(id);
    assert.equal(model.masterId, MASTER_ID);
    assert.equal(model.kind, 'runtime-reference-model');
    assert.equal(model.id, id);
    assert.equal(model.profile, model.parts);
    assert.doesNotThrow(() => validateVisualIdentity(model));
    assert.equal(model.referenceStyle.version, 1);
    assert.ok(model.referenceStyle.scale > .5 && model.referenceStyle.scale <= 1);
    assert.equal(Object.isFrozen(model), true);
    assert.equal(Object.isFrozen(model.profile), true);
    assert.equal(Object.isFrozen(model.referenceStyle), true);
    assert.ok(!assets.has(model.assetId), `duplicate runtime asset id: ${model.assetId}`);
    assets.add(model.assetId);
  }
});

""",
    """test('reference catalog keeps runtime identities and upgrades Shino to audited DCC PRIMARY', () => {
  assert.deepEqual(Object.keys(CHARACTER_REFERENCE_MODELS), EXPECTED);
  const assets = new Set();
  for (const id of EXPECTED) {
    const model = characterReferenceModel(id);
    assert.equal(model.masterId, MASTER_ID);
    assert.equal(model.id, id);
    assert.equal(model.profile, model.parts);
    assert.doesNotThrow(() => validateVisualIdentity(model));
    assert.equal(model.referenceStyle.version, 1);
    assert.ok(model.referenceStyle.scale > .5 && model.referenceStyle.scale <= 1);
    assert.equal(Object.isFrozen(model), true);
    assert.equal(Object.isFrozen(model.profile), true);
    assert.equal(Object.isFrozen(model.referenceStyle), true);
    if (id === 'shino.reference.v2') {
      assert.equal(model.kind, 'dcc-character-model');
      assert.equal(model.assetId, 'character.shino-reference-v2.dcc.v1');
      assert.equal(model.productionStage, 'PRIMARY');
      assert.equal(model.modelingMode, 'dcc-blender');
      assert.equal(model.productionReady, false);
      assert.match(model.assetPath, /SHINO_REFERENCE_V2\\.vrm$/);
      assert.match(model.integrityPath, /SHINO_REFERENCE_V2\\.asset\\.json$/);
    } else {
      assert.equal(model.kind, 'runtime-reference-model');
    }
    assert.ok(!assets.has(model.assetId), `duplicate runtime asset id: ${model.assetId}`);
    assets.add(model.assetId);
  }
});

""",
    'reference catalog test',
)
text = replace_once(
    text,
    """test('every runtime reference model points at a committed reference sheet', () => {
  for (const model of Object.values(CHARACTER_REFERENCE_MODELS)) {
    const sheet = new URL(`../../../${model.referencePath}`, import.meta.url);
    assert.ok(statSync(sheet).size > 0, model.referencePath);
    assert.match(model.note, /ランタイム3D/);
  }
  assert.throws(() => characterReferenceModel('unknown.reference'), /Unknown character reference model/);
});
""",
    """test('every reference model points at a committed sheet and declares its runtime/DCC contract', () => {
  for (const model of Object.values(CHARACTER_REFERENCE_MODELS)) {
    const sheet = new URL(`../../../${model.referencePath}`, import.meta.url);
    assert.ok(statSync(sheet).size > 0, model.referencePath);
    if (model.kind === 'dcc-character-model') assert.match(model.note, /DCC PRIMARY/);
    else assert.match(model.note, /ランタイム3D/);
  }
  assert.throws(() => characterReferenceModel('unknown.reference'), /Unknown character reference model/);
});
""",
    'reference note test',
)
path.write_text(text, encoding='utf-8')

# Validation: keep develop's code-health guard and retain the character-production gate.
path = Path('scripts/validate.mjs')
text = path.read_text(encoding='utf-8')
needle = "run(process.execPath, ['scripts/check.mjs', ...selected]);\n"
text = replace_once(text, needle, needle + "if (full || selected.includes('@soul/characters')) run(process.execPath, ['scripts/check-character-production.mjs']);\n", 'validate production gate')
path.write_text(text, encoding='utf-8')

run('git', 'add', '--', *CONFLICTS)
