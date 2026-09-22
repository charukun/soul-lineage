"""Task-scoped migration, removed before final validation. Never synthesizes geometry."""
import json
import shutil
from pathlib import Path

ROOT = Path('.')
ACQUISITION = 'apps/review/public/library/provenance/female-protagonist-rogue-v1.json'
source = json.loads(Path(ACQUISITION).read_text())
asset_path = source['path']
library_path = asset_path.removeprefix('apps/review/public/library/')
url = 'https://soul-lineage-review-dev.c-okamoto.workers.dev/library/' + library_path
assert source['gitBlobSha'] == 'c8827661105eef7b2bfbef3bc676d41a47625733'
assert source['sha256'] == 'e825437cd4d2ee9c1960b517a74a69101e33eb409ae7fa8cedc7134a998fbb7d'

catalog = Path('packages/characters/src/reference-model-catalog.js')
text = catalog.read_text()
start = text.index('const femaleProtagonist = {')
end = text.index('validateVisualIdentity(femaleProtagonist);', start)
replacement = """// The previous authored head/hair model was explicitly rejected. This role now
// selects the unchanged official Rogue mesh, not a new procedural approximation.
const femaleProtagonist = {
  ...protagonist,
  id: PROTAGONIST_VILLAGER_FEMALE_MODEL_ID,
  label: '主人公・女 / KayKit Rogue（公式CC0原形）',
  characterId: 'Protagonist_Villager_Female_V1',
  assetId: 'character.protagonist-villager-female.v1',
  modelingMode: 'imported-reviewed',
  productionStage: 'REFERENCE',
  productionReady: false,
  visualApproval: 'pending',
  procedural: false,
  sourceModelId: 'kaykit.rogue.v1',
  license: 'CC0-1.0',
  assetPath: projectAssetUrl('model/c8827661105eef7b2bfbef3bc676d41a47625733/Rogue.glb'),
  integrityPath: './simulator/assets/PROTAGONIST_VILLAGER_FEMALE_V1.asset.json',
  dccSourcePath: 'apps/review/public/library/model/c8827661105eef7b2bfbef3bc676d41a47625733/Rogue.glb',
  referencePath: 'apps/review/public/library/provenance/female-protagonist-rogue-v1.json',
  referenceStyle: {
    ...protagonist.referenceStyle,
    design: 'protagonist-female-kaykit-rogue-original'
  },
  production: {
    ...protagonist.production,
    authority: {
      ...protagonist.production.authority,
      implementedModularParts: ['kaykit-rogue-original-head-body-hair-clothing'],
      proposedParts: [],
      gameEquipment: []
    },
    requirements: {
      ...protagonist.production.requirements,
      topology: 'kaykit-original-unmodified',
      sourceProvenanceRequired: true
    }
  },
  note: '旧自作の頭部・顔・ボブ髪モデルは破棄。Kay Lousberg作 KayKit Adventurers 1.0 の公式CC0 Rogue.glbを固定revisionから取得し、原本の顔・髪・服・Rig_Medium・UV・埋込テクスチャ・モーションを無改変で採用。実体は自前Asset Originへ収録。旧IDは選択互換のためだけに維持し、旧モデルへfallbackしない。新規採用のためREFERENCE / visualApproval=pending / productionReady=falseを維持。装備所有・操作・当たり判定は変更しない。'
};
"""
text = text[:start] + replacement + text[end:]
text = "import { projectAssetUrl } from '../../assets/src/runtime-origin.js';\n" + text
catalog.write_text(text)

receipt = {
    'schema': 'character-asset-integrity', 'version': 1,
    'id': source['id'], 'assetId': 'character.protagonist-villager-female.v1',
    'format': 'glb', 'path': url, 'sha256': source['sha256'], 'bytes': source['bytes'],
    'gitBlobSha': source['gitBlobSha'], 'productionStage': 'REFERENCE',
    'modelingMode': 'imported-reviewed', 'sourcePath': asset_path,
    'humanoidRig': 'kaykit.Rig_Medium.v1', 'referencePath': ACQUISITION,
    'visualApproval': 'pending', 'productionReady': False,
    'license': {'spdx': 'CC0-1.0', 'author': source['author'],
        'rigProvenance': 'Official KayKit Adventurers 1.0 Rogue / Rig_Medium; revision ' + source['revision'] + '; CC0-1.0.',
        'surfaceAuthorship': 'Kay Lousberg. Original Rogue.glb retained byte-for-byte; no RINNE-generated head, hair, clothing or geometry.'},
    'source': {key: source[key] for key in ['repository','revision','sourceUrl','assetPage','originalFilename','conversion']}
}
for app in ['rinne', 'character-studio']:
    path = Path(f'apps/{app}/public/simulator/assets/PROTAGONIST_VILLAGER_FEMALE_V1.asset.json')
    path.write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + '\n')
    Path(f'apps/{app}/public/simulator/assets/PROTAGONIST_VILLAGER_FEMALE_V1.glb').unlink()

production = {
    'schema': 'character-production', 'version': 2, 'id': source['id'],
    'stage': 'REFERENCE', 'modelingMode': 'imported-reviewed', 'license': 'CC0-1.0',
    'source': {'referencePaths': [ACQUISITION], 'meshPath': asset_path,
        'integrityPath': 'apps/rinne/public/simulator/assets/PROTAGONIST_VILLAGER_FEMALE_V1.asset.json',
        'rigId': 'kaykit.Rig_Medium.v1', 'rigProvenance': receipt['license']['rigProvenance'],
        'import': {'author': source['author'], 'revision': source['revision'], 'url': source['sourceUrl'],
                   'sha256': source['sha256'], 'gitBlobSha': source['gitBlobSha'], 'conversion': source['conversion']}},
    'evidence': {'reference': {'intentLocked': True, 'views': [], 'sourceAuditPath': ACQUISITION}},
    'status': {'visualApproval': 'pending', 'productionReady': False, 'licensePolicy': 'allowed-cc0',
        'distributionEligible': True,
        'note': 'Original external replacement, not an iteration of the retired authored model. Prior visual approvals and DCC evidence do not carry over. Fixed-view/runtime observation is task evidence; explicit human approval and physical-device performance acceptance remain pending.'}
}
Path('packages/characters/production/protagonist-villager-female-v1.production.json').write_text(json.dumps(production, ensure_ascii=False, indent=2)+'\n')

# The compatibility identifier is retained; the rejected geometry and its
# regeneration paths are removed so selecting it cannot revive the old asset.
shutil.rmtree('assets/characters/protagonist/villager-female-v1')
shutil.rmtree('docs/characters/qa/protagonist-villager-female-v1')
Path('docs/characters/references/protagonist-villager-female-v1.svg').unlink()
for path in ['scripts/blender/build-protagonist-villager-female-v1.py','scripts/blender/refine-protagonist-villager-female-v1.py']:
    Path(path).unlink()
Path('docs/characters/PROTAGONIST_FEMALE_REPLACEMENT.md').write_text('''# 女主人公の外部モデル差し替え\n\n2026-09-22: ユーザーの明示的な破棄依頼により、旧自作モデルを廃止。\n\n採用: Kay Lousberg / KayKit Adventurers 1.0 / Rogue（フードなし）。\nCC0-1.0の公式GLBを無改変で保持。顔・髪・服を自作で置き換えない。\n\n正本は `apps/review/public/library/provenance/female-protagonist-rogue-v1.json`。\nGit blob / SHA-256 / bytes / 原典URL / revision / ライセンスを固定。\nモデル実体は同監査票の `path` にあり、自前Cloudflare Asset Originから配信。\n\n`protagonist.villager.female.v1` は選択互換IDとしてだけ継続する。\n旧SHA-256 `7c422960add80f120d5dbcd91a6b74e23269b35049796f60cb1e6c4e4604d9a2` の\nGLB、Blender原本、再生成スクリプト、旧参照画、旧QA画像は現行ツリーから除去。\n履歴はGitに残るがactive候補でもfallbackでもない。\n\n旧PRIMARYと旧視覚証拠は継承しない。新規採用モデルはREFERENCE、\nvisualApproval=pending / productionReady=false。男主人公、セーブ、成長、\n戦闘、装備所有、共通リグ・ソケット契約は変更しない。\n''')

runtime = Path('apps/character-studio/src/review/character/runtime.js')
text = runtime.read_text()
old = "license: 'CC0-1.0 / RINNE DCC', source: receipt"
assert text.count(old) == 1
runtime.write_text(text.replace(old, "license: receipt.license?.spdx || 'CC0-1.0 / RINNE DCC', source: receipt"))

grid = Path('apps/character-studio/tests/character-review-grid.test.mjs')
text = grid.read_text()
text = text.replace("'../public/simulator/assets/PROTAGONIST_VILLAGER_FEMALE_V1.glb'", "'../../review/public/library/model/c8827661105eef7b2bfbef3bc676d41a47625733/Rogue.glb'")
text = text.replace('committed protagonist assets are locally available to character-studio and DCC loading is integrity checked', 'protagonist sources are committed in app or shared Asset Origin and loading is integrity checked')
grid.write_text(text)

old_test = Path('tests/protagonist-villager-dcc.test.mjs')
text = old_test.read_text()
start = text.index("test('female protagonist is a separate repository-local Rig_Medium DCC model'")
text = text[:start] + """test('female protagonist replaces the retired DCC surface with the original CC0 Rogue', () => {
  const model = CHARACTER_REFERENCE_MODELS[PROTAGONIST_VILLAGER_FEMALE_MODEL_ID];
  const receipt = JSON.parse(readFileSync('apps/rinne/public/simulator/assets/PROTAGONIST_VILLAGER_FEMALE_V1.asset.json', 'utf8'));
  const production = JSON.parse(readFileSync('packages/characters/production/protagonist-villager-female-v1.production.json', 'utf8'));
  const bytes = readFileSync(production.source.meshPath);
  assert.equal(model.id, 'protagonist.villager.female.v1');
  assert.equal(model.modelingMode, 'imported-reviewed');
  assert.equal(model.production.target.rigId, 'Rig_Medium');
  assert.equal(model.sourceModelId, 'kaykit.rogue.v1');
  assert.equal(model.assetPath, receipt.path);
  assert.equal(model.productionStage, 'REFERENCE');
  assert.equal(production.stage, 'REFERENCE');
  assert.equal(production.status.visualApproval, 'pending');
  assert.equal(production.status.productionReady, false);
  assert.equal(model.productionReady, false);
  assert.equal(bytes.length, receipt.bytes);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), receipt.sha256);
  assert.equal(receipt.sha256, 'e825437cd4d2ee9c1960b517a74a69101e33eb409ae7fa8cedc7134a998fbb7d');
  assert.equal(receipt.humanoidRig, 'kaykit.Rig_Medium.v1');
  assert.equal(receipt.license.spdx, 'CC0-1.0');
  for (const app of ['rinne', 'character-studio']) {
    assert.equal(existsSync(`apps/${app}/public/simulator/assets/PROTAGONIST_VILLAGER_FEMALE_V1.glb`), false);
    assert.deepEqual(JSON.parse(readFileSync(`apps/${app}/public/simulator/assets/PROTAGONIST_VILLAGER_FEMALE_V1.asset.json`, 'utf8')), receipt);
  }
  assert.equal(existsSync('assets/characters/protagonist/villager-female-v1/source/ProtagonistVillagerFemaleV1.blend'), false);
});
"""
old_test.write_text(text)
print('Female protagonist now resolves to the unchanged official Rogue. Old geometry and generators retired.')
