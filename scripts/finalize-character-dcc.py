#!/usr/bin/env python3
"""Finalize a Character DCC Carrier build from its repository request."""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath

REQUIRED_VIEWS = ("front", "side", "back", "three-quarter")
ALLOWED_STAGES = {"REFERENCE", "BLOCKOUT", "PRIMARY"}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def repo_path(value: str, name: str) -> Path:
    if not isinstance(value, str) or not value or "\\" in value:
        raise SystemExit(f"{name} must be a repository-relative POSIX path")
    pure = PurePosixPath(value)
    if pure.is_absolute() or ".." in pure.parts or value.startswith("/"):
        raise SystemExit(f"{name} escapes the repository: {value}")
    return Path(*pure.parts)


def load_json(path: Path, name: str) -> dict:
    if not path.is_file() or path.stat().st_size == 0:
        raise SystemExit(f"{name} missing or empty: {path}")
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as error:
        raise SystemExit(f"invalid {name}: {path}: {error}") from error


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--request", default=".dcc/character-dcc-request.json")
    args = parser.parse_args()

    request_path = repo_path(args.request, "request")
    request = load_json(request_path, "request")
    if request.get("schema") != "character-dcc-request" or request.get("version") != 1:
        raise SystemExit("unsupported Character DCC request schema/version")

    character_id = request.get("id")
    asset_id = request.get("assetId")
    if not isinstance(character_id, str) or not character_id:
        raise SystemExit("request.id missing")
    if not isinstance(asset_id, str) or not asset_id:
        raise SystemExit("request.assetId missing")

    generated = repo_path(request["generatedDir"], "generatedDir")
    blend = repo_path(request["canonical"]["blend"], "canonical.blend")
    model = repo_path(request["canonical"]["model"], "canonical.model")
    integrity_path = repo_path(request["canonical"]["integrity"], "canonical.integrity")
    production_path = repo_path(request["canonical"]["production"], "canonical.production")
    qa_dir = repo_path(request["canonical"]["qaDir"], "canonical.qaDir")
    audit_path = qa_dir / "blender-audit.json"
    build_path = qa_dir / "build.json"

    for path, label in ((blend, "blend"), (model, "model"), (audit_path, "audit"), (build_path, "build")):
        if not path.is_file() or path.stat().st_size == 0:
            raise SystemExit(f"required canonical {label} missing or empty: {path}")
    for view in REQUIRED_VIEWS:
        path = qa_dir / f"{view}.png"
        if not path.is_file() or path.stat().st_size == 0:
            raise SystemExit(f"required review view missing or empty: {path}")

    audit = load_json(audit_path, "Blender audit")
    build = load_json(build_path, "build metadata")
    if audit.get("characterId") != character_id:
        raise SystemExit(f"audit character id mismatch: {audit.get('characterId')} != {character_id}")
    if build.get("characterId") != character_id:
        raise SystemExit(f"build character id mismatch: {build.get('characterId')} != {character_id}")
    checks = audit.get("checks", {})
    if not checks or not all(checks.values()):
        raise SystemExit("Blender audit contains a failed or missing objective check")

    scene = audit.get("scene", {})
    primary = request.get("primary", {})
    min_meshes = int(primary.get("minMeshObjects", 1))
    min_materials = int(primary.get("minMaterials", 1))
    if scene.get("meshObjects", 0) < min_meshes:
        raise SystemExit(f"meshObjects below request minimum: {scene.get('meshObjects', 0)} < {min_meshes}")
    if scene.get("materials", 0) < min_materials:
        raise SystemExit(f"materials below request minimum: {scene.get('materials', 0)} < {min_materials}")

    stage = str(request.get("production", {}).get("stage", "REFERENCE")).upper()
    if stage not in ALLOWED_STAGES:
        raise SystemExit("carrier production stage may only be REFERENCE, BLOCKOUT or PRIMARY")
    review = request.get("review", {})
    if request.get("production", {}).get("productionReady", False) is not False:
        raise SystemExit("carrier cannot set productionReady=true")
    if request.get("production", {}).get("visualApproval", "pending") != "pending":
        raise SystemExit("carrier cannot grant visualApproval")

    reference = request.get("reference", {})
    reference_views = reference.get("views", ["front", "side", "back"])
    if not isinstance(reference_views, list):
        raise SystemExit("reference.views must be an array")

    blend_sha = sha256(blend)
    model_sha = sha256(model)
    format_name = str(request.get("format", model.suffix.lstrip("."))).lower()
    public_path = request.get("publicPath")
    if not isinstance(public_path, str) or not public_path.startswith("./") or ".." in public_path:
        raise SystemExit("request.publicPath must be a safe ./ runtime path")

    integrity = {
        "schema": "character-asset-integrity",
        "version": 1,
        "id": character_id,
        "assetId": asset_id,
        "format": format_name,
        "path": public_path,
        "sha256": model_sha,
        "bytes": model.stat().st_size,
        "productionStage": stage,
        "modelingMode": "dcc-blender",
        "sourceBlendSha256": blend_sha,
        "humanoidRig": request["rig"]["id"],
        "referencePath": request["reference"]["path"],
        "visualApproval": "pending",
        "license": {
            "rigProvenance": request["license"]["rigProvenance"],
            "surfaceAuthorship": request["license"]["surfaceAuthorship"],
        },
    }
    integrity_path.parent.mkdir(parents=True, exist_ok=True)
    integrity_path.write_text(json.dumps(integrity, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    production = {
        "schema": "character-production",
        "version": 2,
        "id": character_id,
        "stage": stage,
        "modelingMode": "dcc-blender",
        "source": {
            "referencePaths": [request["reference"]["path"]],
            "meshPath": model.as_posix(),
            "integrityPath": integrity_path.as_posix(),
            "dcc": {
                "tool": "Blender",
                "version": audit["dcc"]["version"],
                "sourcePath": blend.as_posix(),
                "sourceSha256": blend_sha,
            },
        },
        "evidence": {
            "reference": {
                "intentLocked": review.get("intentLocked") is True,
                "views": reference_views,
            },
            "blockout": {
                "views": list(REQUIRED_VIEWS),
                "proportionsReviewed": review.get("proportionsReviewed") is True,
                "silhouetteReviewed": review.get("silhouetteReviewed") is True,
                "reviewEvidence": qa_dir.as_posix() + "/",
            },
            "primary": {
                "topologyReviewed": review.get("topologyReviewed") is True,
                "uvReviewed": checks.get("hasUVs") is True,
                "separateSurfaces": list(primary.get("separateSurfaces", [])),
                "auditPath": audit_path.as_posix(),
                "meshObjects": scene.get("meshObjects", 0),
                "triangles": scene.get("triangles", 0),
                "materials": scene.get("materials", 0),
            },
        },
        "status": {
            "visualApproval": "pending",
            "productionReady": False,
            "note": "Character DCC Carrier output. Export/audit does not grant deformation, motion, polish, device performance, RUNTIME_READY, or human visual approval.",
        },
    }
    production_path.parent.mkdir(parents=True, exist_ok=True)
    production_path.write_text(json.dumps(production, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(json.dumps({
        "id": character_id,
        "stage": stage,
        "modelSha256": model_sha,
        "blendSha256": blend_sha,
        "modelBytes": model.stat().st_size,
        "meshObjects": scene.get("meshObjects", 0),
        "vertices": scene.get("vertices", 0),
        "triangles": scene.get("triangles", 0),
        "materials": scene.get("materials", 0),
        "bones": scene.get("bones", 0),
        "blenderVersion": audit["dcc"]["version"],
        "generatedDir": generated.as_posix(),
    }, indent=2))


if __name__ == "__main__":
    main()
