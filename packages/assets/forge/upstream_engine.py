"""Pinned upstream transport and invocation only. No reconstruction algorithms.

Capability gap: reproducible img2threejs installation on disposable authoring hosts.
Detach when the host provides the same verified upstream tree natively. The engine
runs outside the published assets; its source, LICENSE and notices stay unchanged.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import subprocess
import sys
import tarfile
import tempfile
from urllib.request import urlopen

LOCK = Path(__file__).with_name("upstream.lock.json")


def git_object(kind: str, payload: bytes) -> bytes:
    return hashlib.sha1(kind.encode() + b" " + str(len(payload)).encode() + b"\0" + payload).digest()


def tree_hash(root: Path) -> str:
    """Verify archive contents against the Connector-resolved Git tree, not a label."""
    entries = []
    for child in root.iterdir():
        if child.name in {".git", "__pycache__"}:
            continue
        name = os.fsencode(child.name)
        if child.is_symlink():
            mode, value, key = b"120000", git_object("blob", os.fsencode(os.readlink(child))), name
        elif child.is_dir():
            mode, value, key = b"40000", bytes.fromhex(tree_hash(child)), name + b"/"
        elif child.is_file():
            mode = b"100755" if child.stat().st_mode & 0o111 else b"100644"
            value, key = git_object("blob", child.read_bytes()), name
        else:
            raise ValueError(f"Unsupported upstream entry: {child}")
        entries.append((key, mode + b" " + name + b"\0" + value))
    return git_object("tree", b"".join(payload for _, payload in sorted(entries))).hex()


def load_lock() -> dict:
    lock = json.loads(LOCK.read_text())
    for key in ("engine", "animatedCharacter"):
        pin = lock[key]
        if not re.fullmatch(r"img2threejs/[a-z0-9-]+", pin["repository"]):
            raise ValueError("Unapproved upstream repository")
        if any(not re.fullmatch(r"[0-9a-f]{40}", pin[field]) for field in ("commit", "tree")):
            raise ValueError("Upstream must be pinned to full commit and tree hashes")
    return lock


def verify(root: Path, pin: dict) -> None:
    actual = tree_hash(root)
    if actual != pin["tree"]:
        raise ValueError(f"Upstream integrity mismatch: {root}: {actual} != {pin['tree']}")
    if not (root / "LICENSE").is_file():
        raise ValueError(f"Upstream license missing: {root}")


def materialize(cache: Path, key: str) -> Path:
    pin = load_lock()[key]
    cache = cache.resolve()
    target = cache / (pin["repository"].split("/")[1] + "-" + pin["commit"])
    if target.exists():
        verify(target, pin)
        return target
    cache.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="upstream-", dir=cache) as temp:
        temp = Path(temp)
        archive = temp / "source.tar.gz"
        url = f"https://codeload.github.com/{pin['repository']}/tar.gz/{pin['commit']}"
        with urlopen(url, timeout=90) as response, archive.open("wb") as dest:
            shutil.copyfileobj(response, dest)
        unpack = temp / "unpack"
        unpack.mkdir()
        with tarfile.open(archive) as source:
            members = source.getmembers()
            for member in members:
                p = PurePosixPath(member.name)
                if p.is_absolute() or ".." in p.parts or not (member.isfile() or member.isdir() or member.issym()):
                    raise ValueError(f"Unsafe upstream archive entry: {member.name}")
                if member.issym():
                    resolved = (unpack / member.name).parent / member.linkname
                    if not resolved.resolve().is_relative_to(unpack.resolve()):
                        raise ValueError("Upstream symlink escapes extraction root")
            source.extractall(unpack, members=members, filter="data")
        roots = list(unpack.iterdir())
        if len(roots) != 1 or not roots[0].is_dir():
            raise ValueError("Expected exactly one archive root")
        verify(roots[0], pin)
        roots[0].rename(target)
    return target


def invoke(root: Path, entry: str, args: list[str], cwd: Path, env: dict | None = None) -> int:
    verify(root, load_lock()["engine"])
    script = root / entry
    if not entry.startswith("forge/") or script.suffix != ".py" or not script.resolve().is_relative_to(root.resolve()):
        raise ValueError("Only pinned upstream forge Python entrypoints may be invoked")
    if not script.is_file():
        raise ValueError(f"Required upstream stage is absent: {entry}")
    environment = dict(os.environ, PYTHONDONTWRITEBYTECODE="1")
    environment.update(env or {})
    return subprocess.run([sys.executable, str(script), *args], cwd=cwd, env=environment, check=False).returncode


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=("materialize", "verify", "run"))
    parser.add_argument("--cache", type=Path, default=Path(".cache/character-forge-upstream"))
    parser.add_argument("--key", choices=("engine", "animatedCharacter"), default="engine")
    parser.add_argument("--cwd", type=Path, default=Path.cwd())
    parser.add_argument("--entry")
    options, rest = parser.parse_known_args()
    if rest and options.command != "run":
        parser.error(f"Unrecognized arguments: {rest}")
    root = materialize(options.cache, options.key)
    if options.command == "run":
        if options.key != "engine" or not options.entry:
            parser.error("run requires --key engine and --entry")
        return invoke(root, options.entry, rest[1:] if rest[:1] == ["--"] else rest, options.cwd.resolve())
    print(json.dumps({"root": str(root), **load_lock()[options.key], "verified": True}))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, ValueError, tarfile.TarError) as error:
        print(f"FORGE_UPSTREAM_BLOCKED: {error}", file=sys.stderr)
        raise SystemExit(2)
