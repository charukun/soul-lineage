#!/usr/bin/env python3
"""Manual, hash-pinned original-byte import into the existing Static Asset Origin.
Not called by build/CI. Supply the official FREE zip archives in the argument directory.
"""
from pathlib import Path
import hashlib, json, struct, sys, zipfile
ROOT=Path(__file__).resolve().parents[2]
LIB=ROOT/'apps/review/public/library'
SPEC=ROOT/'scripts/assets/kaykit-current-20260922.json'
PROVENANCE='provenance/kaykit-current-20260922.json'
def digest(body): return hashlib.sha256(body).hexdigest()
def blob(body): return hashlib.sha1(f'blob {len(body)}\0'.encode()+body).hexdigest()
def write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
def document(body):
    assert len(body)>=28 and body[:4]==b'glTF', 'GLB header missing'
    assert struct.unpack_from('<II',body,4)==(2,len(body)), 'GLB version/length invalid'
    n,kind=struct.unpack_from('<II',body,12); assert kind==0x4e4f534a
    doc=json.loads(body[20:20+n])
    assert not any(x.get('uri') for x in doc.get('images',[])+doc.get('buffers',[])), 'External dependency'
    assert doc.get('skins') and doc.get('meshes'), 'Unrigged character'
    assert not doc.get('extensionsRequired'), 'Unsupported decoder requirement'
    names={x.get('name','').lower() for x in doc['nodes']}
    assert {'hips','spine','chest','head','upperarm.l','upperarm.r','hand.l','hand.r','foot.l','foot.r'}<=names, 'Incomplete KayKit rig'
    return doc

def main(directory):
    spec=json.loads(SPEC.read_text()); manifest=json.loads((LIB/'manifest.json').read_text())
    indexed={x['path']:x for x in manifest['files']}
    existing={x['sha256']:x['path'] for x in manifest['files'] if x.get('sha256')}
    rows=[];ledger={'schema':1,'id':spec['id'],'source':'official itch.io FREE uploads','transforms':[],
                    'packs':spec['packs'],'models':[],'notAcquired':spec['notAcquired'],
                    'readiness':'REFERENCE; external-motion/browser evidence required; not Production approval'}
    def store(relative,body):
        relative=existing.get(digest(body),relative)
        path=LIB/relative;path.parent.mkdir(parents=True,exist_ok=True)
        if path.exists(): assert path.read_bytes()==body, 'Immutable asset collision: '+relative
        else: path.write_bytes(body)
        indexed[relative]={'path':relative,'bytes':len(body),'gitBlobSha':blob(body),'sha256':digest(body)}
        existing[digest(body)]=relative
        return relative
    for pack in spec['packs']:
        archive=Path(directory)/(pack['sourceUrl'].rsplit('/',1)[1]+'.zip')
        data=archive.read_bytes();assert len(data)==pack['archiveByteLength'] and digest(data)==pack['archiveSha256'], 'Archive identity changed'
        with zipfile.ZipFile(archive) as z:
            license=z.read(pack['licenseSourcePath'])
            assert digest(license)==pack['licenseSha256'] and len(license)==pack['licenseByteLength'], 'Pack license changed'
            text=license.decode('utf-8');assert 'Creative Commons Zero, CC0' in text and 'commercial projects' in text
            license_path=store('licenses/'+blob(license)+'.txt',license)
            pack['licensePath']=license_path
            for item in [x for x in spec['models'] if x['pack']==pack['id']]:
                body=z.read(item['sourcePath'])
                assert len(body)==item['byteLength'] and digest(body)==item['sha256'] and blob(body)==item['gitBlobSha'], 'Original model mismatch'
                doc=document(body)
                path=store('model/'+blob(body)+'/'+item['name']+'.glb',body)
                compared=[]
                for candidate in LIB.glob('model/*/'+item['name']+'.glb'):
                    old=candidate.read_bytes()
                    if candidate==LIB/path:continue
                    od=document(old)
                    compared.append({'path':str(candidate.relative_to(LIB)), 'sha256':digest(old),
                                     'byteLength':len(old),'relation':'exact-duplicate' if old==body else 'official-version-variant',
                                     'oldMeshes':len(od.get('meshes',[])), 'newMeshes':len(doc.get('meshes',[])),
                                     'oldEmbeddedClips':len(od.get('animations',[])), 'newEmbeddedClips':len(doc.get('animations',[]))})
                row={**item,'key':item['id'].removeprefix('kaykit.'),'label':item['name'].replace('_',' ')+' · '+pack['version'],
                     'familyId':'kaykit.adventurers.v1' if item['species']=='human' else 'kaykit.skeletons.v1',
                     'rigId':'Rig_Medium','format':'glb','license':pack['license'],'author':pack['author'],
                     'source':{'repository':pack['sourceUrl'],'revision':pack['version']+'/upload-'+pack['uploadId'],
                               'path':item['sourcePath'],'gitBlobSha':item['gitBlobSha'],'byteLength':item['byteLength'],
                               'archiveSha256':pack['archiveSha256'],'sha256':item['sha256']},
                     'licensePath':license_path,'provenancePath':PROVENANCE,
                     'runtime':{'assetPath':path,'localPath':'apps/review/public/library/'+path,'lazy':True},
                     'productionStage':'REFERENCE','modelingMode':'imported-reviewed','productionReady':False,
                     'visualApproval':'pending','procedural':False,
                     'compatibility':{'rig':'Rig_Medium','animationMode':'shared-external','embeddedClips':len(doc.get('animations',[])),
                                      'status':'pending-browser-validation'},
                     'clothingStyle':'medieval-fantasy','suitableRole':['enemy'] if item['species']=='undead' else ['npc','protagonist-candidate'],
                     'equipmentNote':'Authored part meshes and hand sockets preserved; clothing swaps still need rig/mesh fitting.'}
                rows.append(row);ledger['models'].append({**item,'runtimePath':path,'licensePath':license_path,'comparisons':compared,
                    'inspection':{'meshes':len(doc['meshes']),'skins':len(doc['skins']),'joints':len(doc['skins'][0]['joints']),
                    'animations':len(doc.get('animations',[])),'embeddedTextures':len(doc.get('images',[]))}})
    generated={'schema':1,'models':rows,'packs':spec['packs'],'notAcquired':spec['notAcquired'],
               'counts':{'currentModelVariants':len(rows),'currentCharacterIdentities':len({x['characterIdentity'] for x in rows}),
                         'genuinelyNewCharacterIdentities':len([x for x in rows if x['deduplication']=='new-character'])}}
    write_json(ROOT/'packages/characters/generated/kaykit-current.json',generated)
    write_json(LIB/PROVENANCE,ledger)
    bp=(LIB/PROVENANCE).read_bytes();indexed[PROVENANCE]={'path':PROVENANCE,'bytes':len(bp),'gitBlobSha':blob(bp),'sha256':digest(bp)}
    manifest['files']=sorted(indexed.values(),key=lambda x:x['path']);write_json(LIB/'manifest.json',manifest)
    print(json.dumps(generated['counts']))
if __name__=='__main__':
    if len(sys.argv)!=2: raise SystemExit('usage: materialize-kaykit-current.py <official-zip-directory>')
    main(sys.argv[1])
