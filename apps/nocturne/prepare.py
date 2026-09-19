"""Download original third-party assets. No geometry is generated or modified."""
from pathlib import Path
import urllib.request, zipfile, io, json, struct, hashlib, time
ROOT = Path(__file__).parent
OUT = ROOT / 'public'
OUT.mkdir(parents=True, exist_ok=True)
PACKS = [
 ('adventurers','Kay Lousberg','https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0','https://codeload.github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0/zip/672074b73ba276876a19e8816ecdc5241817ab47'),
 ('skeletons','Kay Lousberg','https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Skeletons-1.0','https://codeload.github.com/KayKit-Game-Assets/KayKit-Character-Pack-Skeletons-1.0/zip/15b62b9bad122f72926c10fb14d622c73819fa54'),
 ('nature','Kenney','https://kenney.nl/assets/nature-kit','https://kenney.nl/media/pages/assets/nature-kit/37ac38a37b-1677698939/kenney_nature-kit.zip')
]
manifest = {'license':'CC0-1.0','generatedModels':0,'packs':[],'models':{}}
def download(url):
 for attempt in range(3):
  try:
   return urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'NocturneAssetBuild/1.0'}),timeout=90).read()
  except Exception:
   if attempt == 2: raise
   time.sleep(2)
def inspect_glb(data):
 if data[:4] != b'glTF': raise ValueError('Asset is not a GLB')
 n, typ = struct.unpack_from('<II',data,12)
 doc = json.loads(data[20:20+n])
 return {'animations':[a.get('name','') for a in doc.get('animations',[])], 'nodes':[x.get('name','') for x in doc.get('nodes',[])], 'meshes':[x.get('name','') for x in doc.get('meshes',[])], 'images':doc.get('images',[]), 'triangles':sum(doc.get('accessors',[{}])[p['indices']].get('count',0)//3 for m in doc.get('meshes',[]) for p in m.get('primitives',[]) if 'indices' in p)}
for pack, creator, source, url in PACKS:
 raw = download(url)
 z = zipfile.ZipFile(io.BytesIO(raw))
 packinfo = {'id':pack,'creator':creator,'source':source,'download':url,'sha256':hashlib.sha256(raw).hexdigest(),'license':'CC0-1.0'}
 manifest['packs'].append(packinfo)
 glbs = [p for p in z.namelist() if p.lower().endswith('.glb')]
 print('PACK',pack,'GLB_COUNT',len(glbs),'FILES',json.dumps([Path(p).name for p in glbs]),flush=True)
 for path in glbs:
  name = Path(path).stem
  if pack != 'nature' and not any(x in name.lower() for x in ['knight','barbarian','mage','skeleton','rogue']): continue
  if pack != 'nature' and '/Characters/' not in path: continue
  dest = OUT/'assets'/pack/Path(path).name
  dest.parent.mkdir(parents=True,exist_ok=True)
  data = z.read(path); dest.write_bytes(data)
  info = inspect_glb(data)
  manifest['models'][pack+'/'+name] = {'url':str(dest.relative_to(OUT)), 'bytes':len(data), 'sha256':hashlib.sha256(data).hexdigest(), 'pack':pack, **info}
  for img in info['images']:
   if 'uri' in img and not img['uri'].startswith('data:'):
    ipath = str(Path(path).parent / img['uri'])
    target = dest.parent / img['uri']; target.parent.mkdir(parents=True,exist_ok=True); target.write_bytes(z.read(ipath))
  if pack != 'nature': print('CHARACTER',name,json.dumps(info),flush=True)
 licenses = [p for p in z.namelist() if 'license' in Path(p).name.lower() and not p.endswith('/')]
 if not licenses: raise RuntimeError('Missing upstream license: '+pack)
 text = z.read(licenses[0]).decode('utf-8-sig')
 if not any(x in text.lower() for x in ['cc0','creative commons zero','public domain']): raise RuntimeError('Unverified license: '+pack)
 (OUT/'assets'/pack/'LICENSE.txt').write_text(text)
assert any(k.endswith('/Knight') for k in manifest['models']), 'Knight missing'
assert len([k for k in manifest['models'] if k.startswith('nature/')]) > 20, 'Nature pack missing'
(OUT/'assets-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
print('ASSET_TOTAL',len(manifest['models']),'BYTES',sum(m['bytes'] for m in manifest['models'].values()),flush=True)
