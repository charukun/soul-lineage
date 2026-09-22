"""Same-repository task materialization with pinned previous-asset guards."""
import hashlib, io, json, shutil, struct, sys
from pathlib import Path
from PIL import Image
out = Path(sys.argv[1]); candidate = out / 'candidate'
def read(p): return json.loads(Path(p).read_text())
def write(p, v): Path(p).parent.mkdir(parents=True, exist_ok=True); Path(p).write_text(json.dumps(v, ensure_ascii=False, indent=2) + '\n')
def copy(a, b): Path(b).parent.mkdir(parents=True, exist_ok=True); shutil.copyfile(a, b)
pv = Path('apps/review/public/library/provenance/heroine-dawn-v1.json'); v = read(pv); old = v['path']
assert v['sha256'] == '777f0c4f7f910edf85ab66011fddf961b7144a4a129212cf8a0b5a1b73937678'
audit = read(candidate / 'inspection.json'); body = (candidate / 'HeroineDawn.glb').read_bytes()
assert hashlib.sha256(body).hexdigest() == audit['sha256']; assert audit['motionStreams'] == 'byte-for-byte unchanged'
relative = f"model/{audit['gitBlobSha']}/HeroineDawn.glb"; mesh = 'apps/review/public/library/' + relative
copy(candidate / 'HeroineDawn.glb', mesh); Path(old).unlink(); copy(candidate / 'HeroineDawn.blend', v['dccSourcePath']); copy(candidate / 'HeroineDawnPalette.png', 'assets/characters/heroine-dawn/source/HeroineDawnPalette.png')
n = struct.unpack_from('<I', body, 12)[0]; doc = json.loads(body[20:20+n]); binary = body[28+n:]; alpha = []
for image in doc['images']:
    view = doc['bufferViews'][image['bufferView']]; offset = view.get('byteOffset', 0); png = binary[offset:offset+view['byteLength']]
    img = Image.open(io.BytesIO(png)).convert('RGBA'); extrema = img.getchannel('A').getextrema(); assert extrema == (255, 255)
    alpha.append({'name': image.get('name'), 'sha256': hashlib.sha256(png).hexdigest(), 'alphaMin': extrema[0], 'alphaMax': extrema[1]})
audit['textureAlpha'] = alpha
qa = 'docs/characters/qa/heroine-dawn-v1'; write(f'{qa}/dcc-audit.json', audit)
v.update(path=mesh, bytes=len(body), byteLength=len(body), sha256=audit['sha256'], gitBlobSha=audit['gitBlobSha'], dccSourceSha256=hashlib.sha256(Path(v['dccSourcePath']).read_bytes()).hexdigest(), triangles=audit['triangles'], meshNames=[m.get('name','') for m in doc['meshes']], nodes=[n.get('name','') for n in doc['nodes']], materials=doc['materials'], images=doc['images'], animations=[a['name'] for a in doc['animations']])
v['authoringRecipe'].append('assets/characters/heroine-dawn/opacity.py'); v['adaptation'] += ' Opaque real-surface repair: inward bob/garment/sash shells, sewn rims, closed cuffs and shorts waist, local scalp closure and weighted collar/neck overlap; original silhouette and Rig_Medium motion streams preserved.'; v['conversion'] = v['adaptation']; v['opacityEvidence'] = 'docs/characters/qa/heroine-opacity-v1/review.json'; write(pv, v)
for app in ['rinne','character-studio']:
    p = f'apps/{app}/public/simulator/assets/PROTAGONIST_VILLAGER_FEMALE_V1.asset.json'; r = read(p); r.update(path=v['runtimeOrigin']+relative, sha256=audit['sha256'], bytes=len(body), gitBlobSha=audit['gitBlobSha']); write(p,r)
p = Path('packages/characters/src/reference-model-catalog.js'); s = p.read_text(); oldrel = old.replace('apps/review/public/library/',''); assert s.count(f"projectAssetUrl('{oldrel}')") == 1; p.write_text(s.replace(f"projectAssetUrl('{oldrel}')", f"projectAssetUrl('{relative}')"))
p = 'packages/characters/production/protagonist-villager-female-v1.production.json'; r = read(p); r['source']['meshPath'] = mesh; r['source']['dcc']['sourceSha256'] = v['dccSourceSha256']; r['evidence']['primary']['triangles'] = audit['triangles']; r['evidence']['primary']['meshObjects'] = len(audit['meshes']); write(p,r)
write(out/'materialized.json', {'old':old,'mesh':mesh,'modelSha256':audit['sha256'],'sourcePath':v['dccSourcePath'],'qa':qa})
print(json.dumps({'materialized':mesh,'triangles':audit['triangles'],'sha256':audit['sha256']}))
