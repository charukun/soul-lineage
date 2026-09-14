from pathlib import Path

path = Path('packages/characters/src/reference-models.js')
text = path.read_text(encoding='utf-8')
old = """    kind: 'runtime-reference-model',
    characterId: spec.characterId,
    masterId: MASTER_ID,
    assetId: `runtime.${spec.id}`,
"""
new = """    kind: 'runtime-reference-model',
    characterId: spec.characterId,
    masterId: MASTER_ID,
    assetId: `runtime.${spec.id}`,
    productionStage: 'BLOCKOUT',
    modelingMode: 'runtime-procedural',
    productionReady: false,
"""
count = text.count(old)
if count != 1:
    raise SystemExit(f'expected one runtime reference contract insertion point, found {count}')
path.write_text(text.replace(old, new, 1), encoding='utf-8')
