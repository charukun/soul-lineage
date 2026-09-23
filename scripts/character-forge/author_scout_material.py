"""Connect accepted geometry to upstream projection descriptors and PBR evidence."""
import argparse,json,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'packages/assets/forge'))
from upstream_workspace import install_boundary,checked_run,write_json

def author(w,cache):
    spec=json.loads((w/'object-sculpt-spec.json').read_text())
    if spec['sculptPipeline']['currentPass']!='material-pass':raise ValueError('Projection requires a reviewed form pass')
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
        material['shaderNotes'].append('PBR channels remain estimates; original de-lit full-view albedo supplies face, fringe, belt and rear emblem identity. No procedural replacement.')
    write_json(w/'object-sculpt-spec.json',spec)
    install=install_boundary(cache,cache/'host')
    evidence='img2threejs/evidence/material-r0-review.json'
    if not any(evidence in item.get('evidence',[]) for item in spec.get('reviewHistory',[])):
        rejected=json.loads((ROOT/'scripts/character-forge/fixtures/upstream-scout-material-r0-review.json').read_text())
        write_json(w/evidence,rejected)
        code=checked_run(install,w,'forge/stage4_review/append_review.py',['object-sculpt-spec.json','--pass-id','material-pass','--action',rejected['action'],'--fidelity',str(rejected['fidelity']),'--summary',rejected['reason'],'--evidence',evidence,'--in-place'])
        if code:return code
    return checked_run(install,w,'forge/stage2_spec/validate_sculpt_spec.py',['object-sculpt-spec.json','--strict-quality','--json'])

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--workspace',type=Path,required=True);p.add_argument('--cache',type=Path,required=True);a=p.parse_args();raise SystemExit(author(a.workspace.resolve(),a.cache.resolve()))
