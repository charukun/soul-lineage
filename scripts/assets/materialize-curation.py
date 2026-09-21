#!/usr/bin/env python3
"""Manually invoked, additive public-asset materializer. Never used at runtime/build.

Fetch only the selected public paths at immutable Git revisions. Verify every
source blob, embed glTF dependencies without changing artist geometry/animation,
and append content-addressed files plus provenance to the existing Asset Origin.
Activation is a separate integration/validation step; this command never deploys.
"""
from __future__ import annotations
import base64
import hashlib
import json
import os
import pathlib
import posixpath
import re
import struct
import subprocess
import sys
import time
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[2]
LIBRARY = ROOT / 'apps/review/public/library'
SPEC_PATH = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'scripts/assets/curation-20260921.json'
SPEC = json.loads(SPEC_PATH.read_text())
POLICY = SPEC['policy']
LEDGER_PATH = LIBRARY / 'provenance' / (SPEC['id'] + '.json')
GENERATED = ROOT / 'packages/assets/generated/curated-library.json'
MANIFEST_PATH = LIBRARY / 'manifest.json'
CC0_URL = 'https://creativecommons.org/publicdomain/zero/1.0/'
SHA_RE = re.compile(r'^[0-9a-f]{40}$')
CACHE: dict[str, object] = {}
SKIPPED: list[dict] = []

def fail(message: str):
    raise ValueError(message)

def blob_sha(data: bytes) -> str:
    return hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()

def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()

def safe_path(path: str) -> str:
    if not isinstance(path, str) or not path or path.startswith(('/', '\\')) or '\\' in path or '\0' in path:
        fail('Unsafe asset path: ' + repr(path))
    if any(part in ('', '.', '..') for part in path.split('/')):
        fail('Unsafe asset path: ' + path)
    return path

def request(url: str, *, api: bool = False, limit: int = 24_000_000) -> bytes:
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme != 'https' or parsed.username or parsed.password:
        fail('HTTPS public source required')
    if api and parsed.netloc != 'api.github.com':
        fail('API credentials may only be sent to api.github.com')
    headers = {'User-Agent': 'soul-lineage-pinned-asset-materializer/1'}
    if api:
        headers['Accept'] = 'application/vnd.github+json'
        if os.environ.get('GITHUB_TOKEN'):
            headers['Authorization'] = 'Bearer ' + os.environ['GITHUB_TOKEN']
    for attempt in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=60) as response:
                body = response.read(limit + 1)
                if len(body) > limit:
                    fail('Source exceeds bounded download size: ' + url)
                return body
        except Exception:
            if attempt == 2:
                raise
            time.sleep(attempt + 1)
    raise RuntimeError('Unreachable')

def api_json(url: str):
    if url not in CACHE:
        CACHE[url] = json.loads(request(url, api=True, limit=12_000_000))
    return CACHE[url]

def tree(repository: str, ref: str, recursive: bool = False) -> dict:
    suffix = '?recursive=1' if recursive else ''
    result = api_json('https://api.github.com/repos/' + repository + '/git/trees/' + ref + suffix)
    if result.get('truncated'):
        fail('Refusing truncated source tree: ' + repository + '/' + ref)
    return result

def lookup(pack: dict, path: str) -> dict:
    parts = safe_path(path.rstrip('/')).split('/')
    current = pack['revision']
    result = None
    for i, part in enumerate(parts):
        entries = tree(pack['repository'], current)['tree']
        result = next((row for row in entries if row['path'] == part), None)
        if result is None:
            fail('Missing pinned source path: ' + pack['repository'] + '/' + path)
        if i < len(parts) - 1:
            if result['type'] != 'tree':
                fail('Source directory expected: ' + path)
            current = result['sha']
    return result

def source_url(pack: dict, path: str) -> str:
    safe_path(path)
    return 'https://raw.githubusercontent.com/' + pack['repository'] + '/' + pack['revision'] + '/' + urllib.parse.quote(path, safe='/')

def source_bytes(pack: dict, path: str, row: dict | None = None) -> tuple[bytes, dict]:
    row = row or lookup(pack, path)
    if row['type'] != 'blob' or not SHA_RE.fullmatch(row['sha']):
        fail('Pinned source blob required: ' + path)
    key = 'bytes:' + pack['repository'] + ':' + row['sha']
    if key not in CACHE:
        data = request(source_url(pack, path))
        if len(data) != row['size'] or blob_sha(data) != row['sha']:
            fail('Source integrity mismatch: ' + path)
        if data.startswith(b'version https://git-lfs.github.com/spec/v1'):
            fail('Git LFS pointer is not an asset: ' + path)
        CACHE[key] = data
    data = CACHE[key]
    return data, {'path': path, 'url': source_url(pack, path), 'byteLength': len(data), 'gitBlobSha': row['sha'], 'sha256': sha256(data)}

def write_new(path: pathlib.Path, data: bytes):
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        if path.read_bytes() != data:
            fail('Refusing immutable asset overwrite: ' + str(path))
    else:
        path.write_bytes(data)

def write_json(path: pathlib.Path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')

def align4(data: bytes, pad: bytes = b'\0') -> bytes:
    return data + pad * ((-len(data)) % 4)

def read_glb(data: bytes) -> tuple[dict, bytes]:
    if len(data) < 20 or data[:4] != b'glTF':
        fail('GLB magic missing')
    _, version, total = struct.unpack_from('<III', data)
    if version != 2 or total != len(data):
        fail('GLB header/length mismatch')
    offset, document, binary = 12, None, b''
    while offset < len(data):
        if offset + 8 > len(data):
            fail('Truncated GLB chunk')
        length, kind = struct.unpack_from('<II', data, offset)
        offset += 8
        chunk = data[offset:offset + length]
        if len(chunk) != length or length % 4:
            fail('Invalid GLB chunk bounds')
        if kind == 0x4E4F534A:
            if document is not None:
                fail('Duplicate GLB JSON chunk')
            document = json.loads(chunk.rstrip(b' \0'))
        elif kind == 0x004E4942:
            binary = chunk
        offset += length
    if document is None or str(document.get('asset', {}).get('version')) != '2.0':
        fail('glTF 2.0 required')
    return document, binary

def dependency(pack: dict, owner_path: str, uri: str, inputs: list[dict]) -> bytes:
    if uri.startswith('data:'):
        header, encoded = uri.split(',', 1)
        if ';base64' not in header:
            fail('Only base64 embedded glTF data is accepted')
        return base64.b64decode(encoded, validate=True)
    if urllib.parse.urlparse(uri).scheme or uri.startswith('/') or '\\' in uri or '?' in uri or '#' in uri:
        fail('External glTF dependency URL prohibited: ' + uri)
    path = posixpath.normpath(posixpath.join(posixpath.dirname(owner_path), urllib.parse.unquote(uri)))
    safe_path(path)
    data, evidence = source_bytes(pack, path)
    if not any(item['path'] == path for item in inputs):
        inputs.append(evidence)
    return data

def mime(data: bytes) -> str:
    if data.startswith(b'\x89PNG\r\n\x1a\n'):
        return 'image/png'
    if data.startswith(b'\xff\xd8'):
        return 'image/jpeg'
    fail('Unsupported embedded image format')

def image_dimensions(data: bytes) -> tuple[int, int]:
    kind = mime(data)
    if kind == 'image/png':
        if len(data) < 24:
            fail('Truncated PNG')
        return struct.unpack_from('>II', data, 16)
    offset = 2
    while offset + 4 < len(data):
        if data[offset] != 255:
            offset += 1
            continue
        marker = data[offset + 1]
        offset += 2
        if marker in (0xD8, 0xD9) or 0xD0 <= marker <= 0xD7:
            continue
        length = struct.unpack_from('>H', data, offset)[0]
        if marker in (0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF):
            height, width = struct.unpack_from('>HH', data, offset + 3)
            return width, height
        if length < 2:
            break
        offset += length
    fail('JPEG dimensions unavailable')

def embed_gltf(pack: dict, path: str, data: bytes, inputs: list[dict]) -> bytes:
    if data[:4] == b'glTF':
        document, old_binary = read_glb(data)
        if not any('uri' in row for row in document.get('buffers', []) + document.get('images', [])):
            return data
    else:
        document, old_binary = json.loads(data), b''
    if document.get('asset', {}).get('version') != '2.0':
        fail('glTF 2.0 source required')
    buffer_bases, chunks = [], []
    offset = 0
    for row in document.get('buffers', []):
        content = dependency(pack, path, row['uri'], inputs) if 'uri' in row else old_binary[:row['byteLength']]
        if len(content) != row['byteLength']:
            fail('Source glTF buffer byteLength mismatch: ' + path)
        buffer_bases.append(offset)
        padded = align4(content)
        chunks.append(padded)
        offset += len(padded)
    views = document.setdefault('bufferViews', [])
    for view in views:
        index = view.get('buffer', 0)
        if index >= len(buffer_bases):
            fail('Invalid source buffer index')
        view['byteOffset'] = buffer_bases[index] + view.get('byteOffset', 0)
        view['buffer'] = 0
    for image in document.get('images', []):
        if 'uri' not in image:
            continue
        content = dependency(pack, path, image.pop('uri'), inputs)
        image['mimeType'] = mime(content)
        image['bufferView'] = len(views)
        views.append({'buffer': 0, 'byteOffset': offset, 'byteLength': len(content)})
        padded = align4(content)
        chunks.append(padded)
        offset += len(padded)
    binary = b''.join(chunks)
    document['buffers'] = [{'byteLength': len(binary)}]
    encoded = align4(json.dumps(document, ensure_ascii=False, separators=(',', ':')).encode(), b' ')
    return struct.pack('<III', 0x46546C67, 2, 28 + len(encoded) + len(binary)) + struct.pack('<II', len(encoded), 0x4E4F534A) + encoded + struct.pack('<II', len(binary), 0x004E4942) + binary

def inspect_glb(data: bytes, kind: str) -> dict:
    document, binary = read_glb(data)
    if any('uri' in row for row in document.get('buffers', []) + document.get('images', [])):
        fail('Runtime GLB must have no external dependencies')
    if document.get('extensionsRequired'):
        fail('Curated GLB must not need additional runtime decoders/extensions')
    for view in document.get('bufferViews', []):
        if view.get('buffer', 0) != 0 or view.get('byteOffset', 0) < 0 or view.get('byteOffset', 0) + view['byteLength'] > len(binary):
            fail('GLB bufferView outside BIN chunk')
    accessors = document.get('accessors', [])
    primitives = [primitive for mesh in document.get('meshes', []) for primitive in mesh.get('primitives', [])]
    triangles, vertices = 0, 0
    for primitive in primitives:
        position = primitive.get('attributes', {}).get('POSITION')
        if position is None or position >= len(accessors):
            fail('Renderable POSITION accessor required')
        count = accessors[position]['count']
        vertices += count
        index = primitive.get('indices')
        count = accessors[index]['count'] if index is not None else count
        mode = primitive.get('mode', 4)
        triangles += count // 3 if mode == 4 else max(0, count - 2) if mode in (5, 6) else 0
    if not primitives or triangles < 1 or triangles > POLICY['maxTriangles']:
        fail('Geometry budget rejected: ' + str(triangles))
    texture_dimensions = []
    for image in document.get('images', []):
        view = document['bufferViews'][image['bufferView']]
        start = view.get('byteOffset', 0)
        dimensions = image_dimensions(binary[start:start + view['byteLength']])
        if min(dimensions) < 1 or max(dimensions) > POLICY['maxTextureDimension']:
            fail('Texture dimension budget exceeded')
        texture_dimensions.append(list(dimensions))
    animations = []
    for index, animation in enumerate(document.get('animations', [])):
        if not animation.get('channels') or not animation.get('samplers'):
            fail('Empty native animation')
        durations = []
        for sampler in animation['samplers']:
            accessor = accessors[sampler['input']]
            if accessor['count'] < 1:
                fail('Empty native animation time accessor')
            durations.append(float(accessor.get('max', [0])[0]))
        animations.append({'index': index, 'name': animation.get('name', 'Animation ' + str(index)), 'channels': len(animation['channels']), 'duration': max(durations)})
    skins = document.get('skins', [])
    if kind == 'creature' and (not skins or not animations or any(not skin.get('joints') for skin in skins)):
        fail('Animated creature must preserve real skins, joints and clips')
    return {'format': 'glb', 'vertices': vertices, 'triangles': triangles, 'meshes': len(document.get('meshes', [])), 'primitives': len(primitives), 'materials': len(document.get('materials', [])), 'skins': len(skins), 'joints': sum(len(skin.get('joints', [])) for skin in skins), 'animations': animations, 'textureDimensions': texture_dimensions, 'externalDependencies': 0}

def slug(value: str) -> str:
    return re.sub(r'[^a-z0-9]+', '-', value.lower()).strip('-')

def classification(pack: dict, name: str) -> tuple[str, str]:
    key = name.lower()
    if pack['kind'] == 'creature':
        return 'creatures', 'creature'
    if any(word in key for word in ('sword', 'shield', 'spear', 'weapon', 'bow', 'axe', 'helmet', 'armor', 'staff')) and 'banner' not in key:
        return 'weapons', 'equipment'
    if any(word in key for word in ('bed', 'chair', 'table', 'shelf', 'bench', 'stool')):
        return 'furniture', 'prop'
    if any(word in key for word in ('tree', 'rock', 'hill', 'mountain', 'cloud', 'grass', 'bush', 'flower')):
        return 'outdoor', 'nature'
    if any(word in key for word in ('building', 'wall', 'floor', 'door', 'gate', 'stairs', 'pillar', 'column', 'arch', 'roof', 'bridge', 'tile', 'hex')):
        return 'outdoor', 'building'
    return 'props', 'prop'

CREATURE_LABELS = {'Bat': 'コウモリ', 'Bee': 'ハチ', 'Cactus': 'サボテン精', 'Chicken': 'ニワトリ', 'Crab': 'カニ', 'Cthulhu': 'タコの魔物', 'Cyclops': '一つ目', 'Deer': 'シカ', 'Demon': '小悪魔', 'Ghost': 'おばけ', 'GreenDemon': '緑の小悪魔', 'Mushroom': 'キノコ精', 'Panda': 'パンダ', 'Penguin': 'ペンギン', 'Pig': 'ブタ', 'Skull': 'ドクロ精', 'Tree': '木の精', 'YellowDragon': '黄竜', 'Yeti': '雪男'}

def add_manifest(manifest: dict, relative: str, data: bytes):
    entry = {'path': relative, 'bytes': len(data), 'gitBlobSha': blob_sha(data), 'sha256': sha256(data)}
    existing = next((item for item in manifest['files'] if item['path'] == relative), None)
    if existing is not None:
        if existing['bytes'] != entry['bytes'] or existing['gitBlobSha'] != entry['gitBlobSha']:
            fail('Manifest immutable path mismatch: ' + relative)
    else:
        manifest['files'].append(entry)

def license_evidence(pack: dict) -> list[dict]:
    prefix = 'licenses/' + pack['id']
    evidence = []
    if pack.get('licensePath'):
        data, source = source_bytes(pack, pack['licensePath'])
        if not re.search(rb'(CC0|Creative Commons Zero|public.?domain|creativecommons.org/publicdomain/zero)', data, re.I):
            fail('CC0 declaration missing: ' + pack['id'])
        relative = prefix + '-CC0.txt'
        write_new(LIBRARY / relative, data)
        evidence.append({**source, 'runtimePath': relative})
    else:
        url = pack['licenseDeclarationUrl']
        declaration = request(url, limit=2_000_000)
        if b'creativecommons.org/publicdomain/zero' not in declaration or b'Cute Animated Monsters' not in declaration:
            fail('Original author CC0 declaration could not be verified')
        data = ('Author: ' + pack['author'] + '\nOriginal source: ' + url + '\nRelease: ' + pack.get('upstreamRelease', '') + '\nLicense: CC0-1.0\nLicense URL: ' + CC0_URL + '\nAcquisition mirror (not author): https://github.com/' + pack['repository'] + '\nPinned revision: ' + pack['revision'] + '\nOriginal author declaration HTML SHA-256: ' + sha256(declaration) + '\nThe artist page identifies this pack as CC0 and available for personal and commercial projects.\n').encode()
        relative = prefix + '-CC0.txt'
        write_new(LIBRARY / relative, data)
        evidence.append({'url': url, 'declarationSha256': sha256(declaration), 'runtimePath': relative, 'byteLength': len(data), 'gitBlobSha': blob_sha(data), 'sha256': sha256(data)})
    return evidence

def main():
    if SPEC.get('schema') != 1 or not POLICY.get('additiveOnly'):
        fail('Explicit additive curation spec required')
    manifest = json.loads(MANIFEST_PATH.read_text())
    previous = json.loads(LEDGER_PATH.read_text()) if LEDGER_PATH.exists() else {'files': [], 'packs': []}
    previous_by_source = {row['source']['repository'] + '@' + row['source']['revision'] + '/' + row['source']['path']: row for row in previous['files']}
    accepted = list(previous['files'])
    existing_hashes = {row['gitBlobSha'] for row in manifest['files']}
    # Include pre-library local GLB/glTF assets; never export repository source.
    tracked = subprocess.check_output(['git', 'ls-files', '--stage', '-z'], cwd=ROOT).decode().split('\0')
    for line in tracked:
        if not line:
            continue
        metadata, path = line.split('\t', 1)
        if pathlib.Path(path).suffix.lower() in ('.glb', '.gltf', '.ogg', '.wav', '.png', '.jpg'):
            existing_hashes.add(metadata.split()[1])
    # Source identities already registered through different local packaging are duplicates too.
    registered_hashes = set()
    for base in (LIBRARY / 'provenance', ROOT / 'apps/rinne/src', ROOT / 'packages/assets', ROOT / 'packages/characters'):
        for path in base.rglob('*'):
            if not path.is_file() or path.suffix not in ('.json', '.js') or path == LEDGER_PATH or path == GENERATED:
                continue
            text = path.read_text(errors='ignore')
            registered_hashes.update(re.findall(r'gitBlobSha[\"\']?\s*:\s*[\"\']([0-9a-f]{40})', text))
    pack_evidence = []
    for pack in SPEC['packs']:
        if pack['license'] != 'CC0-1.0' or not SHA_RE.fullmatch(pack['revision']):
            fail('Unpinned or uncleared source pack')
        license_rows = license_evidence(pack)
        for item in license_rows:
            add_manifest(manifest, item['runtimePath'], (LIBRARY / item['runtimePath']).read_bytes())
        source_directory = lookup(pack, pack['sourcePrefix'])
        if source_directory['type'] != 'tree':
            fail('Source prefix must be a directory')
        rows = tree(pack['repository'], source_directory['sha'], recursive=True)['tree']
        candidates = [row for row in rows if row['type'] == 'blob' and pathlib.PurePosixPath(row['path']).suffix.lower() in pack['extensions']]
        # Prefer an authored GLB when the pack also supplies its glTF equivalent.
        glb_stems = {row['path'][:-4].removesuffix('.gltf') for row in candidates if row['path'].endswith('.glb')}
        count_before = len(accepted)
        for row in sorted(candidates, key=lambda item: item['path']):
            source_path = pack['sourcePrefix'] + row['path']
            name = pathlib.PurePosixPath(row['path']).stem.removesuffix('.gltf')
            identity = pack['repository'] + '@' + pack['revision'] + '/' + source_path
            if identity in previous_by_source:
                continue
            if name in pack.get('excludeNames', []):
                SKIPPED.append({'source': source_path, 'reason': 'art-direction-exclusion'})
                continue
            if row['path'].endswith('.gltf') and row['path'][:-5] in glb_stems:
                SKIPPED.append({'source': source_path, 'reason': 'authored-glb-preferred'})
                continue
            if row['sha'] in existing_hashes or row['sha'] in registered_hashes:
                SKIPPED.append({'source': source_path, 'reason': 'existing-content-or-source-hash', 'gitBlobSha': row['sha']})
                continue
            original, source = source_bytes(pack, source_path, row)
            inputs = [source]
            if pack['kind'] == 'audio':
                if original[:4] != b'OggS' or b'vorbis' not in original[:512]:
                    fail('Expected native Ogg Vorbis audio: ' + source_path)
                output = original
                metadata = {'format': 'ogg', 'externalDependencies': 0}
                maximum = POLICY['maxAudioBytes']
                extension = '.ogg'
                category, asset_type = ('足音' if 'footstep' in name.lower() else '命中' if 'impact' in name.lower() else '生活'), 'audio'
            else:
                output = embed_gltf(pack, source_path, original, inputs)
                metadata = inspect_glb(output, pack['kind'])
                maximum = POLICY['maxCreatureBytes'] if pack['kind'] == 'creature' else POLICY['maxObjectBytes']
                extension = '.glb'
                category, asset_type = classification(pack, name)
            if len(output) > maximum:
                SKIPPED.append({'source': source_path, 'reason': 'byte-budget', 'byteLength': len(output)})
                continue
            output_hash = blob_sha(output)
            if output_hash in existing_hashes:
                SKIPPED.append({'source': source_path, 'reason': 'existing-materialized-content', 'gitBlobSha': output_hash})
                continue
            id_value = pack['id'] + '-' + slug(row['path'].rsplit('.', 1)[0].removesuffix('.gltf'))
            relative = ('audio/' if asset_type == 'audio' else 'model/') + pack['id'] + '/' + slug(name) + '/' + output_hash + extension
            write_new(LIBRARY / relative, output)
            add_manifest(manifest, relative, output)
            label = CREATURE_LABELS.get(name, name.replace('_', ' ').replace('-', ' '))
            record = {
                'id': id_value, 'visualAssetId': 'library.' + id_value + '.v1' if asset_type != 'audio' else None,
                'label': label, 'kind': pack['kind'], 'type': asset_type, 'category': category,
                'active': False, 'status': 'MATERIALIZED', 'origin': 'artist-authored',
                'license': pack['license'], 'author': pack['author'], 'originalSource': pack['originalSource'],
                'pack': pack['id'], 'runtimePath': relative, 'localPath': 'apps/review/public/library/' + relative,
                'licensePath': 'apps/review/public/library/' + license_rows[0]['runtimePath'],
                'byteLength': len(output), 'gitBlobSha': output_hash, 'sha256': sha256(output),
                'source': {'repository': pack['repository'], 'revision': pack['revision'], 'path': source_path, 'url': source['url'], 'hash': 'git-blob:' + source['gitBlobSha'], 'gitBlobSha': source['gitBlobSha'], 'byteLength': source['byteLength'], 'sha256': source['sha256']},
                'inputs': inputs, 'transform': 'none' if output == original else 'embed glTF buffers/images into GLB; geometry, skin and animation unchanged',
                'inspection': metadata,
                'review': {'route': '/review-sound' if asset_type == 'audio' else '/review-objects', 'nativeAnimationOnly': pack['kind'] == 'creature', 'productionVisualApproval': False},
            }
            accepted.append(record)
            existing_hashes.add(output_hash)
            registered_hashes.add(source['gitBlobSha'])
        pack_evidence.append({**pack, 'sourceTreeSha': source_directory['sha'], 'licenseEvidence': license_rows, 'newAssets': len(accepted) - count_before})
        print(json.dumps({'pack': pack['id'], 'newAssets': len(accepted) - count_before, 'totalAccepted': len(accepted)}, ensure_ascii=False), flush=True)
    if not accepted:
        fail('No new nonduplicate eligible assets')
    manifest['files'].sort(key=lambda row: row['path'])
    write_json(MANIFEST_PATH, manifest)
    ledger = {'schema': 1, 'id': SPEC['id'], 'active': False, 'baseSha': SPEC['baseSha'], 'materializedOnHead': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT).decode().strip(), 'runtimeOrigin': manifest['origin'], 'policy': POLICY, 'packs': pack_evidence, 'files': accepted, 'skipped': SKIPPED, 'excluded': SPEC.get('excluded', [])}
    write_json(LEDGER_PATH, ledger)
    # Data backing the single visual registry and existing review catalogs, not a new registry.
    compact = [{key: value for key, value in row.items() if key not in ('inputs', 'transform')} for row in accepted]
    write_json(GENERATED, compact)
    print(json.dumps({'assets': len(accepted), 'bytes': sum(row['byteLength'] for row in accepted), 'kinds': {kind: sum(row['kind'] == kind for row in accepted) for kind in ('object', 'creature', 'audio')}, 'duplicatesOrExcluded': len(SKIPPED)}, ensure_ascii=False), flush=True)

if __name__ == '__main__':
    main()
