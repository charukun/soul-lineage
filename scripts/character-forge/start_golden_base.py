"""Idempotent, pinned upstream intake of the actual supplied Golden Base sheet.

Only initializes or resumes the real upstream state. It never marks a pass done,
approves a likeness, invents rig evidence or invokes the legacy generator.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "packages/assets/forge"))
from upstream_workspace import install_boundary, initialize, next_step, verify_sources
from prepare_golden_base_views import prepare, sha256


def start(workspace: Path, cache: Path) -> int:
    source = ROOT / "scripts/character-forge/fixtures/golden-base-v1"
    sheet = source / "turnaround.png"
    if workspace.exists():
        job = verify_sources(workspace)
        if job["id"] != "golden-base-v1" or job["provenance"] != json.loads((source / "provenance.json").read_text()):
            raise ValueError("Existing upstream workspace belongs to another character or provenance")
        return next_step(install_boundary(cache, cache / "host"), workspace)
    record = prepare(sheet, source)
    if len({row["sha256"] for row in record["views"].values()}) != 3:
        raise ValueError("Front/side/back sheet views are not independently readable")
    for name, row in record["views"].items():
        if sha256(source / (name + ".png")) != row["sha256"]:
            raise ValueError("The observed Golden Base view changed after crop")
    args = argparse.Namespace(id="golden-base-v1", name="Golden Base v1",
                              front=str(source / "front.png"), side=str(source / "side.png"),
                              back=str(source / "back.png"), front34=None, back34=None, top=None,
                              provenance=str(source / "provenance.json"))
    return initialize(args, install_boundary(cache, cache / "host"), workspace)


if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--workspace", type=Path, required=True)
    p.add_argument("--cache", type=Path, default=ROOT / ".cache/character-forge-upstream")
    opts = p.parse_args()
    raise SystemExit(start(opts.workspace.resolve(), opts.cache.resolve()))
