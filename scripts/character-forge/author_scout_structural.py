"""Author the next structural pass, after exact-capture blockout approval."""
import argparse,json,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'packages/assets/forge'))
from upstream_workspace import install_boundary,checked_run,write_json

def author(w,cache):
    spec=json.loads((w/'object-sculpt-spec.json').read_text())
    if spec['sculptPipeline']['currentPass']!='structural-pass':raise ValueError('Structural work is locked until blockout is reviewed')
    measured=json.loads((w/'img2threejs/evidence/landmarks.json').read_text());s=measured['heightMetres']/(measured['feetRow']-measured['crownRow'])
    nodes={n['id']:n for n in spec['componentTree']}
    nose=next(p for p in nodes['head']['geometryDescriptor']['sdf']['primitives'] if p['id']=='nose')
    # Preserve the observed tip at z=31 px, but bridge back into the cheek/face
    # field. The former centre 28/radius 3 produced a disconnected SDF island.
    nose['center'][2]=22*s;nose['radii'][2]=9*s
    for side in ('l','r'):
        sdf=nodes['forearm-'+side]['geometryDescriptor']['sdf'];sdf['primitives'][0]['height']=52*s
        sdf['bounds']['min'][1]=-44*s;sdf['bounds']['max'][1]=44*s
    write_json(w/'object-sculpt-spec.json',spec)
    write_json(w/'img2threejs/evidence/structural-authoring.json',{'nose':{'preservedTipPixels':31,'oldCenterDepth':28,'oldDepthRadius':3,'newCenterDepth':22,'newDepthRadius':9,'status':'inferred bridge behind observed profile'},'arms':{'purpose':'join constant-width shafts without the visible elliptical joint waist','shaftPixels':52,'status':'interpolated between observed arm silhouette endpoints'},'review':'pending; actual render and connectivity must be checked'})
    install=install_boundary(cache,cache/'host')
    return checked_run(install,w,'forge/stage2_spec/validate_sculpt_spec.py',['object-sculpt-spec.json','--strict-quality','--json'])

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--workspace',type=Path,required=True);p.add_argument('--cache',type=Path,required=True);a=p.parse_args();raise SystemExit(author(a.workspace.resolve(),a.cache.resolve()))
