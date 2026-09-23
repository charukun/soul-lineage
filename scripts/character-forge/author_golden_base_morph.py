"""Author Golden Base expression poses on the frozen, reference-projected head.

This is character-specific pose DATA, not a replacement reconstruction or morph
builder. The pinned upstream projector locates observed facial features and
upstream_morph.py computes the actual relative targets. Neutral buffers stay
immutable. Every expression requires a later browser semantics review.
"""
import argparse,json,math,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'packages/assets/forge'))
from upstream_workspace import install_boundary,write_json,sha256

def author(w,cache):
    job=json.loads((w/'forge-job.json').read_text())
    if job['id']!='golden-base-v1':raise ValueError('This authored facial region belongs only to the Golden Base sheet')
    install=install_boundary(cache,cache/'host');sys.path.insert(0,str(install['engine']))
    from forge.stage1_intake.camera_fitting_math import project_landmark
    from forge.stage1_intake.camera_fitting_types import CameraParameters
    path=w/'build/rig/meshes-before.json';payload=json.loads(path.read_text())
    rig=json.loads((w/'build/rig/rig-contract.json').read_text())
    heads=[name for name,row in rig['meshes'].items() if row['sourceComponent']=='head']
    if len(heads)!=1:raise ValueError('Expected the actual authored head component')
    head=next(m for m in payload['meshes'] if m['name']==heads[0])
    landmarks=json.loads((w/'img2threejs/evidence/landmarks.json').read_text())
    authored=json.loads((ROOT/'scripts/character-forge/fixtures/golden-base-v1/landmarks.json').read_text())
    if landmarks!=authored:raise ValueError('Facial proportions differ from the measured Golden Base source')
    c=json.loads((w/'img2threejs/evidence/cameras.json').read_text())['front'];p=c['fit']['cameraParameters']
    camera=CameraParameters(image_width=c['imageWidth'],image_height=c['imageHeight'],fov_degrees=p['fovDegrees'],yaw_degrees=p['yawDegrees'],pitch_degrees=p['pitchDegrees'],roll_degrees=p['rollDegrees'],position=tuple(p['position']))
    front=landmarks['views']['front'];eyes=[front['anchors']['eye-left'],front['anchors']['eye-right']]
    mouth_row=front['face']['mouthRow'];center=sum(e[0] for e in eyes)/2
    scale=landmarks['heightMetres']/(landmarks['feetRow']-landmarks['crownRow'])
    head_scale=landmarks['headHeightPixels']/77
    positions=head['attributes']['position'];normals=head['attributes']['normal'];base=[positions[i:i+3] for i in range(0,len(positions),3)]
    targets={name:[] for name in ['blink','smile','mouth-open']};moved={name:0 for name in targets}
    def falloff(x,r):
        t=max(0.,1.-(x/r)**2)
        return t*t
    for index,point in enumerate(base):
        pixel=project_landmark(tuple(point),camera)
        if pixel is None:raise ValueError('Frozen head projects behind its reference camera')
        x,y=pixel
        # Only front-facing skin can express these observed front features.
        facing=max(0.,min(1.,normals[index*3+2]*2.)) if point[2]>0 else 0.
        blink=sum(falloff(x-ex,7*head_scale)*falloff(y-ey,7*head_scale)*(y-ey)*.95 for ex,ey in eyes)*scale*facing
        mouth=falloff(x-center,14*head_scale)*falloff(y-mouth_row,7*head_scale)*facing
        smile=mouth*(min(1.,abs(x-center)/(9*head_scale))**2*3.-.5)*scale*head_scale
        opening=-mouth*(y-mouth_row)*2.4*scale
        for name,dy in [('blink',blink),('smile',smile),('mouth-open',opening)]:
            targets[name].append([point[0],point[1]+dy,point[2]])
            moved[name]+=abs(dy)>1e-9
    if not all(moved.values()):raise ValueError('Observed feature regions do not contain deformable head vertices')
    paths={}
    for name,vertices in targets.items():
        paths[name]='build/morph/authored-'+name+'.json';write_json(w/paths[name],{'name':name,'vertices':vertices})
    write_json(w/'build/morph/target-contract.json',{'schema':'rinne.character-expressions/v1','meshPayloadSha256':sha256(path),'meshes':{heads[0]:paths}})
    write_json(w/'build/morph/authoring.json',{'status':'inferred poses; actual browser semantics/neutral parity pending','neutralChanged':False,'observed':['Golden Base front eye centres','Golden Base front mouth row','reference-projected surface identity'],'inferred':['expression amplitude','smooth influence radii scaled to measured head height','smile corner movement','mouth opening deformation'],'notClaimed':['observed expression reference','measured facial muscle anatomy','observed mouth cavity'],'upstreamProjector':'forge.stage1_intake.camera_fitting_math.project_landmark','movedVertexCounts':moved})
    return moved

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--workspace',type=Path,required=True);p.add_argument('--cache',type=Path,required=True);a=p.parse_args();print(json.dumps(author(a.workspace.resolve(),a.cache.resolve())))
