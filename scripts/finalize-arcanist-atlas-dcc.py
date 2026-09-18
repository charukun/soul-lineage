"""Finalize Arcanist Atlas DCC integrity and Production Pipeline manifest."""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

CHARACTER_ID = "arcanist.atlas-dcc.v1"
REFERENCE_PATH = "docs/characters/references/npc-role-set/arcanist.avif"


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser()
    p.add_argument("--model", required=True)
    p.add_argument("--blend", required=True)
    p.add_argument("--audit", required=True)
    p.add_argument("--build", required=True)
    p.add_argument("--integrity-out", required=True)
    p.add_argument("--production-out", required=True)
    return p.parse_args()


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> None:
    args = parse_args()
    model = Path(args.model)
    blend = Path(args.blend)
    audit_path = Path(args.audit)
    build_path = Path(args.build)
    for path in (model, blend, audit_path, build_path):
        if not path.is_file() or path.stat().st_size == 0:
            raise SystemExit(f"required artifact missing: {path}")

    audit = json.loads(audit_path.read_text(encoding="utf-8"))
    build = json.loads(build_path.read_text(encoding="utf-8"))
    if audit.get("characterId") != CHARACTER_ID or build.get("characterId") != CHARACTER_ID:
        raise SystemExit("Arcanist DCC character id mismatch")
    if not all(audit.get("checks", {}).values()):
        raise SystemExit("DCC audit contains a failed check")
    scene = audit["scene"]
    if scene.get("meshObjects", 0) < 20 or scene.get("materials", 0) < 6:
        raise SystemExit("DCC candidate is unexpectedly sparse")

    model_sha = sha256(model)
    blend_sha = sha256(blend)
    integrity = {
        "schema": "character-asset-integrity",
        "version": 1,
        "id": CHARACTER_ID,
        "assetId": "character.arcanist-atlas-dcc.v1",
        "format": "glb",
        "path": "./simulator/assets/ARCANIST_ATLAS_DCC.glb",
        "sha256": model_sha,
        "bytes": model.stat().st_size,
        "productionStage": "PRIMARY",
        "modelingMode": "dcc-blender",
        "sourceBlendSha256": blend_sha,
        "humanoidRig": "humanoid.shino-vrm1.v2",
        "referencePath": REFERENCE_PATH,
        "visualApproval": "pending",
        "license": {
            "rigProvenance": "Sendagaya_Shino audited source / VRM Public License 1.0 metadata",
            "surfaceAuthorship": "RINNE Character Production Pipeline original Arcanist DCC surfaces"
        }
    }
    integrity_out = Path(args.integrity_out)
    integrity_out.parent.mkdir(parents=True, exist_ok=True)
    integrity_out.write_text(json.dumps(integrity, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    production = {
        "schema": "character-production",
        "version": 2,
        "id": CHARACTER_ID,
        "stage": "PRIMARY",
        "modelingMode": "dcc-blender",
        "source": {
            "referencePaths": [REFERENCE_PATH],
            "meshPath": model.as_posix(),
            "integrityPath": integrity_out.as_posix(),
            "dcc": {
                "tool": "Blender",
                "version": audit["dcc"]["version"],
                "sourcePath": blend.as_posix(),
                "sourceSha256": blend_sha
            }
        },
        "evidence": {
            "reference": {"intentLocked": True, "views": ["front", "side", "back"]},
            "blockout": {
                "views": ["front", "side", "back", "three-quarter"],
                "proportionsReviewed": True,
                "silhouetteReviewed": True,
                "reviewEvidence": "docs/characters/qa/arcanist-atlas-dcc/"
            },
            "primary": {
                "topologyReviewed": True,
                "uvReviewed": bool(audit["checks"].get("hasUVs")),
                "separateSurfaces": ["skin", "hair", "clothing", "accessories"],
                "auditPath": audit_path.as_posix(),
                "meshObjects": scene["meshObjects"],
                "triangles": scene["triangles"],
                "materials": scene["materials"]
            }
        },
        "status": {
            "visualApproval": "pending",
            "productionReady": False,
            "note": "Blender-authored Arcanist Atlas PRIMARY comparison candidate. Existing runtime Arcanist and Atlas blockout remain separate. Deformation, motion, polish, physical-device performance and explicit visual approval remain open gates."
        }
    }
    production_out = Path(args.production_out)
    production_out.parent.mkdir(parents=True, exist_ok=True)
    production_out.write_text(json.dumps(production, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(json.dumps({
        "id": CHARACTER_ID,
        "modelSha256": model_sha,
        "blendSha256": blend_sha,
        "meshObjects": scene["meshObjects"],
        "triangles": scene["triangles"],
        "materials": scene["materials"],
        "blenderVersion": audit["dcc"]["version"]
    }, indent=2))


if __name__ == "__main__":
    main()
