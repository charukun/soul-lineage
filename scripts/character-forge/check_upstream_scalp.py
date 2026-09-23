"""Map real generated geometry to the unchanged upstream scalp exposure gate."""
import argparse,json,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'packages/assets/forge'))
from upstream_workspace import install_boundary,checked_run,write_json

def check(w,cache,pass_id):
    spec=json.loads((w/'object-sculpt-spec.json').read_text())
    if not spec.get('hairProfile'):return 0
    rows=json.loads((w/f'review/{pass_id}/mesh-buffers.json').read_text())
    nodes={n['id']:n for n in spec['componentTree']};meshes={r['name']:r for r in rows}
    head=nodes[spec['hairProfile']['scalpComponentId']];matrix=meshes[head['name']]['matrixWorld']
    expected=[1,0,0,0,0,1,0,0,0,0,1,0]
    if any(abs(a-b)>1e-6 for a,b in zip(matrix[:12],expected)):raise ValueError('Scalp proxy requires an unscaled, unrotated head frame')
    if abs(matrix[12])>1e-6:raise ValueError('Scalp proxy head is not on the midline')
    rings=[[y+matrix[13],rx,rz,zc+matrix[14]] for y,rx,rz,zc in head['geometryDescriptor']['ringStack']['rings']]
    points=[]
    for node in spec['componentTree']:
        if node.get('role')!='hair':continue
        row=meshes[node['name']];m=row['matrixWorld'];p=row['position']
        for i in range(0,len(p),3):
            x,y,z=p[i:i+3];points.append([m[0]*x+m[4]*y+m[8]*z+m[12],m[1]*x+m[5]*y+m[9]*z+m[13],m[2]*x+m[6]*y+m[10]*z+m[14]])
    if not points:raise ValueError('Hair profile has no actual hair mesh')
    out=w/'review'/pass_id
    write_json(out/'scalp-rings.json',rings);write_json(out/'hair-points.json',points)
    # Source-specific forehead/hairline row 43, recorded in landmark evidence.
    measured=json.loads((w/'img2threejs/evidence/landmarks.json').read_text())
    scale=measured['heightMetres']/(measured['feetRow']-measured['crownRow'])
    hairline_y=(measured['feetRow']-43)*scale
    low=(hairline_y-rings[0][0])/(rings[-1][0]-rings[0][0])
    install=install_boundary(cache,cache/'host')
    return checked_run(install,w,'forge/stage4_review/scalp_exposure.py',['--rings',f'review/{pass_id}/scalp-rings.json','--hair-points',f'review/{pass_id}/hair-points.json','--v-low',str(low),'--out',f'review/{pass_id}/scalp-exposure.json'])

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--workspace',type=Path,required=True);p.add_argument('--cache',type=Path,required=True);p.add_argument('--pass-id',required=True);a=p.parse_args();raise SystemExit(check(a.workspace.resolve(),a.cache.resolve(),a.pass_id))
