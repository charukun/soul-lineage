"""Serialization adapters for real upstream functions which have no complete CLI.

No fitting, hull, UV solver or morph-delta algorithm is reimplemented here. The
UV seam expansion is the consumer action explicitly required by uv_unwrap.py.
"""
from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
import sys

from .engine import Engine, EngineError, load_json, save_json, sha256
from .session import confined, required_file, read_session


def execute(workspace: Path, engine: Engine, operation: str, input_path: str, output_path: str) -> dict:
    read_session(workspace, engine)
    data_path = required_file(workspace, input_path)
    data = load_json(data_path)
    sys.path.insert(0, str(engine.root))
    used = []
    if operation == 'camera-fit':
        from forge.stage1_intake.solve_camera_pose import fit_camera_to_correspondences
        from forge.stage1_intake.camera_fitting_types import CameraParameters, NormalizedCorrespondence
        used = ['forge/stage1_intake/solve_camera_pose.py', 'forge/stage1_intake/camera_fitting_types.py',
                'forge/stage1_intake/camera_fitting_solver.py', 'forge/stage1_intake/camera_fitting_math.py']
        initial = dict(data['initialCamera'])
        initial['position'] = tuple(initial['position'])
        points = [NormalizedCorrespondence(row['name'], tuple(row['world']), tuple(row['observed'])) for row in data['correspondences']]
        result = fit_camera_to_correspondences(points, initial_camera=CameraParameters(**initial))
    elif operation == 'landmark-fit':
        # The caller supplies a parametric template as affine landmark bases.
        # The optimizer and projection math are the upstream implementations.
        from forge.stage4_review.fit_params import fit, FitConfig
        from forge.stage1_intake.camera_fitting_types import CameraParameters
        from forge.stage1_intake.camera_fitting_math import project_landmark
        used = ['forge/stage4_review/fit_params.py', 'forge/stage1_intake/camera_fitting_math.py']
        cameras = {}
        for name, raw in data['cameras'].items():
            raw = dict(raw); raw['position'] = tuple(raw['position'])
            cameras[name] = CameraParameters(**raw)
        count = len(data['initial'])
        for row in data['landmarks']:
            if len(row['basis']) != count or len(row['offset']) != 3:
                raise EngineError('Landmark template basis dimensions do not match parameters')
        def objective(parameters):
            squared = []
            for row in data['landmarks']:
                world = tuple(float(row['offset'][axis]) + sum(parameters[j] * row['basis'][j][axis] for j in range(count)) for axis in range(3))
                predicted = project_landmark(world, cameras[row['view']])
                if predicted is None:
                    return -1e12
                squared.append(sum((predicted[k] - row['observed'][k]) ** 2 for k in range(2)))
            if not squared:
                raise EngineError('No observed landmarks were provided')
            return -sum(squared) / len(squared)
        fitted = fit(data['initial'], data['bounds'], objective, FitConfig(**data.get('config', {})))
        result = fitted.to_json()
        result['metric'] = 'negative-mean-squared-reprojection-pixels; not an aesthetic quality score'
        result['initialRmsPixels'] = math.sqrt(max(0, -objective(tuple(data['initial']))))
        result['finalRmsPixels'] = math.sqrt(max(0, -fitted.best_score))
    elif operation == 'unwrap':
        from forge.stage3_build import uv_unwrap as uv
        used = ['forge/stage3_build/uv_unwrap.py']
        vertices = data['vertices']; faces = uv._triangles(data['indices'])
        angle = data.get('angleDegrees', uv.DEFAULT_CHART_ANGLE_DEGREES)
        report = uv.unwrap(data, angle)
        if report['totalFlippedTriangles'] or report['nonDiskCharts']:
            save_json(confined(workspace, output_path), {'status': 'blocked', 'report': report})
            raise EngineError('Upstream UV unwrap rejected fold-over/non-disk charts; no replacement unwrap was used')
        # unwrap() documents seam duplication but returns only the last chart UV
        # per vertex. Reuse its same segmentation/LSCM/packing functions to retain
        # each chart's coordinates before serializing the required duplicate rows.
        charts, _ = uv.enforce_disk_charts(faces, uv.segment_charts(vertices, faces, angle))
        packed, _ = uv.pack_charts([uv.lscm(vertices, faces, chart) for chart in charts])
        expanded = []; uvs = []; indices = []; source_indices = []
        for number, chart in enumerate(charts):
            remap = {}
            for face_index in chart:
                for old in faces[face_index]:
                    if old not in remap:
                        remap[old] = len(expanded)
                        expanded.append(vertices[old]); uvs.append(list(packed[number][old])); source_indices.append(old)
                    indices.append(remap[old])
        result = {'vertices': expanded, 'indices': indices, 'uv': uvs,
                  'sourceVertexIndices': source_indices, 'report': report,
                  'notes': 'Topology at UV seams was duplicated before rig freeze; vertex positions are copied unchanged.'}
        for key in ('normals',):
            if key in data:
                result[key] = [data[key][index] for index in source_indices]
    elif operation == 'morphs':
        from forge.stage3_build.morph_targets import build_morph_set
        used = ['forge/stage3_build/morph_targets.py']
        result = build_morph_set(data['base'], data['targets'])
        if result['noOpTargets']:
            raise EngineError('No-op morph targets are not a completed Morph adapter')
    else:
        raise EngineError(f'Unsupported direct upstream operation: {operation}')
    output = confined(workspace, output_path)
    save_json(output, result)
    receipt = {'operation': operation, 'input': input_path, 'inputSha256': sha256(data_path.read_bytes()),
               'output': output_path, 'outputSha256': sha256(output.read_bytes()),
               'upstreamCommit': engine.lock['engine']['commit'],
               'upstreamFunctions': [{'path': path, 'sha256': sha256((engine.root/path).read_bytes())} for path in used]}
    save_json(output.with_suffix(output.suffix + '.receipt.json'), receipt)
    return receipt
