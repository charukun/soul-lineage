"""Reference-specific form refinement, using the pinned upstream primitives."""
import argparse,json,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'packages/assets/forge'))
from upstream_workspace import install_boundary,checked_run,write_json

def author(w,cache):
    spec=json.loads((w/'object-sculpt-spec.json').read_text())
    if spec['sculptPipeline']['currentPass']!='form-refinement':raise ValueError('Form work requires structural review')
    nodes={n['id']:n for n in spec['componentTree']}
    for side in ('l','r'):
        # The hidden proximal cap intersected the tunic. Keep the observed leg
        # width below the hem; contract only its covered, inferred attachment.
        nodes['thigh-'+side]['geometryDescriptor']['latheProfile']['points']=[[0,-.5],[.46,-.5],[.5,-.46],[.5,.38],[.30,.5],[0,.5]]
    # Increase sampling of the existing upstream SDF. This removes visible
    # voxel stair steps without substituting a new reconstruction algorithm.
    nodes['hair']['geometryDescriptor']['sdf']['resolution']=64
    nodes['head']['geometryDescriptor']['sdf']['resolution']=64
    write_json(w/'object-sculpt-spec.json',spec)
    write_json(w/'img2threejs/evidence/form-authoring.json',{'hiddenHipCap':{'status':'inferred','purpose':'bury proximal trousers under the observed tunic while keeping exposed width unchanged'},'headHairSampling':{'status':'generated','method':'unchanged upstream SDF at 64 samples (upstream maximum)'},'review':'pending actual captures'})
    install=install_boundary(cache,cache/'host')
    return checked_run(install,w,'forge/stage2_spec/validate_sculpt_spec.py',['object-sculpt-spec.json','--strict-quality','--json'])

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--workspace',type=Path,required=True);p.add_argument('--cache',type=Path,required=True);a=p.parse_args();raise SystemExit(author(a.workspace.resolve(),a.cache.resolve()))
