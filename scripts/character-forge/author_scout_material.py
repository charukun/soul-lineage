"""Connect accepted geometry to upstream projection descriptors and PBR evidence."""
import argparse,copy,json,sys
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'packages/assets/forge'))
from upstream_workspace import install_boundary,checked_run,write_json

def author(w,cache):
    spec=json.loads((w/'object-sculpt-spec.json').read_text())
    if spec['sculptPipeline']['currentPass']!='material-pass':raise ValueError('Projection requires a reviewed form pass')
    install=install_boundary(cache,cache/'host')
    sys.path.insert(0,str(install['engine']/'forge/stage1_intake'))
    from extract_part_color_recipe import build_recipe
    # The blue back is independently observed, not the teal front material.
    # Supply the appropriate measured recipe to the unchanged per-view gate.
    crop=w/'img2threejs/evidence/materials/cloth/back-crop.png'
    Image.open(w/'source/back.png').crop([52,106,128,219]).convert('RGB').save(crop)
    back_recipe=build_recipe('cloth',crop,material_class_hint='fabric')
    back_recipe['sourceCropPath']=str(crop.relative_to(w))
    back_recipe['viewEvidence']={'view':'back','source':'source/back.png','pixelRect':[52,106,128,219],'status':'observed'}
    write_json(crop.with_name('back-color-recipe.json'),back_recipe)
    for node in spec['componentTree']:
        if node['material'] in ('cloth','hidden'):
            recipe=copy.deepcopy(back_recipe);recipe['componentId']=node['id']
            node.setdefault('colorMaterialRecipeByView',{})['back']=recipe
    maps=json.loads((w/'img2threejs/evidence/projection/maps.json').read_text())
    for view in ('front','side','back'):
        descriptor=json.loads((w/f'img2threejs/evidence/projection/{view}/descriptor.json').read_text())['projectedTextureBake']
        if descriptor['projectionMode']!='perspective-camera-projection':raise ValueError('Unexpected projection semantics')
        for relative in maps[view]['maps'].values():
            if not (w/relative).is_file():raise ValueError('A descriptor without source pixels cannot be baked')
    spec['projectionBake']={'required':True,'source':'img2threejs/evidence/projection/maps.json','descriptors':[f'img2threejs/evidence/projection/{v}/descriptor.json' for v in ('front','side','back')],'runtimeAdapter':'packages/assets/forge/three_projection_bake.js','semantics':'calibrated projection onto visible surfaces, foreground/depth masks, UV rasterization, unseen texel accounting','unseenRegions':{'oppositeSide':'mirrored','occluded':'inferred palette continuation'},'status':'plan-ready; actual pixels and visual acceptance pending'}
    for material in spec['materials']:
        if material.get('qualityTier')=='utility':continue
        material['textureProjection']={'mode':'perspective-camera-projection','texelDensityIntent':'Unique triangle UV charts at >=1024px, growing to keep at least 9 pixels per chart cell. Baked before mesh-freeze; geometry positions/normals remain unchanged.','referenceViews':['front','side','back']}
        note='PBR channels remain estimates; original de-lit full-view albedo supplies face, fringe, belt and rear emblem identity. No procedural replacement.'
        if note not in material['shaderNotes']:material['shaderNotes'].append(note)
    # The source is an unlit illustration. ACES + blue ground irradiance is not
    # a reference-matched photographic exposure and darkened its skin/boots.
    # Keep physical diffuse shading, but use neutral inferred studio lighting.
    spec['referenceReviewLighting']={'status':'inferred from flat illustrated reference; not measured radiometry','toneMapping':'none','exposure':1,'hemisphere':{'sky':'#ffffff','ground':'#ffffff','intensity':2.6},'key':{'color':'#ffffff','intensity':.55,'position':[2,2.5,4],'target':[0,0,0]},'rim':{'color':'#ffffff','intensity':.12,'position':[-2,2,-3],'target':[0,0,0]}}
    write_json(w/'object-sculpt-spec.json',spec)
    for round_id in range(2):
        evidence=f'img2threejs/evidence/material-r{round_id}-review.json'
        if any(evidence in item.get('evidence',[]) for item in spec.get('reviewHistory',[])):continue
        rejected=json.loads((ROOT/f'scripts/character-forge/fixtures/upstream-scout-material-r{round_id}-review.json').read_text())
        write_json(w/evidence,rejected)
        code=checked_run(install,w,'forge/stage4_review/append_review.py',['object-sculpt-spec.json','--pass-id','material-pass','--action',rejected['action'],'--fidelity',str(rejected['fidelity']),'--summary',rejected['reason'],'--evidence',evidence,'--in-place'])
        if code:return code
    return checked_run(install,w,'forge/stage2_spec/validate_sculpt_spec.py',['object-sculpt-spec.json','--strict-quality','--json'])

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--workspace',type=Path,required=True);p.add_argument('--cache',type=Path,required=True);a=p.parse_args();raise SystemExit(author(a.workspace.resolve(),a.cache.resolve()))
