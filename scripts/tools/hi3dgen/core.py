"""Pure, offline contracts shared by inference, materialization and focused tests."""
from __future__ import annotations
import hashlib
import json
import math
from pathlib import Path
import re
import struct

MAX_ASSET_BYTES = 20 * 1024 * 1024
MAX_INPUT_BYTES = 8 * 1024 * 1024
MAX_RAW_BYTES = 128 * 1024 * 1024
ID = re.compile(r'^[a-z][a-z0-9-]{2,63}$')


def digest(data: bytes) -> dict:
    return {'sha256': hashlib.sha256(data).hexdigest(), 'byteLength': len(data),
            'gitBlobSha': hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()}


def safe_path(value: str) -> str:
    if not isinstance(value, str) or not value or any(c in value for c in ('\\', '\0', ':', '?', '#', '%')):
        raise ValueError('UNSAFE_PATH')
    if any(part in ('', '.', '..') for part in value.split('/')):
        raise ValueError('UNSAFE_PATH')
    return value


def contained(root: Path, value: str) -> Path:
    path = (root / safe_path(value)).resolve()
    if not path.is_relative_to(root.resolve()):
        raise ValueError('PATH_ESCAPES_REPOSITORY')
    return path


def validate_request(request: dict) -> dict:
    if request.get('schema') != 1 or not ID.fullmatch(request.get('id', '')):
        raise ValueError('INVALID_REQUEST_ID_OR_SCHEMA')
    if request.get('productionEligible') is not False or request.get('usage') != 'experimental-review':
        raise ValueError('GENERATED_ASSETS_ARE_EXPERIMENTAL_ONLY')
    if not isinstance(request.get('label'), str) or not request['label'].strip():
        raise ValueError('LABEL_REQUIRED')
    images = request.get('images')
    if not isinstance(images, list) or not 1 <= len(images) <= 8:
        raise ValueError('IMAGES_ARRAY_REQUIRED')
    for image in images:
        safe_path(image['path'])
        if not image.get('license') or not image.get('author') or not image.get('view'):
            raise ValueError('IMAGE_PROVENANCE_REQUIRED')
        if Path(image['path']).suffix.lower() not in ('.png', '.jpg', '.jpeg', '.webp'):
            raise ValueError('UNSUPPORTED_IMAGE_FORMAT')
    provider = request.get('provider', {})
    if provider.get('id') not in ('hi3dgen-hf', 'hi3dgen-local'):
        raise ValueError('UNKNOWN_PROVIDER')
    if provider['id'] == 'hi3dgen-hf' and request.get('consentToPublicInference') is not True:
        raise ValueError('PUBLIC_UPLOAD_CONSENT_REQUIRED')
    if len(images) != 1:
        raise ValueError('PROVIDER_MULTIVIEW_UNSUPPORTED: Hi3DGen currently accepts exactly one view')
    p = request.get('parameters', {})
    for key, lower, upper in [('seed', 0, 2147483647), ('ssSamplingSteps', 1, 50), ('slatSamplingSteps', 1, 50)]:
        if type(p.get(key)) is not int or not lower <= p[key] <= upper:
            raise ValueError('INVALID_PARAMETER_' + key)
    for key in ('ssGuidanceStrength', 'slatGuidanceStrength'):
        if not isinstance(p.get(key), (int, float)) or not math.isfinite(p[key]) or not 0 <= p[key] <= 10:
            raise ValueError('INVALID_PARAMETER_' + key)
    post = request.get('postprocess', {})
    for key, lower, upper in [('heightMeters', .05, 5), ('yawDegrees', -360, 360)]:
        if not isinstance(post.get(key), (int, float)) or not math.isfinite(post[key]) or not lower <= post[key] <= upper:
            raise ValueError('INVALID_POSTPROCESS_' + key)
    if type(post.get('maxTriangles')) is not int or not 100 <= post['maxTriangles'] <= 20000:
        raise ValueError('INVALID_TRIANGLE_BUDGET')
    return request


def inspect_glb(data: bytes, max_bytes: int = MAX_ASSET_BYTES) -> dict:
    if not 20 <= len(data) <= max_bytes:
        raise ValueError('GLB_BYTE_BUDGET')
    magic, version, length = struct.unpack_from('<4sII', data)
    if magic != b'glTF' or version != 2 or length != len(data):
        raise ValueError('INVALID_GLB_HEADER')
    offset, chunks = 12, []
    while offset < len(data):
        if offset + 8 > len(data):
            raise ValueError('TRUNCATED_GLB_CHUNK')
        size, kind = struct.unpack_from('<II', data, offset)
        offset += 8
        if size % 4 or offset + size > len(data):
            raise ValueError('INVALID_GLB_CHUNK')
        chunks.append((kind, data[offset:offset + size]))
        offset += size
    if len(chunks) != 2 or chunks[0][0] != 0x4E4F534A or chunks[1][0] != 0x004E4942:
        raise ValueError('SELF_CONTAINED_GLB_REQUIRED')
    gltf = json.loads(chunks[0][1].rstrip(b' \0'))
    buffers = gltf.get('buffers', [])
    if len(buffers) != 1 or any('uri' in item for item in buffers + gltf.get('images', [])):
        raise ValueError('EXTERNAL_GLB_DEPENDENCY')
    if buffers[0].get('byteLength', 0) > len(chunks[1][1]):
        raise ValueError('GLB_BUFFER_LENGTH_MISMATCH')
    accessors = gltf.get('accessors', [])
    triangles, mins, maxs = 0, [], []
    for mesh in gltf.get('meshes', []):
        for primitive in mesh.get('primitives', []):
            if primitive.get('mode', 4) != 4:
                raise ValueError('TRIANGLES_ONLY')
            pos = accessors[primitive['attributes']['POSITION']]
            count = accessors[primitive['indices']]['count'] if 'indices' in primitive else pos['count']
            if not isinstance(count, int) or count < 3 or count % 3:
                raise ValueError('INVALID_TRIANGLE_COUNT')
            triangles += count // 3
            for key in ('min', 'max'):
                if len(pos.get(key, [])) != 3 or not all(math.isfinite(x) for x in pos[key]):
                    raise ValueError('FINITE_BOUNDING_BOX_REQUIRED')
            mins.append(pos['min']); maxs.append(pos['max'])
    if not triangles or not mins:
        raise ValueError('EMPTY_MESH')
    bounds = [[min(p[i] for p in mins) for i in range(3)], [max(p[i] for p in maxs) for i in range(3)]]
    if any(bounds[1][i] <= bounds[0][i] for i in range(3)):
        raise ValueError('DEGENERATE_BOUNDING_BOX')
    return {'format': 'glb', 'triangles': triangles, 'meshLocalBounds': bounds,
            'meshCount': len(gltf['meshes']), 'externalDependencies': 0}


def write_immutable(path: Path, data: bytes) -> None:
    if path.is_file():
        if path.read_bytes() != data:
            raise ValueError('IMMUTABLE_PATH_COLLISION: ' + str(path))
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)


def add_manifest(manifest: dict, path: str, data: bytes) -> None:
    safe_path(path)
    if len(data) > min(manifest['maxAssetBytes'], MAX_ASSET_BYTES):
        raise ValueError('ASSET_ORIGIN_BYTE_BUDGET')
    info = digest(data)
    row = {'path': path, 'bytes': len(data), 'gitBlobSha': info['gitBlobSha'], 'sha256': info['sha256']}
    existing = next((r for r in manifest['files'] if r['path'] == path), None)
    if existing is not None and existing != row:
        raise ValueError('MANIFEST_INTEGRITY_CONFLICT')
    if existing is None:
        manifest['files'].append(row)


def json_bytes(value) -> bytes:
    return (json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + '\n').encode()
