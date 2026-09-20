"""One-shot NOCTURNE import into the existing shared /library, never a build step."""
from pathlib import Path, PurePosixPath
import hashlib, io, json, struct, urllib.request, zipfile, time

ROOT = Path(__file__).resolve().parents[3]
LIB = ROOT / 'apps/review/public/library'
OUT = ROOT / 'apps/review/src/nocturne'
SOURCE = 'https://nocturne-autobattle.c-okamoto.workers.dev/'
PACKS = {
 'adventurers': ('Kay Lousberg', '672074b73ba276876a19e8816ecdc5241817ab47', 'https://codeload.github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0/zip/672074b73ba276876a19e8816ecdc5241817ab47'),
 'skeletons': ('Kay Lousberg', '15b62b9bad122f72926c10fb14d622c73819fa54', 'https://codeload.github.com/KayKit-Game-Assets/KayKit-Character-Pack-Skeletons-1.0/zip/15b62b9bad122f72926c10fb14d622c73819fa54'),
 'nature': ('Kenney', 'kenney_nature-kit-1677698939', 'https://kenney.nl/media/pages/assets/nature-kit/37ac38a37b-1677698939/kenney_nature-kit.zip'),
}
KEYS = ['adventurers/Knight', 'skeletons/Skeleton_Warrior', 'skeletons/Skeleton_Mage', 'skeletons/Skeleton_Minion'] + ['nature/' + x for x in ['ground_grass','ground_pathTile','path_stoneCircle','path_stone','tree_pineTallA_detailed','tree_pineTallB_detailed','tree_pineRoundC','tree_detailed_dark','stone_largeB','stone_largeD','stone_tallB','stone_smallC','plant_bushDetailed','plant_bushSmall','grass_large','grass_leafsLarge','flower_purpleA','mushroom_redGroup','log_large','stump_roundDetailed','fence_planks','campfire_stones','statue_obelisk','statue_columnDamaged']]

def digest(data):
 return hashlib.sha256(data).hexdigest()

def blob(data):
 return hashlib.sha1(('blob %d\0' % len(data)).encode() + data).hexdigest()

def get(url):
 for attempt in range(3):
  try:
   with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent':'SoulLineageAssetMaterializer/1.0'}), timeout=75) as response:
    return response.read()
  except Exception:
   if attempt == 2: raise
   time.sleep(attempt + 1)

def emit(path, data):
 path = LIB / path
 if path.exists() and path.read_bytes() != data: raise ValueError('Immutable asset collision: ' + str(path))
 path.parent.mkdir(parents=True, exist_ok=True)
 path.write_bytes(data)

def document(data):
 if len(data) < 20 or data[:4] != b'glTF' or struct.unpack_from('<I',data,4)[0] != 2 or struct.unpack_from('<I',data,8)[0] != len(data): raise ValueError('Invalid GLB')
 n, kind = struct.unpack_from('<II', data, 12)
 if kind != 0x4e4f534a or n % 4 or n + 20 > len(data): raise ValueError('Invalid GLB JSON')
 return json.loads(data[20:20+n])

def main():
 OUT.mkdir(parents=True, exist_ok=True)
 target = OUT / 'manifest.json'
 if target.exists():
  manifest = json.loads(target.read_text())
  for row in manifest['files']:
   data = (LIB / row['path']).read_bytes()
   assert len(data) == row['byteLength'] and digest(data) == row['sha256'] and blob(data) == row['gitBlob'], row['path']
  print('Existing pinned NOCTURNE library verified:', len(manifest['files']))
  return
 raw_manifest = get(SOURCE + 'assets-manifest.json')
 reference = json.loads(raw_manifest)
 build = json.loads(get(SOURCE + 'build.json'))
 archives = {}
 provenance = {'schemaVersion':1, 'id':'nocturne-battle2-v1', 'referenceBuild':build, 'referenceManifestSha256':digest(raw_manifest), 'referenceManifestUrl':SOURCE+'assets-manifest.json', 'packs':[], 'models':{}, 'files':[]}
 for pack, (author, revision, url) in PACKS.items():
  original = next(p for p in reference['packs'] if p['id'] == pack)
  assert original['download'] == url and original['license'] == 'CC0-1.0', pack
  data = get(url)
  assert digest(data) == original['sha256'], 'Upstream archive differs from published NOCTURNE: ' + pack
  z = zipfile.ZipFile(io.BytesIO(data)); archives[pack] = z
  licenses = [n for n in z.namelist() if 'license' in PurePosixPath(n).name.lower() and not n.endswith('/')]
  assert licenses, 'Missing license: ' + pack
  lic = z.read(licenses[0]); text = lic.decode('utf-8-sig').lower()
  assert any(x in text for x in ['cc0','creative commons zero','public domain']), pack
  lp = 'licenses/nocturne/' + blob(lic) + '/' + pack + '.txt'; emit(lp,lic)
  prow = {'id':pack,'author':author,'license':'CC0-1.0','revision':revision,'sourceUrl':original['source'],'downloadUrl':url,'sha256':digest(data),'byteLength':len(data),'licensePath':lp}
  provenance['packs'].append(prow)
  provenance['files'].append({'path':lp,'sha256':digest(lic),'gitBlob':blob(lic),'byteLength':len(lic)})
 for key in KEYS:
  pack, name = key.split('/'); z = archives[pack]
  candidates = [n for n in z.namelist() if n.lower().endswith('.glb') and PurePosixPath(n).stem == name and (pack == 'nature' or '/Characters/' in n)]
  assert len(candidates) == 1, (key,candidates)
  member = candidates[0]; data = z.read(member); expected = reference['models'][key]
  assert len(data) == expected['bytes'] and digest(data) == expected['sha256'], key
  assert len(data) <= 20*1024*1024, 'Asset exceeds shared origin size ceiling: ' + key
  doc = document(data); group = 'object' if pack == 'nature' else 'model'; parent = group + '/' + blob(data)
  asset_path = parent + '/' + PurePosixPath(member).name
  emit(asset_path,data)
  row = {'id':key,'path':asset_path,'sha256':digest(data),'gitBlob':blob(data),'byteLength':len(data),'pack':pack,'revision':PACKS[pack][1],'archiveMember':member,'author':PACKS[pack][0],'license':'CC0-1.0','sourceUrl':next(p['sourceUrl'] for p in provenance['packs'] if p['id']==pack),'animations':[a.get('name','') for a in doc.get('animations',[])],'dependencies':[]}
  provenance['files'].append({k:row[k] for k in ['path','sha256','gitBlob','byteLength']})
  for resource in doc.get('buffers',[]) + doc.get('images',[]):
   uri = resource.get('uri','')
   if not uri or uri.startswith('data:'): continue
   parts = PurePosixPath(uri).parts
   assert not uri.startswith('/') and ':' not in uri and '\\' not in uri and all(p not in ('..','.') for p in parts), uri
   resource_bytes = z.read(str(PurePosixPath(member).parent / uri)); dep_path = parent + '/' + uri
   assert len(resource_bytes) <= 20*1024*1024
   emit(dep_path,resource_bytes)
   dep = {'path':dep_path,'sha256':digest(resource_bytes),'gitBlob':blob(resource_bytes),'byteLength':len(resource_bytes)}
   row['dependencies'].append(dep); provenance['files'].append(dep)
  provenance['models'][key] = row
 provenance['files'] = list({r['path']:r for r in provenance['files']}.values())
 payload = (json.dumps(provenance,ensure_ascii=False,indent=2)+'\n').encode()
 (LIB / 'provenance').mkdir(parents=True,exist_ok=True)
 (LIB / 'provenance/nocturne-battle2-v1.json').write_bytes(payload)
 target.write_bytes(payload)
 print(json.dumps({'models':len(KEYS),'files':len(provenance['files']),'byteLength':sum(x['byteLength'] for x in provenance['files']),'manifestSha256':digest(payload),'publishedSourceSha':build.get('sourceSha')},ensure_ascii=False))

if __name__ == '__main__': main()
