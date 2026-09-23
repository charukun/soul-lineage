"""Run actual pinned Stage 1 producers for the measured Golden Base turnaround.

This is reference-specific input data for upstream. It never approves a pass,
promotes a scaffold to observed anatomy, or substitutes a custom mesh generator.
"""
from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'packages/assets/forge'))
from upstream_workspace import install_boundary, checked_run, write_json


def prepare(workspace: Path, cache: Path) -> dict:
    w = workspace.resolve()
    installation = install_boundary(cache.resolve(), cache.resolve() / 'host')
    fixture = ROOT / 'scripts/character-forge/fixtures/golden-base-v1'
    authored = json.loads((fixture / 'landmarks.json').read_text())
    job = json.loads((w / 'forge-job.json').read_text())
    if job['id'] != 'golden-base-v1' or set(job['views']) != {'front', 'side', 'back'}:
        raise ValueError('Only the three independently observed Golden Base views are admitted')

    def run(entry: str, *args: str) -> None:
        if checked_run(installation, w, entry, list(args)):
            raise ValueError('Pinned upstream step rejected Golden Base: ' + entry)

    evidence = w / 'img2threejs/evidence'
    evidence.mkdir(parents=True, exist_ok=True)
    for view in ('front', 'side', 'back'):
        if not (evidence / (view + '-admission.json')).exists():
            run('forge/stage1_intake/check_reference_admission.py', f'source/{view}.png',
                '--viewpoint', view, '--out', f'img2threejs/evidence/{view}-admission.json',
                '--probe-out', f'img2threejs/evidence/{view}-probe.json')
        if not (evidence / (view + '-landmark-scaffold.json')).exists():
            run('forge/stage1_intake/extract_landmarks.py', f'source/{view}.png',
                '--style-heads', str((authored['feetRow']-authored['crownRow'])/authored['headHeightPixels']),
                '--out', f'img2threejs/evidence/{view}-landmark-scaffold.json',
                '--overlay', f'img2threejs/evidence/{view}-landmark-grid.png', '--force')
        if not (w / f'build/textures/{view}-albedo.png').exists():
            run('forge/stage1_intake/delight_albedo.py', f'source/{view}.png',
                '--out', f'build/textures/{view}-albedo.png',
                '--report', f'img2threejs/evidence/{view}-delight.json', '--strength', '.2')

    # The pinned extractor emits a guide grid. This independent authored record
    # contains inspected pixel landmarks, with inferred depth clearly marked.
    write_json(evidence / 'landmarks.json', authored)
    sys.path.insert(0, str(installation['engine']))
    from forge.stage1_intake.solve_camera_pose import (
        CameraParameters, NormalizedCorrespondence, fit_camera_to_correspondences)
    from forge.stage3_build.visual_hull import carve_visual_hull
    scale = authored['heightMetres'] / (authored['feetRow']-authored['crownRow'])
    cameras = {}
    for view in ('front', 'side', 'back'):
        image = Image.open(w / f'source/{view}.png')
        width, height = image.size
        anchors = authored['views'][view]['anchors']
        image_center_x = {'front': 223, 'side': 139, 'back': 222}[view]
        plane = [NormalizedCorrespondence(label, ((uv[0]-image_center_x)*scale,
                 (authored['feetRow']-uv[1])*scale, 0), tuple(uv))
                 for label, uv in anchors.items()]
        initial = CameraParameters(width, height, 12, 0, 0, 0,
                   ((width/2-image_center_x)*scale,
                    (authored['feetRow']-height/2)*scale,
                    height*scale/(2*math.tan(math.radians(10)/2))))
        fit = fit_camera_to_correspondences(plane, initial_camera=initial)
        fit['worldFrame'] = {'front': 'x,y,z', 'side': '-z,y,x', 'back': '-x,y,-z'}[view]
        fit['provenance'] = {'pixelAnchors': 'observed pixel estimates',
                             'worldLandmarkPlane': 'inferred calibration plane',
                             'source': f'source/{view}.png',
                             'depth': 'inferred, side silhouette constrains it later'}
        fit['planeScaleMetresPerPixel'] = scale
        cameras[view] = fit
    write_json(evidence / 'cameras.json', cameras)

    masks = []
    for view in ('front', 'side'):
        image = Image.open(w / f'source/{view}.png').convert('RGB').resize((128, 224), Image.Resampling.LANCZOS)
        if view == 'side':
            image = image.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
        rows = []
        for y in range(image.height):
            row = ''
            for x in range(image.width):
                red, green, blue = image.getpixel((x, y))
                # Floor ellipse is a green illustration prop, not anatomy.
                floor = green > red + 3 and green >= blue + 2
                foreground = (min(red, green, blue) < 251 or max(red, green, blue)-min(red, green, blue) > 4) and not floor
                row += '1' if foreground else '0'
            rows.append(row)
        masks.append({'axis': view, 'confidence': .8, 'mask': rows})
    descriptor = {'projection': 'orthographic', 'boundsSpace': 'component-local',
                  'bounds': {'min': [-.58, 0, -.38], 'max': [.58, authored['heightMetres'], .38]},
                  'resolution': 32, 'triangleBudget': 393216, 'views': masks,
                  'hiddenRegions': ['Actual silhouette cone intersection is only an outer constraint; head profile, armpits, face and outfit require upstream character reconstruction. Back is surface evidence, not an independent geometry axis.']}
    write_json(evidence / 'visual-hull-descriptor.json', descriptor)
    write_json(evidence / 'visual-hull.json', carve_visual_hull(descriptor))
    result = {'source': 'exact Golden Base v1 sheet crop', 'views': list(job['views']),
              'heightMetres': authored['heightMetres'], 'headUnitsFromVisiblePixels':
              (authored['feetRow']-authored['crownRow'])/authored['headHeightPixels'],
              'displayAnnotationHeadUnits': 'approximately 3.5, inconsistent with visible-pixel estimate',
              'upstreamAuthority': ['check_reference_admission', 'extract_landmarks', 'delight_albedo',
                                    'solve_camera_pose.fit_camera_to_correspondences', 'visual_hull.carve_visual_hull'],
              'cameraResidualPixels': {v: value['fit']['finalReprojectionError'] for v, value in cameras.items()},
              'stateAcceptance': 'none; read upstream next.py before marking mandatory steps'}
    write_json(evidence / 'intake-summary.json', result)
    return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--workspace', type=Path, required=True)
    parser.add_argument('--cache', type=Path, default=ROOT / '.cache/character-forge-upstream')
    args = parser.parse_args()
    print(json.dumps(prepare(args.workspace, args.cache)))
