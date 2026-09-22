"""Generation-only adapters. No credentials, quota rotation, or paid fallback."""
from __future__ import annotations
import base64
import json
from pathlib import Path
import re
import time
from urllib.parse import quote, urlparse
from core import MAX_RAW_BYTES, contained, digest, json_bytes, write_immutable


class Hi3DGenProvider:
    max_views = 1

    def __init__(self, config: dict, log, work: Path):
        import requests
        self.session = requests.Session()
        self.session.trust_env = False
        self.session.headers['User-Agent'] = 'RINNE-experimental-Hi3DGen/1'
        self.config, self.log, self.work = config, log, work
        self.endpoint = config.get('endpoint', 'https://stable-x-hi3dgen.hf.space').rstrip('/')
        parsed = urlparse(self.endpoint)
        if parsed.username or parsed.password or parsed.query or parsed.fragment or parsed.path:
            raise ValueError('PROVIDER_BASE_ORIGIN_REQUIRED')
        if config['id'] == 'hi3dgen-hf':
            if self.endpoint != 'https://stable-x-hi3dgen.hf.space':
                raise ValueError('UNREVIEWED_PUBLIC_PROVIDER')
        elif parsed.hostname not in ('127.0.0.1', 'localhost', '::1') or parsed.scheme not in ('http', 'https'):
            raise ValueError('LOCAL_PROVIDER_MUST_BE_LOOPBACK')

    def get(self, url: str, limit: int = 2 * 1024 * 1024) -> bytes:
        with self.session.get(url, timeout=(20, 90), stream=True, allow_redirects=False) as response:
            response.raise_for_status()
            if 300 <= response.status_code < 400:
                raise ValueError('UNEXPECTED_REDIRECT: ' + url)
            chunks, size = [], 0
            for chunk in response.iter_content(65536):
                size += len(chunk)
                if size > limit:
                    raise ValueError('DOWNLOAD_BYTE_BUDGET')
                chunks.append(chunk)
            return b''.join(chunks)

    def post(self, route: str, **kwargs):
        response = self.session.post(self.endpoint + route, timeout=(20, 120), allow_redirects=False, **kwargs)
        response.raise_for_status()
        if 300 <= response.status_code < 400 or len(response.content) > 1024 * 1024:
            raise ValueError('INVALID_PROVIDER_RESPONSE')
        return response.json()

    def snapshot(self) -> dict:
        if self.config['id'] == 'hi3dgen-local':
            revision = self.config.get('sourceRevision', '')
            rows = self.config.get('licenseEvidence', [])
            if not re.fullmatch('[a-f0-9]{40}', revision) or not rows:
                raise ValueError('LOCAL_SOURCE_REVISION_AND_LICENSE_EVIDENCE_REQUIRED')
            evidence, seen = [], set()
            for row in rows:
                name = row.get('name', '')
                if not re.fullmatch('[a-z0-9-]{1,80}', name) or name in seen:
                    raise ValueError('INVALID_LOCAL_LICENSE_NAME')
                seen.add(name)
                source = contained(Path(__file__).resolve().parents[3], row['path'])
                if not source.is_file() or not 0 < source.stat().st_size <= 2 * 1024 * 1024:
                    raise ValueError('LOCAL_LICENSE_BYTE_BUDGET')
                data = source.read_bytes()
                if digest(data)['sha256'] != row.get('sha256') or not row.get('url') or not row.get('license'):
                    raise ValueError('LOCAL_LICENSE_INTEGRITY_AND_SOURCE_REQUIRED')
                write_immutable(self.work / 'licenses' / (name + '.txt'), data)
                evidence.append({**row, **digest(data)})
            return {'provider': 'hi3dgen-local', 'sourceRevision': revision,
                    'revisionConfidence': 'operator-supplied-not-server-attested',
                    'model': self.config.get('model', 'Stable-X/trellis-normal-v0-1'),
                    'licenseEvidence': evidence}
        space = json.loads(self.get('https://huggingface.co/api/spaces/Stable-X/Hi3DGen'))
        model = json.loads(self.get('https://huggingface.co/api/models/Stable-X/trellis-normal-v0-1'))
        if not all(re.fullmatch('[a-f0-9]{40}', item.get('sha', '')) for item in (space, model)):
            raise ValueError('HUB_SOURCE_REVISION_REQUIRED')
        evidence = []
        for label, url in [
            ('space-readme', f"https://huggingface.co/spaces/Stable-X/Hi3DGen/raw/{space['sha']}/README.md"),
            ('space-source', f"https://huggingface.co/spaces/Stable-X/Hi3DGen/raw/{space['sha']}/app.py"),
            ('model-card', f"https://huggingface.co/Stable-X/trellis-normal-v0-1/raw/{model['sha']}/README.md"),
        ]:
            data = self.get(url)
            write_immutable(self.work / 'licenses' / (label + '.txt'), data)
            evidence.append({'name': label, 'url': url, **digest(data)})
            if label.endswith(('readme', 'card')) and not re.search(r'license:\s*mit\b', data.decode(), re.I):
                raise ValueError('UPSTREAM_LICENSE_CHANGED')
        # GitHub resolves LICENSE / LICENSE.txt without guessing filenames.
        for label, repo, expected_license in [
            ('hi3dgen-code', 'bytedance/Hi3DGen', 'MIT'),
            ('normal-predictor-code', 'Stable-X/StableNormal', 'Apache-2.0'),
        ]:
            commit = json.loads(self.get('https://api.github.com/repos/' + repo + '/commits/main'))
            sha = commit['sha']
            if not re.fullmatch('[a-f0-9]{40}', sha):
                raise ValueError('CODE_SOURCE_REVISION_REQUIRED')
            license_row = json.loads(self.get(f'https://api.github.com/repos/{repo}/license?ref={sha}'))
            if license_row.get('encoding') != 'base64' or license_row.get('license', {}).get('spdx_id') != expected_license:
                raise ValueError('UPSTREAM_CODE_LICENSE_CHANGED')
            data = base64.b64decode(''.join(license_row['content'].split()), validate=True)
            if not data or digest(data)['gitBlobSha'] != license_row.get('sha'):
                raise ValueError('UPSTREAM_LICENSE_BLOB_INTEGRITY')
            url = f"https://github.com/{repo}/blob/{sha}/{license_row['path']}"
            write_immutable(self.work / 'licenses' / (label + '.txt'), data)
            evidence.append({'name': label, 'url': url, 'revision': sha, 'license': expected_license, **digest(data)})
        return {'provider': 'hi3dgen-hf', 'space': 'Stable-X/Hi3DGen', 'sourceRevision': space['sha'],
                'model': 'Stable-X/trellis-normal-v0-1', 'modelHubRevision': model['sha'],
                'loadedModelRevision': None, 'revisionConfidence': 'hub-snapshot-not-provider-attested',
                'modelSoftwareLicense': 'MIT', 'licenseEvidence': evidence}

    def infer(self, image: Path, parameters: dict) -> tuple[bytes, dict]:
        info = json.loads(self.get(self.endpoint + '/gradio_api/info'))
        endpoint = info.get('named_endpoints', {}).get('/generate_3d')
        if not endpoint or len(endpoint.get('parameters', [])) != 6:
            raise ValueError('PROVIDER_API_SCHEMA_CHANGED')
        write_immutable(self.work / 'api-schema.json', json_bytes(info))
        self.log('upload', 'started')
        with image.open('rb') as stream:
            files = self.post('/gradio_api/upload', files={'files': (image.name, stream, 'image/png')})
        if not isinstance(files, list) or len(files) != 1 or not isinstance(files[0], str):
            raise ValueError('INVALID_UPLOAD_RESPONSE')
        image_data = {'path': files[0], 'orig_name': image.name, 'meta': {'_type': 'gradio.FileData'}}
        data = [image_data, parameters['seed'], parameters['ssGuidanceStrength'], parameters['ssSamplingSteps'],
                parameters['slatGuidanceStrength'], parameters['slatSamplingSteps']]
        submitted = self.post('/gradio_api/call/generate_3d', json={'data': data})
        event_id = submitted.get('event_id', '')
        if not re.fullmatch('[a-zA-Z0-9_-]{1,100}', event_id):
            raise ValueError('INVALID_GENERATION_EVENT')
        write_immutable(self.work / 'submitted.json', json_bytes({'eventId': event_id, 'endpoint': self.endpoint}))
        self.log('inference', 'submitted', eventId=event_id)
        deadline, result, event = time.monotonic() + 600, None, ''
        with self.session.get(self.endpoint + '/gradio_api/call/generate_3d/' + event_id,
                              stream=True, timeout=(20, 90), allow_redirects=False) as response:
            response.raise_for_status()
            if 300 <= response.status_code < 400:
                raise ValueError('UNEXPECTED_INFERENCE_REDIRECT')
            for line in response.iter_lines(decode_unicode=True):
                if time.monotonic() > deadline:
                    raise TimeoutError('PROVIDER_INFERENCE_TIMEOUT')
                if not line:
                    continue
                if isinstance(line, bytes):
                    line = line.decode()
                if line.startswith('event:'):
                    event = line[6:].strip()
                elif line.startswith('data:'):
                    payload = json.loads(line[5:])
                    if event == 'error':
                        raise RuntimeError('PROVIDER_ERROR: ' + str(payload)[:1600])
                    if event == 'complete':
                        result = payload
                        break
        if not isinstance(result, list) or len(result) < 3:
            raise ValueError('GENERATION_DID_NOT_RETURN_MESH')
        write_immutable(self.work / 'provider-result.json', json_bytes(result))
        mesh = result[2]
        if isinstance(mesh, str):
            mesh = {'path': mesh}
        if not isinstance(mesh, dict) or not str(mesh.get('path', '')).lower().endswith('.glb'):
            raise ValueError('GLB_PROVIDER_OUTPUT_REQUIRED')
        url = mesh.get('url') or self.endpoint + '/gradio_api/file=' + quote(mesh['path'], safe='/')
        if urlparse(url).netloc != urlparse(self.endpoint).netloc or urlparse(url).scheme != urlparse(self.endpoint).scheme:
            raise ValueError('CROSS_ORIGIN_PROVIDER_OUTPUT_REJECTED')
        self.log('download', 'started')
        return self.get(url, MAX_RAW_BYTES), {'eventId': event_id, 'retrievedFromUrl': url,
                                           'apiSchema': digest(json_bytes(info)), 'authentication': 'none'}


def create_provider(config: dict, log, work: Path):
    return Hi3DGenProvider(config, log, work)
