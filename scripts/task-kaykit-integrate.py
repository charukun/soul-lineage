# Temporary task authoring input. Removed before final validation.
from pathlib import Path
import json, hashlib, zipfile, sys
root=Path.cwd(); acq=Path(sys.argv[1])
def h(b): return hashlib.sha256(b).hexdigest()
def git(b): return hashlib.sha1(f'blob {len(b)}\0'.encode()+b).hexdigest()
models=[];packs=[]
locks=[('kaykit-adventurers','2.0','15363167',13024345,'abe48f4763fba0896bab486ee9e6d08ca6b5b3884b9601f235c8847ae94dc479','d4adc31660d1db22eb60eba648e01db41577548f6fa1a3576cb4a6283dae0a58'),('kaykit-skeletons','1.1','15363145',8177445,'21fbad59ee6cc1d7bed12d0e425acab8ebe564b8620bbc1d017aedb29dd8a3d2','327a1aac6e6ff1259d82d0024cdaf088bcef302f8d7a116b5142538ac2b5cf8d')]
for slug,version,upload,size,sha,license_sha in locks:
 data=(acq/(slug+'.zip')).read_bytes();assert len(data)==size and h(data)==sha
 with zipfile.ZipFile(acq/(slug+'.zip')) as z:
  lp=next(x for x in z.namelist() if x.endswith('/License.txt'));lb=z.read(lp);assert h(lb)==license_sha
  pack={'id':slug+'-'+version,'name':lp.split('/')[0],'version':version,'sourceUrl':'https://kaylousberg.itch.io/'+slug,'author':'Kay Lousberg','license':'CC0-1.0','uploadId':upload,'archiveSha256':sha,'archiveByteLength':size,'releaseDate':'2025-10-27','retrievedAt':'2026-09-22','licenseSourcePath':lp,'licenseSha256':h(lb),'licenseGitBlobSha':git(lb),'licenseByteLength':len(lb)};packs.append(pack)
  for member in sorted(z.namelist()):
   if not member.endswith('.glb') or '/characters/' not in member.lower():continue
   b=z.read(member);name=Path(member).stem;key=name.lower().replace('_','-')
   models.append({'pack':pack['id'],'name':name,'id':'kaykit.'+key+('.v2' if version=='2.0' else '.v1-1'),'sourcePath':member,'sha256':h(b),'gitBlobSha':git(b),'byteLength':len(b),'characterIdentity':'kaykit.'+('rogue' if name=='Rogue_Hooded' else key),'classification':'monster' if name.startswith('Skeleton') else 'humanoid','species':'undead' if name.startswith('Skeleton') else 'human','archetype':key.replace('skeleton-',''),'genderPresentation':'unspecified','femaleProtagonistCandidate':name in ['Rogue','Ranger'],'variantOf':None if name=='Ranger' else ('kaykit.'+key+'.v1' if not name.startswith('Skeleton') else 'review-'+key),'deduplication':'new-character' if name=='Ranger' else 'official-version-variant'})
assert len(models)==10 and sum(x['byteLength'] for x in models)==3639000
spec={'schema':1,'id':'kaykit-current-20260922','packs':packs,'models':models,'notAcquired':[{'pack':'Mystery Character Series '+str(i),'sourceUrl':'https://kaylousberg.itch.io/kaykit-series-'+str(i),'reason':'Paid distribution; no entitled source bytes available. Not licensed/materialized/registered by this import.'} for i in [4,5,6]]+[{'pack':'Prototype Bits 1.1 FREE','sourceUrl':'https://kaylousberg.itch.io/prototype-bits','reason':'Actual free archive checked: no rigged character GLB. Animated Dummy belongs to EXTRA tier.'}]}
p=root/'scripts/assets/kaykit-current-20260922.json';p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(spec,ensure_ascii=False,indent=2)+'\n')
def change(file,old,new):
 p=root/file;s=p.read_text();assert old in s,'Source drift: '+file;s=s.replace(old,new);p.write_text(s)
change('packages/characters/src/index.js',"export * from './kaykit-foundation.js';","export * from './kaykit-foundation.js';\nexport * from './kaykit-library.js';")
change('apps/character-studio/src/review/character/main.js','CHARACTER_REFERENCE_MODELS, KAYKIT_MODELS,','CHARACTER_REFERENCE_MODELS, KAYKIT_MODELS, KAYKIT_CHARACTER_LIBRARY,')
change('apps/character-studio/src/review/character/main.js','for (const model of KAYKIT_MODELS)','for (const model of KAYKIT_CHARACTER_LIBRARY)')
change('apps/character-studio/src/review/character/main.js',"b.dataset.modelStage = 'CC0';","b.dataset.modelStage = model.legacyVersion ? '1.0 / CC0' : `${model.pack.includes('2.0') ? '2.0' : '1.1'} / CC0`;\n      if (model.thumbnailUrl) b.dataset.thumbnailUrl = model.thumbnailUrl;\n      b.title = `${model.label} · ${model.rigId} · ${model.productionStage}`;")
change('apps/character-studio/src/review/character/grid.js',"stage: source.dataset.modelStage || '',","stage: source.dataset.modelStage || '',\n    thumbnailUrl: source.dataset.thumbnailUrl || '',")
change('apps/character-studio/src/review/character/grid.js',"button.append(make('strong', 'character-model-card-label', model.label));","if (model.thumbnailUrl) {\n        const image = make('img', 'character-model-thumbnail');\n        image.src = model.thumbnailUrl; image.alt = ''; image.loading = 'lazy'; image.decoding = 'async';\n        image.width = 288; image.height = 184; button.append(image);\n      }\n      button.append(make('strong', 'character-model-card-label', model.label));")
change('apps/character-studio/src/review/character/grid.js','[model.key, model.label, model.stage, model.selected, model.disabled]','[model.key, model.label, model.stage, model.thumbnailUrl, model.selected, model.disabled]')
p=root/'apps/character-studio/src/review/character/grid.css';p.write_text(p.read_text()+'\n.character-model-thumbnail{display:block;width:100%;height:auto;aspect-ratio:288/184;object-fit:contain;border-radius:5px}\n')
change('apps/rinne/src/review/motion/models.js','KAYKIT_MODELS,PROTAGONIST','KAYKIT_CHARACTER_LIBRARY,PROTAGONIST')
change('apps/rinne/src/review/motion/models.js','...KAYKIT_MODELS','...KAYKIT_CHARACTER_LIBRARY')
change('apps/rinne/src/review/motion/source-runtime.js',"if(!['http:','https:'].includes(url.protocol)||url.origin!==base.origin)throw new Error('Review target must be self-hosted');","const ownedLibrary=url.href.startsWith(projectAssetOrigin(runtimeEnvironment));\n  if(!['http:','https:'].includes(url.protocol)||(url.origin!==base.origin&&!ownedLibrary)||isThirdPartyRuntimeAssetUrl(url.href))throw new Error('Review target must be self-hosted');")
change('apps/rinne/tests/review-motion-protagonist.test.mjs','KAYKIT_MODELS,PROTAGONIST','KAYKIT_CHARACTER_LIBRARY,PROTAGONIST')
change('apps/rinne/tests/review-motion-protagonist.test.mjs','slice(1),KAYKIT_MODELS','slice(1),KAYKIT_CHARACTER_LIBRARY')
print('Integrated locked source inputs and existing consumers without changing protagonist or gameplay pool')
