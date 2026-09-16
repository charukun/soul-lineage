#!/usr/bin/env python3
"""Write a minimal integrity receipt for a Character DCC Carrier build."""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

REQUIRED_VIEWS = ("front", "three-quarter", "side", "back")


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def require_file(value: str, label: str) -> Path:
    path = Path(value)
    if path.is_absolute() or ".." in path.parts:
        raise SystemExit(f"{label} must stay inside the repository: {path}")
    if not path.is_file() or path.stat().st_size == 0:
        raise SystemExit(f"{label} missing or empty: {path}")
    return path


def load_json(path: Path, label: str) -> dict:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except Exception as error:
        raise SystemExit(f"invalid {label}: {path}: {error}") from error
    if not isinstance(value, dict):
        raise SystemExit(f"{label} must be a JSON object: {path}")
    return value


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--slug", required=True)
    parser.add_argument("--reference", required=True)
    parser.add_argument("--rig", required=True)
    parser.add_argument("--builder", required=True)
    parser.add_argument("--blend", required=True)
    parser.add_argument("--model", required=True)
    parser.add_argument("--audit", required=True)
    parser.add_argument("--build", required=True)
    parser.add_argument("--qa-dir", required=True)
    parser.add_argument("--public-path", required=True)
    parser.add_argument("--out", required=True)
    args = parser.parse_args()

    if not args.slug or any(char not in "abcdefghijklmnopqrstuvwxyz0123456789-" for char in args.slug):
        raise SystemExit("slug must contain only lowercase letters, digits and hyphens")
    if not args.public_path.startswith("./") or ".." in args.public_path:
        raise SystemExit("public path must be a safe ./ path")

    reference = require_file(args.reference, "reference")
    rig = require_file(args.rig, "rig")
    builder = require_file(args.builder, "builder")
    blend = require_file(args.blend, "blend")
    model = require_file(args.model, "model")
    audit_path = require_file(args.audit, "audit")
    build_path = require_file(args.build, "build metadata")
    qa_dir = Path(args.qa_dir)
    if qa_dir.is_absolute() or ".." in qa_dir.parts:
        raise SystemExit("qa-dir must stay inside the repository")
    for view in REQUIRED_VIEWS:
        require_file(str(qa_dir / f"{view}.png"), f"review {view}")

    audit = load_json(audit_path, "Blender audit")
    build = load_json(build_path, "build metadata")
    character_id = build.get("characterId")
    if not isinstance(character_id, str) or not character_id.strip():
        raise SystemExit("build metadata must contain a non-empty characterId")
    if audit.get("characterId") != character_id:
        raise SystemExit(f"audit character id mismatch: {audit.get('characterId')} != {character_id}")
    checks = audit.get("checks")
    if not isinstance(checks, dict) or not checks or not all(checks.values()):
        raise SystemExit("Blender audit contains a failed or missing objective check")

    suffix = model.suffix.lower().lstrip(".")
    if suffix not in {"glb", "vrm"}:
        raise SystemExit("runtime model must be .glb or .vrm")

    receipt = {
        "schema": "character-dcc-build",
        "version": 1,
        "slug": args.slug,
        "characterId": character_id,
        "format": suffix,
        "path": args.public_path,
        "model": {
            "path": model.as_posix(),
            "bytes": model.stat().st_size,
            "sha256": sha256(model),
        },
        "source": {
            "blend": {"path": blend.as_posix(), "sha256": sha256(blend)},
            "builder": {"path": builder.as_posix(), "sha256": sha256(builder)},
            "reference": {"path": reference.as_posix(), "sha256": sha256(reference)},
            "rig": {"path": rig.as_posix(), "sha256": sha256(rig)},
        },
        "dcc": audit.get("dcc", {}),
        "scene": audit.get("scene", {}),
        "checks": checks,
        "review": {
            "views": list(REQUIRED_VIEWS),
            "evidencePath": qa_dir.as_posix() + "/",
            "visualApproval": "pending",
        },
        "status": {
            "productionReady": False,
            "note": "Blender execution evidence only. Production-stage promotion and human visual approval are separate gates.",
        },
    }

    out = Path(args.out)
    if out.is_absolute() or ".." in out.parts:
        raise SystemExit("out must stay inside the repository")
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(json.dumps({
        "slug": args.slug,
        "characterId": character_id,
        "modelSha256": receipt["model"]["sha256"],
        "blendSha256": receipt["source"]["blend"]["sha256"],
        "referenceSha256": receipt["source"]["reference"]["sha256"],
        "rigSha256": receipt["source"]["rig"]["sha256"],
        "blenderVersion": receipt["dcc"].get("version"),
    }, indent=2))


if __name__ == "__main__":
    main()
