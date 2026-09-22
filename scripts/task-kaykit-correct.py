# Bounded correction after inspecting actual output, not a persistent pipeline.
from pathlib import Path
import json,hashlib,struct,importlib.util
root=Path.cwd();lib=root/'apps/review/public/library'
def change(file,old,new):
 p=root/file;s=p.read_text();assert old in s,'Source drift: '+file;p.write_text(s.replace(old,new))
change('apps/rinne/src/review/motion/entrypoint.js',"if(model.thumbnailUrl)return createStaticThumbnail(model.thumbnailUrl,model.label);","if(model.thumbnailUrl){\n    const image=document.createElement('img');image.className='review-static-thumbnail';\n    image.src=model.thumbnailUrl;image.alt=model.label;image.loading='lazy';image.decoding='async';\n    image.width=288;image.height=184;return image;\n  }")
change('apps/rinne/src/review/motion/source-runtime.js',"fetcher(url.href,{signal:AbortSignal.timeout(60000),cache:'force-cache'})","fetcher(url.href,{signal:AbortSignal.timeout(60000),cache:'force-cache',redirect:'error'})")
change('scripts/browser/kaykit-library.mjs',"assert(await page.locator('#motion-model-grid [data-motion-model]').count()===16,'Motion model enumeration mismatch');","assert(await page.locator('#motion-model-grid [data-motion-model]').count()===16,'Motion model enumeration mismatch');\n  await page.locator('.motion-models summary').click();\n  await page.waitForFunction(()=>[...document.querySelectorAll('#motion-model-grid img')].every(x=>x.complete&&x.naturalWidth>0));")
change('scripts/browser/kaykit-library.mjs',"for(const id of ['kaykit.ranger.v2','kaykit.rogue.v2'])","for(const id of ['kaykit.mage.v2','kaykit.rogue.v2'])")
change('scripts/browser/kaykit-library-probe.js',"['Ranger','Rogue','Skeleton_Warrior']","['Ranger','Rogue','Mage','Skeleton_Warrior']")
# Human visual observation changes presentation/candidate metadata only, never the model bytes.
for file in ['scripts/assets/kaykit-current-20260922.json','packages/characters/generated/kaykit-current.json','apps/review/public/library/provenance/kaykit-current-20260922.json']:
 p=root/file;d=json.loads(p.read_text())
 for row in d['models']:
  name=row['name'];row['genderPresentation']='feminine' if name in ['Mage','Rogue','Rogue_Hooded'] else ('masculine' if name in ['Ranger','Barbarian'] else 'unspecified')
  row['femaleProtagonistCandidate']=name in ['Mage','Rogue','Rogue_Hooded']
  row['visualReviewNote']='Observed original rendered model, 2026-09-22; presentation is a visual classification, not an authored age. No protagonist selection.'
 p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
# Compare decoded geometry/texture content independently of animation payload and GLB offsets.
code='''def geometry_fingerprint(body):
    doc=document(body); n=struct.unpack_from('<I',body,12)[0]; binary=body[28+n:]; rows=[]
    def accessor(index):
        a=doc['accessors'][index]; v=doc['bufferViews'][a['bufferView']]
        sizes={5120:1,5121:1,5122:2,5123:2,5125:4,5126:4}; widths={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}
        width=sizes[a['componentType']]*widths[a['type']]; stride=v.get('byteStride',width); start=v.get('byteOffset',0)+a.get('byteOffset',0)
        payload=b''.join(binary[start+i*stride:start+i*stride+width] for i in range(a['count']))
        return [a['componentType'],a['type'],a['count'],digest(payload)]
    for mesh in sorted(doc['meshes'],key=lambda m:m.get('name','')):
        for primitive in mesh['primitives']:
            rows.append([mesh.get('name'),{key:accessor(value) for key,value in primitive['attributes'].items() if key in ['POSITION','TEXCOORD_0']},accessor(primitive['indices'])])
    for image in doc.get('images',[]):
        view=doc['bufferViews'][image['bufferView']]; start=view.get('byteOffset',0)
        rows.append(['image',digest(binary[start:start+view['byteLength']])])
    return digest(json.dumps(rows,sort_keys=True).encode())

'''
change('scripts/assets/materialize-kaykit-current.py','def main(directory):',code+'def main(directory):')
change('scripts/assets/materialize-kaykit-current.py',"'oldMeshes':len(od.get('meshes',[])), 'newMeshes':len(doc.get('meshes',[])),","'geometryTextureEquivalent':geometry_fingerprint(old)==geometry_fingerprint(body),\n                                     'oldGeometryFingerprint':geometry_fingerprint(old),'newGeometryFingerprint':geometry_fingerprint(body),\n                                     'oldMeshes':len(od.get('meshes',[])), 'newMeshes':len(doc.get('meshes',[])),")
module_spec=importlib.util.spec_from_file_location('materializer',root/'scripts/assets/materialize-kaykit-current.py');module=importlib.util.module_from_spec(module_spec);module_spec.loader.exec_module(module)
p=lib/'provenance/kaykit-current-20260922.json';d=json.loads(p.read_text())
for row in d['models']:
 current=(lib/row['runtimePath']).read_bytes()
 for comparison in row['comparisons']:
  old=(lib/comparison['path']).read_bytes();a=module.geometry_fingerprint(old);b=module.geometry_fingerprint(current)
  comparison.update(geometryTextureEquivalent=a==b,oldGeometryFingerprint=a,newGeometryFingerprint=b)
  if a==b:comparison['note']='Same geometry/texture appearance; retained as the official small, shared-motion version, not counted as a new character. Prior animated original remains for existing consumers; not a second entry in the new current-model picker.'
d['visualEvidence']={'runId':35682360182,'artifactId':10676005056,'sourceHead':'e731a754e83e2669a3eeaf5b5421e6cc0b4a1d7a','modelsInspected':10,'animationChecks':110,'uiStatus':'Raster thumbnail correction and UI re-observation required; see final PR receipt.'}
p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
manifest=json.loads((lib/'manifest.json').read_text());body=p.read_bytes();entry=next(x for x in manifest['files'] if x['path']=='provenance/kaykit-current-20260922.json');entry.update(bytes=len(body),sha256=hashlib.sha256(body).hexdigest(),gitBlobSha=hashlib.sha1(f'blob {len(body)}\0'.encode()+body).hexdigest());(lib/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
print('Corrected raster consumer, real UI interaction, observed presentation and duplicate provenance')
