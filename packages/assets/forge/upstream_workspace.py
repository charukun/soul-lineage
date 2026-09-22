"""RINNE workspace boundary for the unmodified img2threejs agent workflow.

This wrapper owns references, transport and receipts, NOT sculpting, landmarks,
pass order, review decisions or upstream step completion. A descriptor is never
relabelled as baked pixels. Decisions/evidence remain in the upstream workspace.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from upstream_engine import load_lock, materialize, verify

ROOT = Path(__file__).resolve().parents[3]


def write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n")
    temporary.replace(path)


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def contained(root: Path, name: str) -> Path:
    target = (root / name).resolve()
    if not target.is_relative_to(root.resolve()):
        raise ValueError(f"Path escapes Forge workspace: {name}")
    return target


def install_boundary(cache: Path, home: Path) -> dict:
    """Use the upstream registry format; never fake a character-only rig profile."""
    pins = load_lock()
    roots = {key: materialize(cache, key) for key in ("engine", "animatedCharacter", "harness")}
    home.mkdir(parents=True, exist_ok=True)
    plugin = json.loads((roots["animatedCharacter"] / "plugin.json").read_text())
    plugin_id = plugin["id"]
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]*", plugin_id):
        raise ValueError("Invalid pinned plugin id")
    links = {home / "harness": roots["harness"], home / "plugins" / plugin_id: roots["animatedCharacter"]}
    for link, target in links.items():
        link.parent.mkdir(parents=True, exist_ok=True)
        if link.exists() or link.is_symlink():
            if not link.is_symlink() or link.resolve() != target.resolve():
                raise ValueError(f"Refusing to replace an unrelated host entry: {link}")
        else:
            link.symlink_to(target.resolve(), target_is_directory=True)
    expected = {"plugins": [{"id": plugin_id, "repository": pins["animatedCharacter"]["repository"],
                              "commit": pins["animatedCharacter"]["commit"]}]}
    registry = home / "plugins.json"
    if registry.exists() and json.loads(registry.read_text()) != expected:
        raise ValueError("Forge uses a dedicated pinned IMG2_HOME; unrelated registry found")
    write_json(registry, expected)
    return {**roots, "home": home.resolve()}


def environment(installation: dict) -> dict:
    return dict(os.environ, IMG2_HOME=str(installation["home"]), PYTHONDONTWRITEBYTECODE="1")


def checked_run(installation: dict, workspace: Path, entry: str, args: list[str], key: str = "engine") -> int:
    root = installation[key]
    verify(root, load_lock()[key])
    script = contained(root, entry)
    allowed = "forge/" if key == "engine" else "tools/"
    if not entry.startswith(allowed) or script.suffix != ".py" or not script.is_file():
        raise ValueError(f"Missing/unsupported upstream stage: {key}:{entry}")
    command = [sys.executable, str(script), *args]
    logs = workspace / "img2threejs" / "commands"
    logs.mkdir(parents=True, exist_ok=True)
    index = 1 + len(list(logs.glob("*.json")))
    prefix = logs / f"{index:04d}-{script.stem}"
    start = datetime.now(timezone.utc).isoformat()
    result = subprocess.run(command, cwd=workspace, env=environment(installation),
                            stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False)
    prefix.with_suffix(".stdout.txt").write_bytes(result.stdout)
    prefix.with_suffix(".stderr.txt").write_bytes(result.stderr)
    write_json(prefix.with_suffix(".json"), {"entry": entry, "arguments": args, "upstream": load_lock()[key],
               "startedAt": start, "returnCode": result.returncode,
               "stdoutSha256": hashlib.sha256(result.stdout).hexdigest(),
               "stderrSha256": hashlib.sha256(result.stderr).hexdigest()})
    sys.stdout.buffer.write(result.stdout)
    sys.stderr.buffer.write(result.stderr)
    return result.returncode


def verify_sources(workspace: Path) -> dict:
    job = json.loads((workspace / "forge-job.json").read_text())
    if job.get("upstream") != load_lock():
        raise ValueError("Workspace upstream pins differ; deliberate migration is required")
    for name, view in job["views"].items():
        if sha256(contained(workspace, view["path"])) != view["sha256"]:
            raise ValueError(f"Source changed since intake: {name}")
    return job


def next_step(installation: dict, workspace: Path) -> int:
    verify_sources(workspace)
    return checked_run(installation, workspace, "forge/next.py", ["--state", ".img2threejs/state.json"])


def initialize(args: argparse.Namespace, installation: dict, workspace: Path) -> int:
    if workspace.exists():
        raise ValueError("Workspace exists; use next/run/mark to resume without resetting state")
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]{0,63}", args.id or ""):
        raise ValueError("Character id is required and must use lower-case letters, numbers and hyphens")
    inputs = {view: getattr(args, view, None) for view in ("front", "side", "back", "front34", "back34", "top")}
    inputs = {key: Path(path).resolve() for key, path in inputs.items() if path}
    if not inputs.get("front") or any(not p.is_file() for p in inputs.values()):
        raise ValueError("Readable named source views with a front view are required")
    if args.provenance is None:
        raise ValueError("A provenance record is required; source pixels do not establish rights")
    provenance = json.loads(Path(args.provenance).read_text())
    if provenance.get("license") not in ("RINNE-OWNED", "CC0-1.0") or not provenance.get("author") or not provenance.get("source"):
        raise ValueError("Source requires eligible recorded rights, author and source")
    workspace.mkdir(parents=True)
    views = {}
    for name, source in inputs.items():
        destination = workspace / "source" / (name + source.suffix.lower())
        destination.parent.mkdir(exist_ok=True)
        shutil.copyfile(source, destination)
        views[name] = {"path": destination.relative_to(workspace).as_posix(), "sha256": sha256(destination), "status": "observed"}
    write_json(workspace / "forge-job.json", {"schemaVersion": "rinne.upstream-forge-job/v1", "id": args.id,
               "displayName": args.name or args.id, "views": views, "upstream": load_lock(), "provenance": provenance,
               "reconstructionMode": "single-view" if len(views) == 1 else "multi-view",
               "geometryAuthority": "upstream-generated-factory", "workflowAuthority": ".img2threejs/state.json",
               "statusAuthority": "upstream-next-and-versioned-evidence; no auto approval"})
    code = checked_run(installation, workspace, "forge/state.py", ["init", "--state", ".img2threejs/state.json",
                       "--reference", views["front"]["path"], "--profile", "animated-character", "--spec", "object-sculpt-spec.json"])
    if code:
        return code
    return next_step(installation, workspace)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=("create", "next", "run", "mark"))
    parser.add_argument("--workspace", required=True, type=Path)
    parser.add_argument("--cache", type=Path, default=ROOT / ".cache/character-forge-upstream")
    parser.add_argument("--id")
    parser.add_argument("--name")
    parser.add_argument("--provenance")
    for view in ("front", "side", "back", "front34", "back34", "top"):
        parser.add_argument("--" + view)
    parser.add_argument("--entry")
    parser.add_argument("--key", choices=("engine", "animatedCharacter"), default="engine")
    args, extra = parser.parse_known_args(argv)
    extra = extra[1:] if extra[:1] == ["--"] else extra
    if args.command in ("create", "next") and extra:
        parser.error(f"Unexpected arguments: {extra}")
    workspace = args.workspace.resolve()
    installation = install_boundary(args.cache.resolve(), args.cache.resolve() / "host")
    if args.command == "create":
        return initialize(args, installation, workspace)
    code = next_step(installation, workspace)
    if code or args.command == "next":
        return code
    if args.command == "mark":
        if not extra:
            parser.error("mark requires upstream step id and evidence arguments after --")
        return checked_run(installation, workspace, "forge/state.py", ["mark", "--state", ".img2threejs/state.json", *extra])
    if not args.entry:
        parser.error("run requires --entry and optional upstream arguments after --")
    if args.entry == "forge/state.py":
        parser.error("Use create/mark/next; do not reset or replace state through run")
    return checked_run(installation, workspace, args.entry, extra, args.key)


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, ValueError, KeyError) as error:
        print(f"FORGE_UPSTREAM_BLOCKED: {error}", file=sys.stderr)
        raise SystemExit(2)
