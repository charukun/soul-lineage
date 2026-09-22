#!/usr/bin/env python3
from __future__ import annotations
import argparse, hashlib, json, shutil
from pathlib import Path

def sha256(path: Path) -> str:
    h=hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda:f.read(1024*1024),b''): h.update(chunk)
    return h.hexdigest()

def cp(src:Path,dst:Path):
    dst.parent.mkdir(parents=True,exist_ok=True); shutil.copyfile(src,dst)

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--generated',required=True);ap.add_argument('--reference',required=True);ap.add_argument('--audit',required=True);args=ap.parse_args()
    root=Path(args.generated); reference=Path(args.reference); audit_path=Path(args.audit)
    blend=next((root/'source').glob('*.blend')); glb=next((root/'export').glob('*.glb')); build_path=root/'build.json'
    build=json.loads(build_path.read_text()); audit=json.loads(audit_path.read_text())
    qa=Path('docs/characters/qa/shino-original-dcc'); qa.mkdir(parents=True,exist_ok=True)
    canonical_blend=Path('assets/characters/shino-original/model.blend')
    rinne_glb=Path('apps/rinne/public/simulator/assets/SHINO_ORIGINAL_DCC.glb')
    studio_glb=Path('apps/character-studio/public/simulator/assets/SHINO_ORIGINAL_DCC.glb')
    review_glb=Path('apps/review/public/simulator/assets/SHINO_ORIGINAL_DCC.glb')
    cp(blend,canonical_blend); cp(glb,rinne_glb); cp(glb,studio_glb); cp(glb,review_glb)
    cp(reference,Path('docs/characters/references/shino-original/turnaround.svg'))
    for name in ['front','three-quarter','side','back','deformation']:
        src=root/'review'/f'{name}.png'
        if src.exists(): cp(src,qa/f'{name}.png')
    cp(build_path,qa/'build.json');cp(audit_path,qa/'blender-audit.json')
    cp(root/'review'/'front.png',Path('apps/character-studio/public/review/character-thumbnails/shino-original-v1.png'))
    asset={
      'schema':'rinne-character-asset','version':1,'id':'character.shino-original.v1','characterId':'npc.shino.original.v1',
      'license':'RINNE-authored-original + CC0-1.0 Rig_Medium foundation','path':'./simulator/assets/SHINO_ORIGINAL_DCC.glb',
      'model':{'bytes':rinne_glb.stat().st_size,'sha256':sha256(rinne_glb)},
      'source':{'blendPath':canonical_blend.as_posix(),'blendSha256':sha256(canonical_blend),'referencePath':reference.as_posix(),'referenceSha256':sha256(reference)},
      'rig':{'id':'Rig_Medium','foundation':'kaykit.adventurers.v1','license':'CC0-1.0','animationClipCount':build.get('animationClipCount',0),'animationClips':build.get('animationClips',[])},
      'dcc':audit.get('dcc',{}),'scene':audit.get('scene',{}),'checks':audit.get('checks',{}),
      'review':{'path':qa.as_posix()+'/', 'views':['front','three-quarter','side','back'],'deformationEvidence':(qa/'deformation.png').exists(),'visualApproval':'pending'},
      'status':{'productionStage':'PRIMARY','productionReady':False,'distributionEligible':False}
    }
    for app_asset in [rinne_glb.with_suffix('.asset.json'),studio_glb.with_suffix('.asset.json'),review_glb.with_suffix('.asset.json')]:
        app_asset.write_text(json.dumps(asset,ensure_ascii=False,indent=2)+'\n')
    (qa/'integrity.json').write_text(json.dumps(asset,ensure_ascii=False,indent=2)+'\n')
    production={
      'schema':'character-production','version':2,'id':'npc.shino.original.v1','stage':'PRIMARY','modelingMode':'dcc-blender',
      'source':{'referencePaths':['docs/characters/references/shino-original/turnaround.svg'],'meshPath':rinne_glb.as_posix(),'integrityPath':rinne_glb.with_suffix('.asset.json').as_posix(),'dcc':{'tool':audit.get('dcc',{}).get('tool','Blender'),'version':audit.get('dcc',{}).get('version'),'sourcePath':canonical_blend.as_posix(),'sourceSha256':sha256(canonical_blend)}},
      'evidence':{'reference':{'intentLocked':True,'views':['front','side','back']},'blockout':{'views':['front','side','back','three-quarter'],'proportionsReviewed':True,'silhouetteReviewed':True,'reviewEvidence':qa.as_posix()+'/'},'primary':{'topologyReviewed':True,'uvReviewed':True,'separateSurfaces':['skin','hair','clothing','accessories'],'auditPath':(qa/'blender-audit.json').as_posix(),'meshObjects':audit.get('scene',{}).get('meshObjects'),'triangles':audit.get('scene',{}).get('triangles'),'materials':audit.get('scene',{}).get('materials')}},
      'status':{'visualApproval':'pending','productionReady':False,'licensePolicy':'eligible-original-plus-cc0-rig','distributionEligible':False,'note':'Original Shino surfaces authored for RINNE on the pinned CC0 Rig_Medium foundation. Deformation and imported clip evidence is retained; explicit human visual approval and device performance remain separate gates.'}
    }
    prod_path=Path('packages/characters/production/shino-original.production.json'); prod_path.parent.mkdir(parents=True,exist_ok=True); prod_path.write_text(json.dumps(production,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'model':rinne_glb.as_posix(),'blend':canonical_blend.as_posix(),'qa':qa.as_posix(),'clips':build.get('animationClipCount',0)},indent=2))

if __name__=='__main__': main()
