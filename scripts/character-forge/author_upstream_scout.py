"""Versioned authoring recipe for the Scout regression fixture.

This is reference-specific ObjectSculptSpec DATA authoring, not a substitute
geometry engine. Unmodified upstream SDF/factory code produces every surface.
"""
import argparse, copy, json, sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'packages/assets/forge'))
from upstream_workspace import install_boundary, write_json, checked_run

def author(workspace,cache):
    install=install_boundary(cache,cache/'host')
    sys.path[:0]=[str(install['engine']/'forge/stage2_spec'),str(install['engine']/'forge/stage3_build')]
    from new_sculpt_spec import make_spec, _cnode
    w=workspace
    measured=json.loads((w/'img2threejs/evidence/landmarks.json').read_text())
    s=measured['heightMetres']/(measured['feetRow']-measured['crownRow'])
    head=measured['headHeightPixels']
    spec=make_spec('Upstream Scout','source/front.png')
    a=spec['preSpecAssessment']
    a['objectClass'].update(primaryType='stylized full-body scout',primaryDomain='character',formLanguage=['rounded head','slender straight limbs','flared tunic'],structureKind=['continuous face','separate hair shell','jointed limbs','cloth shell'],motionPotential=['walk','talk','grip'],materialFamilies=['skin','dyed cloth','leather','hair'],notes='Front teal shirt, blue back, golden belt and rear diamond are independently observed.')
    a['complexity'].update(tier='moderate',scores={k:2 for k in a['complexity']['scores']},estimatedCounts={'macroComponents':4,'mesoComponents':12,'microFeatureGroups':6,'materialLayers':5,'repetitionSystems':0},reasoning=['Three distinct surfaces; rear hair length differs from front; painted eyes and belt are identity-critical.'])
    a['specDepthDecision'].update(requiredDepth='moderate',minimumComponentLevels=['macro','meso','micro'],needsMaterialLocalOverrides=True,rationale='Reference contains separate hair, face, tunic, belt, legs and shoes.')
    a['anatomy']={'applies':True,'styleHeads':316/head,'proportions':{'headUnit':head*s,'torso':118/head,'legs':111/head,'shoulderWidth':48/head,'hipWidth':62/head},'pose':{'type':'standing arms down','jointAngles':{}},'faceLandmarks':{'eyeLine':(60-18)/head,'eyeSpacing':28/70,'noseBase':(69-18)/head,'mouthLine':(78-18)/head,'hairline':(43-18)/head},'features':['navy asymmetric fringe','small dark eyes','straight mouth','gold belt','rear diamond'],'confidence':.9,'evidenceRefs':['front','side','back'],'note':'Pixel coordinates in img2threejs/evidence/landmarks.json; hidden depths remain inferred.'}
    q=spec['qualityContract'];q['qualityBar']='reference-fidelity';q['minimumSpecDepth'].update(macroComponents=4,mesoComponents=12,microFeatureGroups=6,materialLayers=5,reviewViewpoints=6)
    spec['scores']={k:3 for k in spec['scores']};spec['suitability']='conditional'
    spec['risks']=['The reference is a flat original illustration; unseen face volume and material microstructure are inferred. The opposite side is mirrored.']
    spec['viewEvidence']=[{'id':v,'sourceImage':f'source/{v}.png','viewpoint':v,'confidence':1,'status':'observed','imageRegion':{'x':0,'y':0,'width':180,'height':360}} for v in ('front','side','back')]
    spec['viewEvidence'].append({'id':'full-object','sourceImage':'source/front.png','confidence':1,'status':'observed'})
    spec['referenceCamera']={'solved':True,'source':'img2threejs/evidence/cameras.json','fovDegrees':10.,'aspect':.5,'orientation':{'yaw':0,'pitch':0,'roll':0},'positionHint':[0,.77975,10.418],'note':'Upstream numerical landmark-plane fit; world plane inferred from orthographic turnaround. Render comparison must validate the actual shape.'}
    base=copy.deepcopy(spec['materials'][0])
    mats=[]
    for mid,color in [('skin','#e4b089'),('hair','#294064'),('cloth','#2d9db0'),('pants','#243a55'),('boots','#ad6133'),('hidden','#ffffff')]:
        m=copy.deepcopy(base);m.update(id=mid,name=mid,color=color,baseColor=color)
        m['albedo']={'dominant':color,'secondary':[color]};m['colorVariation']={'palette':[color,color],'pattern':'flat','amplitude':0,'heightCorrelation':0}
        m['localOverrides']=[{'id':mid+'-projection','name':'Observed multi-view projected albedo','region':'source foreground','evidenceRefs':['front','side','back'],'color':color}]
        m['surfaceFrequencyBands']=[{'id':band,'frequency':freq,'amplitude':0.001 if band=='micro' else .01,'role':'inferred material response; source albedo remains projected'} for band,freq in [('macro',2),('meso',12),('micro',56)]]
        if mid=='hidden':m.update(opacity=0,transparent=True,qualityTier='utility')
        else:
            patch_path=w/'img2threejs/evidence/materials'/mid/'material-patch.json'
            if patch_path.exists():
                m.update(json.loads(patch_path.read_text()))
                for channel in m['referencePbr']['maps'].values():channel['url']='img2threejs/evidence/materials/'+mid+'/'+Path(channel['path']).name
        mats.append(m)
    spec['materials']=mats
    nodes=[];centers={}
    def part(cid,name,parent,center,radii,material='skin',level='meso',primitives=None,operations=None):
        center=[float(v)*s for v in center];radii=[float(v)*s for v in radii]
        local=[center[i]-centers.get(parent,[0,0,0])[i] for i in range(3)]
        sdf={'primitives':primitives or [{'id':cid+'-mass','type':'ellipsoid','center':[0,0,0],'radii':radii}],'operations':operations or [],'resolution':40,'bounds':{'min':[-v*1.25 for v in radii],'max':[v*1.25 for v in radii]}}
        node=_cnode(cid,name,'sphere',parent,local,[v*2 for v in radii],material=material,level=level,sdf=sdf,evidence=['front','side','back'],topology_rationale='Reference-authored continuous volume. Exact upstream SDF polygonizer; dimensions come from versioned pixel evidence, hidden transitions inferred.')
        node['geometryDescriptor']['uvStrategy']='camera-solved multi-view projection baked after geometry acceptance'
        if parent:
            node['attachment']={'parentSocket':parent+'-surface','localStart':local,'localEnd':local,'contactType':'overlap','embedDepth':2*s,'gapTolerance':s,'evidenceRefs':['front','side']}
        node['localFeatures']=[{'id':cid+'-identity','type':'surface-mark','description':name+' reference silhouette and projected surface','evidenceRefs':['front','side','back']}]
        nodes.append(node);centers[cid]=center
        return node
    root=_cnode('root','Scout root','box',None,[0,0,0],[1,1,1],material='hidden',level='macro',anim_role='root');nodes.append(root);centers['root']=[0,0,0]
    part('pelvis','Clothed hips','root',[0,334-212,-3],[31,16,18],'cloth','macro')
    part('chest','Flared teal tunic with blue rear','pelvis',[0,334-163,-3],[32,59,24],'cloth','macro')
    part('neck','Neck','chest',[0,334-101,0],[9,12,9])
    # Cranial depth, cheek, jaw, chin and nose are fitted separately. The face
    # is not a sphere carrying a frontal decal. Dimensions are in source pixels.
    dims=[35,39,30]
    primitives=[]
    for pid,c,r in [('cranium',[0,5,-3],[30,34,24]),('jaw',[0,-21,2],[22,15,21]),('cheek-l',[-16,-7,11],[12,20,15]),('cheek-r',[16,-7,11],[12,20,15]),('chin',[0,-30,9],[14,7,13]),('nose',[0,-7,24],[5,8,7])]:
        primitives.append({'id':pid,'type':'ellipsoid','center':[v*s for v in c],'radii':[v*s for v in r]})
    ops=[];left=primitives[0]['id']
    for i,p in enumerate(primitives[1:]):
        out='blend-'+str(i);ops.append({'id':out,'type':'smooth-union','left':left,'right':p['id'],'radius':3*s});left=out
    part('head','Cranium cheeks jaw chin and nose','neck',[0,334-57,0],dims,'skin','macro',primitives,ops)
    # Hair shell preserves the long back; subtract the observed facial opening.
    hair=part('hair','Navy hair cap and back locks','head',[0,334-65,-3],[38,53,31],'hair')
    hair['geometryDescriptor']['sdf']={'primitives':[{'id':'cap','type':'ellipsoid','center':[0,10*s,-4*s],'radii':[35*s,40*s,28*s]},{'id':'back-lock','type':'ellipsoid','center':[0,-28*s,-15*s],'radii':[36*s,28*s,14*s]},{'id':'face-opening','type':'box','center':[0,-23*s,28*s],'size':[58*s,71*s,56*s]}],'operations':[{'id':'cap-lock','type':'smooth-union','left':'cap','right':'back-lock','radius':8*s},{'id':'open','type':'subtract','left':'cap-lock','right':'face-opening'}],'resolution':48,'bounds':{'min':[-42*s,-65*s,-38*s],'max':[42*s,58*s,38*s]}}
    for side,sign in [('l',1),('r',-1)]:
        part('upper-arm-'+side,'Upper arm '+side,'chest',[sign*41,334-138,0],[9,27,10])
        part('forearm-'+side,'Forearm '+side,'upper-arm-'+side,[sign*41,334-182,0],[9,25,9])
        part('hand-'+side,'Hand '+side,'forearm-'+side,[sign*41,334-207,0],[9,13,10])
        part('thigh-'+side,'Trouser thigh '+side,'pelvis',[sign*17.5,334-246,0],[11,32,14],'pants')
        part('shin-'+side,'Trouser shin '+side,'thigh-'+side,[sign*17.5,334-282,0],[10.5,28,14],'pants')
        part('boot-'+side,'Brown boot '+side,'shin-'+side,[sign*17.5,334-317,6],[14.5,17,24],'boots')
    spec['componentTree']=nodes
    ids=[n['id'] for n in nodes]
    for p in spec['buildPasses']:p['componentRefs']=ids
    passids=spec['sculptPipeline']['passOrder']
    spec['featureReviewTargets']=[{'id':fid,'name':name,'tier':'critical','passIds':passids,'minimumScore':.8,'mustPass':True,'componentRefs':refs,'evidenceRefs':['front','side','back']} for fid,name,refs in [('anatomy-proportion','Head/body and feet alignment',['head','chest','pelvis']),('face-landmark-placement','Face width, eyes, mouth, nose profile',['head']),('pose-silhouette','Real side depth and limb silhouette',ids),('outfit-and-palette','Fringe, belt, diamond and outfit identity',['hair','chest','boot-l','boot-r'])]]
    a['detailInventory']={'scanMethod':'component-zones','targetMinDetails':6,'details':[{'id':str(i),'kind':'linework','description':text,'mapsTo':{'ref':cid+'-identity'},'evidenceRefs':['front','side','back']} for i,(cid,text) in enumerate([('hair','asymmetric navy fringe'),('head','paired dark eyes'),('head','short mouth line'),('chest','gold belt'),('chest','rear gold diamond'),('boot-l','brown rounded boots')])]}
    # Micro detail is painted evidence, not unnecessary disconnected geometry.
    spec['qualityTargets']['reviewViewpoints']=['front','side','back','front-three-quarter','rear-three-quarter','turntable']
    spec['lightingFromPhoto']=['Key light: white directional from upper left; intensity 2 at [2,4,3].','Fill light: hemispheric neutral 1.2; environment flat gray.','Rim light: white directional intensity .5 from rear. Exposure 1 and ACES tone mapping; white background; contact shadow under boots. Inferred lighting, not observed physical capture.']
    for n in nodes:
        mid=n['material'];rp=w/'img2threejs/evidence/materials'/('cloth' if mid=='hidden' else mid)/'color-recipe.json'
        if rp.exists():
            n['colorMaterialRecipe']=json.loads(rp.read_text());n['colorMaterialRecipe']['componentId']=n['id']
    spec['sourceConstraints']={'visualHull':'img2threejs/evidence/visual-hull.json','landmarks':'img2threejs/evidence/landmarks.json','cameraFit':'img2threejs/evidence/cameras.json','observationClasses':measured['unseen']}
    write_json(w/'assessment.json',{'preSpecAssessment':a,'qualityContract':q})
    write_json(w/'object-sculpt-spec.json',spec)
    code=checked_run(install,w,'forge/stage2_spec/validate_sculpt_spec.py',['object-sculpt-spec.json','--strict-quality','--json'])
    return code

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--workspace',type=Path,required=True);p.add_argument('--cache',type=Path,required=True);a=p.parse_args()
    raise SystemExit(author(a.workspace.resolve(),a.cache.resolve()))
