"""Recorded source observations for a regression subject, not a generic inference API.

Replay performs the real upstream intake/spec preparation. No visual pass, aesthetic
score, rig completion or model acceptance is manufactured by this fixture.
"""
import os
import sys
import json
from pathlib import Path
from argparse import Namespace
from PIL import Image

r=Path(os.environ['FORGE_REPO']);w=Path(os.environ['FORGE_WORKSPACE'])
sys.path.insert(0,str(r/'packages/assets/forge'))
from upstream.engine import Engine,save_json,load_json,sha256
from upstream.session import initialize,mark_step,next_step
up=Path(os.environ['IMG2THREEJS_ROOT'])
e=Engine(upstream=up,plugin=Path(os.environ['IMG2THREEJS_PLUGIN']),cache=Path(os.environ['FORGE_CACHE']))
p=r/'docs/characters/references/shino/shino-character-reference-sheet-v2.png'
rects={'front':[702,185,817,457],'side':[833,185,925,457],'back':[934,185,1044,457]}
i=w.parent/'canonical-inputs';i.mkdir(parents=True,exist_ok=True)
im=Image.open(p).convert('RGBA')
for view,box in rects.items():im.crop(box).save(i/(view+'.png'))
save_json(i/'provenance.json',{'license':'RINNE-OWNED','author':'RINNE project reference reconstruction','source':str(p.relative_to(r)),'referenceSha256':sha256(p.read_bytes()),'sourceCrops':rects,'authorization':'Canonical concept reference per docs/characters/SHINO_REFERENCE_V2_DCC.md; this task authorizes original procedural reconstruction. No retired conditional mesh, rig, or texture is reused. Software licenses do not grant image rights.','modelOrigin':'Geometry is authored through pinned img2threejs. Rig, morph and animation remain separate pending stages.'})
args=Namespace(id='canonical-scout-upstream',name='緑衣の旅人 / img2threejs reconstruction',root=str(r),workspace=str(w),front=str(i/'front.png'),side=str(i/'side.png'),back=str(i/'back.png'),sheet=None,sheet_order=None,provenance=str(i/'provenance.json'))
initialize(args,e)
landmarks={
 'front':{'crown':[59,7],'chin':[59,55],'neck':[60,60],'shoulder.L':[78,72],'shoulder.R':[40,72],'elbow.L':[92,98],'elbow.R':[26,98],'wrist.L':[97,131],'wrist.R':[20,131],'hand.L':[101,148],'hand.R':[17,148],'waist':[60,116],'hip.L':[72,141],'hip.R':[45,141],'knee.L':[72,188],'knee.R':[44,188],'ankle.L':[74,238],'ankle.R':[41,238],'sole.L':[74,265],'sole.R':[41,265],'eye.L':[68,42],'eye.R':[50,42],'mouth':[59,50]},
 'side':{'crown':[42,7],'forehead':[23,25],'nose':[20,39],'mouth':[23,47],'chin':[27,55],'ear':[42,42],'rearSkull':[62,33],'neck':[43,62],'shoulder':[43,74],'elbow':[46,102],'wrist':[48,134],'waist':[39,119],'hip':[44,142],'knee':[42,186],'ankle':[49,232],'heel':[50,263],'toe':[22,263]},
 'back':{'crown':[53,7],'neck':[53,63],'shoulder.L':[34,74],'shoulder.R':[72,74],'waist':[53,117],'hip.L':[41,142],'hip.R':[67,142],'knee.L':[37,189],'knee.R':[69,189],'sole.L':[34,265],'sole.R':[69,265]}}
observation={'schemaVersion':'rinne.character-observation/v1','reviewer':'recorded-astra-vision-observation','referenceSheet':str(p.relative_to(r)),'sourceCrops':rects,'sourceStatus':'project-canonical-reference-not-final-art-approval','coordinateConventions':{'image':'top-left pixel centers; x right, y down','world':'+Y up, +Z forward, metres','side':'Subject faces image left, columns follow -Z. Flip hull masks only.','back':'Columns follow -X. Reverse lateral correspondences; never call Back Top.'},'landmarks':landmarks,
 'observed':['Short light-brown rounded bob and scalloped bangs, large dark-brown eyes and small chin; crown-to-sole 260 pixels, approximately 5.1 heads.','Green high-collar capelet, golden hem and four round front buttons in two columns, pale neck emblem; rear cape is unbroken green.','Ivory puffed sleeves, brown riveted wrist cuffs, dark shorts with pale rolled hems, broad brown belt with square brass buckle.','Bare legs, light ankle socks, brown ankle boots with green folded cuffs and gold trim. Side view shows forward toe and small heel.','Small side belt pouch. Near-orthographic neutral standing drawings have slightly different arm poses; whole-body hull intersection would erase source-valid frontal arms.'],
 'unknowns':['Skin under clothes','Scalp under bob','Fine finger topology','Inner boots','Surface depth between supplied views','True lighting-free albedo'],
 'suitability':'conditional: native 272px-high crops support stylized reconstruction, not fine hidden anatomy or photogrammetric accuracy',
 'qualityFloor':{'critical':['source-identity','head-ratio','cape-silhouette','hair-volume','surface-pattern-retention','nonplanar-off-axis','deforming-rig'],'benchmark':'Initial Shino standalone study is a qualitative visual benchmark, not an upstream completion receipt'},'inferencePolicy':'Measured values remain evidence; hidden anatomy is explicitly inferred. Do not replace observations with a generic humanoid template.'}
save_json(w/'img2threejs/observation.json',observation)
mark_step(w,e,'image-analysis',['img2threejs/observation.json'])
save_json(w/'img2threejs/suitability.json',{'verdict':'conditional','acceptedBy':'User-requested stylized reference reconstruction','limitations':observation['suitability'],'unknowns':observation['unknowns']})
mark_step(w,e,'reference-suitability',['img2threejs/suitability.json'])
for v in rects:e.run('forge/stage1_intake/check_reference_admission.py',[f'source/{v}.png','--viewpoint',v,'--out',f'img2threejs/admission-{v}.json','--probe-out',f'img2threejs/probe-{v}.json'],w)
mark_step(w,e,'reference-admission',[f'img2threejs/admission-{v}.json' for v in rects])
paths=['grimoire/character/reconstruction.md','grimoire/character/likeness_maximization.md','grimoire/character/structure_decomposition.md','grimoire/character/head_construction.md','grimoire/character/stylized_hair_threejs.md']
save_json(w/'img2threejs/character-contract.json',{'reader':'recorded-astra-contract-analysis','upstreamCommit':e.lock['engine']['commit'],'files':[{'path':s,'sha256':sha256((up/s).read_bytes())} for s in paths],'application':'Use measured landmarks and reference cameras. Scaffold values are not observations. Freeze geometry before additive skin binding.'})
mark_step(w,e,'character-contract-read',['img2threejs/character-contract.json'])
e.run('forge/stage1_intake/extract_landmarks.py',['source/front.png','--out','img2threejs/anatomy-scaffold.json','--overlay','img2threejs/landmark-guide.png','--style-heads','5.1'],w)
a=load_json(w/'img2threejs/anatomy-scaffold.json')['anatomy']
a.update(applies=True,confidence=.75,source='agent-observed-landmarks',evidenceRef='img2threejs/observation.json#/landmarks',uncertainty='Head measurement includes hair. Hidden joints and depths are inferred and need render comparison.')
a['proportions'].update(headUnit=5.1,torso=1.76,legs=2.4,shoulderWidth=.79,hipWidth=.62)
a['pose']['type']='neutral-standing-observed'
a['faceLandmarks'].update(hairline=.20,eyeLine=.73,eyeSpacing=.36,noseBase=.82,mouthLine=.91,earTop=.63,earBottom=.9)
a['features']=['brown chin-length bob','green capelet with four front buttons','dark cuffed shorts','green-cuffed brown boots']
save_json(w/'img2threejs/anatomy.json',{'anatomy':a,'observedViews':landmarks})
mark_step(w,e,'character-landmarks',['img2threejs/anatomy.json','img2threejs/landmark-guide.png'])
e.run('forge/stage2_spec/new_pre_spec_assessment.py',['RINNE Green Cape Traveller','--image','source/front.png','--domain','animated-character','--character','--complexity','complex','--out','img2threejs/assessment-starter.json'],w)
mark_step(w,e,'local-spec-search',['img2threejs/assessment-starter.json'])
assessment=load_json(w/'img2threejs/assessment-starter.json');pa=assessment['preSpecAssessment'];pa['anatomy']=a
pa['objectClass'].update(primaryDomain='character',primaryType='stylized-humanoid-traveller',formLanguage=['rounded-organic','tapered-cloth-shells'],structureKind=['articulated-humanoid','layered-clothing'],motionPotential=['walk','talk','attack','rest'],materialFamilies=['skin','hair','wool','linen','leather','brass'],notes='Measured canonical Front/Side/Back; not a retired model reconstruction.')
pa['complexity']['scores']={k:3 for k in pa['complexity']['scores']}
pa['complexity']['estimatedCounts'].update(macroComponents=4,mesoComponents=20,microFeatureGroups=8,materialLayers=6,repetitionSystems=1)
pa['complexity']['reasoning']=['Layered cape, bob, shorts, puffed sleeves, cuffed boots and repeated hardware need separate source-guided geometry and surface treatment.']
pa['specDepthDecision']['rationale']='Preserve measured silhouette and identity before material polish.'
save_json(w/'img2threejs/assessment.json',assessment)
mark_step(w,e,'pre-spec-assessment',['img2threejs/assessment.json'])
e.run('forge/stage1_intake/build_detail_inventory.py',['source/front.png','--mode','grid-3x3','--out-dir','img2threejs/detail-crops','--out','img2threejs/detail-inventory-starter.json'],w)
rows=[
 ('fringe','contour','brown bob fringe scallops','micro','silhouette','hair','bangs',0,.02,.95,.20),
 ('eyes','decal','two dark brown eyes in pale face','micro','material','skin','eyes',.34,.11,.40,.10),
 ('collar','contour','raised green neck collar','meso','silhouette','collar','raised-collar',.34,.19,.37,.08),
 ('neck-emblem','decal','pale neck emblem on green chest','micro','material','green','emblem',.45,.22,.17,.10),
 ('cape-buttons','fastener','four gold front buttons in two columns','micro','geometry','cape','buttons',.31,.29,.45,.13),
 ('cape-hem','decal','gold narrow capelet hem','micro','material','green','gold-hem',.06,.35,.9,.06),
 ('puffed-sleeves','contour','ivory voluminous lower sleeves','meso','silhouette','sleeves','puffs',.01,.37,.98,.1),
 ('cuff-rivets','fastener','pale rivets on leather wrist cuffs','micro','material','leather','cuff-rivets',.03,.44,.97,.05),
 ('belt-buckle','fastener','square brass front waist buckle','micro','geometry','buckle','buckle-outline',.4,.37,.2,.06),
 ('short-hems','contour','ivory rolled leg openings','micro','silhouette','shorts','rolled-hems',.21,.52,.6,.05),
 ('boot-cuffs','contour','green outward folded boot cuffs','meso','silhouette','boots','folded-cuffs',.19,.78,.64,.08),
 ('boot-laces','decal','dark crossing laces and small eyelets','micro','material','leather','laces',.22,.85,.56,.1),
 ('boot-sole','contour','dark soles with toe and heel projection','micro','silhouette','boots','soles',.18,.95,.61,.04),
 ('pouch','contour','small side belt pouch','meso','silhouette','pouch','flap',.2,.39,.17,.08)]
pa['detailInventory'].update(scanMethod='component-zones',targetMinDetails=10,details=[{'id':id,'kind':kind,'description':desc,'scale':scale,'affects':affects,'region':{'x':x,'y':y,'width':ww,'height':hh,'units':'normalized'},'mapsTo':{'type':'material.localOverrides' if affects=='material' else 'component.localFeatures','ref':ref+'.'+feature},'evidenceRef':'source/front.png','confidence':.8} for id,kind,desc,scale,affects,ref,feature,x,y,ww,hh in rows])
save_json(w/'img2threejs/assessment.json',assessment)
save_json(w/'img2threejs/detail-inventory.json',{'detailInventory':pa['detailInventory'],'reviewer':'recorded-astra-source-observation','notes':'Inventory enumerates source features; it is not visual acceptance of a mesh.'})
mark_step(w,e,'detail-inventory',['img2threejs/detail-inventory.json'])
sources=load_json(w/'session.json')['sourceViews'];cameras={}
for v,ox,axis in [('front',60,'+Z'),('side',43,'+X'),('back',54,'-Z')]:
 e.run('forge/stage1_intake/solve_camera_pose.py',[f'source/{v}.png','--out',f'img2threejs/camera-{v}-starter.json'],w)
 e.run('forge/stage1_intake/delight_albedo.py',[f'source/{v}.png','--out',f'img2threejs/delit-{v}.png','--report',f'img2threejs/delit-{v}.json','--strength','.15'],w)
 cameras[v]={'type':'orthographic','axis':axis,'pixelsPerUnit':260/1.6,'imageOrigin':[ox,265],'imageWidth':sources[v]['width'],'imageHeight':sources[v]['height'],'method':'agent-landmark orthographic alignment','evidenceRef':'img2threejs/observation.json#/landmarks/'+v,'calibrationStatus':'awaiting-render-reprojection-check','assumption':'Near-orthographic turnaround; no true photographic focal length is observable.'}
 save_json(w/f'img2threejs/camera-{v}.json',cameras[v])
 e.run('forge/stage3_build/bake_projected_texture.py',['--reference-image',f'source/{v}.png','--delit-image',f'img2threejs/delit-{v}.png','--camera',f'img2threejs/camera-{v}.json','--mesh-id','character','--projection-mode','orthographic-front-projection','--texture-size','1024','--out',f'img2threejs/bake-plan-{v}.json'],w)
save_json(w/'img2threejs/projection-route.json',{'required':True,'mode':'source-calibrated-multiview','cameras':cameras,'plans':{v:f'img2threejs/bake-plan-{v}.json' for v in cameras},'pixelStatus':'not-executed','note':'Original upstream script emits a descriptor only. Actual pixel baking and coverage evidence are still required.'})
mark_step(w,e,'projection-route',['img2threejs/projection-route.json'])
e.run('forge/stage2_spec/new_sculpt_spec.py',['RINNE Green Cape Traveller','--image','source/front.png','--assessment','img2threejs/assessment.json','--domain','animated-character','--character','--out','img2threejs/object-sculpt-spec.json'],w)
print('Upstream intake replay stopped at:',next_step(w,e)['currentStep'])
