"""Author Golden Base ObjectSculptSpec data for the unchanged img2threejs SDF factory.

All dimensions come from the supplied sheet's own measured pixels; side depth
and interior joint shape remain explicit inferences. This is not a standalone
mesh engine, generic humanoid canon, or a copy of the Scout fixture.
"""
from __future__ import annotations

import argparse
import copy
import json
import sys
from pathlib import Path
from PIL import Image

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'packages/assets/forge'))
from upstream_workspace import install_boundary,write_json,checked_run


def author(w:Path,cache:Path)->int:
    job=json.loads((w/'forge-job.json').read_text())
    if job['id']!='golden-base-v1':raise ValueError('Golden Base measurements must not be applied to another character')
    old=w/'object-sculpt-spec.json'
    if old.is_file() and json.loads(old.read_text()).get('sculptPipeline',{}).get('completedPasses'):
        raise ValueError('Do not reseed a workspace with accepted upstream passes')
    installation=install_boundary(cache,cache/'host')
    sys.path[:0]=[str(installation['engine']/'forge/stage2_spec'),str(installation['engine']/'forge/stage3_build')]
    from new_sculpt_spec import make_spec,_cnode
    measured=json.loads((w/'img2threejs/evidence/landmarks.json').read_text())
    expected=json.loads((ROOT/'scripts/character-forge/fixtures/golden-base-v1/landmarks.json').read_text())
    if measured!=expected:raise ValueError('Reference landmark revision changed; reauthor rather than applying stale geometry')
    pixels=measured['feetRow']-measured['crownRow'];s=measured['heightMetres']/pixels
    spec=make_spec('Golden Base v1','source/front.png')
    a=spec['preSpecAssessment'];q=spec['qualityContract']
    a['objectClass'].update(primaryType='stylized bald full-body chibi base',primaryDomain='character',
       formLanguage=['large continuous cranium','real side nose/cheek/chin depth','slim gray sleeveless suit','bare T-pose arms'],
       structureKind=['continuous cranial/face masses','separate ears','skin limbs','cloth torso/pelvis'],
       motionPotential=['walk','talk','grip'],materialFamilies=['human skin','gray fabric'],
       notes='Mint front eyes and mouth are actual source surface identity, not procedural circles. Side lowered-arm conflicts with Front/Back T-pose.')
    a['complexity'].update(tier='moderate',scores={key:2 for key in a['complexity']['scores']},
       estimatedCounts={'macroComponents':4,'mesoComponents':15,'microFeatureGroups':6,'materialLayers':3,'repetitionSystems':0},
       reasoning=['Three orthographic-looking drawings provide different silhouette and surface evidence; Side pose conflicts with Front arms.'])
    a['specDepthDecision'].update(requiredDepth='moderate',minimumComponentLevels=['macro','meso','micro'],
       needsMaterialLocalOverrides=True,rationale='Nose, cheek, jaw, ears, eyes and the gray body suit are identity-critical.')
    head=measured['headHeightPixels'];face=measured['views']['front']['face']
    a['anatomy']={'applies':True,'source':'observed source-pixel estimates, not canon',
      'styleHeads':pixels/head,'proportions':{'headUnit':head*s,'torso':(463-280)/head,
       'legs':(674-455)/head,'shoulderWidth':(281-167)/head,'hipWidth':(309-140)/head,
       'armSpan':(442-2)/head},'pose':{'type':'Front/Back approximate T-pose; Side has lowered arm',
       'jointAngles':{},'conflict':'Front/Side arm presentation is not physically identical'},
      'faceLandmarks':{'eyeLine':(face['eyeRow']-measured['crownRow'])/head,
       'eyeSpacing':(272-145)/head,'noseBase':(face['noseRow']-measured['crownRow'])/head,
       'mouthLine':(face['mouthRow']-measured['crownRow'])/head,
       'forehead':(face['foreheadRow']-measured['crownRow'])/head},
      'features':['mint eyes','rounded ears','short nose','small mouth','smooth bald cranium','gray sleeveless suit'],
      'confidence':.78,'evidenceRefs':['front','side','back'],
      'note':'The printed ~3.5 head ratio conflicts with visible pixel measure ~2.54; height in metres is a runtime choice, not observed.'}
    q['qualityBar']='reference-fidelity'
    q['minimumSpecDepth'].update(macroComponents=4,mesoComponents=15,microFeatureGroups=6,materialLayers=2,reviewViewpoints=6)
    spec['scores']={key:3 for key in spec['scores']};spec['suitability']='conditional'
    spec['risks']=['Side arm pose differs from Front/Back; these are not perfectly consistent captures.',
       'Pale rendered illustration has inferred PBR microstructure; no skin pore or actual photometric roughness observed.',
       'Camera fit uses inferred 3D landmark planes, not observed internal depths.']
    spec['viewEvidence']=[{'id':view,'sourceImage':f'source/{view}.png','viewpoint':view,'confidence':.85,
       'status':'observed','imageRegion':{'x':0,'y':0,'width':Image.open(w/f'source/{view}.png').width,
       'height':Image.open(w/f'source/{view}.png').height}} for view in ('front','side','back')]
    spec['viewEvidence'].append({'id':'full-object','sourceImage':'source/front.png','confidence':1,'status':'observed'})
    camera=json.loads((w/'img2threejs/evidence/cameras.json').read_text())['front']
    fitted=camera['fit']['cameraParameters']
    spec['referenceCamera']={'solved':True,'source':'img2threejs/evidence/cameras.json',
       'fovDegrees':fitted['fovDegrees'],'aspect':camera['aspect'],
       'orientation':{'yaw':fitted['yawDegrees'],'pitch':fitted['pitchDegrees'],'roll':fitted['rollDegrees']},
       'positionHint':fitted['position'],
       'note':'Pinned numerical correspondence fit on inferred 3D planes; rendered comparisons must validate the physical shape.'}
    base=copy.deepcopy(spec['materials'][0]);materials=[]
    for mid,color in [('skin','#FCE8E7'),('suit','#BEBDBE'),('hidden','#FFFFFF')]:
        material=copy.deepcopy(base);material.update(id=mid,name=mid,color=color,baseColor=color)
        material['albedo']={'dominant':color,'secondary':[color]}
        material['colorVariation']={'palette':[color,color],'pattern':'observed source projection','amplitude':0,'heightCorrelation':0}
        material['localOverrides']=[{'id':mid+'-source-projection','name':'Measured multi-view image surface',
          'region':'actual visible source pixels','evidenceRefs':['front','side','back'],'color':color}]
        if mid=='hidden':material.update(opacity=0,transparent=True,qualityTier='utility')
        else:
            patch=json.loads((w/f'img2threejs/evidence/materials/{mid}/material-patch.json').read_text())
            if patch['referencePbr']['confidence']<.7 or not patch['referencePbr']['usable']:
                raise ValueError('Pinned material evidence is insufficient for '+mid)
            material.update(patch)
            for channel in material['referencePbr']['maps'].values():
                channel['path']='img2threejs/evidence/materials/'+mid+'/'+Path(channel['path']).name
                channel['url']=channel['path']
            material['referencePbr']['sourceImage']=f'img2threejs/evidence/materials/{mid}/crop.png'
        materials.append(material)
    spec['materials']=materials
    nodes=[];world_centres={}
    def component(cid,name,parent,x,row,z,rx,ry,rz,material='skin',level='meso',primitives=None,operations=None):
        center=[(x-223)*s,(measured['feetRow']-row)*s,z*s]
        radii=[rx*s,ry*s,rz*s]
        parent_center=world_centres.get(parent,[0,0,0]);local=[center[i]-parent_center[i] for i in range(3)]
        sdf={'primitives':primitives or [{'id':cid+'-mass','type':'ellipsoid','center':[0,0,0],'radii':radii}],
             'operations':operations or [],'resolution':40,
             'bounds':{'min':[-v*1.27 for v in radii],'max':[v*1.27 for v in radii]}}
        node=_cnode(cid,name,'sphere',parent,local,[v*2 for v in radii],material=material,level=level,sdf=sdf,
          evidence=['front','side','back'],topology_rationale='Continuous observed outer form shaped by the pinned upstream SDF polygonizer; hidden depth inferred from Side.')
        node['geometryDescriptor']['uvStrategy']='calibrated front/side/back projection onto unique pre-rig UV charts'
        if parent:
            node['attachment']={'parentSocket':parent+'-surface','localStart':local,'localEnd':local,
              'contactType':'overlap','embedDepth':2*s,'gapTolerance':s,'evidenceRefs':['front','side','back']}
        node['localFeatures']=[{'id':cid+'-silhouette','type':'surface-mark',
           'description':name+' contour and observed source-pixel projection',
           'evidenceRefs':['front','side','back']}]
        nodes.append(node);world_centres[cid]=center
        return node
    root=_cnode('root','Golden Base root','box',None,[0,0,0],[1,1,1],material='hidden',level='macro',anim_role='root')
    nodes.append(root);world_centres['root']=[0,0,0]
    component('pelvis','Gray suit hips','root',223,430,0,78,49,48,'suit','macro')
    component('chest','Gray sleeveless torso','pelvis',223,348,0,72,87,45,'suit','macro')
    component('neck','Bare neck','chest',223,277,1,23,19,23)
    # Reference-backed cranial depth, forehead/eye plane, cheeks, nose, jaw,
    # chin form one closed head through the exact upstream smooth-union SDF.
    masses=[('cranium',[0,21,-17],[125,119,106]),
            ('forehead',[0,51,68],[93,68,52]),
            ('eye-plane',[0,-15,94],[104,44,33]),
            ('cheek-left',[-74,-50,72],[42,46,49]),
            ('cheek-right',[74,-50,72],[42,46,49]),
            ('jaw',[0,-95,43],[73,39,64]),
            ('chin',[0,-119,62],[45,17,41]),
            ('nose',[0,-48,116],[13,22,20])]
    primitives=[{'id':name,'type':'ellipsoid','center':[v*s for v in centre],
                 'radii':[v*s for v in radii]} for name,centre,radii in masses]
    operations=[];left=primitives[0]['id']
    for index,shape in enumerate(primitives[1:]):
        output='head-blend-'+str(index)
        operations.append({'id':output,'type':'smooth-union','left':left,'right':shape['id'],'radius':7*s})
        left=output
    component('head','Bald cranium cheeks eye plane jaw chin nose','neck',223,138,0,131,135,130,
              'skin','macro',primitives,operations)
    for side,x in [('l',344),('r',102)]:
        component('ear-'+side,'Rounded ear '+side,'head',x,191,-8,26,41,19)
    for side,sign in [('l',1),('r',-1)]:
        shoulder=281 if sign==1 else 165;elbow=346 if sign==1 else 100
        wrist=412 if sign==1 else 34
        component('upper-arm-'+side,'T-pose upper arm '+side,'chest',(shoulder+elbow)/2,312,0,48,17,18)
        component('forearm-'+side,'T-pose forearm '+side,'upper-arm-'+side,(elbow+wrist)/2,330,0,47,14,15)
        component('hand-'+side,'Open hand '+side,'forearm-'+side,424 if sign==1 else 22,348,3,21,10,13)
        leg_x=264 if sign==1 else 182
        component('thigh-'+side,'Bare thigh '+side,'pelvis',leg_x,510,0,33,57,31)
        component('shin-'+side,'Bare lower leg '+side,'thigh-'+side,leg_x,594,0,28,56,28)
        component('foot-'+side,'Foot and toes '+side,'shin-'+side,leg_x,651,22,36,22,43)
    spec['componentTree']=nodes;ids=[n['id'] for n in nodes]
    for build in spec['buildPasses']:build['componentRefs']=ids
    passes=spec['sculptPipeline']['passOrder']
    spec['featureReviewTargets']=[{'id':fid,'name':name,'tier':'critical','passIds':passes,
      'minimumScore':.8,'mustPass':True,'componentRefs':refs,'evidenceRefs':['front','side','back']}
      for fid,name,refs in [
       ('head-proportion','Bald cranium height, width and side depth',['head','chest','pelvis']),
       ('face-feature-placement','Observed mint eyes, nose, cheeks, mouth and chin',['head','ear-l','ear-r']),
       ('pose-silhouette','Front/Back arms, Side arm conflict, separate legs and feet',ids),
       ('suit-identity','Actual gray sleeveless suit shape and front/back surface',['pelvis','chest'])]]
    details=[('head','mint iris and eye-line'),('head','dark curved brows'),('head','small mouth'),
      ('head','real nose projection'),('ear-l','left ear helix'),('chest','sleeveless garment neckline')]
    a['detailInventory']={'scanMethod':'observed face/body regions','targetMinDetails':6,
      'details':[{'id':str(i),'kind':'linework','description':text,
         'mapsTo':{'ref':part+'-silhouette'},'evidenceRefs':['front','side','back']}
         for i,(part,text) in enumerate(details)]}
    spec['qualityTargets']['reviewViewpoints']=['front','side','back','front-three-quarter','rear-three-quarter','turntable']
    spec['lightingFromPhoto']=[
      'Inferred key light: neutral white from upper front left at [2,2.5,4], intensity 0.55.',
      'Inferred fill environment light: white hemisphere sky and ground, intensity 2.6.',
      'Inferred rim light: white from rear left [-2,2,-3], intensity 0.12.',
      'Exposure 1, no tone mapping; inferred bright white illustration background; contact ground shadow beneath bare feet.']
    for node in nodes:
        mid='skin' if node['material']=='hidden' else node['material']
        recipe=json.loads((w/f'img2threejs/evidence/materials/{mid}/color-recipe.json').read_text())
        recipe['componentId']=node['id'];node['colorMaterialRecipe']=recipe
        if node['material']=='hidden':recipe['sourceClass']='generated non-rendering hierarchy carrier'
    spec['sourceConstraints']={'visualHull':'img2threejs/evidence/visual-hull.json',
       'landmarks':'img2threejs/evidence/landmarks.json','cameraFit':'img2threejs/evidence/cameras.json',
       'observationClasses':measured['unseen']}
    maps=json.loads((w/'img2threejs/evidence/projection/maps.json').read_text())
    if set(maps)!={'front','side','back'}:raise ValueError('Projection source views are incomplete')
    spec['projectionBake']={'required':True,'source':'img2threejs/evidence/projection/maps.json',
       'descriptors':[f'img2threejs/evidence/projection/{view}/descriptor.json' for view in ('front','side','back')],
       'runtimeAdapter':'packages/assets/forge/three_projection_bake.js',
       'semantics':'Pinned descriptor, solved camera, de-lit observed image, foreground/depth visibility, UV bake',
       'unseenRegions':{'oppositeSide':'mirrored','occluded':'inferred'},
       'status':'ready-to-bake on actual generated geometry; not yet visually accepted'}
    for material in materials:
        if material['id']=='hidden':continue
        material['textureProjection']={'mode':'perspective-camera-projection',
           'referenceViews':['front','side','back'],
           'texelDensityIntent':'source eye/mouth pixels resolve before pre-rig optimization'}
    spec['referenceReviewLighting']={'status':'inferred bright neutral studio, not observed radiometry',
      'toneMapping':'none','exposure':1,
      'hemisphere':{'sky':'#ffffff','ground':'#ffffff','intensity':2.6},
      'key':{'color':'#ffffff','intensity':.55,'position':[2,2.5,4],'target':[0,0,0]},
      'rim':{'color':'#ffffff','intensity':.12,'position':[-2,2,-3],'target':[0,0,0]}}
    write_json(w/'assessment.json',{'preSpecAssessment':a,'qualityContract':q})
    write_json(w/'object-sculpt-spec.json',spec)
    return checked_run(installation,w,'forge/stage2_spec/validate_sculpt_spec.py',
                       ['object-sculpt-spec.json','--strict-quality','--json'])


if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--workspace',type=Path,required=True)
    p.add_argument('--cache',type=Path,default=ROOT/'.cache/character-forge-upstream')
    a=p.parse_args();raise SystemExit(author(a.workspace.resolve(),a.cache.resolve()))
