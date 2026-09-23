"""Reproducible intake for the repository-owned Scout; not a model approval.

All geometry remains a versioned upstream ObjectSculptSpec. This script only
supplies observed image coordinates and executes pinned upstream producers.
"""
import argparse
import json
import math
from pathlib import Path
import sys
from types import SimpleNamespace
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'packages/assets/forge'))
sys.path.insert(0, str(Path(__file__).parent))
from upstream_workspace import install_boundary, initialize, checked_run, write_json
from fixture import create_fixture


def prepare(workspace, cache):
    workspace, cache = workspace.resolve(), cache.resolve()
    inputs = create_fixture(workspace.parent / 'scout-reference')
    installation = install_boundary(cache, cache / 'host')
    if not workspace.exists():
        code = initialize(SimpleNamespace(id='upstream-scout', name='Scout — upstream reconstruction',
                          front=str(inputs/'front.png'), side=str(inputs/'side.png'), back=str(inputs/'back.png'),
                          provenance=str(inputs/'provenance.json')), installation, workspace)
        if code: raise RuntimeError('Upstream state initialization failed')
    def run(entry, *arguments):
        code = checked_run(installation, workspace, entry, list(arguments))
        if code: raise RuntimeError(f'Upstream stage failed ({code}): {entry}')
    evidence = workspace / 'img2threejs/evidence'
    evidence.mkdir(parents=True, exist_ok=True)
    for view in ('front', 'side', 'back'):
        run('forge/stage1_intake/check_reference_admission.py', f'source/{view}.png', '--viewpoint', view,
            '--out', f'img2threejs/evidence/{view}-admission.json', '--probe-out', f'img2threejs/evidence/{view}-probe.json')
        run('forge/stage1_intake/extract_landmarks.py', f'source/{view}.png', '--style-heads', str(316/77),
            '--out', f'img2threejs/evidence/{view}-landmark-scaffold.json',
            '--overlay', f'img2threejs/evidence/{view}-landmark-grid.png', '--force')
        run('forge/stage1_intake/delight_albedo.py', f'source/{view}.png', '--out', f'build/textures/{view}-albedo.png',
            '--report', f'img2threejs/evidence/{view}-delight.json', '--strength', '.2')
    # The scaffold's grid is NOT anatomy. These source-pixel observations are
    # versioned author input and are not hardcoded into the reconstruction engine.
    measured = json.loads((Path(__file__).parent/'fixtures/upstream-scout-landmarks.json').read_text())
    write_json(evidence/'landmarks.json', measured)
    sys.path.insert(0, str(installation['engine']))
    from forge.stage1_intake.solve_camera_pose import fit_camera_to_correspondences, CameraParameters, NormalizedCorrespondence
    from forge.stage3_build.visual_hull import carve_visual_hull
    scale = measured['heightMetres']/(measured['feetRow']-measured['crownRow'])
    cameras = {}
    for view in ('front','side','back'):
        image = Image.open(workspace/f'source/{view}.png')
        width,height=image.size
        plane=[]
        for name,uv in measured['views'][view]['anchors'].items():
            # Planar calibration proxy is explicitly inferred from an orthographic
            # turnaround; this does not pretend that 2D landmarks reveal depth.
            plane.append(NormalizedCorrespondence(name,((uv[0]-width/2)*scale,(measured['feetRow']-uv[1])*scale,0),tuple(uv)))
        initial=CameraParameters(width,height,12,0,0,0,(0,(measured['feetRow']-height/2)*scale,height*scale/(2*math.tan(math.radians(10)/2))))
        fit=fit_camera_to_correspondences(plane,initial_camera=initial)
        fit['worldFrame']={'front':'x,y,z','side':'-z,y,x','back':'-x,y,-z'}[view]
        fit['provenance']={'pixelAnchors':'observed','worldLandmarkPlane':'inferred','projectionAssumption':'orthographic turnaround calibrated on landmark plane; finite-FOV fit retained','source':f'source/{view}.png'}
        fit['planeScaleMetresPerPixel']=scale
        cameras[view]=fit
    write_json(evidence/'cameras.json',cameras)
    masks=[]
    for view in ('front','side'):
        im=Image.open(workspace/f'source/{view}.png').convert('RGB').crop((0,measured['crownRow'],180,measured['feetRow']+1)).resize((128,224),Image.Resampling.NEAREST)
        if view=='side': im=im.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
        masks.append({'axis':view,'confidence':1.,'mask':[''.join('1' if min(im.getpixel((x,y)))<240 else '0' for x in range(im.width)) for y in range(im.height)]})
    hull={'projection':'orthographic','boundsSpace':'component-local','bounds':{'min':[-90*scale,0,-90*scale],'max':[90*scale,measured['heightMetres'],90*scale]},'resolution':32,'triangleBudget':393216,'views':masks,'hiddenRegions':['Silhouette cone intersection is only an outer bound. Facial concavities, hidden armpits and clothing thickness are inferred. Back supplies surface evidence, not a third independent axis.']}
    write_json(evidence/'visual-hull-descriptor.json',hull)
    result=carve_visual_hull(hull)
    write_json(evidence/'visual-hull.json',result)
    write_json(evidence/'intake-summary.json',{'source':'repository-owned fixture','upstream':json.loads((ROOT/'packages/assets/forge/upstream.lock.json').read_text()),'views':['front','side','back'],'headUnits':(measured['feetRow']-measured['crownRow'])/measured['headHeightPixels'],'heightMetres':measured['heightMetres'],'metresPerPixel':scale,'cameraResidualPixels':{v: c['fit']['finalReprojectionError'] for v,c in cameras.items()},'referenceRead':True,'reconstructionValidated':False})
    print('INTAKE_READY — no reconstruction or visual approval claimed')

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--workspace',type=Path,required=True)
    parser.add_argument('--cache',type=Path,default=ROOT/'.cache/character-forge-upstream')
    args=parser.parse_args()
    prepare(args.workspace,args.cache)
