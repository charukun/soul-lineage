"""Execute original material evidence and strict factory generation for the fixture.

This ends at render-capture. A successful build is not a successful visual review.
"""
import os,sys,json
from pathlib import Path
from PIL import Image
r=Path(os.environ['FORGE_REPO']);w=Path(os.environ['FORGE_WORKSPACE']);u=Path(os.environ['IMG2THREEJS_ROOT'])
sys.path.insert(0,str(r/'packages/assets/forge'))
from upstream.engine import Engine,save_json,load_json,sha256
from upstream.session import next_step,mark_step,build_pass
sys.path.insert(0,str(u/'forge/stage1_intake'))
from extract_pbr_evidence import material_patch
e=Engine(upstream=u,plugin=Path(os.environ['IMG2THREEJS_PLUGIN']),cache=Path(os.environ['FORGE_CACHE']))
s=load_json(w/'img2threejs/object-sculpt-spec.json')
crops={'skin':('front',(46,43,70,53),'skin'),'hair':('back',(19,8,91,59),'unknown'),'green':('back',(12,63,100,112),'fabric'),'shirt':('front',(13,111,27,124),'fabric'),'pants':('front',(30,126,88,147),'fabric'),'leather':('front',(27,237,52,261),'unknown'),'brass':('front',(50,116,62,126),'metal'),'sole':('side',(12,253,59,267),'rubber')}
for mid,(view,box,hint) in crops.items():
 crop=w/f'img2threejs/material-crops/{mid}.png';crop.parent.mkdir(parents=True,exist_ok=True)
 Image.open(w/f'source/{view}.png').convert('RGBA').crop(box).save(crop)
 res=e.run('forge/stage1_intake/extract_part_color_recipe.py',[str(crop.relative_to(w)),'--component-id',mid,'--material-class-hint',hint],w)
 recipe=json.loads(res.stdout);save_json(w/f'img2threejs/material-crops/{mid}-recipe.json',recipe)
 for c in s['componentTree']:
  if c['material']==mid:c['colorMaterialRecipe']=recipe
 e.run('forge/stage1_intake/extract_pbr_evidence.py',[str(crop.relative_to(w)),'--out-dir',f'img2threejs/materials/{mid}','--material-id',mid,'--size','1024','--report',f'img2threejs/materials/{mid}/report.json','--multi-view-reference'],w,timeout=240)
for m in s['materials']:
 mid=m['id']
 if mid=='hidden':m['surfaceFrequencyBands']=[];continue
 report=load_json(w/f'img2threejs/materials/{mid}/report.json')
 if not report['ok']:raise RuntimeError('Original material evidence gate failed: '+mid)
 patch=material_patch(mid,Path(report['sourceImage']),Path(report['outDir']),f'/artifact/img2threejs/materials/{mid}',report['diagnostics']['mapSize'],report['targetThreshold'],report['confidence'],report['verdict'],report['palette'],report['diagnostics']['mapStats'],report['diagnostics'],report['warnings'])
 save_json(w/f'img2threejs/materials/{mid}/material-patch.json',patch)
 for k in ['referencePbr','textureResolution','roughness','ambientOcclusion','surfaceFrequencyBands']:m[k]=patch[k]
 m['colorVariation']={'palette':[m['baseColor']],'pattern':'flat','amplitude':0,'heightCorrelation':0}
 m['notes']='PBR response is inferred from stylized source pixels, not a measured BRDF. A 1024px resampled map does not add source detail. Full-view projection still requires real baking and coverage review.'
refs={'full-object':'source/front.png','front':'source/front.png','side':'source/side.png','back':'source/back.png'}
for c in s['componentTree']:
 for ref in c.get('evidenceRefs',[]):refs[ref]=ref.split(':')[0]
s['viewEvidence']=[{'id':key,'sourceImage':value,'confidence':.75,'notes':'Source-native input or measured region; hidden or inferred views are not labelled observed.'} for key,value in refs.items()]
save_json(w/'img2threejs/object-sculpt-spec.json',s)
save_json(w/'img2threejs/material-wiring.json',{'method':'Original upstream material_patch() serialized from its actual extractor diagnostics','upstreamScriptSha256':sha256((u/'forge/stage1_intake/extract_pbr_evidence.py').read_bytes()),'materials':list(crops),'limitations':['Resampled maps are not additional source resolution.','Physical response is not uniquely recovered from an illustration.']})
e.run('forge/stage3_build/orchestrate_passes.py',['sync','img2threejs/object-sculpt-spec.json','--in-place'],w)
res=e.run('forge/stage2_spec/validate_sculpt_spec.py',['img2threejs/object-sculpt-spec.json','--strict-quality'],w)
save_json(w/'img2threejs/strict-validation.json',{'status':'passed','specSha256':sha256((w/'img2threejs/object-sculpt-spec.json').read_bytes()),'stdout':res.stdout,'visualApproval':False})
mark_step(w,e,'spec-authoring',['img2threejs/object-sculpt-spec.json','img2threejs/observation.json'])
mark_step(w,e,'material-evidence',[f'img2threejs/materials/{mid}/report.json' for mid in crops])
mark_step(w,e,'material-spec-wiring',['img2threejs/material-wiring.json'])
mark_step(w,e,'strict-validation',['img2threejs/strict-validation.json'])
print(json.dumps(build_pass(w,e),indent=2))
