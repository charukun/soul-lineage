"""Correct the clipped lateral extent of the observed side-face SDF cut."""
import argparse,json,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'packages/assets/forge'))
from upstream_workspace import install_boundary,checked_run,write_json,verify_sources

def author(w,cache):
    verify_sources(w)
    path=w/'object-sculpt-spec.json';spec=json.loads(path.read_text())
    hair=next(n for n in spec['componentTree'] if n['id']=='hair');sdf=hair['geometryDescriptor']['sdf']
    before=json.loads(json.dumps(sdf))
    width=sdf['bounds']['max'][0]-sdf['bounds']['min'][0]
    # The observed side boundary is a sagittal constraint. Its clipping box
    # must span the full hair volume in X; the previous 58px front-face width
    # left a lateral slab that covered the face from either side.
    for primitive in sdf['primitives']:
        if primitive['id'] in ('face-opening','side-face-boundary'):primitive['size'][0]=width*1.1
    write_json(w/'img2threejs/evidence/side-hair-width-refinement.json',{
        'status':'inferred extrusion of the observed sagittal boundary across the bounded hair volume',
        'observation':'r6 side/oppositeSide/front34/rear34 show the surviving lateral slab',
        'sourceConstraint':'img2threejs/evidence/side-hair-refinement.json',
        'unchanged':['source pixels','camera','head geometry','front forehead height','side boundary plane','upstream SDF kernel','scalp gate'],
        'before':before,'after':sdf})
    write_json(path,spec)
    install=install_boundary(cache,cache/'host')
    return checked_run(install,w,'forge/stage2_spec/validate_sculpt_spec.py',['object-sculpt-spec.json','--strict-quality','--json'])

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--workspace',type=Path,required=True);p.add_argument('--cache',type=Path,required=True);a=p.parse_args();raise SystemExit(author(a.workspace.resolve(),a.cache.resolve()))
