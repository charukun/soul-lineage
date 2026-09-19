"""Acquire authored assets verbatim; never manufacture model geometry."""
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.parse import quote
import json, hashlib, struct, zipfile, io, time, subprocess, base64
from concurrent.futures import ThreadPoolExecutor
ROOT = Path(__file__).resolve().parent
OUT = ROOT / 'public'
OUT.mkdir(exist_ok=True)
UPSTREAM = 'db3df04d1e4714298a09510b26fb6de6645138a2'
BASE = 'https://raw.githubusercontent.com/agentkaerf/FreeModels/' + UPSTREAM + '/'
PACK = 'Pirate Kit - Nov 2023'
GRAVE = 'https://kenney.nl/media/pages/assets/graveyard-kit/ba8d4b4517-1760691807/kenney_graveyard-kit_5.0.zip'
manifest = {'app':'ashen-vigil','generatedModels':0,'sourceCommit':subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip(),'models':{},'packs':[{'id':'pirate','author':'Quaternius','license':'CC0-1.0','source':'https://quaternius.com/packs/piratekit.html','mirror':'https://github.com/agentkaerf/FreeModels','revision':UPSTREAM},{'id':'graveyard','author':'Kenney','license':'CC0-1.0','source':'https://kenney.nl/assets/graveyard-kit','download':GRAVE}]}
def get(url):
    for attempt in range(3):
        try:
            return urlopen(Request(url,headers={'User-Agent':'AshenVigil/1.0'}),timeout=90).read()
        except Exception:
            if attempt == 2: raise
            time.sleep(1 + attempt)
def docof(data):
    if data[:4] == b'glTF':
        n = struct.unpack_from('<I',data,12)[0]
        return json.loads(data[20:20+n])
    return json.loads(data)
def save(pack,name,data,suffix,source):
    doc = docof(data)
    dest = OUT/'assets'/pack/(name+suffix)
    dest.parent.mkdir(parents=True,exist_ok=True)
    dest.write_bytes(data)
    manifest['models'][pack+'/'+name] = {'url':str(dest.relative_to(OUT)),'sha256':hashlib.sha256(data).hexdigest(),'bytes':len(data),'source':source,'animations':[a.get('name','') for a in doc.get('animations',[])],'meshes':[m.get('name','') for m in doc.get('meshes',[])],'nodes':[n.get('name','') for n in doc.get('nodes',[])],'images':doc.get('images',[]),'triangles':sum(doc['accessors'][p['indices']]['count']//3 for m in doc.get('meshes',[]) for p in m['primitives'] if 'indices' in p)}
    return doc
pirate_tree = json.loads(get('https://api.github.com/repos/agentkaerf/FreeModels/git/trees/b1d6804d8fc4cd3b95b5f47fd5c28dc6e980625e?recursive=1'))['tree']
names = [x['path'] for x in pirate_tree if x['path'].endswith('.gltf') and any(k in x['path'] for k in ['Characters_Anne','Characters_Captain_Barbarossa','Characters_Henry','Characters_Skeleton','Characters_Sharky','Characters_Tentacle','Enemy_Tentacle','Environment_Cliff','Environment_Rock','Environment_LargeBones','Environment_Skulls','Weapon_','Prop_Sword','Prop_Pistol','Prop_Lantern','Prop_Chest','Prop_Barrel','Prop_Cannon','Prop_Bottle'])]
def pirate(path):
    url=BASE+quote(PACK+'/'+path,safe='/')
    data=get(url)
    doc=save('pirate',Path(path).stem,data,'.gltf',url)
    for record in doc.get('buffers',[]) + doc.get('images',[]):
        uri=record.get('uri','')
        if uri and not uri.startswith('data:'):
            dep=OUT/'assets'/'pirate'/uri
            dep.parent.mkdir(parents=True,exist_ok=True)
            dep.write_bytes(get(BASE+quote(PACK+'/'+str(Path(path).parent/uri),safe='/')))
    return path
with ThreadPoolExecutor(max_workers=6) as pool:
    for path in pool.map(pirate,names): print('PIRATE',path,flush=True)
raw=get(GRAVE)
manifest['packs'][1]['sha256']=hashlib.sha256(raw).hexdigest()
z=zipfile.ZipFile(io.BytesIO(raw))
for path in z.namelist():
    if path.lower().endswith('.glb'):
        doc=save('graveyard',Path(path).stem,z.read(path),'.glb',GRAVE+'#'+path)
        for img in doc.get('images',[]):
            uri=img.get('uri','')
            if uri and not uri.startswith('data:'):
                dest=OUT/'assets'/'graveyard'/uri
                dest.parent.mkdir(parents=True,exist_ok=True)
                dest.write_bytes(z.read(str(Path(path).parent/uri)))
licenses=[p for p in z.namelist() if 'license' in Path(p).name.lower() and not p.endswith('/')]
assert licenses,'Graveyard license absent'
license_text=z.read(licenses[0]).decode('utf-8-sig')
assert 'cc0' in license_text.lower(),'Graveyard license unverified'
(OUT/'assets'/'graveyard'/'LICENSE.txt').write_text(license_text)
(OUT/'assets'/'pirate'/'LICENSE.txt').write_text('Pirate Kit by Quaternius. CC0 1.0 Universal.\nAuthor license declaration: https://quaternius.com/packs/piratekit.html\nDownload mirror: https://github.com/agentkaerf/FreeModels\n')
# Verify byte-level exclusion against all 3D assets tracked by existing projects.
repo=ROOT.parent.parent
old_paths=subprocess.check_output(['git','ls-files'],cwd=repo,text=True).splitlines()
old_hashes={}
for path in old_paths:
    if path.startswith('apps/ashen-vigil/'): continue
    if Path(path).suffix.lower() in ['.glb','.gltf','.fbx','.obj','.bin']:
        p=repo/path
        if p.is_file(): old_hashes[hashlib.sha256(p.read_bytes()).hexdigest()]=path
collisions=[(key,old_hashes[v['sha256']]) for key,v in manifest['models'].items() if v['sha256'] in old_hashes]
assert not collisions, 'PROHIBITED REUSED ASSET: '+str(collisions)
assert len(manifest['models'])>40,'Incomplete acquisition'
assert 'pirate/Characters_Anne' in manifest['models']
assert 'pirate/Characters_Skeleton' in manifest['models']
manifest['exclusionAudit']={'trackedExisting3DFilesChecked':len(old_hashes),'exactByteCollisions':collisions,'excludedPacks':['KayKit Adventurers','KayKit Skeletons','KayKit Dungeon Remastered','KayKit Medieval Hexagon','Kenney Nature Kit'],'nocturneSource':'work/nocturne-external-assets/apps/nocturne/prepare.py'}
(OUT/'assets-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
for k,v in manifest['models'].items(): print('MODEL',k,v['bytes'],v['triangles'],json.dumps(v['animations']),flush=True)
print('AUDIT',json.dumps(manifest['exclusionAudit']),flush=True)
