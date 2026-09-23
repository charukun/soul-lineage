"""Content-pinned execution boundary. Reconstruction remains in unmodified img2threejs.

This module downloads/locates a pinned source snapshot, verifies its complete tracked
file set, and invokes its Python entrypoints. It deliberately contains no geometry,
landmark estimation, projection, review scoring, or replacement workflow logic.
"""
from __future__ import annotations

import hashlib
import io
import json
import os
from pathlib import Path, PurePosixPath
import shutil
import subprocess
import sys
import tarfile
import tempfile
import urllib.request

LOCK = Path(__file__).with_name('engine-lock.json')
MAX_ARCHIVE_BYTES = 32 * 1024 * 1024
MAX_EXPANDED_BYTES = 64 * 1024 * 1024
EXCLUDED = {'.git', '__pycache__', '.pytest_cache', '.cache'}


class EngineError(RuntimeError):
    """A missing or modified upstream must not silently select another generator."""


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def load_json(path: Path) -> dict:
    value = json.loads(path.read_text(encoding='utf-8'))
    if not isinstance(value, dict):
        raise EngineError(f'Expected a JSON object: {path}')
    return value


def save_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    data = json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + '\n'
    with tempfile.NamedTemporaryFile('w', encoding='utf-8', dir=path.parent, delete=False) as f:
        f.write(data)
        tmp = Path(f.name)
    tmp.replace(path)


def source_inventory(root: Path) -> list[list[str]]:
    rows = []
    if not root.is_dir():
        raise EngineError(f'Upstream snapshot is missing: {root}')
    for path in sorted(root.rglob('*')):
        relative = path.relative_to(root)
        if any(part in EXCLUDED for part in relative.parts):
            continue
        if path.is_symlink():
            raise EngineError(f'Upstream symlink is not an audited source file: {relative}')
        if path.is_file():
            rows.append([relative.as_posix(), sha256(path.read_bytes())])
    return rows


def inventory_digest(rows: list[list[str]]) -> str:
    return sha256(json.dumps(rows, separators=(',', ':'), ensure_ascii=False).encode('utf-8'))


def verify_snapshot(root: Path, pin: dict) -> None:
    rows = source_inventory(root)
    if len(rows) != pin['fileCount'] or inventory_digest(rows) != pin['sourceDigest']:
        raise EngineError(f"Upstream source differs from pinned {pin['repository']}@{pin['commit']}. "
                          'Restore the exact snapshot; do not use a simplified fallback.')


def unpack_snapshot(data: bytes, destination: Path) -> None:
    """Extract plain files only; refuse paths, links, devices and oversized archives."""
    expanded = 0
    prefix = None
    seen = set()
    with tarfile.open(fileobj=io.BytesIO(data), mode='r:gz') as archive:
        members = archive.getmembers()
        if len(members) > 10000:
            raise EngineError('Upstream archive has too many members')
        for item in members:
            name = PurePosixPath(item.name)
            if name.is_absolute() or '..' in name.parts or '\\' in item.name:
                raise EngineError('Unsafe upstream archive path')
            if not name.parts:
                continue
            prefix = prefix or name.parts[0]
            if name.parts[0] != prefix:
                raise EngineError('Upstream archive has multiple roots')
            relative = Path(*name.parts[1:])
            if item.isdir():
                continue
            if not item.isfile() or not relative.parts or relative in seen:
                raise EngineError('Unsupported/duplicate upstream archive member')
            seen.add(relative)
            expanded += item.size
            if expanded > MAX_EXPANDED_BYTES:
                raise EngineError('Upstream archive exceeds expansion limit')
            if any(part in EXCLUDED for part in relative.parts):
                raise EngineError('Archive contains unaudited generated state')
            path = destination / relative
            path.parent.mkdir(parents=True, exist_ok=True)
            stream = archive.extractfile(item)
            if stream is None:
                raise EngineError(f'Unreadable archive member: {relative}')
            path.write_bytes(stream.read())


def materialize(pin: dict, cache: Path, supplied: Path | None = None) -> Path:
    if supplied is not None:
        root = supplied.resolve()
        verify_snapshot(root, pin)
        return root
    root = cache / pin['repository'].replace('/', '-') / pin['commit']
    if root.exists():
        verify_snapshot(root, pin)
        return root
    root.parent.mkdir(parents=True, exist_ok=True)
    temp = Path(tempfile.mkdtemp(prefix='snapshot-', dir=root.parent))
    try:
        url = f"https://api.github.com/repos/{pin['repository']}/tarball/{pin['commit']}"
        request = urllib.request.Request(url, headers={'User-Agent': 'RINNE-Character-Forge', 'Accept': 'application/vnd.github+json'})
        with urllib.request.urlopen(request, timeout=60) as response:
            data = response.read(MAX_ARCHIVE_BYTES + 1)
        if len(data) > MAX_ARCHIVE_BYTES:
            raise EngineError('Upstream archive exceeds download limit')
        unpack_snapshot(data, temp)
        verify_snapshot(temp, pin)
        try:
            temp.rename(root)
        except FileExistsError:
            verify_snapshot(root, pin)
        return root
    finally:
        if temp.exists():
            shutil.rmtree(temp)


class Engine:
    def __init__(self, *, upstream: Path | None = None, plugin: Path | None = None,
                 cache: Path | None = None):
        self.lock = load_json(LOCK)
        cache = cache or Path(os.environ.get('XDG_CACHE_HOME', Path.home() / '.cache')) / 'rinne-character-forge'
        self.root = materialize(self.lock['engine'], cache, upstream)
        self.plugin = materialize(self.lock['animationPlugin'], cache, plugin)
        self.env = dict(os.environ, PYTHONDONTWRITEBYTECODE='1', PYTHONPYCACHEPREFIX=str(cache/'isolated-bytecode'))
        for key in ('PYTHONPATH', 'PYTHONHOME', 'PYTHONSTARTUP'):
            self.env.pop(key, None)
        # The upstream registry is the extension point. Never edit forge/_shared/domains.
        home = cache / 'registries' / (self.lock['engine']['commit'] + '-' + self.lock['animationPlugin']['commit'])
        installed = home / 'plugins' / 'character'
        if not installed.exists():
            installed.parent.mkdir(parents=True, exist_ok=True)
            shutil.copytree(self.plugin, installed)
        verify_snapshot(installed, self.lock['animationPlugin'])
        save_json(home / 'plugins.json', {'plugins': [{'id': 'character', 'repository': self.lock['animationPlugin']['repository'], 'commit': self.lock['animationPlugin']['commit']}]})
        self.env['IMG2_HOME'] = str(home)
        self.installed_plugin = installed

    def run(self, script: str, args: list[str], workspace: Path, *, plugin: bool = False,
            timeout: int = 180, check: bool = True) -> subprocess.CompletedProcess:
        """Execute a pinned CLI and retain both successful and failed command receipts."""
        self.verify()
        base = self.installed_plugin if plugin else self.root
        relative = PurePosixPath(script)
        if relative.is_absolute() or '..' in relative.parts or relative.suffix != '.py' or any(part in EXCLUDED for part in relative.parts):
            raise EngineError('An upstream entrypoint must be a relative Python path')
        target = base / Path(*relative.parts)
        if not target.is_file():
            raise EngineError(f'Pinned upstream does not implement {script}')
        if any(str(arg).split('=')[0] in {'--allow-nonstrict', '--allow-low-confidence', '--force-out-of-order', '--visual-threshold'} for arg in args):
            raise EngineError('Gate-bypass flags are forbidden for Forge builds')
        workspace.mkdir(parents=True, exist_ok=True)
        receipts = workspace / 'img2threejs' / 'receipts'
        receipts.mkdir(parents=True, exist_ok=True)
        command = [sys.executable, str(target), *map(str, args)]
        try:
            result = subprocess.run(command, cwd=workspace, env=self.env, capture_output=True,
                                    text=True, timeout=timeout, check=False)
        except subprocess.TimeoutExpired as error:
            save_json(receipts / f'{len(list(receipts.glob("*.json"))):04d}.json', {
                'script': script, 'args': args, 'status': 'timeout', 'timeoutSeconds': timeout,
                'upstreamCommit': self.lock['animationPlugin' if plugin else 'engine']['commit']})
            raise EngineError(f'Upstream {script} timed out; partial evidence was retained') from error
        receipt = {'script': script, 'args': list(map(str, args)), 'exitCode': result.returncode,
                   'scriptSha256': sha256(target.read_bytes()),
                   'upstreamCommit': self.lock['animationPlugin' if plugin else 'engine']['commit'],
                   'stdout': result.stdout, 'stderr': result.stderr}
        save_json(receipts / f'{len(list(receipts.glob("*.json"))):04d}.json', receipt)
        if check and result.returncode:
            raise EngineError(f'Upstream {script} stopped with exit {result.returncode}:\n{result.stdout}\n{result.stderr}')
        return result

    def verify(self) -> None:
        verify_snapshot(self.root, self.lock['engine'])
        verify_snapshot(self.installed_plugin, self.lock['animationPlugin'])
