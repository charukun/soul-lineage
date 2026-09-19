"""Acquire authored assets verbatim; never manufacture model geometry."""
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.parse import quote
import json, hashlib, struct, zipfile, io, time, subprocess
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
    for attempt in range(4):
        try:
            return urlopen(Request(url,headers={'User-Agent':'AshenVigil/1.0'}),timeout=90).read()
        except Exception:
            if attempt == 3: raise
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
# Pinned inventory verified against the upstream tree and first successful acquisition.
# No unauthenticated GitHub API call during builds: shared-runner API limits must not break a reproducible build.
NAMES = ['Characters_Captain_Barbarossa','Characters_Sharky','Characters_Henry','Characters_Anne','Characters_Skeleton_Headless','Characters_Skeleton','Enemy_Tentacle','Characters_Tentacle','Environment_Cliff1','Environment_Cliff2','Environment_Cliff3','Environment_Cliff4','Environment_Rock_1','Environment_Rock_2','Environment_Rock_3','Environment_Rock_4','Environment_Rock_5','Environment_LargeBones','Environment_Skulls','Prop_Barrel','Prop_Bottle_1','Prop_Bottle_2','Prop_Cannon','Prop_CannonBall','Prop_Chest_Closed','Prop_Chest_Gold','Weapon_Axe','Weapon_AxeRifle','Weapon_Cutlass','Weapon_Dagger','Weapon_DoubleAxe','Weapon_DoubleShotgun','Weapon_Lute','Weapon_Pistol','Weapon_Sword_1','Weapon_Rifle','Weapon_Sword_2']
def pirate(name):
    path='glTF/'+name+'.gltf'
    url=BASE+quote(PACK+'/'+path,safe='/')
    doc=save('pirate',name,get(url),'.gltf',url)
    for record in doc.get('buffers',[]) + doc.get('images',[]):
        uri=record.get('uri','')
        if uri and not uri.startswith('data:'):
            dep=OUT/'assets'/'pirate'/uri
            dep.parent.mkdir(parents=True,exist_ok=True)
            dep.write_bytes(get(BASE+quote(PACK+'/'+str(Path(path).parent/uri),safe='/')))
    return name
with ThreadPoolExecutor(max_workers=6) as pool:
    for name in pool.map(pirate,NAMES): print('PIRATE',name,flush=True)
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
