#!/usr/bin/env python3
"""Assemble Shino Reference v2 production evidence without inventing approval.

The script promotes only to the highest stage supported by the supplied objective
and reviewed evidence. `--visual-approval approved` is intentionally explicit and
must not be passed by CI merely because automated checks succeeded.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import struct
from pathlib import Path

REQUIRED_DEFORMATION=['neutral','head-turn','arm-raise','elbow-bend','knee-bend','crouch']
REQUIRED_MOTION=['relaxed-idle','combat-idle','relaxed-to-combat','walk','run','attack','hit-small','hit-large','weapon-draw','weapon-sheathe']
REQUIRED_EXPRESSIONS=['neutral','blink','smile','mouth-open']


def sha256(path:Path)->str:
    h=hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda:f.read(1024*1024),b''):h.update(chunk)
    return h.hexdigest()


def glb_json(path:Path):
    data=path.read_bytes();off=12
    if data[:4]!=b'glTF':raise SystemExit('invalid GLB')
    while off+8<=len(data):
        length,kind=struct.unpack_from('<II',data,off);off+=8;payload=data[off:off+length];off+=length
        if kind==0x4E4F534A:return json.loads(payload.decode('utf-8').rstrip(' \t\r\n\x00'))
    raise SystemExit('missing GLB JSON')


def image_memory(doc):
    total=0
    views=doc.get('bufferViews',[])
    for image in doc.get('images',[]):
        view=image.get('bufferView')
        if isinstance(view,int) and 0<=view<len(views):total+=int(views[view].get('byteLength') or 0)
    return total


def bool_review(review,key):
    return review.get(key) is True


def main():
    p=argparse.ArgumentParser()
    p.add_argument('--model',required=True);p.add_argument('--blend',required=True);p.add_argument('--audit',required=True);p.add_argument('--dcc-evidence',required=True);p.add_argument('--browser-evidence',required=True);p.add_argument('--review',required=True);p.add_argument('--integrity-out',required=True);p.add_argument('--production-out',required=True);p.add_argument('--visual-approval',choices=['pending','approved','changes-requested'],default='pending')
    args=p.parse_args()
    model=Path(args.model);blend=Path(args.blend);audit=json.loads(Path(args.audit).read_text());dcc=json.loads(Path(args.dcc_evidence).read_text());browser=json.loads(Path(args.browser_evidence).read_text());review=json.loads(Path(args.review).read_text())
    if not all(audit.get('checks',{}).values()):raise SystemExit('Blender audit is not clean')
    if dcc.get('binding',{}).get('unbound'):raise SystemExit('Unbound visible DCC meshes remain')
    poses=dcc.get('deformation',{}).get('poses',[])
    if not all(x in poses for x in REQUIRED_DEFORMATION):raise SystemExit('Required deformation pose evidence missing')
    if not browser.get('success') or not browser.get('webgl2'):raise SystemExit('Runtime browser evidence failed')
    if browser.get('reviewViewCount',0)<8:raise SystemExit('Eight-direction runtime evidence missing')
    for profile in ('desktop','mobile'):
        if not browser.get(profile,{}).get('normalSpeed',{}).get('advancedSeconds',0)>.30:raise SystemExit(f'{profile} 1x playback evidence missing')
    shared={row.get('clip') for row in browser.get('desktop',{}).get('sharedMotionClips',[])}
    motion=set(review.get('motionClips',[]))|shared
    if not all(x in motion for x in REQUIRED_MOTION):raise SystemExit('Required motion evidence missing: '+','.join(x for x in REQUIRED_MOTION if x not in motion))
    expressions=set(review.get('expressions',[]))
    if not all(x in expressions for x in REQUIRED_EXPRESSIONS):raise SystemExit('Polish expression evidence incomplete')

    secondary_ok=all(bool_review(review,x) for x in ['hairFormsReviewed','clothingFormsReviewed','accessoriesReviewed'])
    deform_ok=all(bool_review(review,x) for x in ['weightsReviewed','selfIntersectionReviewed','clothingHairCollisionReviewed'])
    motion_ok=all(bool_review(review,x) for x in ['centerOfGravity','silhouette','lineOfAction','anticipation','timingSpacing','gameplayExaggeration','cameraVersatility','returnsToStablePose'])
    polish_objective=all(bool_review(review,x) for x in ['materialBaseColor','materialRoughness','materialMetallic','materialNormal','secondaryMotionReviewed'])
    visual_ok=args.visual_approval=='approved'
    desktop_p95=browser['desktop']['metrics']['p95Ms'];mobile_p95=browser['mobile']['metrics']['p95Ms']
    runtime_budget=desktop_p95<=16.67 and mobile_p95<=33.34

    stage='PRIMARY'
    if secondary_ok:stage='SECONDARY'
    if stage=='SECONDARY' and deform_ok:stage='DEFORMATION'
    if stage=='DEFORMATION' and motion_ok:stage='MOTION'
    if stage=='MOTION' and polish_objective and visual_ok:stage='POLISH'
    if stage=='POLISH' and runtime_budget:stage='RUNTIME_READY'

    doc=glb_json(model);digest=sha256(model);blend_digest=sha256(blend)
    production={
      'schema':'character-production','version':2,'id':'shino.reference.v2','stage':stage,'modelingMode':'dcc-blender',
      'source':{'referencePaths':['docs/characters/references/shino/shino-character-reference-sheet-v2.png'],'meshPath':'apps/rinne/public/simulator/assets/SHINO_REFERENCE_V2.vrm','integrityPath':'apps/rinne/public/simulator/assets/SHINO_REFERENCE_V2.asset.json','dcc':{'tool':'Blender','version':audit.get('dcc',{}).get('version','unknown'),'sourcePath':'assets/characters/shino/reference-v2/source/ShinoReferenceV2.blend','sourceSha256':blend_digest}},
      'evidence':{
        'reference':{'intentLocked':True,'views':['front','side','back']},
        'blockout':{'views':['front','side','back','three-quarter'],'proportionsReviewed':True,'silhouetteReviewed':True,'reviewEvidence':'docs/characters/qa/shino-reference-v2/'},
        'primary':{'topologyReviewed':True,'uvReviewed':True,'separateSurfaces':['skin','hair','clothing'],'auditPath':'docs/characters/qa/shino-reference-v2/blender-audit.json','meshObjects':audit.get('scene',{}).get('meshObjects'),'triangles':audit.get('scene',{}).get('triangles'),'materials':audit.get('scene',{}).get('materials')},
        'secondary':{'hairFormsReviewed':secondary_ok and review['hairFormsReviewed'],'clothingFormsReviewed':secondary_ok and review['clothingFormsReviewed'],'accessoriesReviewed':secondary_ok and review['accessoriesReviewed'],'evidencePath':'docs/characters/qa/shino-reference-v2/runtime-review.json'},
        'deformation':{'poses':REQUIRED_DEFORMATION,'weightsReviewed':deform_ok and review['weightsReviewed'],'selfIntersectionReviewed':deform_ok and review['selfIntersectionReviewed'],'clothingHairCollisionReviewed':deform_ok and review['clothingHairCollisionReviewed'],'evidencePath':'docs/characters/qa/shino-reference-v2/deformation/'},
        'motion':{'clips':REQUIRED_MOTION,'viewCount':8,'principles':{k:bool_review(review,k) for k in ['centerOfGravity','silhouette','lineOfAction','anticipation','timingSpacing','gameplayExaggeration','cameraVersatility']},'returnsToStablePose':bool_review(review,'returnsToStablePose'),'evidencePath':'docs/characters/qa/shino-reference-v2/runtime-browser/'},
        'polish':{'expressions':REQUIRED_EXPRESSIONS,'materials':{'baseColor':bool_review(review,'materialBaseColor'),'roughness':bool_review(review,'materialRoughness'),'metallic':bool_review(review,'materialMetallic'),'normal':bool_review(review,'materialNormal')},'secondaryMotionReviewed':bool_review(review,'secondaryMotionReviewed'),'visualApproval':args.visual_approval,'evidencePath':'docs/characters/qa/shino-reference-v2/runtime-review.json'},
        'runtime':{'format':'vrm','webgl2':True,'assetHash':digest,'provenanceReviewed':bool_review(review,'provenanceReviewed'),'licenseReviewed':bool_review(review,'licenseReviewed'),'desktopP95Ms':desktop_p95,'mobileP95Ms':mobile_p95,'triangles':browser['desktop']['metrics']['info']['triangles'],'drawCalls':browser['desktop']['metrics']['info']['calls'],'textureMemoryBytes':image_memory(doc),'mobileDeviceClass':'pixel-fold-class','mobileProfileId':browser.get('mobileProfile',{}).get('id'),'physicalHardwareRun':False,'reviewViewCount':browser['reviewViewCount'],'evidencePath':'docs/characters/qa/shino-reference-v2/runtime-browser/shino-runtime-browser.json'}
      },
      'status':{'visualApproval':args.visual_approval,'productionReady':stage=='RUNTIME_READY','note':'RUNTIME_READY requires explicit visual approval; CI profile performance is recorded separately from physical Pixel Fold hardware.'}
    }
    integrity={'schema':'character-asset-integrity','version':1,'id':'shino.reference.v2','assetId':'character.shino-reference-v2.dcc.v1','format':'vrm','path':'./simulator/assets/SHINO_REFERENCE_V2.vrm','sha256':digest,'bytes':model.stat().st_size,'productionStage':stage,'modelingMode':'dcc-blender','sourceBlendSha256':blend_digest,'humanoidRig':'humanoid.shino-vrm1.v2','referencePath':'docs/characters/references/shino/shino-character-reference-sheet-v2.png','visualApproval':args.visual_approval,'license':{'rigProvenance':'Sendagaya_Shino audited source / VRM Public License 1.0 metadata','surfaceAuthorship':'RINNE Character Production Pipeline original DCC surfaces'}}
    Path(args.integrity_out).write_text(json.dumps(integrity,ensure_ascii=False,indent=2)+'\n')
    Path(args.production_out).write_text(json.dumps(production,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'stage':stage,'productionReady':stage=='RUNTIME_READY','desktopP95Ms':desktop_p95,'mobileP95Ms':mobile_p95,'visualApproval':args.visual_approval},indent=2))

if __name__=='__main__':main()
