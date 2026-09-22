"""Task-local successor materialization; refuses to overwrite an unknown candidate."""
import argparse,hashlib,json,shutil,struct
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--out',required=True);a=p.parse_args();out=Path(a.out)
def read(p):return json.loads(Path(p).read_text())
def write(p,v):Path(p).write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n')
def copy(a,b):b=Path(b);b.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(a,b)
pv=Path('apps/review/public/library/provenance/heroine-dawn-v1.json');v=read(pv);old=v['path'];assert v['sha256']=='c44ab5a5d21cf3005ad20ae5400a45e2644dad1b55cfb528f40c1dc2f4a9c435';assert old.endswith('/HeroineDawn.glb')
audit=read(out/'inspection.json');body=(out/'HeroineDawn.glb').read_bytes();assert hashlib.sha256(body).hexdigest()==audit['sha256'];assert audit['round']==3 and audit['motionStreams']=='byte-for-byte unchanged'
relative=f"model/{audit['gitBlobSha']}/HeroineDawn.glb";mesh='apps/review/public/library/'+relative;origin='https://soul-lineage-review-dev.c-okamoto.workers.dev/library/';qa='docs/characters/qa/heroine-dawn-v1'
copy(out/'HeroineDawn.glb',mesh);Path(old).unlink();copy(out/'HeroineDawn.blend',v['dccSourcePath']);copy(out/'HeroineDawnPalette.png','assets/characters/heroine-dawn/source/HeroineDawnPalette.png')
for view in ['front','three-quarter','side','back','face']:copy(out/(view+'.png'),f'{qa}/dcc-{view}.png')
write(f'{qa}/dcc-audit.json',audit);doc=json.loads(body[20:20+struct.unpack_from('<I',body,12)[0]])
v.update(path=mesh,bytes=len(body),byteLength=len(body),sha256=audit['sha256'],gitBlobSha=audit['gitBlobSha'],dccSourceSha256=hashlib.sha256(Path(v['dccSourcePath']).read_bytes()).hexdigest(),triangles=audit['triangles'],meshNames=[m.get('name','') for m in doc['meshes']],nodes=[n.get('name','') for n in doc['nodes']],materials=doc['materials'],images=doc['images'],animations=[a['name'] for a in doc['animations']]);v['authoringRecipe'].append('assets/characters/heroine-dawn/polish.py');v['adaptation']+=' Final real-renderer repair: flared skirt clearance during walking.';v['conversion']=v['adaptation'];write(pv,v)
for app in ['rinne','character-studio']:
    p=f'apps/{app}/public/simulator/assets/PROTAGONIST_VILLAGER_FEMALE_V1.asset.json';r=read(p);r.update(path=origin+relative,sha256=audit['sha256'],bytes=len(body),gitBlobSha=audit['gitBlobSha']);write(p,r)
p=Path('packages/characters/src/reference-model-catalog.js');s=p.read_text();oldrel=old.replace('apps/review/public/library/','');assert s.count(f"projectAssetUrl('{oldrel}')")==1;p.write_text(s.replace(f"projectAssetUrl('{oldrel}')",f"projectAssetUrl('{relative}')"))
p='packages/characters/production/protagonist-villager-female-v1.production.json';r=read(p);r['source']['meshPath']=mesh;r['source']['dcc']['sourceSha256']=v['dccSourceSha256'];r['evidence']['primary']['triangles']=audit['triangles'];r['evidence']['primary']['meshObjects']=len(audit['meshes']);write(p,r)
write(out/'integration.json',{'meshPath':mesh,'previousMeshPath':old,'assetUrl':origin+relative,'modelSha256':audit['sha256'],'sourcePath':v['dccSourcePath'],'provenance':str(pv),'qa':qa,'artRound':3});print(json.dumps({'materialized':mesh,'sha256':audit['sha256'],'bytes':len(body)}))
