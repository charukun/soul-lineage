"""Fit the hair opening to observed side-face boundary using upstream SDF data.

No mesher is implemented here. The pinned factory evaluates the rotated box,
intersection and subtraction. The front hairline plane stays unchanged.
"""
import argparse,json,math,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'packages/assets/forge'))
from upstream_workspace import install_boundary,checked_run,write_json,verify_sources

def author(w,cache):
    verify_sources(w)
    spec_path=w/'object-sculpt-spec.json';spec=json.loads(spec_path.read_text())
    if spec['sculptPipeline']['currentPass'] not in ('material-pass','surface-pass'):raise ValueError('Unexpected geometry refinement stage')
    landmarks=json.loads((w/'img2threejs/evidence/landmarks.json').read_text())
    s=landmarks['heightMetres']/(landmarks['feetRow']-landmarks['crownRow'])
    nodes={n['id']:n for n in spec['componentTree']};hair=nodes['hair'];sdf=hair['geometryDescriptor']['sdf']
    if any(p['id']=='side-face-boundary' for p in sdf['primitives']):raise ValueError('Side-face correction already applied')
    def world(node):
        p=node['transform']['position'].copy()
        if node.get('parent'):
            q=world(nodes[node['parent']]);p=[a+b for a,b in zip(p,q)]
        return p
    origin=world(hair)
    # These are the actual polygon corners in the independent side drawing,
    # newly recorded observations. Depth/plane interpolation remains inferred.
    observed=[[104,53],[94,91]]
    side_center=90
    points=[[(landmarks['feetRow']-row)*s-origin[1],(side_center-x)*s-origin[2]] for x,row in observed]
    slope=(points[1][1]-points[0][1])/(points[1][0]-points[0][0]);intercept=points[0][1]-slope*points[0][0]
    opening=next(p for p in sdf['primitives'] if p['id']=='face-opening')
    before=json.loads(json.dumps(sdf))
    angle=math.atan(slope);yc=opening['center'][1];half_depth=35*s
    zc=intercept+slope*yc+half_depth/math.cos(angle)
    # The intersection clips the sloping side opening at the unchanged front
    # forehead height. It cannot expose the upper scalp to improve a side view.
    opening['center'][2]=0;opening['size'][2]=140*s
    sdf['primitives'].append({'id':'side-face-boundary','type':'box','center':[0,yc,zc],'size':[opening['size'][0],140*s,2*half_depth],'transform':{'rotation':[angle,0,0]}})
    sdf['operations']=[op for op in sdf['operations'] if op['id']!='open']+[
        {'id':'observed-face-opening','type':'intersect','left':'face-opening','right':'side-face-boundary'},
        {'id':'open','type':'subtract','left':'cap-lock','right':'observed-face-opening'}]
    write_json(w/'img2threejs/evidence/side-hair-refinement.json',{'source':'source/side.png','observedSideFaceBoundaryPixels':observed,'inferredSideAxisPixel':side_center,'method':'Pinned SDF rotated box intersected with existing front-hairline opening, then subtracted from the existing cap/lock union','upstreamFile':'forge/stage3_build/generate_threejs_factory.py','frontHairlineUnchanged':True,'before':before,'after':sdf,'status':'authored; actual render/scalp/likeness review required','backHairConflict':'Back drawing has long locks absent in both front and side. Do not treat back as an independent geometric axis or silently claim all three hair silhouettes are identical.'})
    write_json(spec_path,spec)
    install=install_boundary(cache,cache/'host')
    return checked_run(install,w,'forge/stage2_spec/validate_sculpt_spec.py',['object-sculpt-spec.json','--strict-quality','--json'])

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--workspace',type=Path,required=True);p.add_argument('--cache',type=Path,required=True);a=p.parse_args();raise SystemExit(author(a.workspace.resolve(),a.cache.resolve()))
