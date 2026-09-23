"""Author joint evidence for Golden Base, after accepted upstream geometry.

This is an inferred adaptation of source pixel positions to the existing RINNE
Rig_Medium and Golden Socket contracts. The pinned plugin binds and gates it;
this file never replaces the reconstructed geometry or computes skin weights.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'packages/assets/forge'))
from upstream_workspace import write_json
from sockets import create_sockets


def author(w: Path) -> dict:
    job = json.loads((w / 'forge-job.json').read_text())
    if job['id'] != 'golden-base-v1':
        raise ValueError('This pose authoring belongs to Golden Base, not Scout or another reference')
    spec = json.loads((w / 'object-sculpt-spec.json').read_text())
    if spec['sculptPipeline']['completedPasses'] != spec['sculptPipeline']['passOrder']:
        raise ValueError('Rig authoring follows actual accepted upstream geometry only')
    evidence = json.loads((w / 'img2threejs/evidence/landmarks.json').read_text())
    src = json.loads((ROOT / 'scripts/character-forge/fixtures/golden-base-v1/landmarks.json').read_text())
    if evidence != src:
        raise ValueError('Joint estimates belong to another measured reference')
    scale = evidence['heightMetres'] / (evidence['feetRow']-evidence['crownRow'])
    center = evidence['views']['front']['anchors']['chin'][0]

    def world(x: float, row: float, depth: float = 0) -> list[float]:
        return [(x-center)*scale, (evidence['feetRow']-row)*scale, depth*scale]

    bones = []

    def joint(name: str, parent: str | None, pixel: tuple, tip: tuple, refs: list[str], why: str):
        bones.append({'id': name, 'parent': parent, 'jointPos': world(*pixel),
                      'tipPos': world(*tip), 'observationClass': 'inferred',
                      'evidenceRefs': refs, 'reason': why})

    joint('hips', None, (center, 455), (center, 405), ['front.body.legs', 'back.body.legs'],
          'Pelvis centre inferred inside observed gray suit between leg origins.')
    joint('spine', 'hips', (center, 405), (center, 343), ['front.body.torso', 'side.body.torso'],
          'Torso hinge inferred from the observed front and profile silhouette.')
    joint('chest', 'spine', (center, 343), (center, 290), ['front.body.torso', 'front.anchors.shoulder-left'],
          'Chest pivot centred between reference shoulders.')
    joint('neck', 'chest', (center, 283), (center, 268), ['front.body.neck', 'side.anchors.neck'],
          'Observed neck segment does not reveal its actual joint centre.')
    joint('head', 'neck', (center, 266), (center, evidence['crownRow']),
          ['front.face.headBounds', 'side.headBounds', 'back.headBounds'],
          'Oversize cranium depth is constrained by the real side profile; its pivot remains inferred.')

    # Anatomical L is image right in Front. T-pose arms extend horizontally in
    # Front/Back, whereas the Side artwork shows a lowered foreshortened arm.
    # This inconsistency is retained as uncertain pose evidence, not "corrected"
    # by resizing the reference to a generic imported humanoid.
    for side, points, leg_x in (
        ('L', [(281, 300), (346, 319), (412, 340), (434, 349)], 265),
        ('R', [(167, 300), (99, 319), (34, 340), (9, 349)], 182),
    ):
        arm_refs = ['front.body.arms', 'back.body.arms', 'side.body.arm']
        joint('upperArm.'+side, 'chest', points[0], points[1], arm_refs,
              'Anatomical shoulder and elbow estimated inside the visible T-pose sleeve/arm.')
        joint('lowerArm.'+side, 'upperArm.'+side, points[1], points[2], arm_refs,
              'Elbow to wrist interpolated along actual front arm; Side arm pose conflicts.')
        joint('hand.'+side, 'lowerArm.'+side, points[2], points[3], arm_refs,
              'Palm centred on observed finger extension; finger bones remain unresolved.')
        joint('upperLeg.'+side, 'hips', (leg_x, 463), (leg_x, 548),
              ['front.body.legs', 'back.body.legs'], 'Hip/knee centre inferred inside visible leg.')
        joint('lowerLeg.'+side, 'upperLeg.'+side, (leg_x, 548), (leg_x, 631),
              ['front.body.legs', 'side.body.leg'], 'Knee/ankle centre inferred from front and side contours.')
        joint('foot.'+side, 'lowerLeg.'+side, (leg_x, 631), (leg_x, 658, 18),
              ['front.body.boots', 'side.body.boot'], 'Forefoot tip inferred from side depth and visible toes.')

    components = [{'id': bone['id'], 'parent': bone['parent'], 'role': 'skinned'} for bone in bones]
    meshes = {}
    for node in spec['componentTree']:
        if node['material'] == 'hidden':
            continue
        component = 'surface:' + node['id']
        role = 'hair' if node['id'] == 'hair' else 'detail' if node['id'] == 'head' else 'skinned'
        components.append({'id': component, 'parent': 'head' if role in ('hair', 'detail') else 'hips',
                           'role': role})
        meshes[node['name']] = {'componentId': component, 'role': role, 'sourceComponent': node['id']}
    sockets = {}
    create_sockets(sockets)
    result = {'schema': 'rinne.reference-rig-adaptation/v1', 'rigFamily': 'Rig_Medium',
              'figureHeight': evidence['heightMetres'], 'bones': bones, 'meshes': meshes,
              'bindingComponents': components, 'voxelResolution': 64,
              'sockets': sockets['sockets'],
              'sideAuthority': {'left': 'anatomical L is Front image right',
                                'right': 'anatomical R is Front image left',
                                'sideConflict': 'Side depicts a lowered arm while Front/Back depict T-pose'},
              'geometryChanges': False,
              'status': 'Authored joint inferences only; plugin binding, all rig gates and visual parity pending'}
    write_json(w / 'build/rig/rig-contract.json', result)
    return result


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--workspace', type=Path, required=True)
    a = p.parse_args()
    row = author(a.workspace.resolve())
    print(json.dumps({'bones': len(row['bones']), 'meshes': len(row['meshes']), 'status': row['status']}))
