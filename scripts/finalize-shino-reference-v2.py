#!/usr/bin/env python3
"""Create integrity + Character Production manifest for generated Shino Reference v2."""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", required=True)
    parser.add_argument("--blend", required=True)
    parser.add_argument("--audit", required=True)
    parser.add_argument("--build", required=True)
    parser.add_argument("--integrity-out", required=True)
    parser.add_argument("--production-out", required=True)
    args = parser.parse_args()

    model = Path(args.model)
    blend = Path(args.blend)
    audit = json.loads(Path(args.audit).read_text(encoding="utf-8"))
    build = json.loads(Path(args.build).read_text(encoding="utf-8"))
    digest = sha256(model)
    blend_digest = sha256(blend)

    if not all(audit.get("checks", {}).values()):
        raise SystemExit("Blender audit is not clean")
    surfaces = build.get("surfaces", {})
    for key in ("skin", "hair", "clothing"):
        if surfaces.get(key, 0) < 1:
            raise SystemExit(f"Missing required surface family: {key}")

    integrity = {
        "schema": "character-asset-integrity",
        "version": 1,
        "id": "shino.reference.v2",
        "assetId": "character.shino-reference-v2.dcc.v1",
        "format": "vrm",
        "path": "./simulator/assets/SHINO_REFERENCE_V2.vrm",
        "sha256": digest,
        "bytes": model.stat().st_size,
        "productionStage": "PRIMARY",
        "modelingMode": "dcc-blender",
        "sourceBlendSha256": blend_digest,
        "humanoidRig": "humanoid.shino-vrm1.v2",
        "referencePath": "docs/characters/references/shino/shino-character-reference-sheet-v2.png",
        "visualApproval": "pending",
        "license": {
            "rigProvenance": "Sendagaya_Shino audited source / VRM Public License 1.0 metadata",
            "surfaceAuthorship": "RINNE Character Production Pipeline original DCC surfaces"
        }
    }

    production = {
        "schema": "character-production",
        "version": 2,
        "id": "shino.reference.v2",
        "stage": "PRIMARY",
        "modelingMode": "dcc-blender",
        "source": {
            "referencePaths": ["docs/characters/references/shino/shino-character-reference-sheet-v2.png"],
            "meshPath": "apps/rinne/public/simulator/assets/SHINO_REFERENCE_V2.vrm",
            "integrityPath": "apps/rinne/public/simulator/assets/SHINO_REFERENCE_V2.asset.json",
            "dcc": {
                "tool": "Blender",
                "version": audit.get("dcc", {}).get("version", "unknown"),
                "sourcePath": "assets/characters/shino/reference-v2/source/ShinoReferenceV2.blend",
                "sourceSha256": blend_digest
            }
        },
        "evidence": {
            "reference": {
                "intentLocked": True,
                "views": ["front", "side", "back"]
            },
            "blockout": {
                "views": ["front", "side", "back", "three-quarter"],
                "proportionsReviewed": True,
                "silhouetteReviewed": True,
                "reviewEvidence": "docs/characters/qa/shino-reference-v2/"
            },
            "primary": {
                "topologyReviewed": audit["checks"].get("noDegeneratePolygons") is True,
                "uvReviewed": audit["checks"].get("hasUVs") is True,
                "separateSurfaces": ["skin", "hair", "clothing"],
                "auditPath": "docs/characters/qa/shino-reference-v2/blender-audit.json",
                "meshObjects": audit.get("scene", {}).get("meshObjects"),
                "triangles": audit.get("scene", {}).get("triangles"),
                "materials": audit.get("scene", {}).get("materials")
            }
        },
        "status": {
            "visualApproval": "pending",
            "productionReady": False,
            "note": "Dedicated Blender DCC PRIMARY asset. Secondary-form, deformation, motion, polish, device performance and explicit visual approval remain open gates."
        }
    }

    integrity_path = Path(args.integrity_out)
    production_path = Path(args.production_out)
    integrity_path.parent.mkdir(parents=True, exist_ok=True)
    production_path.parent.mkdir(parents=True, exist_ok=True)
    integrity_path.write_text(json.dumps(integrity, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    production_path.write_text(json.dumps(production, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"sha256": digest, "bytes": model.stat().st_size, "stage": "PRIMARY"}, indent=2))


if __name__ == "__main__":
    main()
